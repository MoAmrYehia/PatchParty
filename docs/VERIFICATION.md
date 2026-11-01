# Verification record

Built on 1 November 2026 using Codex in ChatGPT Work.

## Automated

17 Node tests passed for:
- Supported phrase mapping and rejection of unsupported or negated requests.
- Rule conflicts, expiry, four-rule cap, bounded author length, queue limit and per-user cooldown.
- Fixed-step movement, jumping/landing, reverse gravity, ice momentum, speed, low gravity, shield, hit immunity, scoring, spark respawn, win/loss and paused states.
- Stage snapshot schema and secret stripping, hashed room capabilities and same-origin write checks.
- OAuth state validation and URL clearing, EventSub subscription creation, message deduplication, server-directed reconnect transfer, invalid reconnect origin rejection, and client-ID validation.

TypeScript checking and production compilation were also run. Nine browser-origin HTTP relay checks passed for room creation, valid host publish and reader access, read-key write rejection, invalid host key, missing reader key, host-key read rejection, malformed snapshots and oversized snapshots. Cross-origin request rejection is covered by the unit suite.

## Browser

Checked the initialized demo, starting/deploying a gravity patch, movement and jumping, undo, pausing, stage room creation and synchronization. The responsive UI was inspected in a 390-pixel embedded viewport. Touch controls and reduced-motion behavior are implemented; actual touch hardware was not available.

## Limits

No Twitch account or registered application was supplied, so no end-to-end live Twitch authorization or real stream was performed. Protocol tests use controlled mocks and are not proof of a live Twitch stream. Runtime patch interpretation is phrase matching, not model inference. Cross-profile stage snapshots are one per second; same-browser stage capture is the smooth broadcast path. The deployment starts owner-private.
