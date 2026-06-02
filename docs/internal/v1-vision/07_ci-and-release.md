---
title: Tag Curator v1 - CI and Release Design
status: proposal (awaiting review; adopt by copying ci/ into .github/workflows/)
author: claude (opus-4.8), ultracode session
date: 2026-05-30
companion-to: 01_vision-and-ux-thesis.md (the spine)
deliverable: this doc + ci/build.yml + ci/release.yml + ci/README.md
---

# CI and Release Design

This document explains the CI and release pipeline that carries Tag Curator from
a tag push to a published, BRAT-installable release across the v1 milestone map:
v1.0 "Curation, in context", v1.1 "Curation intelligence", v1.2 "Share and scale",
and v2.0+ "Reach". The pipeline is deliberately small. Tag Curator is a
solo-maintained, display-only, file-safe Obsidian plugin (TypeScript, esbuild,
vitest, Apache-2.0), so the goal is "correct and boring," not elaborate.

The ready-to-adopt workflow files live next to this doc in `ci/`. They are a
proposal and do not overwrite the live `.github/workflows/` files until you copy
them across. Adoption steps are in `ci/README.md`.

## 1. What we have today, and the one urgent problem

Two workflows exist:

- `build.yml` runs on PRs and pushes to main: `npm ci` then lint, typecheck,
  test, build, and a `Verify build artifacts` step. Permissions are already
  minimal (`contents: read`). This is a good gate and it stays.
- `release.yml` runs on any tag push: builds, verifies three artifacts, and
  publishes the quartet (`main.js`, `manifest.json`, `styles.css`,
  `versions.json`) via `softprops/action-gh-release` with
  `generate_release_notes`.

The urgent problem is recorded in the 2026-05-30 session log: both workflows pin
actions whose runtime is Node 20, and GitHub deprecated Node 20 actions with a
hard cutover to Node 24 on 2026-06-02. After that date the current pins emit
deprecation warnings now and risk failing later. The fix is not to touch our own
Node version logic but to upgrade the actions themselves, because each action
bundles its own Node runtime. Bumping the action majors clears the warning at the
source.

A second, structural reality also shapes the design: `main.js` and `styles.css`
are gitignored. They are produced only by `release.yml` and shipped only as
release assets. That is why BRAT needs a real GitHub release to install anything,
why the stale May-5 release caused the "UI not appearing" bug this session opened
with, and why every BRAT-facing change needs a version bump so BRAT re-fetches.
The release workflow is therefore the single delivery channel, not a convenience.

## 2. The changes, and why each one

### 2.1 Action version bumps (clears the Node 20 deprecation)

| Action | Before | After | Why |
|---|---|---|---|
| `actions/checkout` | `@v4` | `@v5` | Current major; runs on Node 24, clearing the deprecation. v5 also moves credentials out of `.git/config` into `$RUNNER_TEMP`, with no workflow change required. |
| `actions/setup-node` | `@v4` | `@v5` | Current major on Node 24. Lets us source the Node version from `.nvmrc`. |
| `softprops/action-gh-release` | `@v2` | `@v3` | v3 is the Node 24 line (published 2026-04-12). v2.6.2 was the last Node 20 release; staying there keeps the deprecation. |

These three bumps are the entire fix for the GitHub warning. We do not change
`node-version` to chase Node 24: the runner Node our scripts run under is set by
`setup-node`, and that stays on the project's pinned 20. The deprecation is about
the actions' own runtime, which the majors carry.

`actions/checkout@v6` exists but is newer; v5 is the conservative current major
chosen here, and `ci/README.md` notes the optional later move to v6.

### 2.2 Node version from `.nvmrc`, not hardcoded

Both workflows hardcoded `node-version: '20'`. The repo already has a `.nvmrc`
pinned to `20`. We replace the literal with
`node-version-file: '.nvmrc'` so there is one source of truth. Bumping Node later
is a one-line edit to `.nvmrc` that both CI and release pick up automatically,
and local `nvm use` stays in sync with CI. This removes a class of "works locally,
wrong Node in CI" drift for free.

### 2.3 `build.yml`: concurrency with cancel-in-progress

A `concurrency` group keyed on `github.ref` with `cancel-in-progress: true` means
a fresh push to a PR branch cancels the previous, now-stale run. For a solo
maintainer doing rapid iteration this is the single highest-value CI tweak: it
saves minutes and gives the latest commit the runner immediately. The verification
chain itself is unchanged: lint, then typecheck, then test, then build, then
verify-artifacts, in that order, so the cheapest checks fail fastest. Permissions
stay `contents: read`.

One small consistency fix: the build-time artifact check now also asserts
`versions.json`, so the CI check and the release quartet are identical.

### 2.4 `release.yml`: a tag-versus-manifest guard

The most important new step. Before publishing, a short shell check compares the
pushed tag to `manifest.json`'s `version`:

```
TAG="${GITHUB_REF#refs/tags/}"
MANIFEST_VERSION="$(node -p "require('./manifest.json').version")"
[ "$TAG" = "$MANIFEST_VERSION" ] || exit 1
```

Obsidian plugin tags carry no leading "v" (the manifest version is plain semver
such as `1.2.3`), which is why the check is an exact-string match with no prefix
stripping beyond `refs/tags/`. If someone tags `1.2.4` while the manifest still
says `1.2.3` (for example, forgetting to run `npm version`, which triggers
`version-bump.mjs` to sync `manifest.json` and `versions.json`), the release
fails loudly with an actionable error instead of publishing assets whose declared
version disagrees with the tag. For BRAT, a version mismatch is exactly the kind
of silent breakage that is hard to diagnose later, so failing at publish time is
the cheap place to catch it.

Everything else about release stays: build, verify the quartet exists, then
`softprops/action-gh-release@v3` uploading exactly the four files with
`generate_release_notes: true`. There is intentionally no test step in release:
`build.yml` already gates main, and a release tag should point at an
already-green commit, so re-running the suite would be redundant work on the
delivery path.

## 3. Why no more than this

The cutline discipline from the spine (vision Section 8) applies to
infrastructure too. Things deliberately left out of v1.0 CI:

- No matrix builds. One OS (`ubuntu-latest`) and one Node (`.nvmrc`) match how
  the plugin actually ships; esbuild output is platform-neutral.
- No separate publish job, caching layers beyond npm, or release-please style
  automation. A solo maintainer running `npm version` then `git push
  --follow-tags` is the whole release ritual, and it works.
- No code signing or provenance attestation. Display-only, file-safe plugin;
  not worth the complexity at v1.0.

## 4. Optional future steps (noted, not implemented)

- A `v1.0.0-rc1` rehearsal tag to exercise `release.yml` end to end before the
  real `1.0.0` tag, confirming the quartet uploads and the version guard passes.
  Useful precisely because release is the only delivery channel and the stale-
  release bug already bit once.
- Moving `actions/checkout` to `@v6` after a one-time re-test.
- If v1.2 "Share and scale" ever ships downloadable rule packs as release assets,
  the quartet check would grow to cover them; that is a v1.2 concern, not now.

## 5. Adoption

See `ci/README.md`. In short: copy `ci/build.yml` and `ci/release.yml` over the
live files in `.github/workflows/`, then commit with a `chore(ci):` message.
Nothing else (no secrets, no settings) changes. The release flow stays `npm
version <new>` then `git push --follow-tags`; `version-bump.mjs` keeps
`manifest.json` and `versions.json` in step, and the new guard verifies that work
was done before anything is published.
