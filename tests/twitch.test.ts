import test from "node:test";
import assert from "node:assert/strict";
import { TwitchConnection, consumeTwitchCallback } from "../lib/twitch.ts";

test("OAuth callback rejects wrong state, clears the URL and never persists a token", () => {
  const saved = new Map<string, string>([["pp-oauth-state", "expected"], ["pp-oauth-start", String(Date.now())]]);
  const original = { location: Object.getOwnPropertyDescriptor(globalThis, "location"), history: Object.getOwnPropertyDescriptor(globalThis, "history"), sessionStorage: Object.getOwnPropertyDescriptor(globalThis, "sessionStorage") };
  let cleaned = false;
  Object.defineProperty(globalThis, "location", { configurable: true, value: { hash: "#access_token=unit-token&state=wrong", search: "" } });
  Object.defineProperty(globalThis, "history", { configurable: true, value: { replaceState: () => { cleaned = true; } } });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: { getItem: (key: string) => saved.get(key) || null, removeItem: (key: string) => saved.delete(key) } });
  try { assert.throws(() => consumeTwitchCallback(), /verified/); assert.equal(cleaned, true); assert.equal(saved.size, 0); }
  finally { for (const [name, descriptor] of Object.entries(original)) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); } }
});
test("Twitch creates a real EventSub subscription, deduplicates messages, and transfers reconnects", async () => {
  const originalWs = globalThis.WebSocket, originalFetch = globalThis.fetch;
  const sockets: FakeSocket[] = [], calls: { url: string; body?: string }[] = [], received: string[] = [], statuses: string[] = [];
  class FakeSocket {
    onmessage: ((message: { data: string }) => unknown) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    closed = false;
    readonly url: string;
    constructor(url: string) { this.url = url; sockets.push(this); }
    close() { this.closed = true; this.onclose?.(); }
    async sendEvent(type: string, payload: unknown, id = "1") { await this.onmessage?.({ data: JSON.stringify({ metadata: { message_type: type, message_id: id }, payload }) }); }
  }
  globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
  globalThis.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
    calls.push({ url: String(url), body: options?.body as string | undefined });
    if (String(url).includes("validate")) return Response.json({ client_id: "testclient", user_id: "42", login: "streamer", scopes: ["user:read:chat"] });
    return Response.json({ data: [{ id: "subscription" }] }, { status: 202 });
  }) as typeof fetch;
  const c = new TwitchConnection("unit-token", "testclient", m => received.push(m.text), s => statuses.push(s));
  try {
    await c.connect(); assert.equal(sockets.length, 1);
    await sockets[0].sendEvent("session_welcome", { session: { id: "session-1", keepalive_timeout_seconds: 10 } });
    const body = JSON.parse(calls[1].body!); assert.equal(body.type, "channel.chat.message"); assert.equal(body.condition.broadcaster_user_id, "42"); assert.equal(body.condition.user_id, "42"); assert.equal(body.transport.method, "websocket"); assert.equal(body.transport.session_id, "session-1");
    const event = { event: { chatter_user_name: "viewer", message: { text: "!patch moon gravity" } } };
    await sockets[0].sendEvent("notification", event, "message-1"); await sockets[0].sendEvent("notification", event, "message-1"); assert.equal(received.length, 1);
    await sockets[0].sendEvent("session_reconnect", { session: { reconnect_url: "wss://eventsub.wss.twitch.tv/ws?session=reconnect" } });
    assert.equal(sockets.length, 2); await sockets[1].sendEvent("session_welcome", { session: { id: "session-2", keepalive_timeout_seconds: 10 } });
    assert.equal(calls.filter(x => x.url.includes("subscriptions")).length, 1); assert.equal(sockets[0].closed, true); assert.ok(statuses.includes("connected"));
    await sockets[1].sendEvent("session_reconnect", { session: { reconnect_url: "wss://attacker.test/ws" } }); assert.equal(statuses.at(-1), "disconnected");
  } finally { c.disconnect(); globalThis.WebSocket = originalWs; globalThis.fetch = originalFetch; }
});
test("a token from a different client is rejected before opening a socket", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ client_id: "wrong-client", user_id: "42", login: "streamer", scopes: ["user:read:chat"] })) as typeof fetch;
  const statuses: string[] = [], c = new TwitchConnection("unit-token", "testclient", () => {}, s => statuses.push(s));
  try { await c.connect(); assert.deepEqual(statuses, ["connecting", "disconnected"]); } finally { c.disconnect(); globalThis.fetch = originalFetch; }
});
