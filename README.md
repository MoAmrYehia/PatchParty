# Patch Party

**Your stream. Their rules.** A Twitch-connected survival arena built with OpenAI Codex for the Codex × TwitchCon Hackathon. Viewers propose rule changes in chat, the streamer approves them, and the arena changes immediately.

## Try it

Start a run with **Let's play**, or select **Start & deploy** on a proposal. Demo chat is clearly marked as simulated. Move with **A / D** or **← / →**, jump with **Space / W / ↑**, and pause with **P**. Touch controls appear on mobile. Collect green sparks, avoid orange drones, and survive three minutes with five hearts.

The streamer approves every change. No viewer command executes arbitrary code. The runtime phrase matcher maps supported language to eight predefined mechanics; there is no runtime LLM call, AI model dependency, or model API key requirement. Codex was used as the development tool.

## Included

- Original Canvas arena and procedural artwork; no remote game asset dependencies.
- Eight modifiers: moon gravity, reversing gravity, ice floor, faster movement, tiny player, larger drones, higher jumps, and a shield.
- Four active modifiers maximum, independent expiry, mutually exclusive gravity rules, and undo.
- Builder/Chaos teams, viewer credit, proposal queue, filtering, dismiss controls, per-user cooldown, and bounded chat history.
- Twitch OAuth and EventSub WebSocket chat, keepalive monitoring, duplicate suppression, reconnect transfers, token validation, and disconnect handling.
- Stage view synchronized using BroadcastChannel in one browser and a D1 snapshot relay across browser profiles.
- Run recap and JSON export; best score is a device-local preference.
- Keyboard and touch input, reduced motion, optional sound, modal focus trap, and responsive layout.

## GitHub Pages

The project includes a static build for GitHub Pages. Run `pnpm build:pages`; the deployable files are in `dist/github-pages/`. The publishing branch is `gh-pages`. See [GitHub Pages setup](docs/GITHUB_PAGES.md) for the one-time repository setting, deployment steps, and Twitch redirect URL.

On Pages, the game and Twitch connection run in the browser. Stage view uses another window in the same browser profile. The full server-hosted version also supports a D1 relay across profiles.

## Local development

Use Node **24** and pnpm (the checked-in lockfile is authoritative).

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
```

The standard standalone Vinext starter can run with `pnpm dev`. In a ChatGPT Sites managed Linux workspace, use its supplied preview workflow. The maintained scripts select their execution profile and keep local runtime files ignored.

### Local database

The game, demo chat, and Twitch connection work without a database. The separate stage relay requires D1. The hosting manifest declares `DB`; the Sites build provisions the deployed binding and applies `drizzle/0000_great_exodus.sql`.

After the first local build, apply the schema once:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_great_exodus.sql
```

Local and production databases are separate. Do not reapply an already-applied migration. Local D1 state lives in ignored `.wrangler/state`.

## Connect real Twitch chat

1. Register an application at https://dev.twitch.tv/console/apps . Select the confidential client type to use the implicit grant. The app itself only asks you for the client ID, not the client secret.
2. Add the exact root URL displayed under **Connect Twitch** as an OAuth redirect URL, including the trailing slash. For a standalone local app, register its localhost origin too.
3. Paste the application client ID and select **Authorize with Twitch**.
4. Sign in as the broadcaster whose channel you want to use. This version subscribes to the authorized user's own channel.
5. Authorize `user:read:chat`. Live mode replaces demo chat; it does not silently mix simulated messages into Twitch chat.
6. In Twitch chat, submit `!patch moon gravity` or another supported command. Approve the queued card in the studio.

The OAuth state is generated cryptographically, checked once, and limited to ten minutes. The returned fragment is removed immediately. Access tokens exist only in browser memory, are validated against the client ID and required scope, are revalidated hourly, and are cleared by disconnect or reload. The client never sends Twitch credentials to the Patch Party server, and it never sends messages into Twitch chat.

The initial authorization and end-to-end real-channel demo require the owner's Twitch application and authorization. The code has transport-level tests; a mocked EventSub test is not evidence of a live Twitch stream.

Official docs: https://dev.twitch.tv/docs/chat/authenticating/ , https://dev.twitch.tv/docs/eventsub/handling-websocket-events/ , https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/ .

## Viewer commands

| Command | Result |
|---|---|
| `!team builder` | Join Builders |
| `!team chaos` | Join Chaos Crew |
| `!patch moon gravity` | 40% gravity, 45 seconds |
| `!patch flip gravity` | Gravity alternates every 5 seconds, for 45 seconds |
| `!patch ice floor` | Slower deceleration, 45 seconds |
| `!patch speed boost` | Faster horizontal movement, 45 seconds |
| `!patch tiny player` | Smaller avatar and hitbox, 45 seconds |
| `!patch giant drones` | Bigger drones and hitboxes, 45 seconds |
| `!patch super jump` | Higher jumps, 45 seconds |
| `!patch shield` | Blocks contact damage, 20 seconds |

An explicit team selection must match a patch's category. Without a team command, the proposal inherits the modifier's category. One proposal per person every 30 seconds, twelve pending proposals, and 240 characters per message. Unknown or negated requests are not executed. The round clock is a pacing suggestion; a host can approve a patch whenever they choose, including while paused.

## Broadcast / OBS

Open **Stage view**, create a stage link, and open it in a separate window. Keep the studio running. Use OBS **Window Capture** for the stage window. That window is a spectator; gameplay input belongs in the studio. On a private Site, an OBS Browser Source also needs owner sign-in using OBS Interact; the application does not bypass the Site's access policy.

Same-browser stage updates use BroadcastChannel at 20 Hz. Separate profiles receive a snapshot once per second and are intended for a scoreboard/spectator fallback, not smooth gameplay capture. Stage rooms expire six hours after creation. Losing or reloading the studio loses its in-memory host key; create another stage link. Reloading the studio resets the active run.

Stage URLs carry a read capability in the fragment. API calls transmit it as a bearer header. The distinct host capability can publish snapshots; the reader cannot. Only hashes of those capabilities are stored. Snapshots contain validated game state and active patch author names, not Twitch tokens or raw chat. Expired rooms are removed when a new room is created. Keep game simulation and OAuth in the studio; do not add either to the relay API.

## Tests and structure

```sh
pnpm test
pnpm typecheck
# With a running local preview and migrated D1:
node scripts/check-relay.mjs http://localhost:5173
```

- `app/components/PatchParty.tsx` — studio, moderation, game lifecycle, recap and stage client
- `lib/game.ts` — fixed-step deterministic physics and scoring
- `lib/render.ts` — Canvas rendering and original procedural artwork
- `lib/rules.ts` — supported mechanics and bounded phrase interpreter
- `lib/twitch.ts` — browser OAuth and EventSub transport
- `app/api/rooms/` — D1-backed capability-separated stage relay
- `lib/room-server.ts` — snapshot validation, hashing and request checks
- `tests/` — gameplay, patch constraints, room schema and Twitch protocol tests
- `docs/` — demo script, submission notes and verification record

## Submission preparation

The built Site is private to its owner by default. A private Site link is not anonymous judge access. Make source available in the permitted repository provider and supply runnable instructions, or explicitly change the Site audience if a public demo is desired. The Sites source repository is the persistent development backup; Devpost specifically asks for GitHub, GitLab, or Bitbucket.

Use an actual Codex session ID from `/status` in the thread used for the build. Do not invent an ID or substitute a conversation URL. Record the final demo on a real Twitch stream with consenting participants; simulated chat alone does not meet the video requirement. See `docs/DEMO_SCRIPT.md` and `docs/SUBMISSION.md`.
