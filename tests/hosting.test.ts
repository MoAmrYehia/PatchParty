import test from "node:test";
import assert from "node:assert/strict";
import { appRoot, assetPath, normalizeBasePath, stageLink } from "../lib/hosting.ts";
import { twitchAuthorizationUrl } from "../lib/twitch.ts";

test("project-hosted links stay inside the repository path", () => {
  const origin = "https://moamryehia.github.io", base = "/PatchParty/";
  assert.equal(appRoot(origin, base), "https://moamryehia.github.io/PatchParty/");
  assert.equal(assetPath("patch-party-source.zip", base), "/PatchParty/patch-party-source.zip");
  assert.equal(assetPath("/favicon.svg", base), "/PatchParty/favicon.svg");
  assert.equal(normalizeBasePath("PatchParty"), base);
  assert.equal(appRoot("https://example.test", "/"), "https://example.test/");
});

test("Twitch authorization redirects to the project page and keeps the read-only scope", () => {
  const redirect = appRoot("https://moamryehia.github.io", "/PatchParty/");
  const url = new URL(twitchAuthorizationUrl("test-client-id", redirect, "test-state"));
  assert.equal(url.origin, "https://id.twitch.tv");
  assert.equal(url.searchParams.get("redirect_uri"), redirect);
  assert.equal(url.searchParams.get("state"), "test-state");
  assert.equal(url.searchParams.get("scope"), "user:read:chat");
});

test("stage links preserve the project path and keep the reader capability out of the query", () => {
  const url = new URL(stageLink("https://moamryehia.github.io", "room-id", "reader-key", "/PatchParty/"));
  assert.equal(url.pathname, "/PatchParty/");
  assert.equal(url.searchParams.get("stage"), "room-id");
  assert.equal(url.searchParams.has("key"), false);
  assert.equal(new URLSearchParams(url.hash.slice(1)).get("key"), "reader-key");
});
