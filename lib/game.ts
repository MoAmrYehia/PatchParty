import { type ActiveRule } from "./rules.ts";
export const WIDTH = 960, HEIGHT = 540, FLOOR = 466, CEILING = 86, RUN_SECONDS = 180;
export type Platform = { x: number; y: number; w: number };
export const PLATFORMS: Platform[] = [{ x: 172, y: 374, w: 150 }, { x: 407, y: 286, w: 146 }, { x: 646, y: 374, w: 150 }];
export type Input = { left: boolean; right: boolean; jump: boolean };
export type World = {
  phase: "ready" | "running" | "paused" | "won" | "lost";
  elapsed: number; score: number; collected: number; health: number; patchCount: number;
  player: { x: number; y: number; vx: number; vy: number; grounded: boolean; invincible: number; facing: number };
  enemies: { x: number; y: number; vx: number; lane: number }[];
  sparks: { x: number; y: number; alive: boolean; respawnAt: number }[];
  active: ActiveRule[]; jumpWasDown: boolean; seed: number;
};
export function createWorld(): World {
  return { phase: "ready", elapsed: 0, score: 0, collected: 0, health: 5, patchCount: 0, seed: 1,
    player: { x: 480, y: FLOOR - 20, vx: 0, vy: 0, grounded: true, invincible: 0, facing: 1 },
    enemies: [{ x: 120, y: FLOOR - 17, vx: 82, lane: 0 }, { x: 824, y: FLOOR - 17, vx: -97, lane: 0 }, { x: 490, y: 268, vx: 61, lane: 1 }],
    sparks: [{ x: 85, y: 426 }, { x: 248, y: 336 }, { x: 480, y: 246 }, { x: 721, y: 336 }, { x: 873, y: 426 }].map(s => ({ ...s, alive: true, respawnAt: 0 })),
    active: [], jumpWasDown: false };
}
export function hasRule(world: World, id: string) { return world.active.some(a => a.id === id && a.expiresAt > world.elapsed); }
export function gravitySign(world: World) {
  const flip = world.active.find(a => a.id === "reverse-gravity" && a.expiresAt > world.elapsed);
  return flip && Math.floor((world.elapsed - flip.appliedAt) / 5) % 2 === 0 ? -1 : 1;
}
export function stepWorld(w: World, input: Input, dt: number): void {
  if (w.phase !== "running") return;
  dt = Math.min(Math.max(dt, 0), 1 / 30);
  w.elapsed = Math.min(RUN_SECONDS, w.elapsed + dt);
  w.active = w.active.filter(a => a.expiresAt > w.elapsed);
  const p = w.player, sign = gravitySign(w), size = hasRule(w, "tiny-player") ? 0.6 : 1;
  const half = 18 * size, target = (Number(input.right) - Number(input.left)) * (hasRule(w, "speed-boost") ? 380 : 240);
  p.vx += (target - p.vx) * Math.min(1, (hasRule(w, "ice-floor") ? 1.8 : 16) * dt);
  if (Math.abs(p.vx) > 10) p.facing = Math.sign(p.vx);
  if (input.jump && !w.jumpWasDown && p.grounded) { p.vy = -sign * (hasRule(w, "super-jump") ? 740 : 550); p.grounded = false; }
  w.jumpWasDown = input.jump;
  const oldY = p.y;
  p.vy += sign * (hasRule(w, "low-gravity") ? 560 : 1400) * dt;
  p.x = Math.max(half + 22, Math.min(WIDTH - half - 22, p.x + p.vx * dt));
  p.y += p.vy * dt; p.grounded = false;
  if (p.y + half >= FLOOR) { p.y = FLOOR - half; if (p.vy >= 0) p.vy = 0; if (sign > 0) p.grounded = true; }
  if (p.y - half <= CEILING) { p.y = CEILING + half; if (p.vy <= 0) p.vy = 0; if (sign < 0) p.grounded = true; }
  for (const plat of PLATFORMS) {
    if (p.x + half > plat.x && p.x - half < plat.x + plat.w) {
      if (sign > 0 && p.vy >= 0 && oldY + half <= plat.y + 3 && p.y + half >= plat.y) { p.y = plat.y - half; p.vy = 0; p.grounded = true; }
      if (sign < 0 && p.vy <= 0 && oldY - half >= plat.y + 11 && p.y - half <= plat.y + 14) { p.y = plat.y + 14 + half; p.vy = 0; p.grounded = true; }
    }
  }
  p.invincible = Math.max(0, p.invincible - dt);
  for (const e of w.enemies) {
    e.x += e.vx * dt;
    const min = e.lane ? 414 : 46, max = e.lane ? 546 : 914;
    if (e.x < min || e.x > max) { e.x = Math.max(min, Math.min(max, e.x)); e.vx *= -1; }
    const radius = hasRule(w, "giant-enemies") ? 27 : 17;
    if (Math.abs(p.x - e.x) < half + radius - 4 && Math.abs(p.y - e.y) < half + radius - 4 && p.invincible <= 0 && !hasRule(w, "shield")) {
      w.health--; p.invincible = 2; p.vy = -sign * 310; p.vx += p.x > e.x ? 150 : -150;
    }
  }
  for (const s of w.sparks) {
    if (!s.alive && w.elapsed > s.respawnAt) s.alive = true;
    if (s.alive && Math.hypot(p.x - s.x, p.y - s.y) < half + 15) { s.alive = false; s.respawnAt = w.elapsed + 9; w.collected++; }
  }
  w.score = Math.floor(w.elapsed) * 5 + w.collected * 100;
  if (w.health <= 0) w.phase = "lost";
  else if (w.elapsed >= RUN_SECONDS) w.phase = "won";
}
export function formatTime(seconds: number) {
  const n = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(n / 60).toString().padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`;
}
