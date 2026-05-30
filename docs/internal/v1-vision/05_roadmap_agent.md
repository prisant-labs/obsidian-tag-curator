---
title: Tag Curator v1 - Agent Execution Plan ("go" entrypoint)
status: proposal (awaiting "go"; on "go" this is the plan an agent executes phase by phase)
author: claude (opus-4.8), ultracode session
date: 2026-05-30
target-milestone: v1.0 "Curation, in context"
branch-strategy: >
  One feature branch off release/v0.1.0 (or main if release/v0.1.0 is absent at
  go-time): feat/v1.0-curation-in-context. Commit at every task boundary with
  conventional-commit messages. No push, no tag, no remote or destructive action
  without an explicit STOP-and-ask. Phases land in order; each phase ends green.
canonical-spine:
  - 01_vision-and-ux-thesis.md (Section 7 milestone map, Section 8 v1.0 cutline, Section 5.1 ubiquitous language)
  - 02_decisions_v1.md (D-012..D-017)
companion-docs:
  - 03_architecture_v1.md (the how)
  - 04_roadmap_human.md (the why, for people)
  - 06_getting-started.md (user onboarding)
  - 07_ci-and-release.md (+ ci/ workflow files)
---

# Tag Curator v1.0 - Agent Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to execute this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax; check each box in this file as you complete it.
> This file is the "go" entrypoint named in `01_vision-and-ux-thesis.md` Section 0.
> The spine wins on any disagreement: milestone names and the v1.0 cutline come
> from `01_vision-and-ux-thesis.md` Sections 7-8; decisions from `02_decisions_v1.md`.

---

## Task Summary

**State of the world (read this first).** Tag Curator has a complete, tested
engine and storage layer and a merged host-agnostic UI core. The engine
(`src/engine/ruleEngine.ts`) does three match types (regex / frequency / list)
with highest-priority-wins resolution (Q-005) and `getRuleAttribution` for
"why is this hidden?" diagnostics. Storage (`src/storage/settings.ts`,
`src/storage/tagMeta.ts`) is schema-versioned at `SCHEMA_VERSION = 3` with
atomic writes and a `tags.json` sidecar. The observer pattern is extracted:
`ObserverBase` (`src/observers/observerBase.ts`) owns the scoped MutationObserver
lifecycle and `TagPaneObserver` is its first concrete subclass. The shared tag
UI core is merged and headless-tested: `TagListModel` (rows, visibility, filter
chips, search, sort, selection) and `TagActions` (Tag Wrangler delegation, a
typed `reason: 'b009'` deferral for per-tag visibility). Notebook Navigator
compatibility is in flight on `feat/nn-compat-phase1`: detection + version
gating (`src/integrations/notebookNavigator.ts`) and a hand-written local API
type (`src/integrations/notebookNavigatorApi.ts`) are landed; the NN DOM
decorator is the next step. Trust surfaces (welcome modal, state banner, panic
disable, status bar) are built. The Settings "Tag list" tab is a stub because an
`ItemView` cannot mount in a `PluginSettingTab`.

**What this plan builds.** v1.0 "Curation, in context": the move that takes the
active curation loop out of the Settings modal and into a **Curation Workspace**
leaf (`ItemView`) that docks beside the native tag pane so every change lands in
real time. It also completes scope coverage (tag pane, Notebook Navigator,
Properties, Autocomplete - each independently kill-switchable), makes per-row
actions real with a persisted per-tag **overrides** store, thins Settings to
set-once config, and ships the ecosystem and trust polish. This is the exact
11-item cutline in `01_vision-and-ux-thesis.md` Section 8.1, grounded in the
decisions D-012..D-017.

**Phases (all NOT DONE initially).**

1. [ ] **Phase 0** - Promote decisions D-012..D-017 into `scope-and-decisions.md`; update the in-scope/future tables to the v1.0 cutline. (Cutline item: discipline; no code.)
2. [ ] **Phase 1** - Schema v3->v4 + `overrides` store + override resolution in the engine (always-show beats always-hide beats rules). TDD. (Cutline item 6.)
3. [ ] **Phase 2** - Curation Workspace `ItemView` shell (`CurationWorkspaceView`, `CURATION_VIEW_TYPE`) rendering from `TagListModel`/`TagActions`; replace the Settings "Tag list" stub with an "Open Curation Workspace" launcher; thin the Settings tab. (Cutline items 1, 7.)
4. [ ] **Phase 3** - Workspace internals: virtualized sortable tag table with filter chips + search + multi-select bulk actions, inline rule editor (card + right-docked preview, D-010), per-row diagnostics + per-row override actions (now real). (Cutline item 1.)
5. [ ] **Phase 4** - "Open Curation Workspace beside the tag pane" split command (D-013) + live reaction wiring. (Cutline item 2.)
6. [ ] **Phase 5** - Scope: finish the Notebook Navigator observer (`NotebookNavigatorObserver extends ObserverBase`, per the nn-compat plan) + the per-scope kill switch. (Cutline item 3.)
7. [ ] **Phase 6** - Scope: Properties panel observer (`ObserverBase` subclass; synthetic-DOM tests). (Cutline item 4.)
8. [ ] **Phase 7** - Scope: Autocomplete suppression observer (`ObserverBase` subclass; default-on, kill-switchable). (Cutline item 5.)
9. [ ] **Phase 8** - Settings "Scopes" section (per-scope toggles, D-014) + Integrations section. (Cutline item 7.)
10. [ ] **Phase 9** - Ecosystem: Style Settings `/* @settings */` block in `styles.css`; Tag Wrangler menu composition + verify the bulk "Send to Tag Wrangler" delegation; compatibility README section. (Cutline items 9, 10, 11.)
11. [ ] **Phase 10** - Trust polish: de-overclaim the welcome-modal integration-card copy to match what v1.0 actually ships; verify state banner + panic + status bar across the new surfaces. (Cutline item 8.)
12. [ ] **Phase 11** - Docs + CI adoption: adopt the proposed CI from `docs/internal/v1-vision/ci/`; update README/CHANGELOG/TESTING for v1.0; bump manifest/version.
13. [ ] **Phase 12** - Release rehearsal: `v1.0.0-rc` tag dry-run (STOP for user confirmation before any tag push), BRAT smoke matrix, then tag `v1.0.0`.

---

## Execution discipline

Read this once; it applies to every phase.

- **Branch.** At go-time, check repo state with `git status --short && git branch --show-current && git branch --list release/v0.1.0`. If `release/v0.1.0` exists, branch from it; otherwise branch from `main`. Create one feature branch:
  ```bash
  git checkout release/v0.1.0 2>/dev/null || git checkout main
  git pull --ff-only
  git checkout -b feat/v1.0-curation-in-context
  ```
  Do all work on this branch. Do NOT create the branch if there are uncommitted changes; STOP and ask the user first.
- **Conventional commits.** Every commit message is `type(scope): summary` (`feat`, `fix`, `refactor`, `docs`, `chore`, `test`). Each phase below ends with its exact commit message(s). Commit at task boundaries, never mid-task. Never use em-dashes or en-dashes in any message, file, or comment - use " - " or restructure.
- **The gate.** After every task (every code-bearing step group), run the full verification chain and confirm it is green before committing:
  ```bash
  npm run lint && npm run typecheck && npm test && npm run build
  ```
  `lint` runs `eslint src --ext .ts,.tsx --max-warnings 0`; `typecheck` runs `tsc --noEmit`; `test` runs `vitest run`; `build` runs the esbuild production bundle. If any link in the chain fails, fix it before moving on. For TDD tasks, the failing-test step is expected to fail at `npm test`; that is the only time a red gate is acceptable, and only for the new test.
- **TDD ordering.** This repo is vitest-heavy. Where a task adds logic, write the failing test first, watch it fail for the right reason, then implement until green. Phases 1, 5, 6, 7 are strict TDD; UI-shell phases (2, 3, 4) test the headless seams (model/actions/resolution) and verify DOM via happy-dom where the existing suites already do.
- **STOP-and-ask gates.** STOP and ask the user before: any `git push`; any `git tag`; any `gh release`/publish; any force-push, hard reset, branch delete, or history rewrite; any write outside the repo working directory; installing new runtime dependencies. Building, committing locally, and running tests need no gate.
- **Check off as you go.** As each step completes, edit this file to turn its `- [ ]` into `- [x]`. Update the Task Summary phase checklist when a whole phase is done. This file is the live progress record (the v0.1 plan's checkboxes drifted because they were never synced - do not repeat that).
- **Source-of-truth order when this plan and reality disagree.** Spine (`01`, `02`) for scope and decisions; `src/`+`tests/` for current code shape; this file for execution order. If the code already does something this plan prescribes, mark the step done and move on rather than redoing it.

---

## Phase 0: Promote decisions

**Goal.** Land D-012..D-017 from `02_decisions_v1.md` into the master
`docs/internal/scope-and-decisions.md` with status `Accepted` and today's date,
and re-cut the in-scope / future tables to the v1.0 cutline. No source code
changes. This is the "promote the proposed decisions" step from the spine's
Section 0 go-protocol.

**Preconditions.** On `feat/v1.0-curation-in-context`. `02_decisions_v1.md` and
`scope-and-decisions.md` both present and readable.

- [ ] **Step 1: Append D-012..D-017 to the decisions log.** Edit `docs/internal/scope-and-decisions.md`. After the last decision/question block in Section 2, add D-012 through D-017, copied from `02_decisions_v1.md` verbatim in the master's **Context / Desired outcome / Approaches / Decision / Status** format. For each, flip Status from `Proposed (2026-05-30)` to `Accepted (2026-05-30)` and preserve the "extends / supersedes" lineage line (D-012 supersedes the D-011 dual-host goal; D-013 extends D-003+D-007; D-014 extends spec 4.1/7.2; D-015 closes B009 for v1.0; D-016 extends spec 3/6; D-017 sequences B006). Acceptance: all six IDs appear in Section 2; each has a non-empty Decision and a `Status: Accepted (2026-05-30)`.
- [ ] **Step 2: Update the in-scope table to the v1.0 cutline.** In `scope-and-decisions.md` Section 1.1, retitle to reflect v1.0 and add rows for the 11 cutline items from `01_vision-and-ux-thesis.md` Section 8.1: Curation Workspace leaf; "open beside" split command; NN scope; Properties scope; Autocomplete scope; per-tag overrides; thin Settings + Scopes section; trust polish; Style Settings registration; Tag Wrangler menu + bulk delegation; compatibility doc. Acceptance: every cutline item has a row with a one-line "why in v1.0" note matching Section 8.1.
- [ ] **Step 3: Update the future/deferred table.** In Section 1.2, set the targets from `01_vision-and-ux-thesis.md` Section 8.2: aliases/display-merge -> v1.1; stale + near-duplicate match types + suggested merges -> v1.1; inbox mode -> v1.1; graph view scope -> v1.1; profiles -> v1.2; export/import + community packs -> v1.2; compound criteria + drag-to-reorder -> v1.2. Reconcile legacy backlog IDs (B001 compound -> v1.2; B006 aliases -> v1.1) without deleting them. Acceptance: no deferred item points at a milestone the spine does not assign it.
- [ ] **Step 4: Add a changelog entry.** Append a dated line to the `scope-and-decisions.md` Changelog: "2026-05-30 - Promoted D-012..D-017 (v1 vision bundle) to Accepted; re-cut Section 1 to the v1.0 cutline. v1.0 theme: Curation, in context."

**Commit message:** `docs(scope): promote D-012..D-017 and re-cut scope tables to the v1.0 cutline`

**Definition of done.** D-012..D-017 are Accepted and dated in the master log; Section 1 tables match Section 8 of the spine exactly; no source code touched; `git status` shows only `docs/internal/scope-and-decisions.md` changed.

---

## Phase 1: Schema v3->v4 + overrides store + engine override resolution

**Goal.** Add a persisted per-tag **override** primitive (`always-show` /
`always-hide`) resolved ahead of rules, with a guarded v3->v4 migration
defaulting `overrides` to `{}`. Precedence (D-015): **always-show beats every
rule; always-hide beats every rule except always-show.** This makes the
workspace's per-row actions real (cutline item 6). Strict TDD.

**Preconditions.** Phase 0 committed. `SCHEMA_VERSION` is currently `3` in
`src/types.ts:1`. The v2->v3 migration pattern is in `src/storage/settings.ts:64-70`.

- [ ] **Step 1 (TEST FIRST): migration test for v3->v4.** Append to `tests/settings.test.ts` cases that load a v3 `data.json` (`schemaVersion: 3`, no `overrides`) and assert the migrated settings have `schemaVersion === 4` and `overrides` deep-equal `{}`; load a v4 file with `overrides: { foo: 'show', bar: 'hide' }` and assert it is preserved unchanged; load a future-version file (`schemaVersion: 99`) and assert `migrate` does not downgrade and `load` does not persist (mirror the existing future-version guard test). Run `npx vitest run tests/settings.test.ts`; expect FAIL (no `overrides` field yet).
- [ ] **Step 2 (TEST FIRST): precedence test for the engine.** Create `tests/overrideResolution.test.ts`. Assert a new `RuleEngine.resolveVisibility(tag, meta, rules, overrides)` (or the chosen entrypoint - see Step 5) returns, for a tag with `overrides[tag] === 'show'`, a result that is visible even when a hide rule also matches (always-show wins); for `overrides[tag] === 'hide'` with no rule, a hidden result attributed to the override; for `overrides[tag] === 'hide'` AND a matching hide rule, hidden attributed to the override (override is the effective reason, not the rule); for no override, the existing rule attribution is returned unchanged. Run `npx vitest run tests/overrideResolution.test.ts`; expect FAIL (function does not exist).
- [ ] **Step 3: add the `overrides` type and default.** Edit `src/types.ts`: bump `SCHEMA_VERSION` to `4`; add `export type TagOverride = 'show' | 'hide';`; add `overrides: Record<string, TagOverride>;` to `TagCuratorSettings` (after `customRules`); add `overrides: {}` to `DEFAULT_SETTINGS`. Add an `overrideReason?: 'always-show' | 'always-hide'` discriminator to `AttributedMatch` OR introduce a small `OverrideAttribution` type the resolver returns (pick the lower-churn option; document the choice in the resolver doc comment). Acceptance: `tsc --noEmit` compiles types in isolation.
- [ ] **Step 4: migrate v3->v4 in settings.** Edit `src/storage/settings.ts`: extend `migrate` with `if (inferred < 4) { if (typeof merged.overrides !== 'object' || merged.overrides === null) merged.overrides = {}; }`. Add an `LegacyV0Settings` note if needed. Add `async setOverride(tag: string, value: TagOverride | null): Promise<void>` that sets `overrides[tag] = value` (or `delete`s the key when `value === null`), then `persist()`. Acceptance: `npx vitest run tests/settings.test.ts` PASSES (Step 1 green).
- [ ] **Step 5: implement override resolution in the engine.** Edit `src/engine/ruleEngine.ts`: add a static `resolveVisibility(tag, tagMeta, rules, overrides)` that (a) if `overrides[tag] === 'show'` returns a visible/`shown` result attributed to `always-show` regardless of rules; (b) if `overrides[tag] === 'hide'` returns a hidden result attributed to `always-hide` regardless of rules; (c) otherwise falls through to `getRuleAttribution`. Keep `getRuleAttribution`, `evaluateTag`, `getAllMatches` intact (they are used elsewhere and by the observer base). Acceptance: `npx vitest run tests/overrideResolution.test.ts` PASSES (Step 2 green) and `tests/ruleEngine.test.ts` still passes unchanged.
- [ ] **Step 6: route the model and the observer base through overrides.** Edit `src/ui/tagList/tagListModel.ts` `allRows()`: read `settings.overrides` and call `RuleEngine.resolveVisibility` so a `show` override forces `visibility: 'shown'` and a `hide` override forces `'hidden'`/`'flagged'` (preview) with the override recorded in `matches`/attribution. Edit `src/observers/observerBase.ts` `apply()`: thread an `overrides` field (add `protected overrides: Record<string, TagOverride> = {}` + `setOverrides()` that calls `scheduleApply()`) and evaluate via `resolveVisibility` so always-show un-hides a rule-hidden tag in every scope and always-hide hides it. Update `tests/tagListModel.test.ts` and `tests/observerBase.test.ts` with override cases (always-show un-hides a rule-matched tag; always-hide hides an unmatched tag). Acceptance: full `npm test` green including the new cases.
- [ ] **Step 7: wire `setOverrides` from `main.ts`.** Edit `src/main.ts`: in the initial observer setup and in the `settingsManager.onChange` handler and `onExternalSettingsChange`, call `this.tagPaneObserver.setOverrides(next.overrides)` (and later, every scope observer). Acceptance: gate green.
- [ ] **Step 8: run the gate.** `npm run lint && npm run typecheck && npm test && npm run build`. Expect all green.

**Commit messages (commit at the boundaries shown):**
- `test(overrides): failing v3-to-v4 migration + precedence specs`
- `feat(overrides): persisted per-tag override store with v3-to-v4 migration`
- `feat(engine): resolveVisibility with always-show > always-hide > rules precedence`
- `feat(overrides): route model + observer base through override resolution`

**Definition of done.** `SCHEMA_VERSION === 4`; `overrides: Record<string, 'show'|'hide'>` exists in settings with a guarded migration; `RuleEngine.resolveVisibility` enforces the D-015 precedence; model and observer base honor overrides; new migration + precedence tests pass; full gate green.

---

## Phase 2: Curation Workspace ItemView shell + thin Settings

**Goal.** Stand up `CurationWorkspaceView` (an `ItemView`, view type
`CURATION_VIEW_TYPE`) that renders the merged `TagListModel`/`TagActions` core,
register it, add commands and a status-bar entry point, replace the Settings
"Tag list" stub with an "Open Curation Workspace" launcher, and thin the
Settings tab toward set-once config (D-012; cutline items 1 shell + 7 partial).
Internals (table virtualization, inline editor, per-row actions) come in Phase 3;
this phase delivers a working leaf that lists tags and opens reliably.

**Preconditions.** Phase 1 committed. `TagListView`/`TAG_LIST_VIEW_TYPE` exist in
`src/ui/tagListView.ts` and are wired in `main.ts:6,33`. The Settings "Tag list"
tab stub is `renderTagListTab` in `src/ui/settingsTab.ts:241-271`.

- [ ] **Step 1: create the view + data-source adapter.** Create `src/ui/curationWorkspace/curationWorkspaceView.ts` exporting `CURATION_VIEW_TYPE = 'tag-curator-workspace'` and `class CurationWorkspaceView extends ItemView`. Implement `getViewType()`, `getDisplayText()` ("Curation Workspace"), `getIcon()` ('tags'), `onOpen()`, `onClose()`. Build a `TagListDataSource` adapter (`getSettings: () => plugin.settingsManager.get()`, `getMeta: () => plugin.tagMetaManager.all()`) and a `TagActionsHost` adapter (`isPluginEnabled`, `executeCommand` via `app`), and instantiate `new TagListModel(dataSource)` + `new TagActions(host)`. `onOpen` renders a `StateBanner` (reuse `src/ui/stateBanner.ts`) above the content, then a minimal table from `model.rows()` (tag, count, visibility) - just enough to prove the leaf renders live data. Subscribe to `plugin.settingsManager.onChange` and the tag-meta `changed` event via `this.registerEvent`-equivalent so the table refreshes; tear down in `onClose`.
- [ ] **Step 2: register the view + commands + status bar in main.ts.** Edit `src/main.ts`: `this.registerView(CURATION_VIEW_TYPE, (leaf) => new CurationWorkspaceView(leaf, this))`. Add commands `open-curation-workspace` ("Open Curation Workspace") and keep the existing tag-list commands for now. Add `addRibbonIcon('tags', 'Open Curation Workspace', () => this.openCurationWorkspace())`. Repoint the status-bar click handler to `openCurationWorkspace` (the workspace replaces the tag-list leaf as the home; keep the hidden-filter intent by passing an initial filter). Implement `openCurationWorkspace(opts?)`: find an existing leaf of `CURATION_VIEW_TYPE`, else open in the right sidebar (`getRightLeaf(false)`) per spine Section 11 default, then `revealLeaf`.
- [ ] **Step 3: replace the Settings "Tag list" stub with a launcher.** Edit `src/ui/settingsTab.ts`: rename the `taglist` tab to a launcher (or fold it into General per the thin-Settings direction). Replace `renderTagListTab` body with a single prominent "Open Curation Workspace" CTA (calls `plugin.openCurationWorkspace`) plus a one-line readout ("The Curation Workspace is where you see, edit, preview, and act on tags. Settings holds set-once config."). Remove the stale "lands with the Tag list view rewrite in Phase 3" copy. Acceptance: opening Settings shows the launcher, not the old stub callout.
- [ ] **Step 4: thin the Settings tab (first pass).** Edit `src/ui/settingsTab.ts`: keep the safety row (enable, preview mode, panic) in General; mark the `profiles`/`aliases` deferred tabs' target text as v1.1/v1.2 (was v0.2/v0.3) to match the spine; leave Presets/Advanced. Do NOT yet add the Scopes section (Phase 8) - just ensure nothing references the removed stub. Acceptance: Settings compiles and renders; no dead references to `renderTagListTab`'s old body.
- [ ] **Step 5: keep `TagListView` working or retire it deliberately.** Decision: keep `TagListView` registered for one release so existing `open-tag-list` commands and any saved workspace layouts do not break, but make the status bar and ribbon point at the workspace. Add a short deprecation note in `tagListView.ts`'s header comment ("superseded by CurationWorkspaceView per D-012; retained for layout compatibility, slated for removal in v1.1"). Acceptance: both view types register without console errors.
- [ ] **Step 6: run the gate.** `npm run lint && npm run typecheck && npm test && npm run build`. Expect green. Add a happy-dom smoke test `tests/curationWorkspaceView.test.ts` only for the headless seam if the existing harness supports `ItemView` construction with a stub leaf; otherwise rely on the model tests and note manual verification in TESTING (Phase 11).

**Commit messages:**
- `feat(workspace): CurationWorkspaceView ItemView shell on the shared tag core`
- `feat(workspace): register view, open command, ribbon, and status-bar entry`
- `refactor(settings): replace Tag list stub with Open Curation Workspace launcher`

**Definition of done.** `CURATION_VIEW_TYPE` registers; the workspace opens from command, ribbon, and status bar; it renders live tags from `TagListModel`; the Settings "Tag list" stub is gone, replaced by a launcher; deferred-tab targets read v1.1/v1.2; full gate green.

---

## Phase 3: Workspace internals

**Goal.** Build the real Curation Workspace: a virtualized, sortable tag table
with filter chips + search + multi-select bulk actions; the inline rule editor
(card view + right-docked preview, exactly D-010); per-row "why is this hidden?"
diagnostics; and per-row override actions (always-show / always-hide) that now do
real work because Phase 1 shipped the store. This is the body of cutline item 1.

**Preconditions.** Phases 1-2 committed. `CurationWorkspaceView` renders a
minimal table. `TagListModel` already provides `rows()`, filter chips
(`all|hidden|orphans|frontmatter|unreviewed`), `setSearch`, `setSort`,
selection. `RuleEditor` (`src/ui/ruleEditor.ts`) already implements the D-010
card + right-docked preview for the Settings Custom-rules tab and can be reused.

- [ ] **Step 1: extend the filter-chip set to the spine's list.** The spine
  (Section 4.1) lists chips Hidden, Flagged, Orphans, Frontmatter, Inline,
  Unreviewed, By rule. Edit `src/ui/tagList/tagListModel.ts`: add `'flagged'`,
  `'inline'` to `FilterChip` and `matchesFilter` (flagged = `visibility === 'flagged'`;
  inline = sources is exactly `['inline']`). Add a `byRule(ruleId)` filter mode
  (a method `setRuleFilter(ruleId | null)` that, when set, keeps only rows whose
  `matches` include that ruleId). Append tests to `tests/tagListModel.test.ts` for
  the new chips. TEST FIRST; then implement; gate green.
- [ ] **Step 2: build the virtualized table component.** Create `src/ui/curationWorkspace/tagTable.ts` (a plain DOM component, no framework) that renders `model.rows()` into a windowed list: only render rows in the visible range plus a buffer, recomputing on scroll, so 1,500+ tags stay smooth (success criterion in spine Section 9). Columns: tag, count, first/last seen, source, visibility dot, affecting rule. Header cells call `model.setSort(key)` and re-render. A search input calls `model.setSearch`. A chip bar reflects `model.activeFilter` and calls `model.setFilter`. Multi-select via a per-row checkbox calling `model.toggleSelect`; a "select all matching" affordance per Q-004 (virtualized, no pages). Wire `CurationWorkspaceView` to mount `TagTable`.
- [ ] **Step 3: bulk action bar.** In `tagTable.ts` (or a sibling `bulkBar.ts`), when `model.selection.size > 0`, show a bar with hide / unhide / flag / send-to-tag-wrangler. Route through `TagActions.applyBulk`. For hide/unhide, the action now calls a real per-tag override path (see Step 5), not the `b009` deferral - update `TagActions.setVisibility` to take an override-writer host hook (see Step 5) and return real `applied` counts. "Send to Tag Wrangler" stays delegated and shows the disabled-with-tooltip state when Tag Wrangler is absent (D-016).
- [ ] **Step 4: inline rule editor in the leaf.** Mount `RuleEditor` (`src/ui/ruleEditor.ts`) inside the workspace as a panel toggled from the table ("Rules" view vs "Tags" view, or a side panel). Confirm it renders the card view + right-docked preview (D-010) and writes via `settingsManager.addCustomRule/updateCustomRule/deleteCustomRule`. The editor must never leave the leaf (spine Section 4.1). If `RuleEditor` needs a host container abstraction to live in both Settings and the leaf, extract the minimal seam; do not duplicate the editor.
- [ ] **Step 5: per-row override actions (now real).** Add to `TagActions` a host hook `setOverride(tag, 'show'|'hide'|null)` backed by `plugin.settingsManager.setOverride` (Phase 1). Replace the `reason: 'b009'` deferral in `setVisibility` with real writes that return `{ applied, deferred: 0 }`. Per row, render an action menu: "Always show", "Always hide", "Clear override", and "Why is this hidden?" (Step 6). Update `tests/tagActions.test.ts`: `setVisibility(['a'],'hide')` now returns `{ applied: 1, deferred: 0 }` and calls the host `setOverride`. TEST FIRST for the new TagActions contract; then implement; gate green.
- [ ] **Step 6: per-row diagnostics.** Add a "Why is this hidden?" affordance per row that opens a small popover/inline panel built from `RuleEngine.resolveVisibility` / `getRuleAttribution`: show the effective reason (an override reads "Always-hidden by you" / "Always-shown by you"; a rule reads its name + human reason from `AttributedMatch.reason`) and the full match chain. No new engine code - consume Phase 1 output.
- [ ] **Step 7: run the gate + headless tests.** `npm run lint && npm run typecheck && npm test && npm run build`. Add headless tests for any new pure logic (the windowing range math in `tagTable.ts` can be unit-tested without DOM by extracting a `visibleRange(scrollTop, rowHeight, viewportH, total)` helper). Manual DOM behaviors (scroll smoothness, popover) are logged in TESTING (Phase 11).

**Commit messages:**
- `feat(taglist): flagged + inline + by-rule filter chips`
- `feat(workspace): virtualized sortable tag table with search and chips`
- `feat(workspace): multi-select bulk action bar`
- `feat(workspace): inline rule editor (card + right-docked preview) in the leaf`
- `feat(workspace): real per-tag override actions + per-row diagnostics`

**Definition of done.** The workspace shows a virtualized, sortable, filterable, searchable table; multi-select bulk hide/unhide/flag/send-to-Tag-Wrangler work; the D-010 inline editor lives in the leaf; per-row always-show/always-hide/clear and "why hidden?" work against the Phase 1 store; new headless tests pass; full gate green.

---

## Phase 4: "Open beside the tag pane" split command + live reaction

**Goal.** Ship the one-click split that is the UX win (D-013; cutline item 2):
open the Curation Workspace, reveal the native tag pane, and arrange them
side by side, so editing a rule in the leaf and watching the tag pane react is
one continuous glance. Degrade gracefully to Preview mode for single-pane users.

**Preconditions.** Phases 2-3 committed. The tag-pane observer already reacts
live to rule/override/metadata changes via `ObserverBase.scheduleApply`.

- [ ] **Step 1: add the split command.** Edit `src/main.ts`: add command `open-curation-workspace-beside-tag-pane` ("Open Curation Workspace beside the tag pane"). Implementation `openBesideTagPane()`: (a) ensure a tag pane exists - find a leaf of view type `'tag'` via `getLeavesOfType('tag')`, else open one (`workspace.getLeftLeaf(false)` then `setViewState({ type: 'tag' })`) and `revealLeaf`; (b) open the workspace leaf as a split next to it using `workspace.getLeaf('split', 'vertical')` (or `createLeafBySplit` on the tag-pane leaf) and `setViewState({ type: CURATION_VIEW_TYPE })`; (c) `revealLeaf` the workspace. Use Context7 to confirm the current `WorkspaceLeaf`/`Workspace.getLeaf` split signatures for the pinned `minAppVersion` before finalizing the call shape.
- [ ] **Step 2: surface the command in Settings + onboarding.** Edit `src/ui/settingsTab.ts`: add a secondary "Open beside the tag pane" button next to the "Open Curation Workspace" launcher. (Onboarding copy in `06_getting-started.md` already recommends this path; no code there.)
- [ ] **Step 3: verify live reaction.** Confirm (manually, logged in TESTING) that with the split open, typing/saving a rule in the leaf editor causes the native tag pane rows to hide/flag without any extra action, because `settingsManager.onChange -> tagPaneObserver.setRules -> scheduleApply` already runs. No new wiring expected; if a gap exists (e.g., the editor writes but the observer is not notified), close it in `main.ts`'s `onChange` path.
- [ ] **Step 4: graceful single-pane fallback.** Ensure that if the user has Preview mode on and a single pane, the workspace's own preview list still updates (it renders from `TagListModel`, which honors `previewMode`). No new code expected; verify and note.
- [ ] **Step 5: run the gate.** `npm run lint && npm run typecheck && npm test && npm run build`. Expect green.

**Commit message:** `feat(workspace): open-beside-the-tag-pane split command (D-013)`

**Definition of done.** The split command opens the workspace beside a revealed tag pane; editing a rule reacts live in the tag pane; a Settings button surfaces the command; single-pane Preview still works; full gate green.

---

## Phase 5: Scope - finish the Notebook Navigator observer + per-scope kill switch

**Goal.** Complete the in-flight NN work: a `NotebookNavigatorObserver` that
`extends ObserverBase` and decorates NN's tag tree, gated on the existing
detection module, plus a first per-scope kill switch (D-014; cutline item 3).
Follow the nn-compat plan (`docs/internal/release-plans/proposals/notebook-navigator-compat/plan_nn-compat.md`)
Phases 3-4. Runtime interop only; never copy NN source.

**Preconditions.** Phases 1-4 committed. Detection (`detectNotebookNavigator`,
`MIN_API_VERSION = '2.0.0'`, `subscribeReapply`) and the local API type are
landed in `src/integrations/`. `tests/nnDetection.test.ts` is green.

- [ ] **Step 1 (TEST FIRST): NN observer happy-dom spec.** Create `tests/notebookNavigatorObserver.test.ts` per the nn-compat plan 3.6: build a fake `.nn-navigation-pane-scroller[data-pane="navigation"]` with `div.nn-navitem.nn-tag[data-tag][data-level]` rows including a `photo` / `photo/camera` pair; assert match, descendant match (a rule on `photo` also hits `photo/camera`), idempotency, re-decorate after node removal+reinsert, preview flags, and clear-on-unload. Run; expect FAIL (observer does not exist).
- [ ] **Step 2: implement `NotebookNavigatorObserver`.** Create `src/observers/notebookNavigatorObserver.ts extends ObserverBase` (nn-compat plan 3.1-3.2): `init()` finds NN leaves via `getLeavesOfType(<NN leaf view type>)` or falls back to `document.querySelectorAll('.nn-navigation-pane')`; `getObserveTarget` returns the inner scroller; `findRows` reads `.nn-tag[data-tag]` and the `data-tag` (canonical lowercase) value; `applyDecoration`/`clearDecoration`/`findDecorated` use class constants `tc-nn-hidden`, `tc-nn-flagged`, attr `data-tc-nn-rule` (never `nn-*`). Implement the flat-nesting descendant match (a rule on `photo` decorates `photo/camera`). Run the Step 1 test; iterate to green.
- [ ] **Step 3: CSS.** Append to `styles.css` the NN rules from the nn-compat plan 3.4: `.nn-tag.tc-nn-hidden { display: none !important; }` and a Tag-Curator-owned `.nn-tag.tc-nn-flagged` preview highlight.
- [ ] **Step 4: optional flag-to-color (D-016, opt-in default-off).** Per nn-compat Phase 4, when the NN API is ready and an opt-in `nnColorMirror` setting (add to `TagCuratorSettings`, default `false`, migrate-safe under v4) is on, mirror flags to NN colors via `api.metadata.setTagMeta`, recording every `(tag -> value)` written and never clobbering user colors; clear only Tag-Curator-set values on unload/scope-disable. Add `tests/nnFlagging.test.ts` mocking `nn.metadata`. If time-boxing, this sub-step may land as its own commit but is in-scope for v1.0 (decisions resolved).
- [ ] **Step 5: per-scope kill switch + wiring.** Edit `src/types.ts`/settings to add a `scopeSettings: Record<Scope, boolean>` (or reuse `defaultScopes` as the enabled-scope set - pick one and document it; `defaultScopes` already exists and is the lower-churn choice). Edit `src/main.ts`: construct and `init()` the NN observer only when `detectNotebookNavigator(app).status === 'ready'` AND the NN scope is enabled; feed it the same `setRules/setMetadata/setPreviewMode/setEnabled/setOverrides` as the tag-pane observer; show the one-time "needs NN >= 2.0.0" notice on `status === 'too-old'`. Toggling the NN scope off must call `observer.setEnabled(false)` (clears all `tc-nn-*`).
- [ ] **Step 6: run the gate.** `npm run lint && npm run typecheck && npm test && npm run build`. Expect green (NN detection + observer + flagging suites included).

**Commit messages:**
- `test(nn): failing NN tag-tree decorator spec (happy-dom)`
- `feat(nn): NotebookNavigatorObserver tag-tree hide/flag decorator`
- `feat(nn): opt-in flag-to-color mirroring with record-and-restore`
- `feat(scopes): per-scope enable wiring + NN one-time version notice`

**Definition of done.** Hide/flag rules decorate NN's tag tree with descendant match and idempotency; the observer extends `ObserverBase`; NN absent is a silent no-op and too-old shows a one-time notice; the NN scope has an independent kill switch; opt-in color mirroring is record-and-restore safe; all NN suites + full gate green.

---

## Phase 6: Scope - Properties panel observer

**Goal.** Hide/flag frontmatter tags where they render in Obsidian's Properties
panel, as an `ObserverBase` subclass with synthetic-DOM tests, independently
kill-switchable (D-014; cutline item 4).

**Preconditions.** Phase 5 committed. The per-scope enable mechanism exists.
`ObserverBase` is the proven base.

- [ ] **Step 1: confirm the Properties DOM contract.** Inspect a running vault (manual, logged in TESTING) or use Context7 on the Obsidian API to confirm the current Properties-panel tag selectors for the pinned `minAppVersion`. Document the selectors in the observer's header comment as the contract, noting they are undocumented and version-fragile (the reason for the kill switch). Best-known anchors: the metadata/properties container and the multi-value tag pills (e.g. `.metadata-property[data-property-key="tags"] .multi-select-pill`); treat the exact strings as to-confirm-at-runtime and code defensively (find-no-rows rather than throw on drift).
- [ ] **Step 2 (TEST FIRST): Properties observer spec.** Create `tests/propertiesObserver.test.ts` (happy-dom): build a synthetic properties container with tag pills, assert match hides/flags the right pill, idempotency, clear-on-unload, and that non-tag properties are never touched. Run; expect FAIL.
- [ ] **Step 3: implement `PropertiesObserver`.** Create `src/observers/propertiesObserver.ts extends ObserverBase`: `init()` attaches to the active properties view container(s) and re-attaches on `layout-change` (mirror `TagPaneObserver.init`); `findRows` reads tag pills and their text; class constants `tc-prop-hidden`, `tc-prop-flagged`, attr `data-tc-prop-rule`. Add CSS to `styles.css` for `tc-prop-hidden`/`tc-prop-flagged`. Iterate to green against Step 2.
- [ ] **Step 4: wire + kill switch.** Edit `src/main.ts`: construct/`init()` the Properties observer when the Properties scope is enabled (default on per cutline item 4); feed it the same setters; toggling the scope off clears decorations.
- [ ] **Step 5: run the gate.** `npm run lint && npm run typecheck && npm test && npm run build`. Expect green.

**Commit messages:**
- `test(properties): failing properties-panel observer spec`
- `feat(scopes): PropertiesObserver for frontmatter tag pills (kill-switchable)`

**Definition of done.** Frontmatter tag pills in the Properties panel hide/flag per rules and overrides; the observer extends `ObserverBase`; synthetic-DOM tests pass; the Properties scope has an independent kill switch; full gate green.

---

## Phase 7: Scope - Autocomplete suppression observer

**Goal.** Suppress hidden tags from the editor tag-autocomplete dropdown so users
do not re-create a tag they just hid; `ObserverBase` subclass, default-on,
kill-switchable (D-014; cutline item 5).

**Preconditions.** Phase 6 committed.

- [ ] **Step 1: confirm the autocomplete DOM contract.** As in Phase 6 Step 1, confirm the current tag-autocomplete suggestion DOM for the pinned `minAppVersion` (manual + Context7), document it as a version-fragile contract in the observer header, and code defensively. Best-known anchors: the suggestion container `.suggestion-container` / `.suggestion-item` filtered to tag suggestions; treat as to-confirm-at-runtime.
- [ ] **Step 2 (TEST FIRST): autocomplete observer spec.** Create `tests/autocompleteObserver.test.ts` (happy-dom): build a synthetic suggestion list containing a hidden tag and a shown tag; assert the hidden tag's suggestion item is suppressed (hidden) and the shown one is untouched; idempotency; clear-on-unload; non-tag suggestions never touched. Run; expect FAIL.
- [ ] **Step 3: implement `AutocompleteObserver`.** Create `src/observers/autocompleteObserver.ts extends ObserverBase`. Because the suggestion popup is transient and re-created per keystroke, `init()` observes the document body (or the suggestion portal root) for the suggestion container appearing, then decorates it; class constants `tc-ac-hidden`, attr `data-tc-ac-rule`. Suppression here means hide the suggestion item (never delete DOM). Honor overrides (always-show keeps a suggestion visible even if a rule would hide it). Add CSS. Iterate to green.
- [ ] **Step 4: wire + kill switch (default on).** Edit `src/main.ts`: construct/`init()` when the Autocomplete scope is enabled (default on); feed the same setters; toggling off clears and disconnects.
- [ ] **Step 5: run the gate.** `npm run lint && npm run typecheck && npm test && npm run build`. Expect green.

**Commit messages:**
- `test(autocomplete): failing autocomplete-suppression observer spec`
- `feat(scopes): AutocompleteObserver suppresses hidden tags in suggestions (default-on, kill-switchable)`

**Definition of done.** Hidden tags do not appear in tag autocomplete (overrides respected); the observer extends `ObserverBase`; synthetic-DOM tests pass; default-on with an independent kill switch; full gate green.

---

## Phase 8: Settings "Scopes" section + Integrations section

**Goal.** Give the four scopes a first-class control surface and surface
ecosystem integration status, completing the thin-Settings cutline item 7
(D-014, principle 11; D-016).

**Preconditions.** Phases 5-7 committed (all four scopes exist with kill
switches wired to a settings field). The per-scope enable field chosen in
Phase 5 Step 5 is in `TagCuratorSettings`.

- [ ] **Step 1: add the "Scopes" section.** Edit `src/ui/settingsTab.ts`: add a `scopes` tab (or a "Scopes" heading block in General). For each of `tag-pane`, `notebook-navigator`, `properties`, `autocomplete`: a labeled toggle bound to the per-scope enable field, a one-line description, and a status note where relevant (NN: "Requires Notebook Navigator >= 2.0.0"; greyed/disabled with tooltip when NN is absent or too old, read from `detectNotebookNavigator`). Toggling a scope persists via `settingsManager.update` and the `onChange` path calls the matching `observer.setEnabled`. Tag pane is the always-available baseline.
- [ ] **Step 2: add the "Integrations" section.** Add an Integrations block: Style Settings (note that themes/power users can restyle via the `/* @settings */` block - lands in Phase 9), Tag Wrangler (menu composition + bulk delegation; show Enabled/Installed/Not installed via `app.plugins`), Notebook Navigator (detected version + the opt-in flag-to-color toggle from Phase 5). Each integration is an optional enhancement, never a dependency (D-016).
- [ ] **Step 3: ensure scope-aware defaults.** Confirm `DEFAULT_SETTINGS` has tag-pane + NN + properties + autocomplete enabled by default per the cutline (autocomplete and properties ship default-on, D-014 decision B), and the v4 migration backfills the per-scope field for upgraders.
- [ ] **Step 4: run the gate.** `npm run lint && npm run typecheck && npm test && npm run build`. Expect green. Add a settings-shape test to `tests/settings.test.ts` asserting the per-scope defaults.

**Commit messages:**
- `feat(settings): Scopes section with per-scope kill switches (D-014)`
- `feat(settings): Integrations section (Style Settings, Tag Wrangler, NN)`

**Definition of done.** Settings has a Scopes section toggling all four scopes independently (NN gated by detection), an Integrations section reflecting real plugin state, scope defaults match the cutline, and the v4 migration backfills the field; full gate green.

---

## Phase 9: Ecosystem - Style Settings, Tag Wrangler, compatibility doc

**Goal.** Land the three ecosystem cutline items: Style Settings registration
(item 9), Tag Wrangler menu composition + verified bulk delegation (item 10),
and the compatibility doc (item 11). All optional enhancements (D-016).

**Preconditions.** Phases 1-8 committed. `TagActions.sendToTagWrangler` is built
and tested. `styles.css` already carries the scope decoration classes.

- [ ] **Step 1: Style Settings `/* @settings */` block.** Append a Style Settings settings-comment block to `styles.css` registering Tag Curator's CSS variables (hidden-row treatment, flagged-row highlight color, NN/properties/autocomplete decoration colors) with built-in defaults so nothing breaks when Style Settings is absent (D-016). Use Context7 on "Style Settings" plugin to confirm the current `/* @settings */` YAML-in-comment schema (id, name, settings list of variable definitions) before writing. Acceptance: the block is valid YAML-in-CSS-comment; the variables have `:root` defaults already defined in `styles.css`.
- [ ] **Step 2: Tag Wrangler menu composition.** Add menu composition where Tag Curator already shows context menus (tag-pane rows, workspace rows): when `app.plugins.enabledPlugins` includes `tag-wrangler`, compose a "Rename with Tag Wrangler" item that dispatches `tag-wrangler:rename-tag`; when absent, fall back to Tag Curator's own menu and disable the bulk "Send to Tag Wrangler" with an explanatory tooltip (D-016). Keep this thin (~30 lines per spine Section 7 rationale).
- [ ] **Step 3: verify the bulk delegation.** Confirm the Phase 3 bulk "Send to Tag Wrangler" routes through `TagActions.sendToTagWrangler` (dispatches `tag-wrangler:rename-tag` per tag, counts successes, no-op when absent) - the tested path in `tests/tagActions.test.ts`. Add a workspace-level integration assertion if a headless seam exists; otherwise log a manual check in TESTING.
- [ ] **Step 4: compatibility README section.** Add a "Compatibility" section to `README.md`: Tag Curator is display-only, so Dataview, Tasks, and Bases see unfiltered tags (their queries and indexes are unaffected); Tag Wrangler is the rename surface; Style Settings can restyle; Notebook Navigator coexists via runtime interop (GPL-3.0 NN, Apache-2.0 Tag Curator - no source coupling). This is the trust story stated explicitly (spine Section 9, cutline item 11).
- [ ] **Step 5: run the gate.** `npm run lint && npm run typecheck && npm test && npm run build`. Expect green (a CSS-only change still passes the build; the lint runs only over `src`).

**Commit messages:**
- `feat(ecosystem): Style Settings variable registration in styles.css`
- `feat(ecosystem): Tag Wrangler menu composition + bulk delegation guardrails`
- `docs(readme): compatibility section (Dataview/Tasks/Bases unaffected; TW/Style Settings/NN)`

**Definition of done.** Style Settings can restyle Tag Curator's surfaces (with safe defaults when absent); Tag Wrangler menu items compose when present and degrade when absent; bulk delegation verified; README states the display-only compatibility contract; full gate green.

---

## Phase 10: Trust polish

**Goal.** De-overclaim the welcome-modal integration-card copy so it matches what
v1.0 actually ships, and verify the trust layer (state banner, panic disable,
status bar) works across all new surfaces (cutline item 8). No new features -
honesty and verification.

**Preconditions.** Phases 1-9 committed. The welcome modal is
`src/ui/welcomeModal.ts`; its `INTEGRATIONS` cards currently make claims (NN
"Cascade-respect", Colored Tags Wrangler "v0.2") that must match shipped behavior.

- [ ] **Step 1: correct the welcome-modal integration copy.** Edit `src/ui/welcomeModal.ts` `INTEGRATIONS`: for Notebook Navigator, state exactly what v1.0 does ("Hidden and flagged tags are decorated in the Notebook Navigator tag tree when NN >= 2.0.0 is installed; optional color mirroring is off by default"); drop or correct the unimplemented "Cascade-respect" line. For Tag Wrangler, keep the rename/bulk-delegation lines (these ship). For Colored Tags Wrangler, either remove the card or mark it accurately as "not yet integrated" (it is v2.0+ per spine Section 7) - do not promise "v0.2". Acceptance: every bullet maps to a behavior that v1.0 ships or clearly labels as future.
- [ ] **Step 2: verify the state banner across new surfaces.** Confirm `StateBanner` renders above the Curation Workspace content (Phase 2 Step 1) and shows the Preview/Off states (D-007). If the workspace does not yet mount it, add it. The banner already appears in Settings.
- [ ] **Step 3: verify panic disable clears every scope.** `panicCleanup` in `src/ui/panicDisable.ts` currently clears the tag-pane classes (`tag-curator-hidden`, `tag-curator-flagged`, `data-tag-curator-rule`). Extend `CLASSES`/attrs to include the new scope decorations (`tc-nn-*`, `tc-prop-*`, `tc-ac-*`, `data-tc-nn-rule`, `data-tc-prop-rule`, `data-tc-ac-rule`) so panic disable removes ALL DOM effects across all scopes even if observers fail (spine Section 9, success criterion). Also call each scope observer's `setEnabled(false)` from `panicDisable()` in `main.ts`. Add a `tests/panicDisable.test.ts` case (if not present) asserting all decoration classes/attrs across all scopes are stripped.
- [ ] **Step 4: verify status bar.** Confirm the status bar reflects hidden/flagged counts across the enabled scopes (or at least the tag pane, with the workspace as the click target). Update `refreshStatusBar` in `main.ts` if scope counts should aggregate; keep it honest (do not claim counts a scope cannot produce).
- [ ] **Step 5: run the gate.** `npm run lint && npm run typecheck && npm test && npm run build`. Expect green.

**Commit messages:**
- `fix(welcome): de-overclaim integration cards to match v1.0 behavior`
- `fix(safety): panic disable clears all scope decorations; banner on the workspace`

**Definition of done.** Welcome-modal copy matches shipped behavior; the state banner appears on the workspace; panic disable removes decorations across all four scopes and disables every observer; status-bar copy is honest; full gate green.

---

## Phase 11: Docs + CI adoption + version bump

**Goal.** Adopt the proposed CI, update user-facing docs to v1.0, and bump the
version/manifest so the release rehearsal has a real target.

**Preconditions.** Phases 1-10 committed. Proposed CI files are at
`docs/internal/v1-vision/ci/build.yml` and `release.yml`. Current
`.github/workflows/` has `build.yml` and (per the v0.1 plan) a `release.yml`.

- [ ] **Step 1: adopt the proposed CI.** Copy `docs/internal/v1-vision/ci/build.yml` to `.github/workflows/build.yml` and `docs/internal/v1-vision/ci/release.yml` to `.github/workflows/release.yml`, reconciling with whatever is already there. The proposed `build.yml` gates `lint -> typecheck -> test -> build -> verify-artifacts` on PR and push to main and reads Node from `.nvmrc`. Ensure `.nvmrc` exists (create with `20` if absent). The proposed `release.yml` fires on tag push, verifies the tag equals `manifest.json` version (plain semver, no leading `v`), and publishes the `manifest.json`/`main.js`/`styles.css`/`versions.json` quartet. Acceptance: both workflows are valid YAML and reference `.nvmrc`.
- [ ] **Step 2: README to v1.0.** Update `README.md`: lead with the Curation Workspace and the "open beside the tag pane" loop; document the four scopes and their kill switches; the override safety net; the commands; the compatibility section (Phase 9). Remove v0.1-only framing.
- [ ] **Step 3: CHANGELOG.** Add a `## 1.0.0` section to `CHANGELOG.md` summarizing: Curation Workspace leaf; open-beside split; per-tag overrides; four scopes (tag pane, NN, Properties, Autocomplete); thin Settings + Scopes section; Style Settings + Tag Wrangler integrations; trust polish. Note the schema v3->v4 migration (auto, additive). No em/en dashes.
- [ ] **Step 4: TESTING.** Update `TESTING.md` with the manual BRAT smoke matrix for v1.0: open workspace; open beside tag pane and watch live reaction; each scope's hide/flag (NN needs a real NN vault, Properties needs a note with frontmatter tags, Autocomplete needs typing `#`); panic disable clears all scopes; uninstall restores everything; NN absent is a silent no-op. Fold in the nn-compat plan Phase 5 manual checks.
- [ ] **Step 5: bump version + manifest + versions.json.** Set `package.json` version, `manifest.json` version to `1.0.0`, and add `"1.0.0": "1.9.10"` to `versions.json` (keep `minAppVersion` at `1.9.10` unless a Phase 6/7 DOM contract forced a higher floor - if so, raise `minAppVersion` consistently across manifest + versions and note it in CHANGELOG). If a `version-bump` script exists, use it; otherwise edit the three files directly and keep them in sync (the release workflow fails the build if tag != manifest version).
- [ ] **Step 6: run the gate.** `npm run lint && npm run typecheck && npm test && npm run build`. Expect green; confirm `main.js`, `manifest.json`, `styles.css`, `versions.json` are present (the artifact quartet the release workflow verifies).

**Commit messages:**
- `ci: adopt v1.0 build + release workflows from the v1-vision proposal`
- `docs: README + CHANGELOG + TESTING for v1.0`
- `chore(release): bump to 1.0.0 across package, manifest, versions`

**Definition of done.** CI workflows adopted and valid; README/CHANGELOG/TESTING describe v1.0; version is `1.0.0` and consistent across `package.json`/`manifest.json`/`versions.json`; the artifact quartet builds; full gate green.

---

## Phase 12: Release rehearsal

**Goal.** Rehearse and then cut the release, with explicit STOP gates before any
remote or tag action. Nothing here pushes or publishes without the user's word.

**Preconditions.** Phases 0-11 committed on `feat/v1.0-curation-in-context`; full
gate green; version is `1.0.0`.

- [ ] **Step 1: local release dry-run.** Run `npm ci && npm run lint && npm run typecheck && npm test && npm run build`, then verify `test -f main.js && test -f manifest.json && test -f styles.css && test -f versions.json` and `node -p "require('./manifest.json').version"` prints `1.0.0`. This is exactly what `release.yml` checks; confirm it would pass before any tag exists. No remote action.
- [ ] **Step 2: STOP - ask the user to merge/push the branch.** Present the green gate and the diff summary. Do NOT push. Ask the user how they want to integrate `feat/v1.0-curation-in-context` (PR to `main`/`release` branch, or direct). Only proceed on their explicit instruction. (Use superpowers:finishing-a-development-branch to present options if available.)
- [ ] **Step 3: STOP - ask before the RC tag.** With the user's go, propose the `1.0.0-rc.1` tag as a BRAT-testable pre-release. Do NOT create or push the tag yourself without confirmation. On confirmation, create and push the tag; the release workflow builds and publishes the quartet as a pre-release. (If the user prefers, skip the RC and go straight to `1.0.0`.)
- [ ] **Step 4: BRAT smoke matrix.** Once the RC release assets exist, run the manual BRAT install matrix from `TESTING.md` against a test vault: install via BRAT, open the workspace, exercise each scope, run panic disable, uninstall and confirm full restoration, confirm NN-absent silent no-op. Record results. Fix any blocker and re-rehearse from Step 1.
- [ ] **Step 5: STOP - ask before the final tag.** With a clean smoke matrix and the user's go, tag `1.0.0` (plain semver, no leading `v`, matching `manifest.json`). Do NOT push the tag without explicit confirmation. On confirmation, push; the release workflow publishes the GitHub release with the quartet. Verify the release assets landed.

**Commit message (only if rehearsal forced fixes):** `chore(release): rehearsal fixes for 1.0.0`

**Definition of done.** A local dry-run matches the release-workflow checks; the branch is integrated per the user's instruction; an RC was smoke-tested via BRAT (or skipped at user request); `1.0.0` is tagged and published only after explicit user confirmation; release assets verified. Every push/tag happened behind a STOP gate.

---

## v1.0 Definition of Done (maps to the 11 cutline items, spine Section 8.1)

Tick each only when the mapped phase is green and verified.

1. [ ] **Curation Workspace leaf** (table + inline editor + live preview + bulk + diagnostics) - Phases 2-3. `CURATION_VIEW_TYPE` renders a virtualized sortable table on `TagListModel`/`TagActions`, hosts the D-010 inline editor, supports multi-select bulk actions and per-row diagnostics.
2. [ ] **"Open beside the tag pane" split command** - Phase 4. `open-curation-workspace-beside-tag-pane` arranges the split; rule edits react live in the native tag pane.
3. [ ] **Scope: Notebook Navigator tag tree** - Phase 5. `NotebookNavigatorObserver extends ObserverBase`; hide/flag with descendant match; NN-absent silent no-op; opt-in color mirror; independent kill switch.
4. [ ] **Scope: Properties panel** - Phase 6. `PropertiesObserver extends ObserverBase`; frontmatter tag pills decorated; synthetic-DOM tested; kill-switchable.
5. [ ] **Scope: Autocomplete suppression** - Phase 7. `AutocompleteObserver extends ObserverBase`; hidden tags suppressed in suggestions; default-on; kill-switchable.
6. [ ] **Per-tag overrides (always-show / always-hide)** - Phase 1. `overrides` store; v3->v4 migration; `RuleEngine.resolveVisibility` precedence always-show > always-hide > rules; per-row actions real.
7. [ ] **Thin Settings + "Scopes" section + launch buttons** - Phases 2, 8. Settings launches the workspace; the Scopes section toggles all four scopes; Integrations section reflects real plugin state.
8. [ ] **Trust layer polish** - Phase 10. Welcome copy de-overclaimed; state banner on the workspace; panic disable clears all four scopes; honest status bar.
9. [ ] **Style Settings registration** - Phase 9. `/* @settings */` block in `styles.css` with safe defaults.
10. [ ] **Tag Wrangler menu composition + bulk delegation** - Phase 9. Menu items compose when present, degrade when absent; bulk "Send to Tag Wrangler" verified.
11. [ ] **Compatibility doc** - Phase 9. README compatibility section: Dataview/Tasks/Bases unaffected; TW rename surface; Style Settings restyle; NN runtime-interop / GPL note.

Plus the process gates: Phase 0 promoted D-012..D-017 to Accepted and re-cut the scope tables; CI adopted (Phase 11); version `1.0.0` consistent and released behind STOP gates (Phase 12). Every code-bearing phase ended with `npm run lint && npm run typecheck && npm test && npm run build` green.
