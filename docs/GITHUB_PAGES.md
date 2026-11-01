# GitHub Pages deployment

Patch Party includes a static browser build for GitHub Pages. The source lives on `main`; the compiled site is published on `gh-pages`.

## Publishing source

After the deployment branch has been pushed, enable Pages once:

1. Open https://github.com/MoAmrYehia/PatchParty/settings/pages .
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Select **gh-pages** and **/(root)**, then select **Save**.
4. Wait for GitHub's Pages build and deployment to finish.

The project URL is https://moamryehia.github.io/PatchParty/ after Pages has been enabled and the deployment has succeeded. A repository branch existing is not evidence that the site is live.

The GitHub connector used for this build can publish repository files and branches, but does not expose the repository Pages settings. The owner may need to complete this one-time source selection in GitHub.

Official publishing source documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site .

## Build

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
python3 scripts/package-source.py
pnpm build:pages
```

Publish the **contents** of `dist/github-pages/` at the root of the `gh-pages` branch. The build includes `.nojekyll`, an index, bundled assets, the favicon, and a portable source download. Rebuild and republish that output when changing the source; editing `main` alone does not update the compiled deployment branch.

The Vite configuration sets `/PatchParty/` as the base. Home links, downloads, stage links, and OAuth redirects use this same base path.

## Twitch setup

Register the following exact redirect URL in your Twitch application, including its trailing slash:

```text
https://moamryehia.github.io/PatchParty/
```

The connection dialog displays the correct URL for the page currently running. Tokens remain in browser memory. The static build does not require a client secret or a server token.

## Stage view

The stage runs in a second window of the **same browser profile**. It synchronizes directly with the open studio. Use OBS Window Capture for that window; a separate OBS Browser Source cannot receive the browser's local stage channel.

GitHub Pages does not run the D1-backed relay API. Cross-profile/cross-device stage snapshots remain a capability of the full server-hosted build. The game, demo chat, Twitch chat connection, rule moderation, sound, run recap and source download run in the static build.

Keep the studio open. Reloading it resets the run and the local stage room. No requests to `/api/rooms` are made by the static host.

## Verification

20 tests cover gameplay, rules, room validation, Twitch protocol and hosting paths. The static production build was checked at `/PatchParty/` for starting/deploying a patch, movement, pause, correct Twitch callback URL, and a separate stage receiving the same timer, score and active patch. Real Twitch authorization still requires the owner's registered application and account.
