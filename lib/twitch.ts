import { randomId } from "./id.ts";
import { APP_BASE_PATH, appRoot } from "./hosting.ts";
export type TwitchMessage = { id: string; user: string; text: string };
export type TwitchStatus = "connecting" | "connected" | "reconnecting" | "disconnected";
export const TWITCH_SCOPE = "user:read:chat";
const WS_URL = "wss://eventsub.wss.twitch.tv/ws";

export function twitchAuthorizationUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL("https://id.twitch.tv/oauth2/authorize");
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "token", scope: TWITCH_SCOPE, state }).toString();
  return url.href;
}

export function authorizeTwitch(clientId: string) {
  if (!/^[a-zA-Z0-9]{10,64}$/.test(clientId)) throw new Error("Enter the client ID from your registered Twitch application.");
  const state = randomId();
  sessionStorage.setItem("pp-oauth-state", state);
  sessionStorage.setItem("pp-oauth-start", String(Date.now()));
  localStorage.setItem("pp-client-id", clientId);
  location.assign(twitchAuthorizationUrl(clientId, appRoot(), state));
}

/** Token remains in memory. Never persist it or send it to the app server. */
export function consumeTwitchCallback(): string | null {
  const params = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  if (query.has("error")) { history.replaceState(null, "", APP_BASE_PATH); throw new Error("Twitch authorization was cancelled. Demo mode is still available."); }
  const token = params.get("access_token");
  if (!token) return null;
  history.replaceState(null, "", APP_BASE_PATH);
  const expected = sessionStorage.getItem("pp-oauth-state"), started = Number(sessionStorage.getItem("pp-oauth-start") || 0);
  sessionStorage.removeItem("pp-oauth-state"); sessionStorage.removeItem("pp-oauth-start");
  if (!expected || params.get("state") !== expected || Date.now() - started > 600_000) throw new Error("Twitch authorization could not be verified. Please connect again.");
  return token;
}

export class TwitchConnection {
  private token: string;
  private clientId: string;
  private socket: WebSocket | null = null;
  private nextSocket: WebSocket | null = null;
  private stopped = false;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private validation: ReturnType<typeof setInterval> | undefined;
  private attempts = 0;
  private userId = "";
  private seen = new Set<string>();
  private onMessage: (message: TwitchMessage) => void;
  private onStatus: (status: TwitchStatus, message: string) => void;
  constructor(token: string, clientId: string, onMessage: (message: TwitchMessage) => void, onStatus: (status: TwitchStatus, message: string) => void) { this.token = token; this.clientId = clientId; this.onMessage = onMessage; this.onStatus = onStatus; }
  private async validate() {
    const response = await fetch("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${this.token}` }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("Your Twitch authorization expired. Connect again.");
    const data = await response.json() as { client_id: string; user_id: string; login: string; scopes: string[] };
    if (data.client_id !== this.clientId || !data.scopes.includes(TWITCH_SCOPE)) throw new Error("Twitch client ID or chat permission does not match. Connect again.");
    this.userId = data.user_id; return data;
  }
  async connect() {
    this.onStatus("connecting", "Authorizing Twitch…");
    try {
      const user = await this.validate();
      if (this.stopped) return;
      this.onStatus("connecting", `Connecting to #${user.login}…`); this.open(WS_URL, false);
      this.validation = setInterval(() => { void this.validate().catch(e => this.fail((e as Error).message)); }, 3_600_000);
    } catch (e) { if (!this.stopped) this.fail((e as Error).message); }
  }
  private armKeepalive(seconds: number) {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => { this.socket?.close(); }, (seconds + 5) * 1000);
  }
  private open(url: string, transfer: boolean) {
    if (this.stopped) return;
    const target = new URL(url);
    if (target.origin !== "wss://eventsub.wss.twitch.tv" || Boolean(target.username || target.password)) { this.fail("Twitch returned an invalid reconnect address."); return; }
    const ws = new WebSocket(url);
    if (transfer) this.nextSocket = ws; else this.socket = ws;
    let keepalive = 10;
    ws.onmessage = async message => {
      if (this.stopped) return;
      try {
        const envelope = JSON.parse(String(message.data));
        const kind = envelope.metadata?.message_type, payload = envelope.payload;
        if (kind === "session_welcome") {
          keepalive = payload.session.keepalive_timeout_seconds || 10;
          if (transfer) { const old = this.socket; this.socket = ws; this.nextSocket = null; old?.close(); }
          else {
            const response = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", { method: "POST", headers: { Authorization: `Bearer ${this.token}`, "Client-Id": this.clientId, "Content-Type": "application/json" }, body: JSON.stringify({ type: "channel.chat.message", version: "1", condition: { broadcaster_user_id: this.userId, user_id: this.userId }, transport: { method: "websocket", session_id: payload.session.id } }), signal: AbortSignal.timeout(8000) });
            if (!response.ok) throw new Error(`Twitch chat subscription failed (${response.status}). Reconnect and check your app permissions.`);
          }
          this.attempts = 0; this.onStatus("connected", "Live Twitch chat connected");
        } else if (kind === "session_reconnect") {
          this.onStatus("reconnecting", "Twitch is moving the connection…"); this.open(payload.session.reconnect_url, true);
        } else if (kind === "notification") {
          const id = envelope.metadata.message_id;
          if (!this.seen.has(id)) {
            this.seen.add(id); if (this.seen.size > 1000) this.seen.delete(this.seen.values().next().value!);
            const event = payload.event; this.onMessage({ id, user: event.chatter_user_login || event.chatter_user_name, text: event.message.text });
          }
        } else if (kind === "revocation") throw new Error("Twitch revoked chat access. Connect again.");
        if (ws === this.socket) this.armKeepalive(keepalive);
      } catch (e) { this.fail((e as Error).message); }
    };
    ws.onclose = () => {
      if (this.stopped || (ws !== this.socket && ws !== this.nextSocket)) return;
      clearTimeout(this.timeout);
      if (this.attempts >= 5) { this.fail("Twitch disconnected. Reconnect when your network is ready."); return; }
      this.onStatus("reconnecting", "Reconnecting to Twitch…");
      this.retry = setTimeout(() => this.open(WS_URL, false), Math.min(1000 * 2 ** this.attempts++, 20_000));
    };
    ws.onerror = () => { ws.close(); };
  }
  private fail(message: string) { this.disconnect(); this.onStatus("disconnected", message); }
  disconnect() { this.stopped = true; clearTimeout(this.timeout); clearTimeout(this.retry); clearInterval(this.validation); this.socket?.close(); this.nextSocket?.close(); this.token = ""; }
}
