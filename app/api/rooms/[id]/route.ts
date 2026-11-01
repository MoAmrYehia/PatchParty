import { env } from "cloudflare:workers";
import { bearer, hashSecret, json, sameOrigin, snapshotSchema } from "../../../../lib/room-server";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  if (!env.DB) return json({ error: "Stage relay unavailable." }, 503);
  const { id } = await context.params, key = bearer(request);
  if (!key || !/^[\w-]{36}$/.test(id)) return json({ error: "Stage room not found." }, 404);
  const room = await env.DB.prepare("SELECT snapshot, updated_at FROM rooms WHERE id = ? AND read_hash = ? AND expires_at > ?").bind(id, await hashSecret(key), Date.now()).first<{ snapshot: string; updated_at: number }>();
  if (!room) return json({ error: "Stage room expired or link invalid." }, 404);
  return json({ snapshot: JSON.parse(room.snapshot), updatedAt: room.updated_at });
}
export async function PUT(request: Request, context: Context) {
  if (!sameOrigin(request)) return json({ error: "Origin rejected." }, 403);
  if (!env.DB) return json({ error: "Stage relay unavailable." }, 503);
  const { id } = await context.params, key = bearer(request);
  if (!key || !/^[\w-]{36}$/.test(id)) return json({ error: "Room not found." }, 404);
  if (Number(request.headers.get("content-length") || 0) > 16000) return json({ error: "Snapshot too large." }, 413);
  const raw = await request.text(); if (raw.length > 16000) return json({ error: "Snapshot too large." }, 413);
  let parsed; try { parsed = snapshotSchema.safeParse(JSON.parse(raw)); } catch { return json({ error: "Invalid snapshot." }, 400); }
  if (!parsed.success) return json({ error: "Invalid snapshot." }, 400);
  const result = await env.DB.prepare("UPDATE rooms SET snapshot = ?, updated_at = ? WHERE id = ? AND host_hash = ? AND expires_at > ?").bind(JSON.stringify(parsed.data), Date.now(), id, await hashSecret(key), Date.now()).run();
  if (!result.meta.changes) return json({ error: "Room expired or host access denied." }, 403);
  return json({ ok: true });
}
