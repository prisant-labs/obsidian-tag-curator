---
date: 2026-05-30
agent: claude
topic: BRAT stale-release fix, tag-list dual-host shared core, Notebook Navigator compatibility
status: in-progress
previous-session: AGENTS/session-log/2026-05-28_20-36_claude_v0.1.0-design-lock-ui-build-and-v0.2-proposals.md
branch: feat/nn-compat-phase1
commits: 14
files-changed: 18
---

# Session: BRAT Fix, Tag-List Dual-Host Core, and Notebook Navigator Compatibility

## Goal

Start with a BRAT testing problem (the v0.1 UI not appearing), then turn the budget toward
front-loadable, UI-independent engineering: the tag-list dual-host redesign's shared core and
the groundwork for Notebook Navigator compatibility.

## Summary

The session opened by diagnosing why the locked v0.1 settings UI did not show up under BRAT:
the published `v0.1.0` GitHub release was a stale May-5 build that predated the entire UI
rewrite, and `main.js`/`styles.css` are gitignored (shipped only via `release.yml` on tag
push). We replaced the stale release. We then designed and partly built two independent
efforts. Effort B (tag-list dual-host redesign) got a full spec + plan and its UI-independent
shared core (`TagListModel` + `TagActions`) built, tested, and merged. Effort A (Notebook
Navigator compatibility) got a runtime-interop findings study, a spec + plan, five resolved
scope decisions, and Phases 1-2 implemented (a reusable `ObserverBase` refactor and NN
detection/gating). The session ends mid-Effort-A with Phase 3 (the NN hide decorator) as the
next step on branch `feat/nn-compat-phase1`.

## Work Completed

### BRAT / release fix
- Diagnosed the stale-release root cause (not an Obsidian standards change): BRAT installs
  GitHub *release* assets, and the only `v0.1.0` release was a May-5 build (main.js 34.9 KB,
  no styles.css) from before the 4-phase UI rewrite.
- Replaced the stale release: deleted the old `v0.1.0` release + tag, re-tagged `v0.1.0` at
  the current UI commit, and `release.yml` fired (its first real run, 26s) and republished
  the correct artifacts (main.js 52,399 B, styles.css 28,195 B), matching the local build.
- Flagged the welcome-modal integration cards (Notebook Navigator, Tag Wrangler) as making
  present-tense claims v0.1 does not deliver (only the tag pane is wired).

### Effort B - Tag-list dual-host redesign (spec + plan + shared core, merged)
- Brainstormed and locked the architecture: a shared host-agnostic core (`TagListModel` +
  `TagActions`) feeding two thin render components (`TagViewer` sidebar, `TagTable` settings),
  rather than D-011's original "same component in both hosts."
- Wrote `spec_tag-list-dual-host.md` and a TDD `plan_tag-list-shared-core.md`.
- Built and merged the shared core (Phase A): `TagListModel` (rows/visibility, filter chips,
  search, sort, selection) and `TagActions` (Tag Wrangler delegation; per-tag hide/unhide
  returns a typed b009-deferred result). 19 new headless tests. Merged to `release/v0.1.0`.
- Built `ui_tag-list-dual-host.html` (background agent) for crit review.
- Recorded the D-011 revision in `scope-and-decisions.md`.

### Effort A - Notebook Navigator compatibility (research + spec/plan + Phases 1-2)
- Cloned NN (`johansan/notebook-navigator`, GPL-3.0) to `E:\Projects\Github Repos\` and ran a
  source study (background agent) producing `findings_nn-integration-seam.md`.
- Wrote `spec_nn-compat.md` + `plan_nn-compat.md` (background agent), then resolved 5 scope
  decisions with the user and reconciled both docs.
- Phase 1: extracted a reusable `ObserverBase` from `TagPaneObserver` (17 existing tests stay
  green; +6 base-contract tests).
- Phase 2: NN detection + version gating (`MIN_API_VERSION = '2.0.0'`, absent/too-old/ready),
  a hand-written minimal local NN API type (no vendoring, GPL-safe), and a `subscribeReapply`
  helper. +7 tests.

## Key Decisions

- **Replace the stale v0.1.0 release (vs push an rc first)**.
  - Why: the user wanted the real `v0.1.0` to carry the current build for BRAT; the existing
    release was a pre-everything May-5 build.
  - Alternatives: push `v0.1.0-rc1` first (rehearsal); user chose direct replacement.
- **Tag-list architecture: shared core + two render components (hybrid), with a shared
  `TagActions` service layer**.
  - Why: the sidebar and settings surfaces differ in layout *and* click semantics (a
    behavioral fork, not additive), so separate render components beat one capability-flagged
    component; the service layer makes a future in-panel quick-manage additive UI wiring.
  - Alternatives: pure capability-flag component (A), two fully separate components (B).
- **Sidebar viewer = lightweight (click a tag -> vault search) + a light-manage toggle; the
  heavy table lives in settings**. View mode also gets sortable columns + simple search.
- **Per-tag hide/unhide is B009-gated** (needs a persisted override store + migration);
  sequence it as a fast-follow, keep Phase A migration-free. Corrects an earlier "no
  migration" overstatement.
- **NN compatibility scope (5 decisions, 2026-05-30)**: (a) hide + flag both ship in v1;
  (b) require a recent NN (API v2.0.0): absent = silent no-op, older = one-time notice + skip
  whole scope; (c) flag-to-NN-color via `setTagMeta`, opt-in; (d) hand-write a minimal local
  API type, do not vendor NN's `.d.ts`; (e) build the decorator reusable but not coupled to
  aliases yet.
- **NN coupling is runtime-interop only** (NN is GPL-3.0, Tag Curator is Apache-2.0): observe/
  mutate NN's DOM and call its public API; never copy NN source.

## Problems & Solutions
- **Problem**: v0.1 UI absent under BRAT. **Solution**: stale GitHub release replaced; correct
  artifacts republished by `release.yml`.
- **Problem**: settings "Tag list" tab was a stub; an `ItemView` cannot mount in a
  `PluginSettingTab`. **Solution**: the dual-host redesign extracts a host-agnostic core so
  both hosts render from one tested unit (Phase A built).
- **Problem**: a background agent bypassed the no-em-dash hook via PowerShell on its first run.
  **Solution**: verified that file dash-clean; instructed all later agents to fix-and-retry
  through the Write tool, never bypass. All later agent outputs verified dash-clean.
- **Problem**: BRAT will not auto-update an already-installed copy when the version string is
  unchanged. **Solution (for the user)**: remove + re-add the beta plugin to force a re-fetch.

## Files Changed
- Source (new): `src/ui/tagList/tagListModel.ts`, `src/ui/tagList/tagActions.ts`,
  `src/observers/observerBase.ts`, `src/integrations/notebookNavigator.ts`,
  `src/integrations/notebookNavigatorApi.ts`.
- Source (refactored): `src/observers/tagPaneObserver.ts` (now extends `ObserverBase`).
- Tests (new): `tests/tagListModel.test.ts`, `tests/tagActions.test.ts`,
  `tests/observerBase.test.ts`, `tests/nnDetection.test.ts`.
- Docs (new): `proposals/tag-list-dual-host/` (spec + plan + ui), `proposals/
  notebook-navigator-compat/` (findings + spec + plan); `scope-and-decisions.md` (D-011
  revision + changelog).

## Tests & Verification
- Full suite: 122 (pre-session) -> 154 passing across 12 files (+32 new). typecheck + lint
  (max-warnings 0) clean throughout; verified at each phase boundary.
- TagListModel core merged to `release/v0.1.0` (fast-forward, behavior of existing observers
  unchanged: the 17 `tagPaneObserver` tests stay green after the `ObserverBase` refactor).
- `release.yml` verified live: succeeded on first real run, republished the artifact quartet
  with correct sizes.

## Next Steps
- [ ] Effort A Phase 3: build `NotebookNavigatorObserver extends ObserverBase` - target
      `div.nn-navitem.nn-tag[data-tag]` rows inside `.nn-navigation-pane-scroller[data-pane=
      "navigation"]`; idempotent re-decoration; reapply via `subscribeReapply` on NN events
      plus the MutationObserver; tests with synthetic NN DOM in happy-dom.
- [ ] Effort A Phase 4: opt-in flagging via `metadata.setTagMeta` (record + restore own values).
- [ ] Effort A Phases 5-6: integration sweep, settings wiring, one-time too-old notice, and
      record the 5 NN decisions as D-IDs in `scope-and-decisions.md`.
- [ ] Decide whether to merge `feat/nn-compat-phase1` (Phases 1-2 are clean, mergeable infra)
      now or after Phase 3.
- [ ] Effort B: user to crit `ui_tag-list-dual-host.html`; then build Phase B render
      components (`TagViewer` + `TagTable`, task #9) and the B009 per-tag-override fast-follow.
- [ ] Nothing is pushed: `release/v0.1.0` is ~10 commits ahead of origin and
      `feat/nn-compat-phase1` is local-only.

## Notes
- Memory updated this session: `project_release-distribution-and-brat.md` (gitignored build,
  release-only delivery, BRAT version-bump gotcha) and `feedback_contextual-file-suffixes.md`
  (generic artifact names need a contextual suffix, e.g. `ui_<label>.html`).
- The Node-20 actions in `release.yml`/`build.yml` are deprecated (GitHub forces Node 24 on
  2026-06-02); bump `actions/checkout`, `actions/setup-node`, `softprops/action-gh-release`.
- The welcome-modal integration-card copy overclaims for v0.1 (worth softening to future tense
  or gating to supported integrations).

## Continuation Prompt

```
Resume the Tag Curator plugin on branch `feat/nn-compat-phase1` (descends from
`release/v0.1.0`). Two efforts are in flight, both with full spec + plan bundles under
docs/internal/release-plans/proposals/.

State:
- Effort B (tag-list dual-host redesign): shared core MERGED to release/v0.1.0
  (TagListModel + TagActions, 19 tests). Remaining: user crit of
  proposals/tag-list-dual-host/ui_tag-list-dual-host.html, then Phase B render components
  (TagViewer sidebar + TagTable settings) per proposals/tag-list-dual-host/
  plan_tag-list-shared-core.md "Deferred phases", plus the B009 per-tag-override fast-follow.
- Effort A (Notebook Navigator compatibility): Phases 1-2 done on feat/nn-compat-phase1.
  Phase 1 = ObserverBase extracted from TagPaneObserver (src/observers/observerBase.ts; 17
  tag-pane tests stay green; observerBase.test.ts). Phase 2 = NN detection/gating
  (src/integrations/notebookNavigator.ts, MIN_API_VERSION '2.0.0', absent/too-old/ready,
  subscribeReapply) + hand-written local API type (notebookNavigatorApi.ts; nnDetection.test.ts).

IMMEDIATE NEXT: Effort A Phase 3 (the load-bearing piece) per
proposals/notebook-navigator-compat/plan_nn-compat.md Phase 3:
- Create src/observers/notebookNavigatorObserver.ts extending ObserverBase.
- findRows: query div.nn-navitem.nn-tag rows by their data-tag attribute, scoped to
  .nn-navigation-pane-scroller[data-pane="navigation"]; tag = the data-tag value.
- applyDecoration/clearDecoration/findDecorated: toggle tc-* namespaced classes only (never
  nn-*); set a data-tc marker for idempotent re-decoration.
- init: detectNotebookNavigator(app); if 'absent' no-op, if 'too-old' show a one-time notice
  and skip, if 'ready' observeContainer the scroller and subscribeReapply(api, () =>
  scheduleApply) for NN's storage-ready/tag-changed re-renders.
- Tests: tests/notebookNavigatorObserver.test.ts with synthetic NN DOM in happy-dom (mirror
  tagPaneObserver.test.ts patterns: fake nn rows, flushRaf, assert tc-hidden toggles).
Run npm test + npm run typecheck + npm run lint after each step; commit per sub-step. Keep
the no-em-dash rule (PreToolUse hook). Reference findings_nn-integration-seam.md Sections 5
and 7 for the decorator and virtualization details.

After Phase 3: Phase 4 (opt-in flagging via metadata.setTagMeta with record/restore), then
Phases 5-6 (integration sweep, settings wiring + too-old notice, record the 5 NN decisions
as D-IDs in scope-and-decisions.md). Decide whether to merge feat/nn-compat-phase1 before or
after Phase 3. Nothing is pushed yet.
```
