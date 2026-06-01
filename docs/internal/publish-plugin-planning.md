# Publishing Tag Curator as a community plugin: readiness plan

Status: planning (authored 2026-06-01). This document covers what it takes to prep this
repo's structure to be a "proper" Obsidian plugin and list it in the in-app community
plugin directory. It pairs the official Obsidian requirements with an honest audit of
this repo and a code-level review-readiness scan.

Sources: Obsidian developer docs (`obsidianmd/obsidian-developer-docs`, fetched via
Context7) for requirements; direct file/git audit of this repo for current state; a
guideline-compliance scan of `src/`. Items below marked `[verify]` are general knowledge
that should be confirmed against the live docs at submission time (see Section 10).

Related docs: `docs/internal/v1-vision/07_ci-and-release.md`, `docs/internal/v1-vision/03_architecture_v1.md`, `docs/internal/scope-and-decisions.md`, `CHANGELOG.md`, `README.md`.

---

## 1. TL;DR readiness verdict

**Tag Curator is unusually close to community-directory ready.** The engineering is in
good shape: manifest fields are complete and rule-compliant, a release workflow already
attaches the correct asset trio with a tag/version guard, the license and README are
solid, and the code passes the highest-risk review checks (no `innerHTML`, no network or
telemetry, scoped observers, full teardown on unload).

What is genuinely missing or blocking is **process and version-state**, not capability:

1. **`main` is stale.** The directory reads `manifest.json` from the HEAD of the default
   branch (`main`), but `main` is the early-May skeleton and does not contain v1.0. The
   v1.0 work must be merged to `main` first. (This is the same "trunk left behind" issue
   noted elsewhere; it now becomes a hard submission prerequisite.)
2. **No plain `1.0.0` release exists.** Manifest, `package.json`, and the newest release
   are all on the pre-release `1.0.0-rc.1`. A directory listing must point at a plain
   SemVer release (`1.0.0`), tagged without a leading `v`.
3. **No submission has been started**, and the repo's own roadmap currently *defers*
   directory submission. That deferral is a decision to revisit (Section 7).
4. **Polish:** README has no real screenshots, and ~25 inline `style.*` assignments
   should move to CSS classes to satisfy the styling guideline (Section 5).

None of these are deep; the path from here to "listed" is a short, well-ordered sequence
(Section 6).

---

## 2. What "a proper Obsidian plugin" requires

### 2.1 Repo structure and root files

A community plugin is a **public GitHub repo** whose **default branch root** holds the
plugin's source and metadata. The directory and the in-app updater read from this branch.
Required/expected at the root of the default branch:

- `manifest.json` (required) - read from HEAD of the default branch for the listing.
- `versions.json` (required for multi-version compatibility) - maps plugin version to
  minimum Obsidian app version.
- `main.js` - the built bundle. Does NOT need to be committed; it is shipped as a
  **release asset**. (This repo gitignores `main.js` and builds it in CI, which is fine.)
- `styles.css` - only if the plugin ships CSS; shipped as a release asset. (This repo
  commits `styles.css` because it is hand-authored source, and also ships it.)
- `LICENSE` - any OSI-approved license. Apache-2.0 is acceptable.
- `README.md` - explains what the plugin does, how to install, and how to use it.

### 2.2 manifest.json fields and rules

Source: `Reference/Manifest.md`, `Reference/TypeScript API/PluginManifest.md`,
`Plugins/Releasing/Submit your plugin.md`.

Required (all strings):

| Field | Rule |
|---|---|
| `id` | Unique across the directory; **must not contain `obsidian`**. Becomes the plugin folder name. |
| `name` | Human-readable display name. `[verify]` must not start with `Obsidian` and should not contain the word "Plugin". |
| `version` | **SemVer `x.y.z`**, plain (no leading `v`, no pre-release suffix for a listed release). |
| `minAppVersion` | Minimum Obsidian app version the current release needs. |
| `description` | Concise functionality summary. `[verify]` keep under ~250 chars; no hype. |
| `author` | Author name. |

Optional:

| Field | Notes |
|---|---|
| `authorUrl` | Link to author site/profile. |
| `fundingUrl` | String URL, or an object mapping label to URL (e.g. `{"GitHub Sponsor": "..."}`). `[verify]` exact object schema. |
| `isDesktopOnly` | `true` only if you use Node/Electron/desktop-only APIs (hides it on mobile). If it works on mobile, leave `false` and test on mobile. |
| `helpUrl` | Link to docs/help. (Used by Obsidian's settings "help" affordance.) |

### 2.3 versions.json

Source: `Reference/Versions.md`. A flat object: **keys are plugin versions, values are the
minimum Obsidian app version** that plugin version needs. Example:

```json
{ "0.1.0": "1.0.0", "0.12.0": "1.1.0" }
```

On update, Obsidian serves the **latest plugin version whose required app version is `<=`
the user's installed Obsidian**, so users on older Obsidian still get the newest compatible
release instead of nothing. Keep it in sync whenever you bump `minAppVersion`.

### 2.4 Release artifacts and tagging

Source: `Plugins/Releasing/Submit your plugin.md`, `Release your plugin with GitHub Actions.md`.

- Create a **GitHub release whose tag exactly equals `manifest.json` `version`**.
- The tag is the **bare SemVer string, no leading `v`** (docs example: `git tag -a 1.0.0 -m "1.0.0"`).
- Attach to the release as binary assets: **`main.js`** (required), **`manifest.json`**
  (required), and **`styles.css`** (only if used).
- The official sample Action creates a **draft** release that you must then publish. (This
  repo's `release.yml` already publishes a non-draft release directly and marks it
  pre-release only when the tag contains `-`, so no manual publish-the-draft step is
  needed here.)

### 2.5 Plugin guidelines and developer policies (what reviewers enforce)

Docs-confirmed (`Plugins/Releasing/Plugin guidelines.md`):

- **Settings headings via `setHeading()`**, not raw `<h1>`/`<h2>`.
- **Sentence case** in UI text (settings, commands, buttons).
- **Do not hardcode styles in code.** Use CSS classes (ideally with Obsidian CSS
  variables like `var(--text-normal)`) so themes/snippets can override.

`[verify]` against the live Developer Policies / guidelines (you must agree to them during
submission):

- No remote code execution, no obfuscated/minified-to-hide source; functionality must be
  auditable.
- Telemetry requires explicit opt-in consent and disclosure; default off.
- Disclose any network use in the README.
- Do not include "plugin" in command names or prefix commands with the plugin name
  (Obsidian namespaces commands per plugin already).
- Prefer `this.app` over a global `app`.
- Clean up on unload via `registerEvent` / `registerInterval` / `registerDomEvent` and the
  `addCommand`/`addRibbonIcon`/`addSettingTab`/`registerView` helpers.
- Do NOT detach your custom leaves on unload (it breaks layout restoration).
- No default hotkeys.
- Set `isDesktopOnly` correctly; test on mobile if you claim support.

### 2.6 Submission process

Source: `Plugins/Releasing/Submit your plugin.md`.

1. Sign in at **community.obsidian.md**, link your GitHub account.
2. **Plugins > New plugin**, enter the repo URL.
3. Review and agree to the **Developer policies**; confirm ongoing support.
4. Mechanically this opens a PR against **`obsidianmd/obsidian-releases`** appending one
   entry to `community-plugins.json` (`[verify]` exact entry shape; established form is
   `{ id, name, author, description, repo: "owner/name" }`, matching the manifest).
5. An **automated validation bot** runs first (repo public, release exists with tag ==
   manifest version, assets attached, `id` unique and no `obsidian`, manifest well-formed).
6. A **human reviewer** audits the code against the guidelines/policies. Respond and push
   fixes (re-release if assets change).
7. On merge, the plugin appears in the in-app directory. **You submit once**; future
   updates are pulled automatically from new GitHub releases whose tag matches the new
   manifest version - no re-submission.

---

## 3. This repo today (audited values, verbatim)

`manifest.json` (HEAD of `feat/v1.0-curation-in-context`):

| Field | Value |
|---|---|
| `id` | `tag-curator` |
| `name` | `Tag Curator` |
| `version` | `1.0.0-rc.1` |
| `minAppVersion` | `1.9.10` |
| `description` | `Hide, flag, and curate noisy tags across Obsidian's UI. Display-only, file-safe, fully reversible.` (98 chars) |
| `author` | `JP Prisant` |
| `authorUrl` | `https://github.com/jprisant` |
| `helpUrl` | `https://github.com/jprisant/obsidian-tag-curator#readme` |
| `isDesktopOnly` | `false` |
| `fundingUrl` | absent |

`versions.json`: `{ "0.1.0": "1.9.10", "1.0.0": "1.9.10", "1.0.0-rc.1": "1.9.10" }`
(maintained by `version-bump.mjs` on `npm version`).

Tags / releases: `v0.1.0` (GitHub "Latest", leading-`v`, non-conforming) and
`1.0.0-rc.1` (GitHub "Pre-release", correctly prefix-free). No plain `1.0.0`. Both
releases carry the full asset quartet.

Workflows: `build.yml` (lint/typecheck/test/build/verify on PR + push to main) and
`release.yml` (on tag push: build, verify tag == manifest version with the no-`v`
convention, publish via `softprops/action-gh-release@v3` with manifest/main.js/styles.css/versions.json).

License: Apache-2.0. README: ~1,750 words, install (BRAT + manual) and usage, but two
unfilled screenshot placeholders. CHANGELOG: documents a `1.0.0` (2026-05-30) that was
never tagged.

---

## 4. Gap analysis (HAVE / PARTIAL / MISSING)

| Item | State | Note |
|---|---|---|
| Required manifest fields | HAVE | All present and rule-compliant. `id` has no "obsidian"; `name` does not start with "Obsidian". |
| `id` uniqueness in directory | `[verify]` | Confirm `tag-curator` is not already taken in `community-plugins.json`. |
| `versions.json` | HAVE | Valid mapping; already declares `1.0.0`. |
| Release workflow + assets | HAVE | Attaches the correct trio + versions.json; enforces tag == version, no `v`. Better than the official draft-based sample. |
| CI gate | HAVE | lint/typecheck/test/build on PR + main. |
| LICENSE (OSI) | HAVE | Apache-2.0, accepted. |
| README explains install + use | HAVE | Thorough; BRAT + manual install documented. |
| README screenshot/GIF | MISSING | Two placeholder comments, no images. Strongly encouraged for the listing. |
| `main.js` strategy | HAVE | Gitignored, built in CI, shipped as release asset (allowed). |
| `styles.css` | HAVE | Committed (source) and shipped. |
| Plain `1.0.0` release | MISSING | Newest release is `1.0.0-rc.1`; a listing needs a non-prerelease SemVer release. |
| Manifest on default branch HEAD | MISSING/BLOCKER | Directory reads manifest from `main` HEAD; `main` is the stale skeleton without v1.0. Merge required. |
| Tag hygiene | PARTIAL | `v0.1.0` is prefixed (wrong); the `1.0.0` tag must be prefix-free. |
| `community-plugins.json` submission PR | MISSING | Not started; roadmap currently defers it. |
| `fundingUrl` | OPTIONAL | Absent; add only if desired. |
| Plugin/social icon | MISSING (optional) | No icon asset in repo; not required for the listing, but a ribbon icon + repo social preview are nice. |
| CHANGELOG vs reality | PARTIAL | Claims `1.0.0` shipped; reconcile when cutting the real `1.0.0`. |

---

## 5. Code-level review readiness

A scan of all 28 files in `src/` against the checks Obsidian reviewers commonly apply.

### Strengths (credit these in the PR description)

- **No `innerHTML`/`outerHTML`/`insertAdjacentHTML` anywhere** - all DOM via `createEl`/
  `createDiv`/`setText`. (This is the single most common hard-rejection cause; clean.)
- **No remote code and no network/telemetry** - zero `fetch`/`requestUrl`/`XMLHttpRequest`/
  `eval`/`require`/`child_process`. Directly supports the "file-safe, no remote code" story.
- **Scoped observers** - per-container `MutationObserver`s registered with `disconnect()`
  cleanup (`observerBase.ts`). One deliberate exception (below).
- **Full teardown on unload** - `onunload()` unloads observers, flushes the sidecar, and
  runs `panicCleanup`; events go through `registerEvent`; views via `registerView`.
- **Does not detach its leaves on unload** (correct per guidelines).
- **TS hygiene** - no `var`, no `@ts-ignore`, a single localized `any`.
- **Settings use `setHeading()`** and sentence case.

### Things to fix or note before submitting (prioritized)

1. **(High - top reviewer flag) Move static inline styles to CSS classes.**
   - `ui/tagListView.ts:297-299` (empty-state cell: `textAlign`/`color`/`padding`).
   - `ui/tagListView.ts:231` (`th.style.cursor = 'pointer'`).
   - `ui/ruleEditor.ts:720-723` (confirm-modal footer flex layout).
2. **(High) Convert `style.display` show/hide toggles to a `.is-hidden` CSS class** toggled
   with `toggleClass`: `tagListView.ts:154,422,425`; `curationWorkspace/bulkBar.ts:87,90`;
   `curationWorkspace/tagTable.ts:155,176-177,186-187`; `stateBanner.ts:44,48`;
   `settingsTab.ts:403,406-407`. Mechanical.
3. **(Medium) Document-level listener lifecycle** in `curationWorkspace/rowMenu.ts:180-181`
   (`mousedown`/`keydown` on `document`): ensure they are removed even if the popover is
   torn down by a parent re-render (tie `close()` to the owning view's teardown).
4. **(Low) Unify the two `app.plugins` casts** - convert `settingsTab.ts:641` `as any`
   (+ eslint-disable) to the `as unknown as { plugins?: {...} }` form already used in
   `welcomeModal.ts:191`, removing the only literal `any`.
5. **(Low, optional) Use `registerDomEvent`** for plugin-owned raw `addEventListener`
   (e.g. `main.ts:123` status bar) for idiomatic cleanup.
6. **(Doc) Pre-empt two reviewer questions** in the PR: the body-scoped autocomplete
   observer (`autocompleteObserver.ts:107`, intentional because the suggestion popup is
   portaled to `body` and transient) and confirm the bare `app` at
   `autocompleteObserver.ts:87-89` is the injected `App`, not a global (rename to
   `this.app` if it is a field).

Only items 1 and 2 are likely to draw a review block; the rest is polish. The
runtime-computed inline styles (why-popover positioning `rowMenu.ts:155-163`, virtualization
geometry `tagTable.ts:173,234`) should stay inline and be noted as intentional if asked.

### One licensing note for the human reviewer

Tag Curator is **Apache-2.0**; its Notebook Navigator integration is **runtime-interop
only** (it reads NN's public API and decorates NN's DOM; it never copies NN's GPL-3.0
source). Call this out in the PR so the reviewer does not mistake interop for code reuse.

---

## 6. Critical path and sequencing

Ordered so each step unblocks the next. Steps that publish or submit are gated on your
explicit go.

1. **Finish v1.0 verification** (the BRAT smoke test of the four scopes) and land any
   must-fix feedback. (In progress.)
2. **Apply the review-readiness code fixes** (Section 5, items 1-2 at minimum) on the v1.0
   branch; keep CI green.
3. **Add at least one screenshot/GIF** to the README (Curation Workspace docked beside the
   tag pane is the natural hero shot).
4. **Reconcile the CHANGELOG** so the `1.0.0` entry matches the release you are about to cut.
5. **Merge `feat/v1.0-curation-in-context` into `main`** so the manifest at the default
   branch HEAD is the v1.0 manifest. (Hard prerequisite: the directory reads `main`.)
6. **Cut `1.0.0`**: `npm version 1.0.0` (so `version-bump.mjs` syncs manifest + versions.json),
   commit, tag `1.0.0` (no `v`), push the tag; `release.yml` publishes the non-prerelease
   release with assets. Verify the release is not marked pre-release.
7. **Verify directory preconditions**: repo public; `manifest.json` at `main` HEAD reads
   `1.0.0`; release `1.0.0` exists with `main.js` + `manifest.json` + `styles.css`; `id`
   `tag-curator` is free in `community-plugins.json`.
8. **Submit** via community.obsidian.md (or the `obsidian-releases` PR). Agree to policies,
   confirm support. In the PR description, credit the strengths in Section 5 and note the
   Apache/GPL interop boundary.
9. **Work the review**: fix bot flags, then human-review comments; re-release if assets change.
10. **Post-merge**: the listing tracks future releases automatically. Keep `versions.json`
    in sync on every `minAppVersion` bump.

---

## 7. Decisions and options (need your call)

1. **Submit now, or honor the deferral?** The README roadmap puts directory submission at
   "v2.0+" and the CHANGELOG at "v0.5+". The plugin is technically ready at 1.0.0.
   - Option A (recommended if confident in the four scopes): submit at 1.0.0 once merged +
     screenshotted + the two style fixes are done.
   - Option B: stay BRAT-only for a release or two to gather real-world feedback on the
     version-fragile scopes (NN/Properties/Autocomplete), then submit. Lower risk of a
     reviewer or user hitting a selector break.
2. **Default-branch strategy.** Recommended: merge v1.0 to `main` and make `main` the
   canonical trunk going forward (so the directory always reads current). Alternative:
   change the repo's default branch - not recommended; merging is cleaner.
3. **`fundingUrl`?** Add a sponsor/ko-fi link to the manifest, or leave absent.
4. **Mobile claim.** `isDesktopOnly: false` is set. Decide whether to actually verify on
   Obsidian mobile (the smoke matrix has a mobile cell) before claiming support, or flip to
   desktop-only if mobile is untested. The four scopes are DOM-based and likely work, but
   the status bar is desktop-only (already handled).
5. **Scope of the style refactor.** Minimal (Section 5 item 1 only) vs full (items 1-2).
   Recommended: do both before first submission; item 2 is mechanical and removes the most
   likely review nit.
6. **Icon / social preview.** Optional: add a ribbon icon and a GitHub social-preview image.

---

## 8. Pre-submission checklist

**A. Branch and structure**
- [ ] v1.0 merged into `main`; `main` HEAD `manifest.json` reads the release version
- [ ] Repo is public on GitHub
- [ ] Root of `main` has `manifest.json`, `versions.json`, `README.md`, `LICENSE`

**B. Version and release**
- [ ] `manifest.json` `version` is plain SemVer `1.0.0` (no `-rc`, no `v`)
- [ ] `package.json` version matches
- [ ] `versions.json` has a `1.0.0` -> `1.9.10` entry (already present)
- [ ] Git tag `1.0.0` created (no leading `v`) and pushed
- [ ] GitHub release `1.0.0` published, NOT marked pre-release, with `main.js` + `manifest.json` + `styles.css` attached
- [ ] CHANGELOG `1.0.0` entry matches the actual release

**C. Manifest hygiene**
- [ ] `id` = `tag-curator` confirmed free in `community-plugins.json` `[verify]`
- [ ] `name` does not start with "Obsidian" / contain "Plugin" (ok: "Tag Curator")
- [ ] `description` <= ~250 chars, no hype (ok: 98 chars)
- [ ] `minAppVersion` correct for the APIs used
- [ ] `isDesktopOnly` decision finalized

**D. README and visuals**
- [ ] At least one real screenshot/GIF added (hero: workspace beside the tag pane)
- [ ] Install + usage + safety/compatibility sections current
- [ ] Any network use disclosed (none - state "no network access" explicitly)

**E. Code review-readiness**
- [ ] Static inline styles moved to CSS classes (Section 5.1)
- [ ] `style.display` toggles converted to a `.is-hidden` class (Section 5.2)
- [ ] `rowMenu.ts` document-listener lifecycle hardened (Section 5.3)
- [ ] `app.plugins` casts unified; no literal `any` (Section 5.4)
- [ ] `lint && typecheck && test && build` all green

**F. Policy/guidelines**
- [ ] No remote code / telemetry (confirmed clean)
- [ ] Settings use `setHeading()` + sentence case (confirmed)
- [ ] No default hotkeys (confirmed - none shipped)
- [ ] Commands not prefixed with plugin name / "plugin" `[verify]` against current command labels
- [ ] Reviewed live Developer policies + Plugin guidelines pages

**G. Submission**
- [ ] Submitted via community.obsidian.md (or `obsidian-releases` PR)
- [ ] PR description credits strengths + notes the Apache/GPL NN interop boundary + the intentional body-scoped autocomplete observer
- [ ] Agreed to Developer policies; confirmed ongoing support

**H. Post-submission**
- [ ] Bot checks green
- [ ] Human-review comments addressed (re-release if assets changed)
- [ ] On merge: confirm the in-app directory listing renders correctly

---

## 9. Risks and reviewer-likely flags

- **Style-in-JS** (Section 5.1-5.2) - the most probable review nit; fix before submitting.
- **Version-fragile scopes** - NN/Properties/Autocomplete decorate non-core DOM. A future
  Obsidian or plugin update could break a selector. Mitigation already in place: per-scope
  kill switches + graceful no-op. Worth noting in the README's "known limitations".
- **`main` drift** - if v1.0 is not merged, the directory will list a stale manifest. Hard
  blocker, addressed in Section 6 step 5.
- **`id` collision** - verify `tag-curator` is unused before submitting.
- **Mobile claim** - `isDesktopOnly: false` should be backed by an actual mobile test, or flipped.

---

## 10. Open questions to verify against live docs at submission time

These were general knowledge or not fully returned by the docs fetch:

1. Exact `community-plugins.json` entry shape and the `repo` (`owner/name`) format - confirm
   against the live `obsidianmd/obsidian-releases` PR template.
2. The precise list of automated validation-bot checks - read the bot output on the PR.
3. Exact `name` naming rule wording (no "Obsidian" prefix, no "Plugin") - confirm on the
   live Plugin guidelines page (only the `id` rule was docs-confirmed).
4. `fundingUrl` object schema (label -> URL) if you choose the object form.
5. Current Developer policies wording (remote code, telemetry, command naming, mobile) -
   you agree to these during submission; read them then.
6. Whether `tag-curator` is an available `id` in the current directory.

---

## Appendix: source map

- Requirements: Obsidian developer docs via Context7 - `Plugins/Releasing/Submit your plugin.md`,
  `Plugins/Releasing/Release your plugin with GitHub Actions.md`, `Plugins/Releasing/Plugin guidelines.md`,
  `Reference/Manifest.md`, `Reference/TypeScript API/PluginManifest.md`, `Reference/Versions.md`.
- Repo state: direct audit of `manifest.json`, `package.json`, `versions.json`, `styles.css`,
  `.gitignore`, `.github/workflows/*.yml`, `LICENSE`, `README.md`, `CHANGELOG.md`, git tags/releases.
- Code readiness: guideline-compliance scan of all files under `src/`.
