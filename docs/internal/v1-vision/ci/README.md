# How to adopt these workflows

These two files are a proposal. They do not touch the live `.github/workflows/`
until you adopt them. See `../07_ci-and-release.md` for the full rationale.

## Adopt (one step each)

1. Copy `build.yml` over `.github/workflows/build.yml`.
2. Copy `release.yml` over `.github/workflows/release.yml`.
3. Commit: `chore(ci): bump runner actions to current majors; gate release on tag/manifest match`.

That is the whole adoption. No new secrets, no new tooling, no repo-settings change.

## What changed at a glance

- `actions/checkout` v4 -> v5, `actions/setup-node` v4 -> v5,
  `softprops/action-gh-release` v2 -> v3 (these bring Node 24, clearing the
  "Node 20 actions deprecated, Node 24 forced 2026-06-02" warning).
- Node version now comes from `.nvmrc` via `node-version-file` instead of a
  hardcoded `'20'`. Bump Node by editing `.nvmrc` alone.
- `build.yml` gains a `concurrency` group with `cancel-in-progress`.
- `release.yml` gains a "verify manifest version matches tag" guard so a
  mis-tagged release fails loudly instead of publishing a wrong asset set.
- `build.yml` artifact check now also asserts `versions.json` (matches the
  release quartet exactly).

## Release flow (unchanged shape, safer)

```
npm version <new>     # version-bump.mjs syncs manifest.json + versions.json
git push --follow-tags
# -> release.yml builds, verifies tag == manifest version, publishes the quartet
```

`main.js` and `styles.css` are gitignored: they exist only as release assets.
That is why BRAT needs the release, and why a missed release means a stale BRAT
install. Bump the version on every BRAT-facing change so BRAT re-fetches.

## Optional, not adopted here

- A `v1.0.0-rc1` rehearsal tag to dry-run `release.yml` before the real tag.
- If you later move to `actions/checkout@v6`, re-test once; v5 is the
  conservative current major chosen here.
