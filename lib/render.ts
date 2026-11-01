import { type World, WIDTH, HEIGHT, FLOOR, CEILING, PLATFORMS, hasRule, gravitySign } from "./game.ts";
function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) { c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }
export function renderWorld(c: CanvasRenderingContext2D, w: World, time: number, reduceMotion = false) {
  const t = reduceMotion ? 0 : time, ice = hasRule(w, "ice-floor"), flipped = gravitySign(w) < 0;
  c.clearRect(0, 0, WIDTH, HEIGHT);
  const sky = c.createLinearGradient(0, 0, 0, HEIGHT); sky.addColorStop(0, "#17112b"); sky.addColorStop(.65, "#2c2043"); sky.addColorStop(1, "#352347");
  c.fillStyle = sky; c.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = c.createRadialGradient(495, 235, 10, 495, 235, 420); glow.addColorStop(0, "#9d6ee51a"); glow.addColorStop(1, "#9d6ee500"); c.fillStyle = glow; c.fillRect(0, 0, WIDTH, HEIGHT);
  for (let i = 0; i < 30; i++) { const x = (i * 97 + 23) % WIDTH, y = (i * 71 + 31) % 330; c.fillStyle = `rgba(215,197,255,${.15 + (i % 3) * .12})`; c.fillRect(x, y, i % 4 === 0 ? 3 : 2, 2); }
  c.save(); c.translate(778, 133); c.rotate(-.28); c.strokeStyle = "#b5a2e522"; c.lineWidth = 1; c.beginPath(); c.ellipse(0, 0, 82, 25, 0, 0, Math.PI * 2); c.stroke();
  const moon = c.createLinearGradient(-38, -38, 38, 38); moon.addColorStop(0, "#bfa2eb"); moon.addColorStop(1, "#5a3d85"); c.fillStyle = moon; c.beginPath(); c.arc(0, 0, 38, 0, Math.PI * 2); c.fill(); c.strokeStyle = "#bd9eea88"; c.beginPath(); c.ellipse(0, 0, 82, 25, 0, 0, Math.PI); c.stroke(); c.restore();
  for (let i = 0; i < 17; i++) {
    const h = 55 + (i * 47) % 142, x = i * 64 - 22; box(c, x, FLOOR - h, 45, h, 3, "#20172f");
    for (let j = 0; j < Math.floor(h / 22); j++) { c.fillStyle = (i + j) % 3 ? "#6e528026" : "#b58bd22c"; c.fillRect(x + 9, FLOOR - h + 13 + j * 21, 6, 5); c.fillRect(x + 26, FLOOR - h + 13 + j * 21, 6, 5); }
  }
  c.strokeStyle = flipped ? "#e9adff66" : "#9c7bb429"; c.setLineDash([5, 8]); c.beginPath(); c.moveTo(24, CEILING); c.lineTo(936, CEILING); c.stroke(); c.setLineDash([]);
  c.fillStyle = ice ? "#81d5e322" : "#b68cdb11"; c.fillRect(0, FLOOR, WIDTH, HEIGHT - FLOOR);
  c.strokeStyle = ice ? "#b4f3fb99" : "#8f69b355"; c.lineWidth = 2; c.beginPath(); c.moveTo(0, FLOOR); c.lineTo(WIDTH, FLOOR); c.stroke();
  c.lineWidth = 1; c.strokeStyle = "#ab86cc16";
  for (let x = -300; x < 1400; x += 90) { c.beginPath(); c.moveTo(480 + (x - 480) * .6, FLOOR); c.lineTo(x, HEIGHT); c.stroke(); }
  for (let y = FLOOR + 10; y < HEIGHT; y += (y - FLOOR) * .6 + 7) { c.beginPath(); c.moveTo(0, y); c.lineTo(WIDTH, y); c.stroke(); }
  for (const p of PLATFORMS) {
    c.fillStyle = "#00000020"; c.beginPath(); c.ellipse(p.x + p.w / 2, FLOOR + 5, p.w / 2 - 12, 5, 0, 0, Math.PI * 2); c.fill();
    box(c, p.x, p.y, p.w, 16, 5, "#594070"); box(c, p.x, p.y, p.w, 5, 3, ice ? "#a6e5ed" : "#c1a3e7"); box(c, p.x + 10, p.y + 16, p.w - 20, 8, 3, "#352443");
    c.strokeStyle = "#d4b1f244"; c.beginPath(); c.moveTo(p.x + 12, p.y + 26); c.lineTo(p.x + 12, p.y + 36); c.moveTo(p.x + p.w - 12, p.y + 26); c.lineTo(p.x + p.w - 12, p.y + 36); c.stroke();
  }
  for (let i = 0; i < w.sparks.length; i++) {
    const s = w.sparks[i]; if (!s.alive) continue; const y = s.y + Math.sin(t * 2.5 + i) * 4;
    c.save(); c.translate(s.x, y); c.shadowBlur = 17; c.shadowColor = "#c2f5b8"; c.fillStyle = "#cdf4a1"; c.beginPath(); c.moveTo(0, -10); c.lineTo(7, 0); c.lineTo(0, 10); c.lineTo(-7, 0); c.closePath(); c.fill(); c.fillStyle = "#f5ffdf"; c.fillRect(-1, -4, 2, 6); c.restore();
  }
  const giant = hasRule(w, "giant-enemies");
  for (const e of w.enemies) {
    c.save(); c.translate(e.x, e.y + Math.sin(t * 4 + e.x) * 2); const s = giant ? 1.6 : 1; c.scale(s, s);
    c.fillStyle = "#100d1a66"; c.beginPath(); c.ellipse(0, 17, 19, 4, 0, 0, Math.PI * 2); c.fill();
    box(c, -16, -14, 32, 28, 9, "#e98d70"); box(c, -18, -6, 36, 16, 5, "#faad84"); box(c, -12, -7, 24, 12, 4, "#57364a"); c.fillStyle = "#ffefc6"; c.fillRect(-7, -3, 4, 4); c.fillRect(3, -3, 4, 4);
    c.strokeStyle = "#fcbe98"; c.lineWidth = 2; c.beginPath(); c.moveTo(-12, -13); c.lineTo(-17, -21); c.moveTo(12, -13); c.lineTo(17, -21); c.stroke(); c.restore();
  }
  const p = w.player, size = hasRule(w, "tiny-player") ? .6 : 1;
  c.save(); c.translate(p.x, p.y); c.scale(size * p.facing, size * (flipped ? -1 : 1)); if (p.invincible > 0 && Math.floor(t * 14) % 2) c.globalAlpha = .45;
  if (hasRule(w, "shield")) { c.strokeStyle = "#a6e8dcaa"; c.fillStyle = "#a6e8dc16"; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 33 + Math.sin(t * 4) * 2, 0, Math.PI * 2); c.fill(); c.stroke(); }
  box(c, -14, -17, 28, 31, 8, "#c8a2fd"); box(c, -16, -10, 32, 17, 5, "#e2caff"); box(c, -10, -8, 25, 12, 4, "#443250"); c.fillStyle = "#fff2fd"; c.fillRect(-5, -4, 4, 4); c.fillRect(6, -4, 4, 4);
  box(c, -10, 12, 8, 7, 2, "#9675bd"); box(c, 4, 12, 8, 7, 2, "#9675bd"); box(c, -21, -3, 6, 14, 2, "#9a79c1");
  c.strokeStyle = "#d8baff"; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -17); c.lineTo(0, -24); c.stroke(); c.fillStyle = "#d6faa8"; c.beginPath(); c.arc(0, -26, 3, 0, Math.PI * 2); c.fill(); c.restore();
  if (w.phase === "ready") { c.fillStyle = "#d2b9ef88"; c.font = "11px ui-monospace, monospace"; c.textAlign = "center"; c.fillText("YOUR LITTLE SURVIVOR", 480, 412); c.beginPath(); c.moveTo(480, 419); c.lineTo(480, 428); c.strokeStyle = "#d2b9ef55"; c.stroke(); }
}
