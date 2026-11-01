# Submission preparation

Project name: **Patch Party**

Short description: A live survival arena that Twitch chat rewrites. Viewers propose tested mechanics, the streamer approves each patch, and the whole community watches the consequences.

## What it does

Patch Party turns a Twitch audience into co-designers of a small survival game. Viewers join Builders or Chaos Crew and propose temporary changes: reversing gravity, creating an ice floor, shrinking the hero, or enlarging enemies. The streamer chooses which ideas to deploy. Proposal cards credit their authors, and every run ends with a patch timeline. A clean stage window supports broadcast capture.

## How we built it

OpenAI Codex was used to implement the game, rule system, control room, Twitch OAuth/EventSub connection, D1 stage relay, responsive UI, tests and setup instructions. The simulation runs at a fixed time step; rendering uses original procedural Canvas art. Supported viewer phrases map to predefined effects with expiry and conflicts. There is no runtime LLM dependency.

## Requirements to complete outside the build

- Register the Twitch application and authorize the broadcaster account.
- Verify real Twitch messages arrive, queue proposals, and affect the game after approval.
- Put the source in GitHub, GitLab, or Bitbucket with the required judge access. The private Sites source backup is not a replacement for those allowed providers.
- Supply the actual Codex session ID. Use `/status` in the main build thread; no fabricated ID is included here.
- Record a video under three minutes showing the project functioning on Twitch and how Codex was used. Upload it to YouTube with the visibility required by the official rules.
- Submit the project on Devpost before the official deadline; a saved draft is not submission.
- Preserve the submitted source state during judging and keep access available through the judging period.

Official event and requirements: https://twitchcon-codex.devpost.com/ and https://twitchcon-codex.devpost.com/rules . Check them again before submitting; this note does not supersede them.
