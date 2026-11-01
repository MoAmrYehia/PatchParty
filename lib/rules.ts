export type Team = "builder" | "chaos";
export type RuleId = "low-gravity" | "reverse-gravity" | "ice-floor" | "speed-boost" | "tiny-player" | "giant-enemies" | "super-jump" | "shield";
export type Rule = { id: RuleId; title: string; description: string; team: Team; icon: string; group: string; duration: number };
export const RULES: Rule[] = [
  { id: "low-gravity", title: "Moon mode", description: "Gravity drops to 40%. More airtime, more possibilities.", team: "builder", icon: "moon", group: "gravity", duration: 45 },
  { id: "reverse-gravity", title: "Upside down", description: "Gravity reverses every 5 seconds. The ceiling is fair game.", team: "chaos", icon: "orbit", group: "gravity", duration: 45 },
  { id: "ice-floor", title: "Ice, ice, maybe", description: "The arena gets slippery. Momentum is your new best friend.", team: "chaos", icon: "snow", group: "friction", duration: 45 },
  { id: "speed-boost", title: "Gotta go fast", description: "Run 60% faster. Catch sparks before they disappear.", team: "builder", icon: "bolt", group: "speed", duration: 45 },
  { id: "tiny-player", title: "Small but mighty", description: "Shrink to 60% size. A smaller target is harder to hit.", team: "builder", icon: "shrink", group: "size", duration: 45 },
  { id: "giant-enemies", title: "Big trouble", description: "The drones grow to 1.6× size. Give them some space.", team: "chaos", icon: "ghost", group: "enemy", duration: 45 },
  { id: "super-jump", title: "Sky's the limit", description: "Jump 35% higher. Those top platforms are calling.", team: "builder", icon: "up", group: "jump", duration: 45 },
  { id: "shield", title: "Bubble buddy", description: "A shield blocks drone damage for the next 20 seconds.", team: "builder", icon: "shield", group: "shield", duration: 20 },
];
export type Proposal = { id: string; ruleId: RuleId; user: string; text: string; team: Team; receivedAt: number; source: "demo" | "twitch" | "local" };
export type ActiveRule = { id: RuleId; author: string; appliedAt: number; expiresAt: number };
export const getRule = (id: RuleId) => RULES.find(r => r.id === id)!;

/** Bounded phrase interpreter. No model or arbitrary code is run. */
export function interpretPatch(text: string): RuleId | null {
  const t = text.replace(/^!patch\s*/i, "").trim().toLowerCase().slice(0, 240);
  if (!t || /\b(no|not|don't|dont|disable|remove|cancel|stop)\b/.test(t)) return null;
  if (/reverse.*gravity|flip.*gravity|gravity.*(reverse|flip)|upside.?down|ceiling/.test(t)) return "reverse-gravity";
  if (/low.*gravity|less.*gravity|moon|zero.*gravity|float/.test(t)) return "low-gravity";
  if (/ice|icy|slip|friction/.test(t)) return "ice-floor";
  if (/fast|speed|sprint|quick/.test(t)) return "speed-boost";
  if (/tiny|small|shrink|mini/.test(t)) return "tiny-player";
  if (/giant|huge|big.*(enem|drone)|(enem|drone).*big/.test(t)) return "giant-enemies";
  if (/jump|bounce/.test(t)) return "super-jump";
  if (/shield|protect|bubble|invincib/.test(t)) return "shield";
  return null;
}

export function applyRule(active: ActiveRule[], id: RuleId, author: string, elapsed: number): ActiveRule[] {
  const rule = getRule(id);
  return [...active.filter(a => a.expiresAt > elapsed && getRule(a.id).group !== rule.group),
    { id, author: author.slice(0, 32), appliedAt: elapsed, expiresAt: elapsed + rule.duration }].slice(-4);
}
export function cleanUser(value: string): string { return value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 25) || "you"; }
export function queueProposal(queue: Proposal[], proposal: Proposal, recent: Map<string, number>, now: number) {
  if (queue.length >= 12) return { accepted: false, reason: "The patch queue is full. Try again after a deployment." };
  if (now - (recent.get(proposal.user.toLowerCase()) ?? -Infinity) < 30_000) return { accepted: false, reason: "One proposal per person every 30 seconds. Give everyone a turn." };
  if (queue.some(p => p.user.toLowerCase() === proposal.user.toLowerCase() && p.ruleId === proposal.ruleId)) return { accepted: false, reason: "That proposal is already in the queue." };
  recent.set(proposal.user.toLowerCase(), now);
  return { accepted: true, reason: "" };
}
export const DEMO_PROPOSALS: { user: string; text: string }[] = [
  { user: "pixelwitch", text: "!patch reverse gravity every 5 seconds" },
  { user: "cozybyte", text: "!patch give us moon gravity" },
  { user: "chaotic_toast", text: "!patch make the floor ice" },
  { user: "mintcondition", text: "!patch give us a shield" },
  { user: "orbitkid", text: "!patch make the drones giant" },
  { user: "lilaclogic", text: "!patch make the player tiny" },
  { user: "neonnoodle", text: "!patch super jump please" },
  { user: "bytebunny", text: "!patch make us run faster" },
];
