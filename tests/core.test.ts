import test from "node:test";
import assert from "node:assert/strict";
import { applyRule, interpretPatch, queueProposal, type Proposal, type RuleId } from "../lib/rules.ts";
import { createWorld, FLOOR, gravitySign, RUN_SECONDS, stepWorld, type World } from "../lib/game.ts";
import { hashSecret, sameOrigin, snapshotSchema } from "../lib/room-server.ts";
import { randomId } from "../lib/id.ts";

const input = { left: false, right: false, jump: false };
function run(w: World, seconds: number, keys = input) { for (let i = 0; i < Math.round(seconds * 120); i++) stepWorld(w, keys, 1 / 120); }
function safeWorld() { const w = createWorld(); w.phase = "running"; w.enemies = []; return w; }

test("all advertised phrases resolve to supported mechanics", () => {
  const examples: [string, RuleId][] = [["!patch reverse gravity every 5 seconds", "reverse-gravity"], ["!patch moon gravity", "low-gravity"], ["!patch make the floor slippery", "ice-floor"], ["!patch run faster", "speed-boost"], ["!patch make the player tiny", "tiny-player"], ["!patch giant drones", "giant-enemies"], ["!patch super jump", "super-jump"], ["!patch give us a shield", "shield"]];
  for (const [text, id] of examples) assert.equal(interpretPatch(text), id);
  assert.equal(interpretPatch("!patch remove gravity"), null);
  assert.equal(interpretPatch("!patch don't add ice"), null);
  assert.equal(interpretPatch("!patch fetch('/secrets')"), null);
  assert.equal(interpretPatch("!patch launch a new unsupported mechanic"), null);
});
test("gravity patches replace each other without mutating undo snapshots", () => {
  const old = applyRule([], "low-gravity", "first", 0), next = applyRule(old, "reverse-gravity", "second", 4);
  assert.equal(old[0].id, "low-gravity"); assert.equal(next.length, 1); assert.equal(next[0].id, "reverse-gravity"); assert.equal(next[0].expiresAt, 49);
});
test("expiry, rule cap, and author length are bounded", () => {
  let a = applyRule([], "shield", "a".repeat(100), 0); assert.equal(a[0].author.length, 32);
  a = applyRule(a, "low-gravity", "a", 21); assert.equal(a.length, 1);
  for (const id of ["speed-boost", "tiny-player", "giant-enemies", "super-jump"] as RuleId[]) a = applyRule(a, id, "a", 22);
  assert.equal(a.length, 4); assert.equal(a.some(r => r.id === "low-gravity"), false);
});
test("proposal cooldown is case insensitive and queue is capped", () => {
  const recent = new Map<string, number>(), p: Proposal = { id: "1", ruleId: "shield", user: "Viewer", text: "shield", team: "builder", receivedAt: 1000, source: "twitch" };
  assert.equal(queueProposal([], p, recent, 1000).accepted, true);
  assert.equal(queueProposal([], { ...p, user: "viewer" }, recent, 2000).accepted, false);
  assert.equal(queueProposal([], p, recent, 31000).accepted, true);
  assert.equal(queueProposal(Array(12).fill(p), { ...p, user: "other" }, recent, 32000).accepted, false);
});
test("ready, paused, and terminal worlds never advance", () => {
  const w = createWorld(); run(w, 1); assert.equal(w.elapsed, 0);
  w.phase = "paused"; run(w, 1); assert.equal(w.elapsed, 0);
  w.phase = "lost"; run(w, 1); assert.equal(w.elapsed, 0);
});
test("jump rises and lands on the floor with deterministic movement", () => {
  const w = safeWorld(); w.player.x = 80; stepWorld(w, { ...input, jump: true }, 1 / 120); assert.ok(w.player.vy < 0);
  run(w, 2); assert.equal(w.player.y, FLOOR - 18); assert.equal(w.player.grounded, true);
  const a = safeWorld(), b = safeWorld(); run(a, 2, { ...input, right: true }); run(b, 2, { ...input, right: true }); assert.deepEqual(a, b); assert.ok(a.player.x <= 920);
});
test("reverse gravity alternates every five seconds and expires", () => {
  const w = safeWorld(); w.active = applyRule([], "reverse-gravity", "test", 0);
  assert.equal(gravitySign(w), -1); run(w, 1); assert.ok(w.player.y < FLOOR - 20);
  w.elapsed = 5.1; assert.equal(gravitySign(w), 1); w.elapsed = 10.1; assert.equal(gravitySign(w), -1);
  w.elapsed = 46; stepWorld(w, input, 1 / 120); assert.equal(w.active.length, 0); assert.equal(gravitySign(w), 1);
});
test("ice retains momentum, speed increases velocity, and low gravity extends a jump", () => {
  const base = safeWorld(), ice = safeWorld(); ice.active = applyRule([], "ice-floor", "test", 0);
  base.player.vx = ice.player.vx = 240; run(base, .2); run(ice, .2); assert.ok(ice.player.vx > base.player.vx);
  const speed = safeWorld(), normal = safeWorld(); speed.active = applyRule([], "speed-boost", "test", 0); run(speed, .5, { ...input, right: true }); run(normal, .5, { ...input, right: true }); assert.ok(speed.player.x > normal.player.x);
  const moon = safeWorld(), earth = safeWorld(); moon.active = applyRule([], "low-gravity", "test", 0); run(moon, .35, { ...input, jump: true }); run(earth, .35, { ...input, jump: true }); assert.ok(moon.player.y < earth.player.y);
});
test("shield prevents contact damage and immunity blocks repeat hits", () => {
  const w = createWorld(); w.phase = "running"; w.enemies[0].x = w.player.x; w.enemies[0].y = w.player.y; w.enemies[0].vx = 0;
  w.active = applyRule([], "shield", "test", 0); stepWorld(w, input, 1 / 120); assert.equal(w.health, 5);
  w.active = []; stepWorld(w, input, 1 / 120); assert.equal(w.health, 4); stepWorld(w, input, 1 / 120); assert.equal(w.health, 4);
});
test("sparks score once and respawn; a three minute run wins", () => {
  const w = safeWorld(); w.player.x = w.sparks[0].x; w.player.y = w.sparks[0].y; stepWorld(w, input, 1 / 120); assert.equal(w.collected, 1); assert.equal(w.sparks[0].alive, false); assert.equal(w.score, 100);
  w.player.x = 950; run(w, 10); assert.equal(w.sparks[0].alive, true);
  w.elapsed = RUN_SECONDS - .001; stepWorld(w, input, 1 / 120); assert.equal(w.phase, "won"); assert.equal(w.elapsed, RUN_SECONDS);
});
test("zero health ends the run", () => { const w = safeWorld(); w.health = 0; stepWorld(w, input, 1 / 120); assert.equal(w.phase, "lost"); });
test("stage accepts only bounded game state and strips unrelated fields", () => {
  const w = createWorld(); assert.equal(snapshotSchema.safeParse(w).success, true);
  assert.equal(snapshotSchema.safeParse({ ...w, active: [{ id: "execute-code", author: "x", appliedAt: 0, expiresAt: 1 }] }).success, false);
  assert.equal(snapshotSchema.safeParse({ ...w, health: 100 }).success, false);
  assert.equal(snapshotSchema.safeParse({ ...w, enemies: Array(50).fill(w.enemies[0]) }).success, false);
  assert.equal("access_token" in snapshotSchema.parse({ ...w, access_token: "do-not-store" }), false);
});
test("room secrets are hashed and cross origin writes are rejected", async () => {
  const a = await hashSecret("read-key"), b = await hashSecret("host-key"); assert.equal(a.length, 64); assert.notEqual(a, b); assert.equal(a, await hashSecret("read-key"));
  assert.equal(sameOrigin(new Request("https://example.test/api/rooms", { headers: { Origin: "https://other.test" } })), false);
  assert.equal(sameOrigin(new Request("https://example.test/api/rooms", { headers: { Origin: "https://example.test" } })), true);
});
test("client event IDs are unique UUIDs", () => { const ids = Array.from({ length: 100 }, randomId); assert.equal(new Set(ids).size, 100); assert.match(ids[0], /^[0-9a-f-]{36}$/); });
