"use client";

import { randomId } from "../../lib/id";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownUp, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BookOpen, Check, ChevronDown, CircleHelp, Code2, Copy, Download, Expand, ExternalLink, Gamepad2, Heart, LayoutDashboard, MessageSquare, Moon, MoreHorizontal, Pause, Play, Plus, Radio, RotateCcw, Send, Settings2, Shield, Shrink, Skull, Snowflake, Sparkles, Swords, Trophy, Undo2, Users, Volume2, VolumeX, X, Zap } from "lucide-react";
import { applyRule, cleanUser, DEMO_PROPOSALS, getRule, interpretPatch, queueProposal, RULES, type ActiveRule, type Proposal, type RuleId, type Team } from "../../lib/rules";
import { createWorld, formatTime, HEIGHT, RUN_SECONDS, stepWorld, WIDTH, type Input, type World } from "../../lib/game";
import { renderWorld } from "../../lib/render";
import { authorizeTwitch, consumeTwitchCallback, TwitchConnection, type TwitchStatus } from "../../lib/twitch";

type Chat = { id: string; user: string; text: string; team?: Team; source: "demo" | "twitch" | "local" | "system"; note?: string };
type PatchEvent = { title: string; author: string; team: Team; ruleId: RuleId; elapsed: number; source: string; action: "deploy" | "undo" | "remove" };
type Room = { id: string; hostKey: string; readKey: string };
type Modal = "help" | "connect" | "stage" | "recap" | "library" | null;
const ICONS = { moon: Moon, orbit: ArrowDownUp, snow: Snowflake, bolt: Zap, shrink: Shrink, ghost: Skull, up: ArrowUp, shield: Shield };
function RuleIcon({ id, size = 20 }: { id: RuleId; size?: number }) { const I = ICONS[getRule(id).icon as keyof typeof ICONS]; return <I size={size} strokeWidth={1.6} />; }
const teamLabel = (team: Team) => team === "builder" ? "Builders" : "Chaos crew";
const emptyInput = (): Input => ({ left: false, right: false, jump: false });

export default function PatchParty({ initialStage = false }: { initialStage?: boolean }) {
  const world = useRef<World>(createWorld()), input = useRef<Input>(emptyInput());
  const canvas = useRef<HTMLCanvasElement>(null), arena = useRef<HTMLDivElement>(null), chatList = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<World>(createWorld), [mounted, setMounted] = useState(false), [stage, setStage] = useState(initialStage);
  const [queue, setQueue] = useState<Proposal[]>([]), queueRef = useRef<Proposal[]>([]), recent = useRef(new Map<string, number>()), teams = useRef(new Map<string, Team>());
  const [chats, setChats] = useState<Chat[]>([]), [history, setHistory] = useState<PatchEvent[]>([]), events = useRef<PatchEvent[]>([]), undoStack = useRef<ActiveRule[][]>([]);
  const [mode, setMode] = useState<"demo" | "twitch">("demo"), modeRef = useRef<"demo" | "twitch">("demo"), [demoOn, setDemoOn] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<TwitchStatus>("disconnected"), [connectionMessage, setConnectionMessage] = useState("Demo chat is ready"), twitch = useRef<TwitchConnection | null>(null), oauthToken = useRef<string | null>(null);
  const [modal, setModal] = useState<Modal>(null), [toast, setToast] = useState(""), [banner, setBanner] = useState<{ title: string; author: string; team: Team } | null>(null);
  const [composer, setComposer] = useState(""), [localTeam, setLocalTeam] = useState<Team>("builder"), [filter, setFilter] = useState<"all" | Team>("all");
  const [clientId, setClientId] = useState(""), [best, setBest] = useState(0), [sound, setSound] = useState(false), soundRef = useRef(false), audio = useRef<AudioContext | null>(null);
  const [lastPatch, setLastPatch] = useState(0), [room, setRoom] = useState<Room | null>(null), [roomBusy, setRoomBusy] = useState(false), [stageUrl, setStageUrl] = useState(""), [stageStatus, setStageStatus] = useState("Waiting for the studio"), [copied, setCopied] = useState(false);
  const reducedMotion = useRef(false), notifyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), bannerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const initialized = useRef(false);
  const demoIndex = useRef(3), modalRef = useRef<Modal>(null), [libraryMessage, setLibraryMessage] = useState("");
  const notify = useCallback((message: string) => { setToast(message); clearTimeout(notifyTimer.current); notifyTimer.current = setTimeout(() => setToast(""), 5000); }, []);
  const syncHud = useCallback(() => setHud({ ...world.current, player: { ...world.current.player }, active: [...world.current.active] }), []);
  const addChat = useCallback((message: Chat) => setChats(old => [...old.slice(-69), message]), []);
  const updateQueue = useCallback((items: Proposal[]) => { queueRef.current = items; setQueue(items); }, []);
  const addEvent = useCallback((event: PatchEvent) => { events.current = [...events.current, event].slice(-200); setHistory(events.current); }, []);
  const beep = useCallback(() => {
    if (!soundRef.current) return;
    try { const a = audio.current || (audio.current = new AudioContext()); void a.resume(); const o = a.createOscillator(), gain = a.createGain(); o.type = "sine"; o.frequency.setValueAtTime(440, a.currentTime); o.frequency.exponentialRampToValueAtTime(880, a.currentTime + .12); gain.gain.setValueAtTime(.035, a.currentTime); gain.gain.exponentialRampToValueAtTime(.001, a.currentTime + .25); o.connect(gain); gain.connect(a.destination); o.start(); o.stop(a.currentTime + .25); } catch { /* Sound is optional. */ }
  }, []);
  const ingest = useCallback((userValue: string, textValue: string, source: "demo" | "twitch" | "local") => {
    const user = cleanUser(userValue), text = textValue.trim().slice(0, 240), key = user.toLowerCase();
    if (!text) return;
    const match = text.match(/^!team\s+(builders?|chaos)\s*$/i);
    if (match) { const team: Team = match[1].toLowerCase().startsWith("builder") ? "builder" : "chaos"; teams.current.set(key, team); addChat({ id: randomId(), user, text: `joined ${teamLabel(team)}`, team, source }); return; }
    if (!/^!patch\s+/i.test(text)) { addChat({ id: randomId(), user, text, team: teams.current.get(key), source }); return; }
    const ruleId = interpretPatch(text);
    let note = "";
    if (!ruleId) note = "Try a supported patch: moon gravity, flip gravity, ice, speed, tiny, giant drones, super jump, or shield.";
    const rule = ruleId ? getRule(ruleId) : null, assigned = teams.current.get(key);
    if (rule && assigned && assigned !== rule.team) note = `This patch belongs to ${teamLabel(rule.team)}. Use !team ${rule.team} to switch sides.`;
    if (ruleId && rule && !note) {
      const proposal: Proposal = { id: randomId(), ruleId, user, text, team: rule.team, receivedAt: Date.now(), source };
      const result = queueProposal(queueRef.current, proposal, recent.current, Date.now());
      if (result.accepted) updateQueue([...queueRef.current, proposal]); else note = result.reason;
    }
    addChat({ id: randomId(), user, text, team: rule?.team || assigned, source, note });
    if (note && source === "local") notify(note);
  }, [addChat, notify, updateQueue]);

  useEffect(() => {
    const isStage = new URLSearchParams(location.search).has("stage"); setStage(isStage); setMounted(true);
    reducedMotion.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    try { setBest(Number(localStorage.getItem("pp-best") || 0)); setClientId(localStorage.getItem("pp-client-id") || ""); } catch { /* Device preferences are optional. */ }
    if (isStage) return;
    let token: string | null = null;
    try { token = oauthToken.current || consumeTwitchCallback(); oauthToken.current = token; } catch (e) { notify((e as Error).message); }
    if (token) {
      modeRef.current = "twitch"; setMode("twitch"); setDemoOn(false); updateQueue([]); setChats([]);
      const connection = new TwitchConnection(token, localStorage.getItem("pp-client-id") || "", m => ingest(m.user, m.text, "twitch"), (s, message) => { setConnectionStatus(s); setConnectionMessage(message); if (s === "disconnected") { oauthToken.current = null; notify(message); } });
      twitch.current = connection; void connection.connect();
    } else if (!initialized.current) {
      addChat({ id: "welcome", user: "patchparty", text: "Your chat, your rules. Pick a patch below and make a little chaos.", source: "system" });
      DEMO_PROPOSALS.slice(0, 3).forEach(p => ingest(p.user, p.text, "demo"));
    }
    initialized.current = true;
    return () => { twitch.current?.disconnect(); clearTimeout(notifyTimer.current); clearTimeout(bannerTimer.current); };
  }, [addChat, ingest, notify, updateQueue]);

  useEffect(() => {
    if (!mounted || !canvas.current) return;
    const c = canvas.current.getContext("2d"); if (!c) return;
    let raf = 0, last = performance.now(), uiTime = 0, accumulator = 0;
    const frame = (now: number) => {
      const delta = Math.min((now - last) / 1000, .06); last = now;
      if (!stage) { accumulator += delta; while (accumulator >= 1 / 120) { stepWorld(world.current, input.current, 1 / 120); accumulator -= 1 / 120; } }
      renderWorld(c, world.current, now / 1000, reducedMotion.current);
      if (now - uiTime > 90) { syncHud(); uiTime = now; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame); return () => cancelAnimationFrame(raf);
  }, [mounted, stage, syncHud]);

  useEffect(() => {
    if (stage || mode !== "demo" || !demoOn) return;
    const id = setInterval(() => { if (world.current.phase !== "running") return; const p = DEMO_PROPOSALS[demoIndex.current++ % DEMO_PROPOSALS.length]; ingest(p.user, p.text, "demo"); }, 6500);
    return () => clearInterval(id);
  }, [demoOn, ingest, mode, stage]);
  useEffect(() => { if (chatList.current) chatList.current.scrollTop = chatList.current.scrollHeight; }, [chats]);
  useEffect(() => { modalRef.current = modal; }, [modal]);
  useEffect(() => {
    if (hud.phase !== "won" && hud.phase !== "lost") return;
    setBest(previous => { const next = Math.max(previous, world.current.score); try { localStorage.setItem("pp-best", String(next)); } catch {} return next; });
  }, [hud.phase]);
  const pauseToggle = useCallback(() => {
    if (world.current.phase === "running") world.current.phase = "paused"; else if (world.current.phase === "paused") world.current.phase = "running"; syncHud();
  }, [syncHud]);
  useEffect(() => {
    if (stage) return;
    const key = (e: KeyboardEvent, down: boolean) => {
      if (modalRef.current || /INPUT|TEXTAREA|SELECT|BUTTON/.test((e.target as HTMLElement)?.tagName)) return;
      const k = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", " ", "a", "d", "w", "p"].includes(k)) e.preventDefault();
      if (k === "arrowleft" || k === "a") input.current.left = down;
      if (k === "arrowright" || k === "d") input.current.right = down;
      if (k === " " || k === "arrowup" || k === "w") input.current.jump = down;
      if (k === "p" && down && !e.repeat) pauseToggle();
    };
    const kd = (e: KeyboardEvent) => key(e, true), ku = (e: KeyboardEvent) => key(e, false), blur = () => { input.current = emptyInput(); };
    const visibility = () => { input.current = emptyInput(); if (document.hidden && world.current.phase === "running") { world.current.phase = "paused"; syncHud(); } };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); window.addEventListener("blur", blur); document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", visibility); };
  }, [pauseToggle, stage, syncHud]);

  useEffect(() => {
    if (!room || stage) return;
    const bc = new BroadcastChannel(`patch-party-${room.id}`);
    const fast = setInterval(() => bc.postMessage(world.current), 50);
    let busy = false, warned = false;
    const publish = async () => {
      if (busy) return; busy = true;
      try { const res = await fetch(`/api/rooms/${room.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${room.hostKey}` }, body: JSON.stringify(world.current) }); if (!res.ok) throw new Error(); }
      catch { if (!warned) { notify("Stage relay is offline. The stage still syncs in this browser."); warned = true; } }
      finally { busy = false; }
    };
    void publish(); const slow = setInterval(publish, 1000);
    return () => { clearInterval(fast); clearInterval(slow); bc.close(); };
  }, [notify, room, stage]);
  useEffect(() => {
    if (!mounted || !stage) return;
    const id = new URLSearchParams(location.search).get("stage") || "", readKey = new URLSearchParams(location.hash.slice(1)).get("key") || "";
    if (!id || !readKey) { setStageStatus("Invalid stage link. Create a new one in the studio."); return; }
    let lastLocal = 0, stopped = false, busy = false;
    const bc = new BroadcastChannel(`patch-party-${id}`);
    bc.onmessage = e => { if (e.data?.player && e.data?.phase) { world.current = e.data as World; lastLocal = Date.now(); setStageStatus("Studio connected"); } };
    const poll = async () => {
      if (busy || Date.now() - lastLocal < 2000) return; busy = true;
      try { const res = await fetch(`/api/rooms/${id}`, { headers: { Authorization: `Bearer ${readKey}` } }); const data = await res.json() as { error?: string; snapshot?: World; updatedAt: number }; if (!res.ok) throw new Error(data.error || "Stage relay unavailable"); if (!stopped && data.snapshot?.player) { world.current = data.snapshot; setStageStatus(Date.now() - data.updatedAt < 5000 ? "Studio connected" : "Studio disconnected — last frame"); } }
      catch (e) { if (!stopped) setStageStatus((e as Error).message); } finally { busy = false; }
    };
    void poll(); const timer = setInterval(poll, 1000);
    return () => { stopped = true; clearInterval(timer); bc.close(); };
  }, [mounted, stage]);

  function openModal(value: Modal) { if (world.current.phase === "running") { world.current.phase = "paused"; syncHud(); } setModal(value); }
  function startRun() {
    if (["won", "lost"].includes(world.current.phase)) { world.current = createWorld(); undoStack.current = []; events.current = []; setHistory([]); setLastPatch(0); }
    world.current.phase = "running"; syncHud(); canvas.current?.focus(); beep();
  }
  function resetRun() { world.current = createWorld(); input.current = emptyInput(); undoStack.current = []; events.current = []; setHistory([]); setLastPatch(0); syncHud(); notify("Fresh arena. Your queued patches are ready."); }
  function deploy(proposal: Proposal) {
    if (["won", "lost"].includes(world.current.phase)) { notify("Start a fresh run to deploy another patch."); return; }
    undoStack.current = [...undoStack.current.slice(-19), [...world.current.active]];
    world.current.active = applyRule(world.current.active, proposal.ruleId, proposal.user, world.current.elapsed);
    world.current.patchCount++;
    if (world.current.phase === "ready") world.current.phase = "running";
    const r = getRule(proposal.ruleId); setLastPatch(world.current.elapsed);
    addEvent({ title: r.title, author: proposal.user, team: r.team, ruleId: r.id, elapsed: world.current.elapsed, source: proposal.source, action: "deploy" });
    updateQueue(queueRef.current.filter(p => p.id !== proposal.id));
    setBanner({ title: r.title, author: proposal.user, team: r.team }); clearTimeout(bannerTimer.current); bannerTimer.current = setTimeout(() => setBanner(null), 2800);
    addChat({ id: randomId(), user: "patchparty", text: `${r.title} deployed. Nice one, @${proposal.user}!`, source: "system" }); syncHud(); beep(); canvas.current?.focus();
  }
  function undo() {
    const previous = undoStack.current.pop(); if (!previous) return;
    world.current.active = previous.filter(a => a.expiresAt > world.current.elapsed); const last = [...events.current].reverse().find(e => e.action === "deploy");
    if (last) addEvent({ ...last, elapsed: world.current.elapsed, action: "undo" }); syncHud(); notify("Last rule change undone. Your run keeps going."); canvas.current?.focus();
  }
  function removeRule(id: RuleId) { const active = world.current.active.find(a => a.id === id); if (!active) return; undoStack.current.push([...world.current.active]); world.current.active = world.current.active.filter(a => a.id !== id); const r = getRule(id); addEvent({ title: r.title, author: active.author, team: r.team, ruleId: id, elapsed: world.current.elapsed, source: "host", action: "remove" }); syncHud(); }
  function sendChat(e: FormEvent) { e.preventDefault(); if (!composer.trim()) return; teams.current.set("you", localTeam); ingest("you", composer.startsWith("!") ? composer : `!patch ${composer}`, "local"); setComposer(""); }
  async function createStage() {
    if (room) return;
    setRoomBusy(true);
    try { const res = await fetch("/api/rooms", { method: "POST" }); const data = await res.json() as Room & { error?: string }; if (!res.ok) throw new Error(data.error || "Could not create stage room."); setRoom(data); setStageUrl(`${location.origin}/?stage=${data.id}#key=${data.readKey}`); }
    catch (e) { notify((e as Error).message); } finally { setRoomBusy(false); }
  }
  async function copyStage() { try { await navigator.clipboard.writeText(stageUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { notify("Select and copy the stage link below."); } }
  function useDemo() { twitch.current?.disconnect(); oauthToken.current = null; twitch.current = null; modeRef.current = "demo"; setMode("demo"); setDemoOn(true); setConnectionStatus("disconnected"); setConnectionMessage("Demo chat is ready"); updateQueue([]); recent.current.clear(); teams.current.clear(); setChats([]); DEMO_PROPOSALS.slice(0, 3).forEach(p => ingest(p.user, p.text, "demo")); setModal(null); }
  function exportRecap() {
    const report = { project: "Patch Party", version: "1.0.0", createdAt: new Date().toISOString(), source: modeRef.current, score: world.current.score, survived: world.current.elapsed, result: world.current.phase, patches: events.current };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "patch-party-run.json"; a.click(); URL.revokeObjectURL(url);
  }
  function toggleSound() { soundRef.current = !sound; setSound(!sound); if (!sound) beep(); }
  const deployments = history.filter(e => e.action === "deploy"), contributors = new Set(chats.filter(c => c.source !== "system").map(c => c.user)).size;
  const filteredQueue = queue.filter(p => filter === "all" || p.team === filter), patchCountdown = Math.max(0, 30 - (hud.elapsed - lastPatch));
  const running = hud.phase === "running", terminal = hud.phase === "won" || hud.phase === "lost";

  const gameView = <div className={`game-viewport ${stage ? "stage-game" : ""}`} ref={arena}>
    <canvas ref={canvas} width={WIDTH} height={HEIGHT} tabIndex={0} aria-label="Patch Party survival arena. Move with A and D or arrow keys, jump with Space. Avoid orange drones and collect green sparks." />
    <div className="game-hud"><div className="health-hud" aria-label={`${hud.health} of 5 hearts`}>{Array.from({ length: 5 }, (_, i) => <Heart key={i} size={17} fill={i < hud.health ? "currentColor" : "none"} className={i < hud.health ? "" : "heart-empty"} />)}</div><div className="timer-hud"><span>{stage ? "PATCH PARTY" : "SURVIVE THE CHAOS"}</span><strong>{formatTime(RUN_SECONDS - hud.elapsed)}</strong></div><div className="score-hud"><span>SCORE</span><strong>{hud.score.toLocaleString()}</strong></div></div>
    {!stage && hud.phase === "ready" && <div className="ready-overlay"><div className="ready-icon"><Gamepad2 size={28} /></div><span className="eyebrow">A COMMUNITY-BUILT ADVENTURE</span><h2>Small hero.<br />Unpredictable universe.</h2><p>Survive 3 minutes. Let chat change everything.</p><button className="btn primary" onClick={startRun}><Play size={15} fill="currentColor" /> Let's play</button></div>}
    {!stage && hud.phase === "paused" && <div className="pause-overlay"><Pause size={30} /><h2>A little breather.</h2><p>Your game and patch timers are paused.</p><button className="btn primary" onClick={startRun}><Play size={15} /> Resume run</button></div>}
    {terminal && <div className="end-overlay"><div className="end-icon">{hud.phase === "won" ? <Trophy size={35} /> : <Heart size={35} />}</div><span className="eyebrow">{hud.phase === "won" ? "YOU SURVIVED THE CHAT" : "CHAOS HAD OTHER PLANS"}</span><h2>{hud.phase === "won" ? "What a little legend." : "Beautifully chaotic."}</h2><p>{formatTime(hud.elapsed)} survived · {hud.score.toLocaleString()} points · {hud.patchCount} patches</p>{!stage && <div className="row center"><button className="btn primary" onClick={startRun}><RotateCcw size={15} /> Run it back</button><button className="btn glass" onClick={() => setModal("recap")}>Run recap <ArrowUpRight size={15} /></button></div>}</div>}
    {banner && !stage && <div className={`patch-banner ${banner.team}`} role="status"><Sparkles size={22} /><div><span>PATCH DEPLOYED</span><strong>{banner.title}</strong><small>Dreamed up by @{banner.author}</small></div></div>}
    <div className="arena-coordinates">SECTOR 01 / THE LILAC OUTPOST</div>
    {stage && <div className="stage-rules">{hud.active.map(a => <span key={a.id} className={getRule(a.id).team}><RuleIcon id={a.id} size={14} /> {getRule(a.id).title} <b>{Math.ceil(a.expiresAt - hud.elapsed)}s</b></span>)}</div>}
  </div>;

  if (stage) return <main className="stage-shell">{gameView}<footer className="stage-footer"><span><Gamepad2 size={16} /> Patch Party <i>your stream. their rules.</i></span><span className={stageStatus === "Studio connected" ? "builder-text" : "muted"}><Radio size={12} /> {stageStatus}</span></footer></main>;

  return <div className="app-shell">
    <aside className="sidebar"><a className="app-mark" href="/" aria-label="Patch Party home"><Gamepad2 size={26} strokeWidth={2} /></a><div className="side-links"><button className="side-link selected" aria-label="Control room" title="Control room" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><LayoutDashboard size={20} /></button><button className="side-link" aria-label="Patch library" title="Patch library" onClick={() => openModal("library")}><Sparkles size={21} /></button><button className="side-link" aria-label="Run recap" title="Run recap" onClick={() => openModal("recap")}><Trophy size={21} /></button></div><div className="side-bottom"><button className="side-link" aria-label="How to play" title="How to play" onClick={() => openModal("help")}><CircleHelp size={21} /></button><div className="avatar" title="Streamer studio">P</div></div></aside>
    <div className="main-shell">
      <header className="topbar"><div className="brand">patch<span>party</span><span className="brand-separator" /><small>Creator studio</small></div><div className="top-actions"><a href="https://twitchcon-codex.devpost.com/" target="_blank" rel="noreferrer" className="hackathon-link"><Code2 size={14} /> Built with Codex <ArrowUpRight size={12} /></a><div className={`source-pill ${mode === "twitch" && connectionStatus === "connected" ? "live" : ""}`}><span className="status-dot" />{mode === "demo" ? "Demo mode" : connectionStatus === "connected" ? "Twitch connected" : "Twitch offline"}</div><button className="icon-btn" title="Connection settings" aria-label="Connection settings" onClick={() => openModal("connect")}><Settings2 size={18} /></button></div></header>
      <main className="workspace">
        <section className="page-intro"><div><div className="eyebrow intro-label"><span /> THE COMMUNITY IS IN CONTROL</div><h1>Your stream. <span>Their rules.</span></h1><p>A little survival. A lot of chat-induced chaos.</p></div><div className="intro-actions"><button className="btn secondary" onClick={() => openModal("help")}><BookOpen size={15} /> How to play</button><button className="btn twitch-btn" onClick={() => openModal("connect")}><Radio size={15} /> Connect Twitch <ArrowUpRight size={14} /></button></div></section>
        <div className="studio-grid"><div className="game-column"><section className="arena-panel"><div className="panel-heading"><div className="row gap10"><span className="little-dot" /><h2>The little arena</h2><span className="subtle-tag">SURVIVAL</span></div><div className="row gap8"><span className={`game-status ${running ? "builder-text" : ""}`}>{running ? "Run in progress" : hud.phase === "paused" ? "Paused" : terminal ? "Run complete" : "Ready when you are"}</span><button className="icon-btn small" title="Fullscreen arena" aria-label="Fullscreen arena" onClick={() => { if (!document.fullscreenElement) void arena.current?.requestFullscreen().catch(() => notify("Fullscreen is unavailable. Try the stage view.")); else void document.exitFullscreen(); }}><Expand size={15} /></button></div></div>{gameView}<div className="game-controls"><div className="keyboard-hint"><span><kbd>A</kbd><kbd>D</kbd> move</span><span><kbd>SPACE</kbd> jump</span><span><kbd>P</kbd> pause</span></div><div className="row gap8"><button className="icon-btn small" title={sound ? "Mute patch sounds" : "Enable patch sounds"} aria-label={sound ? "Mute patch sounds" : "Enable patch sounds"} onClick={toggleSound}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button><button className="icon-btn small" title="Reset arena" aria-label="Reset arena" onClick={resetRun}><RotateCcw size={16} /></button><button className="btn play-control" onClick={() => running || hud.phase === "paused" ? pauseToggle() : startRun()}>{running ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}{running ? "Pause" : hud.phase === "paused" ? "Resume" : terminal ? "New run" : "Start run"}</button></div></div><div className="touch-controls">{(["left", "right", "jump"] as const).map(k => <button key={k} aria-label={k === "jump" ? "Jump" : `Move ${k}`} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); input.current[k] = true; }} onPointerUp={() => { input.current[k] = false; }} onPointerCancel={() => { input.current[k] = false; }}>{k === "left" ? <ArrowLeft size={22} /> : k === "right" ? <ArrowRight size={22} /> : <ArrowUp size={22} />}</button>)}</div></section>
          <div className="active-strip"><div className="row gap8"><Zap size={14} /><span>Active patches</span><b>{hud.active.length}<i>/4</i></b></div><div className="active-chips">{hud.active.length === 0 ? <span className="empty-active">A calm universe. For now.</span> : hud.active.map(a => <span key={a.id} className={`active-chip ${getRule(a.id).team}`}><RuleIcon id={a.id} size={12} />{getRule(a.id).title}<small>{Math.max(0, Math.ceil(a.expiresAt - hud.elapsed))}s</small><button aria-label={`End ${getRule(a.id).title}`} onClick={() => removeRule(a.id)}><X size={11} /></button></span>)}</div><button className="text-btn undo-btn" disabled={!undoStack.current.length} onClick={undo}><Undo2 size={13} /> Undo</button></div>
        </div>
        <aside className="chat-panel"><div className="chat-heading"><div className="row gap8"><MessageSquare size={16} /><h2>Community chat</h2></div><button className="icon-btn small" title="Chat settings" aria-label="Chat settings" onClick={() => openModal("connect")}><MoreHorizontal size={19} /></button></div><div className="chat-source"><span className={mode === "twitch" ? "builder-text" : ""}><span className="status-dot" />{mode === "demo" ? "Simulated viewers" : connectionMessage}</span>{mode === "demo" && <button onClick={() => setDemoOn(!demoOn)} aria-label={demoOn ? "Pause demo chat" : "Resume demo chat"}>{demoOn ? <Pause size={12} /> : <Play size={12} />}</button>}</div><div className="chat-messages" ref={chatList} role="log" aria-label="Community messages">{chats.map(c => <div key={c.id} className={`chat-message ${c.source === "system" ? "system" : ""}`}><div className="message-author">{c.source === "system" ? <Sparkles size={11} /> : <span className={`chat-avatar ${c.team || ""}`}>{c.user.slice(0, 1).toUpperCase()}</span>}<strong className={c.team ? `${c.team}-text` : ""}>{c.user}</strong>{c.team && <span className={`team-mini ${c.team}`}>{c.team === "builder" ? "B" : "C"}</span>}{c.source === "local" && <span className="you-label">you</span>}</div><p>{c.text}</p>{c.note && <small className="chat-note">{c.note}</small>}</div>)}</div><div className="chat-composer"><div className="composer-label"><span>TRY A PATCH YOURSELF</span><span>as @you</span></div><div className="team-switch"><button className={localTeam === "builder" ? "builder chosen" : ""} onClick={() => setLocalTeam("builder")}><Shield size={12} /> Builders</button><button className={localTeam === "chaos" ? "chaos chosen" : ""} onClick={() => setLocalTeam("chaos")}><Swords size={12} /> Chaos crew</button></div><form onSubmit={sendChat}><input aria-label="Propose a patch" placeholder={localTeam === "builder" ? "!patch moon gravity" : "!patch flip gravity"} value={composer} onChange={e => setComposer(e.target.value)} maxLength={240} /><button aria-label="Send patch proposal" type="submit" disabled={!composer.trim()}><Send size={15} /></button></form><p>Type <code>!patch</code> and an idea. We'll queue it up.</p></div></aside>
        <section className="patch-section"><div className="section-heading"><div><div className="row gap10"><h2>The next plot twist</h2><span className="count-badge">{queue.length}</span></div><p>Chat dreams it up. You make the call.</p></div><div className="patch-window"><span className="status-dot" /><span>{hud.phase === "ready" ? "FIRST PATCH IS READY" : patchCountdown > 0 ? "NEXT ROUND IN" : "PATCH WINDOW OPEN"}</span>{hud.phase !== "ready" && patchCountdown > 0 && <b>{formatTime(patchCountdown)}</b>}</div></div><div className="queue-toolbar"><div className="filter-tabs">{(["all", "builder", "chaos"] as const).map(f => <button key={f} className={filter === f ? "selected" : ""} onClick={() => setFilter(f)}>{f === "all" ? "All patches" : teamLabel(f)}</button>)}</div><button className="text-btn" onClick={() => openModal("library")}><Plus size={13} /> Patch library</button></div><div className="patch-cards">{filteredQueue.length === 0 ? <div className="empty-queue"><Sparkles size={24} /><div><h3>{queue.length ? "No patches on this side yet." : "A blank canvas for chaos."}</h3><p>Send a patch in chat or pick one from the library.</p></div><button className="btn secondary" onClick={() => openModal("library")}>Explore patches <ArrowUpRight size={14} /></button></div> : filteredQueue.slice(0, 3).map(p => { const r = getRule(p.ruleId); return <article className={`patch-card ${p.team}`} key={p.id}><div className="patch-card-top"><div className={`rule-icon ${p.team}`}><RuleIcon id={p.ruleId} size={20} /></div><span className={`team-badge ${p.team}`}>{p.team === "builder" ? <Shield size={10} /> : <Swords size={10} />}{teamLabel(p.team)}</span><button className="dismiss-patch" aria-label={`Dismiss ${r.title} proposal`} onClick={() => updateQueue(queueRef.current.filter(x => x.id !== p.id))}><X size={12} /></button></div><h3>{r.title}</h3><p>{r.description}</p><div className="patch-author"><span className={`mini-avatar ${p.team}`}>{p.user[0].toUpperCase()}</span><span>@{p.user}</span><small>{r.duration}s</small></div><button className="deploy-btn" disabled={terminal} onClick={() => deploy(p)}><Zap size={14} />{hud.phase === "ready" ? "Start & deploy" : "Deploy patch"}<ArrowUpRight size={14} /></button></article>; })}</div>{filteredQueue.length > 3 && <p className="queue-overflow">+{filteredQueue.length - 3} more in the queue. Deploy or dismiss a patch to see the next one.</p>}</section>
        <section className="session-panel"><div className="row gap8"><Users size={16} /><h2>This little community</h2></div><div className="session-stat"><span>Contributors</span><strong>{contributors.toString().padStart(2, "0")}</strong></div><div className="session-stat"><span>Patches deployed</span><strong>{deployments.length.toString().padStart(2, "0")}</strong></div><div className="team-balance"><div><span className="builder-text"><Shield size={12} /> Builders</span><b>{deployments.filter(e => e.team === "builder").length}</b></div><div><span className="chaos-text"><Swords size={12} /> Chaos crew</span><b>{deployments.filter(e => e.team === "chaos").length}</b></div></div><div className="best-score"><Trophy size={14} /><span>Your best</span><b>{best.toLocaleString()}</b></div><button className="btn secondary stage-button" onClick={() => openModal("stage")}><Expand size={14} /> Open stage view <ArrowUpRight size={14} /></button></section>
        </div>
        <footer className="workspace-footer"><span><span className="status-dot" /> A space for a little shared chaos.</span><button className="text-btn" onClick={() => openModal("recap")}>Run recap <ArrowUpRight size={12} /></button><a className="text-btn" href="/patch-party-source.zip" download><Download size={12} /> Source code</a><span>MADE WITH CODEX <Code2 size={13} /></span></footer>
      </main>
    </div>
    {toast && <div className="toast" role="status"><Sparkles size={17} /><span>{toast}</span><button className="icon-btn small" aria-label="Dismiss notification" onClick={() => setToast("")}><X size={14} /></button></div>}
    {modal && <ModalDialog title={modal === "help" ? "A little guide to the chaos." : modal === "connect" ? "Bring your community." : modal === "stage" ? "Ready for the big screen." : modal === "library" ? "A universe of plot twists." : "Every patch tells a story."} close={() => setModal(null)}>
      {modal === "help" && <div className="help-content"><p className="modal-lead">You play the hero. Your community rewrites the rules. Together, survive the next three minutes.</p><div className="help-steps"><div><span>01</span><h3>Make a little move.</h3><p>Use <kbd>A</kbd> / <kbd>D</kbd> or the arrow keys to move. <kbd>SPACE</kbd> to jump. Collect green sparks and dodge orange drones. Five hearts, three minutes.</p></div><div><span>02</span><h3>Let chat cook.</h3><p>Viewers type <code>!patch flip gravity</code> or <code>!patch give us a shield</code>. Choose a side with <code>!team builder</code> or <code>!team chaos</code>.</p></div><div><span>03</span><h3>Deploy the plot twist.</h3><p>Approve a proposal to change the game immediately. Four patches can be active together. Gravity patches replace each other. Undo brings back the previous rules.</p></div></div><div className="info-box"><Shield size={18} /><p>Every patch uses a tested mechanic. Proposals are interpreted with a phrase matcher. All changes need your approval. One proposal per person every 30 seconds.</p></div><p className="muted">Demo mode uses simulated chat. The Twitch connection reads your own channel's real messages after you authorize it. Opening a panel pauses your run; resume when you're ready.</p><button className="btn primary" onClick={() => { setModal(null); startRun(); }}><Play size={14} /> Got it. Let's play.</button></div>}
      {modal === "connect" && <div className="connect-content"><p className="modal-lead">Connect your own Twitch channel and turn real chat messages into the next plot twist.</p><div className="connection-state"><Radio size={20} /><div><b>{mode === "demo" ? "You're in demo mode" : connectionStatus === "connected" ? "Your channel is connected" : "Twitch connection"}</b><p>{mode === "demo" ? "Simulated viewers, real game mechanics." : connectionMessage}</p></div></div><label className="field-label" htmlFor="client-id">Twitch application client ID</label><input className="full-input" id="client-id" value={clientId} onChange={e => setClientId(e.target.value.trim())} placeholder="Paste your Twitch app client ID" autoComplete="off" /><p className="field-help">Register a confidential app in the <a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noreferrer">Twitch developer console <ExternalLink size={11} /></a>. You only need its client ID here.</p><div className="redirect-box"><small>ADD THIS OAUTH REDIRECT URL TO YOUR TWITCH APP</small><code>{mounted ? `${location.origin}/` : ""}</code></div><div className="info-box"><Shield size={18} /><p>Requests permission to read chat in your channel. Your token stays in memory and is cleared on reload or disconnect. No client secret is needed here.</p></div><button className="btn primary full-width" disabled={!clientId.trim()} onClick={() => { try { authorizeTwitch(clientId.trim()); } catch (e) { notify((e as Error).message); } }}><Radio size={16} /> Authorize with Twitch <ArrowUpRight size={15} /></button><button className="btn secondary full-width" onClick={useDemo}>{mode === "twitch" ? "Disconnect and use demo mode" : "Keep exploring the demo"}</button></div>}
      {modal === "stage" && <div><p className="modal-lead">A clean, read-only view of your arena, timer, and active patches. Keep this studio open to control the game.</p><div className="stage-preview-card"><Gamepad2 size={42} /><span>PATCH PARTY</span><p>Your arena. Front and center.</p></div>{!room ? <button className="btn primary full-width" disabled={roomBusy} onClick={() => void createStage()}><Expand size={16} />{roomBusy ? "Creating your stage…" : "Create stage link"}</button> : <><label className="field-label">Your stage link</label><div className="copy-field"><input readOnly aria-label="Stage URL" value={stageUrl} /><button aria-label="Copy stage link" onClick={() => void copyStage()}>{copied ? <Check size={16} /> : <Copy size={16} />}</button></div><a className="btn primary full-width" href={stageUrl} target="_blank" rel="noreferrer" onClick={e => { e.preventDefault(); window.open(stageUrl, "_blank", "popup,width=1280,height=760,noopener,noreferrer"); }}>Open stage in a new window <ArrowUpRight size={15} /></a></>}<div className="info-box"><Expand size={18} /><p>For OBS, use Window Capture on the separate stage window. If popups are blocked, copy the link into a new browser window. A Browser Source on a private site must first sign in through OBS Interact. The stage link expires after six hours.</p></div><p className="muted">Tabs in the same browser sync smoothly. Other browser profiles receive a snapshot every second. The stage link can view your arena; it cannot deploy patches or read Twitch credentials.</p></div>}
      {modal === "library" && <div><p className="modal-lead">Eight tested mechanics. Hundreds of beautifully chaotic combinations. Add a patch to the queue, then deploy it from the studio.</p><div className="library-grid">{RULES.map(r => <button key={r.id} className={`library-card ${r.team}`} onClick={() => { const user = `studio_${r.id.replace(/-/g, "_")}`; ingest(user, `!patch ${r.id === "low-gravity" ? "moon gravity" : r.id === "reverse-gravity" ? "flip gravity" : r.id === "giant-enemies" ? "giant drones" : r.id.replace(/-/g, " ")}`, "local"); setLibraryMessage(`${r.title} requested. Check the queue; requests have a 30-second cooldown.`); }}><div className="row gap8"><RuleIcon id={r.id} size={18} /><strong>{r.title}</strong><Plus size={13} /></div><p>{r.description}</p><span>{teamLabel(r.team)} · {r.duration}s</span></button>)}</div>{libraryMessage && <p className="library-feedback" role="status">{libraryMessage}</p>}<button className="btn primary full-width" onClick={() => setModal(null)}>Back to the studio <ArrowRight size={14} /></button></div>}
      {modal === "recap" && <div><p className="modal-lead">A small record of the people who changed your universe.</p><div className="recap-stats"><div><small>RUN SCORE</small><strong>{hud.score.toLocaleString()}</strong></div><div><small>TIME SURVIVED</small><strong>{formatTime(hud.elapsed)}</strong></div><div><small>PATCHES DEPLOYED</small><strong>{deployments.length}</strong></div></div>{history.length ? <div className="history-list">{[...history].reverse().map((e, i) => <div key={i}><span className={`rule-icon ${e.team}`}><RuleIcon id={e.ruleId} size={17} /></span><div><strong>{e.title}</strong><p>{e.action === "deploy" ? `Deployed by @${e.author}` : e.action === "undo" ? "Rule change undone" : "Ended by the streamer"} <span>· {e.source}</span></p></div><time>{formatTime(e.elapsed)}</time></div>)}</div> : <div className="empty-history"><Sparkles size={30} /><p>Your story starts with the first patch.</p></div>}<button className="btn secondary full-width" onClick={exportRecap}><Download size={16} /> Download run recap</button><p className="muted">Exports your score and patch timeline as JSON. Twitch credentials are never included.</p></div>}
    </ModalDialog>}
  </div>;
}

function ModalDialog({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  const dialog = useRef<HTMLDivElement>(null), closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const items = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]') || []);
    items()[0]?.focus(); const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); if (e.key === "Tab") { const elements = items(), first = elements[0], last = elements[elements.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } } };
    document.addEventListener("keydown", key); return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={dialog}><div className="modal-top"><span className="eyebrow"><Gamepad2 size={14} /> PATCH PARTY</span><button className="icon-btn" aria-label="Close dialog" onClick={close}><X size={18} /></button></div><h2 id="modal-title">{title}</h2>{children}</div></div>;
}
