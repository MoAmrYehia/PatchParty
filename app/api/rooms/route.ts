import { env } from "cloudflare:workers";
import { hashSecret, json, sameOrigin } from "../../../lib/room-server";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Origin rejected." }, 403);
  if (!env.DB) return json({ error: "Stage relay is unavailable. Use game fullscreen or window capture." }, 503);
  const dev = (import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV;
  const owner = request.headers.get("oai-authenticated-user-id") || (dev ? "local-preview" : null);
  if (!owner) return json({ error: "Sign in to create a stage room." }, 401);
  const now = Date.now();
  const current = await env.DB.prepare("SELECT COUNT(*) AS n FROM rooms WHERE owner = ? AND expires_at > ?").bind(owner, now).first<{ n: number }>();
  if ((current?.n ?? 0) >= 20) return json({ error: "You already have 20 active rooms. Reuse an open studio or wait for a room to expire." }, 429);
  const id = crypto.randomUUID(), hostKey = crypto.randomUUID() + crypto.randomUUID(), readKey = crypto.randomUUID() + crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM rooms WHERE expires_at < ?").bind(now),
    env.DB.prepare("INSERT INTO rooms (id, owner, host_hash, read_hash, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, owner, await hashSecret(hostKey), await hashSecret(readKey), now, now + 6 * 3600000),
  ]);
  return json({ id, hostKey, readKey, expiresAt: now + 6 * 3600000 }, 201);
}
