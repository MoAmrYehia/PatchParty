import { z } from "zod";
import { RULES } from "./rules.ts";
const finite = z.number().finite();
export const snapshotSchema = z.object({
  phase: z.enum(["ready", "running", "paused", "won", "lost"]),
  elapsed: finite.min(0).max(181), score: finite.min(0).max(1000000), collected: finite.min(0).max(10000), health: finite.min(0).max(5), patchCount: finite.min(0).max(10000), seed: finite,
  jumpWasDown: z.boolean(),
  player: z.object({ x: finite.min(-100).max(1060), y: finite.min(-100).max(640), vx: finite, vy: finite, grounded: z.boolean(), invincible: finite, facing: finite }),
  enemies: z.array(z.object({ x: finite, y: finite, vx: finite, lane: finite })).max(8),
  sparks: z.array(z.object({ x: finite, y: finite, alive: z.boolean(), respawnAt: finite })).max(12),
  active: z.array(z.object({ id: z.string().refine(id => RULES.some(r => r.id === id)), author: z.string().max(32), appliedAt: finite, expiresAt: finite })).max(4),
});
export async function hashSecret(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, "0")).join("");
}
export function bearer(request: Request) { return request.headers.get("authorization")?.replace(/^Bearer /, "") || ""; }
export function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }); }
export function sameOrigin(request: Request) { return !request.headers.get("origin") || request.headers.get("origin") === new URL(request.url).origin; }
