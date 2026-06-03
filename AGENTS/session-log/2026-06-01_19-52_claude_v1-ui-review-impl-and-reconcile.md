---
date: 2026-06-01
agent: claude
topic: v1.0 UI crit-review implementation (phases 1-8), main reconciliation, push everything, nn-compat prune
status: in-progress
previous-session: AGENTS/session-log/2026-05-30_00-00_claude_brat-fix-tag-list-core-and-nn-compat.md
branch: feat/v1.0-curation-in-context
commits: 12
files-changed: 18
---

# Session: v1.0 UI Review Implementation, Main Reconciliation, and Push

## Goal

Three threads, in order: (1) orient on the repo after the v1.0 rc1 build and reorganize the
worktrees so the rc1 line is the working copy; (2) run a crit review of the rc1 UI and turn
the feedback into real code across a phased roadmap; (3) once the phases were done, reconcile
the divergent branches (main was a stale skeleton) and push everything to the private origin.

## Summary

This session took the already-built `1.0.0-rc.1` (the v1.0 "Curation, in context" line, built
in the prior 2026-05-31 ultracode session and recorded in memory `project_v1-vision-bundle`,
not in a session-log file) from "tagged pre-release on a feature branch" to "fully reviewed,
implemented, reconciled onto main, and pushed."

First, the worktrees were reorganized so the rc1 branch `feat/v1.0-curation-in-context` is the
primary working copy and the superseded lines (`feat/nn-compat-phase1`, `v0.1.0`) live as
worktrees under `obsidian-tag-curator_worktrees/`. Then a single self-contained HTML review
board (`ui_rc1-smoke-review.html`) was built and taken through a 6-round crit review (27
pins). The recurring principle that emerged: make the UI self-evident by structure (positional
grouping, pruning), not by labels or prose. The decisions were captured in
`08_ui-review-decisions.md` with a phased code roadmap, then implemented as real, gated code
across all 8 phases (each commit green on typecheck + lint --max-warnings 0 + 250 tests +
build). A publish-readiness plan (`publish-plugin-planning.md`) was written, and Phase 8
executed its top reviewer flag (inline styles -> CSS classes).

Finally, on the user's instruction ("repo is private, reconcile and push everything"), `main`
(a stale 0.1.0 skeleton diverged by 1 session-log commit) was reconciled by merging the v1.0
line into it. The merge was verified conflict-free up front with `git merge-tree --write-tree`
and a 4-auditor read-only verification Workflow (all "safe", zero blockers) before any
mutation. Everything was pushed; the subsumed `nn-compat` branch was then pruned at the user's
request. The session ends with the repo fully synced to origin and rc1 awaiting the user's
BRAT smoke test before GA.

## Work Completed

### Orientation + worktree reorg
- Established branch topology: `release/v0.1.0` -> `feat/nn-compat-phase1` ->
  `feat/v1.0-curation-in-context` (rc1). nn-compat is fully subsumed (its tip 41a6041 is an
  ancestor of v1.0, zero unique commits). The v0.1.0 tag (f04adbd) is the BRAT-tested build.
- Reorganized worktrees: rc1 became the primary checkout in the main folder; created
  `_worktrees/nn-compat-phase1` and `_worktrees/v0.1.0` (detached at f04adbd); removed the old
  `obsidian-tag-curator-v1` worktree folder.

### Crit review of the rc1 UI (6 rounds, 27 pins)
- Built `docs/internal/v1-vision/ui-ideas/ui_rc1-smoke-review.html`: one self-contained board
  in the Obsidian-dark visual language, 7 sections (Curation Workspace, Welcome modal,
  Settings, Scope decorations, State banner, Status bar, Panic), decoration classes lifted
  verbatim from `styles.css`.
- Ran `/crit:crit` over 6 rounds; addressed every pin in the mockup and replied per pin.
- Wrote `08_ui-review-decisions.md` (by-area decisions A-I + a phased code roadmap in Section
  3 mapping each decision to source files) and added a scope-decoration Mermaid flowchart +
  expanded Style Settings detail to `03_architecture_v1.md`.

### Phased implementation (all 8 phases, each gated green)
- **Phase 1 Settings IA** (`58f20da`): `settingsTab.ts` consolidated 10 tabs -> 5 (General /
  Scopes & integrations / Rules / Advanced / Help). Workspace launcher folded into General;
  Integrations merged into Scopes (Obsidian surfaces vs Plugin integrations groups); Commands
  -> Help (+ FAQ + About/links); Presets + Custom rules -> Rules; v1.1/v1.2 placeholder tabs
  dropped.
- **Phase 6 Leaf rename** (`531223e`): leaf `getDisplayText()` + header + ribbon tooltip +
  command labels renamed to "Tag Curator". Command IDs and `CURATION_VIEW_TYPE` deliberately
  unchanged (preserve hotkeys + saved layouts).
- **Phase 5 Welcome modal** (`36cb393`): lead with the "Tag Curator" title + how-it-works
  intro; dropped the green callout / "Our safety promise" subheader / "Learn how it works"
  link; collapsible integration cards.
- **Phase 2 Scopes & integrations** (`3cd8918`): positional self-evidence - status pill +
  action link on the name line (about the plugin's install state), a lone toggle on the right
  (Tag Curator's curate switch). Helpers `renderCapabilityIntegration` / `pluginState` /
  `statusPill` / `actionLink` / `openPluginSettings`; CSS `.tc-pill*` / `.tc-action-link`.
- **Phase 4 Presets** (`d2d3a56`): live "would hide N tags" affected-count label + clickable
  deep-link from a preset to the rule-filtered panel (`openCurationWorkspace({ ruleId })` ->
  `setRuleFilter`).
- **Phase 3 Rule editor** - the big one, two commits:
  - part 1 (`0df0a2d`, E1-E4): name-first inline-editable title (dropped the duplicate
    Identity/Name field); three-card type selector (Pattern match / Count threshold / Specific
    tags) replacing the `<select>`; collapsed cards with a single muted "type . summary"
    subline; "+ New rule" anchored as a toolbar button. Removed the now-unused
    `friendlyTypeLabel`.
  - part 2 (`bc96762`, E5): both previews drop the inline rule-name column; each row gets an
    info-icon accordion expanding to a key/value detail panel (Affected by / Notes / First
    seen / Last used) plus per-tag "Always show / Always hide" override pins (D-015). Open rows
    tracked in an instance `Set` so an override toggle (which re-renders the whole editor via
    `settingsManager.onChange`) keeps the panel open. Rows wrapped in `.tcr-pd-item` so the
    dividers survive the inserted detail block; key/value pairs use `display:contents`.
- **Phase 7 CSS**: folded into each feature phase; no standalone pass needed.
- **Phase 8 Publish-readiness** (`fa55e83`): every static / show-hide inline style moved off
  `el.style.*` to a CSS class - `.tc-hidden` (display toggles across tagListView bulk bar,
  stateBanner, settings preset details, tagTable scroll/empty, bulkBar), `.tcl-sortable`,
  `.tcl-empty-cell`, `.tcr-confirm-foot`, and `position:fixed` moved into `.tct-why-pop`. The
  only remaining `el.style.*` are genuinely runtime-computed (rowMenu cursor coords, tagTable
  virtual-scroll height/transform). Also hardened the `rowMenu` why-popover listener lifecycle
  (idempotent `close()` guarded by a `closed` flag, clears the deferred-wire timer, never adds
  listeners after teardown, blur/resize dismiss).
- **Docs status** (`bd951bc`): recorded phase-completion status + commit map in
  `08_ui-review-decisions.md`.

### Publish-readiness plan
- Wrote `docs/internal/publish-plugin-planning.md` (committed in `53503ff`): the directory
  reads `manifest.json` from `main` HEAD; the top reviewer flag was inline styles (Phase 8);
  GA blockers = merge v1.0 -> main, cut a plain `1.0.0` release (no leading "v"), add a
  screenshot.

### Main reconciliation + push everything
- main was a stale 0.1.0 skeleton in sync with origin, diverged from v1.0 at merge-base
  `a9b6e4e`: main had exactly 1 unique commit (`6fb1825`, which adds one session-log .md, 320
  lines), v1.0 had 110. A fast-forward was impossible, so the choice was merge vs reset.
- Chose a non-destructive 3-way merge (preserves `6fb1825`). Verified safety BEFORE mutating
  with a 4-auditor read-only Workflow (data-loss / merge-conflict / remote-coherence /
  completeness), each running read-only git; all returned "safe" with zero blockers. The
  merge-conflict auditor ran `git merge-tree --write-tree` (clean tree `22ab080`, no conflict
  block) and confirmed the merged `manifest.json` blob is byte-identical to v1.0's.
- Executed: `git fetch`; `git checkout main`; `git merge --no-ff feat/v1.0-curation-in-context`
  -> merge commit `af27a71` (parents `6fb1825` + `bd951bc`), conflict-free. Post-merge
  assertions passed (manifest = 1.0.0-rc.1; session-log present). Gate green on the merged tree
  (250 tests).
- Pushed everything (all fast-forward or new-ref, none forced): `main` (6fb1825..af27a71),
  `feat/v1.0-curation-in-context` (cf14e18..bd951bc), `release/v0.1.0` (0ea2feb..fbba18c, +22
  backed up), `feat/nn-compat-phase1` (new branch), tags (no-op, already matched). Restored the
  primary worktree to `feat/v1.0-curation-in-context`.

### Prune nn-compat (user request)
- Removed the `_worktrees/nn-compat-phase1` worktree, deleted the local branch (`git branch -d`,
  it was an ancestor so the merged-check passed), deleted the remote branch (`git push origin
  --delete`). Loses nothing - 41a6041 stays reachable from main and v1.0. Remaining branches:
  `main`, `feat/v1.0-curation-in-context`, `release/v0.1.0`, all in sync with origin. Worktrees:
  primary + the `v0.1.0` archive.

### BRAT guidance
- Confirmed via `gh release view`: the `1.0.0-rc.1` release is `prerelease: true`, `draft:
  false`, assets present (main.js, manifest.json, styles.css, versions.json). BRAT installs
  from releases, not branches; the user must enable BRAT's "include pre-releases" option since
  there is no full release yet.

## Key Decisions

- **rc1 as the primary local branch; stash both old lines as worktrees** (vs delete them).
  - Why: the user is mid-BRAT-testing rc1 and wanted it as the working copy, while keeping
    nn-compat and v0.1.0 retrievable. (nn-compat was later pruned once it was confirmed
    redundant and the user said "prune".)
- **Self-evidence by structure, not prose** (the throughline of the 6-round review).
  - Example: plugin-state vs integration-state was resolved by position (status pill + action
    link on the name line, lone toggle on the right) after both a "Curate" label and an
    explanatory paragraph were rejected as not self-evident.
- **Reconcile main by MERGE, not reset** (vs `git reset --hard main -> v1.0`).
  - Why: main carried one commit v1.0 lacked (`6fb1825`, a session-log). A reset would orphan
    that file; a 3-way merge keeps it AND makes the feature branch a clean ancestor of main -
    the standard "feature lands on main" shape, losing nothing.
- **Verify before mutating with an adversarial Workflow** (ultracode).
  - Why: pushing to origin and rewriting main is semi-irreversible/outward-facing even on a
    private repo. Four independent read-only auditors pressure-tested the plan from different
    failure modes; `git merge-tree --write-tree` proved conflict-freedom without touching HEAD.
- **Merge stays GA-neutral**: the merge brings `manifest.json` to `1.0.0-rc.1` on main
  (reflects reality, correct for the directory) but does NOT cut a `1.0.0` release. GA remains
  a deliberate separate step after the BRAT smoke test.
- **Push nn-compat then prune it**: pushed for "everything" (zero new objects), then deleted at
  the user's explicit "prune" since it is a pure subsumed ancestor.
- **Phase 8 keeps genuinely-dynamic inline styles**: cursor coordinates and virtual-scroll
  geometry have no static form; the guideline's themeability intent does not apply to them.
  Only static + show/hide styles moved to classes.

## Problems & Solutions
- **Problem**: a 745-line rule-editor rebuild (Phase 3) risked a half-done state. **Solution**:
  split into two gated commits (E1-E4 editor/cards, then E5 preview accordion); removed the
  orphaned `friendlyTypeLabel` in the same commit that deleted its last call site so
  lint --max-warnings 0 stayed green.
- **Problem**: inserting an accordion detail div between preview rows broke the
  `.tcr-pd-row + .tcr-pd-row` divider. **Solution**: wrap each row+detail in a `.tcr-pd-item`
  and move the divider to `.tcr-pd-item + .tcr-pd-item`.
- **Problem**: an override toggle re-renders the whole editor (via settings.onChange), which
  would snap the open accordion shut. **Solution**: track open tags in an instance `Set` that
  survives the rebuild.
- **Problem**: main and v1.0 had diverged; a blind merge or reset could conflict or lose work.
  **Solution**: the 4-auditor read-only Workflow + `git merge-tree --write-tree` proved the
  merge clean and lossless before any mutation; post-merge assertions confirmed the prediction.
- **Problem**: the Edit tool refused to edit `ruleEditor.ts` after a commit ("file has not been
  read yet"). **Solution**: re-Read the file in-conversation before editing (a general harness
  constraint after commits/time gaps).

## Files Changed
- Source: `src/ui/settingsTab.ts`, `src/main.ts`,
  `src/ui/curationWorkspace/curationWorkspaceView.ts`, `src/ui/welcomeModal.ts`,
  `src/ui/ruleEditor.ts`, `src/ui/stateBanner.ts`, `src/ui/tagListView.ts`,
  `src/ui/curationWorkspace/tagTable.ts`, `src/ui/curationWorkspace/bulkBar.ts`,
  `src/ui/curationWorkspace/rowMenu.ts`, `styles.css`.
- Docs (new): `docs/internal/v1-vision/ui-ideas/ui_rc1-smoke-review.html`,
  `docs/internal/v1-vision/08_ui-review-decisions.md`,
  `docs/internal/publish-plugin-planning.md`.
- Docs (edited): `docs/internal/v1-vision/03_architecture_v1.md`.
- This session log.

## Tests & Verification
- Full suite green at every phase boundary and on the merged main: 250 tests across 18 files;
  typecheck clean; eslint --max-warnings 0 clean; esbuild production build succeeds.
- Reconciliation verified by a 4-auditor read-only Workflow (all "safe", 0 blockers) +
  `git merge-tree --write-tree` (clean) + post-merge assertions (manifest 1.0.0-rc.1,
  session-log preserved) + per-push exit checks (all fast-forward / new-ref, none forced).
- `origin/main` HEAD now serves manifest id `tag-curator` / name `Tag Curator` / version
  `1.0.0-rc.1`.

## Next Steps
- [ ] USER-GATED: BRAT smoke test of `1.0.0-rc.1` in a real vault (first live test of the
      version-fragile Properties/Autocomplete DOM selectors + a real NN install) per
      `TESTING.md`.
- [ ] GA push (after smoke test): bump manifest/package/versions `1.0.0-rc.1` -> `1.0.0`, tag
      `1.0.0` (release.yml ships the artifact quartet and marks it a full release since the tag
      has no `-`), add a screenshot, then open the community-directory submission PR. Checklist
      in `docs/internal/publish-plugin-planning.md`.
- [ ] Optional Phase 8 hygiene (not a blocker): unify the repeated `app.plugins as unknown as
      {...}` casts (settingsTab, welcomeModal, curationWorkspaceView) into one typed helper.
- [ ] Open design decisions (08_ui-review-decisions.md Sections 4-5): secondary-nav anchor row
      adopt vs skip; leaf-name final confirm; scaffold an Astro docs page; `fundingUrl`;
      submit-now vs defer; opt-in NN flag-to-color mirroring (`nnColorMirror`).

## Notes
- Memory updated this session: `project_v1-ui-review.md` (all 8 phases done + commit map),
  `project_v1-vision-bundle.md` (RECONCILED + PUSHED block), and the `MEMORY.md` index line.
- The `v0.1.0` worktree (detached at f04adbd) remains as an archive of the BRAT-tested build;
  it can be pruned anytime (f04adbd is the `v0.1.0` tag target and an ancestor of
  release/v0.1.0).
- Branch shape now: `main` (af27a71, contains v1.0 + the merge) and
  `feat/v1.0-curation-in-context` (bd951bc, an ancestor of main). Ongoing work can continue on
  the feature branch and land on main via the next merge, or move to main directly.

## Continuation Prompt

```
Resume the Obsidian plugin "Tag Curator" (obsidian-tag-curator) in
E:\Projects\github-jprisant\obsidian-tag-curator. Private repo, origin =
github.com/jprisant/obsidian-tag-curator. Global rules still apply: NO em-dashes or en-dashes
anywhere (use " - "; a PreToolUse hook enforces it on Edit/Write); conventional commits ending
with "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"; commit only when asked; crit is
user-invoked only; use Context7 for library docs; never skip git hooks. Gate after any code
change: npm run typecheck && npm run lint && npm test && npm run build (expect 250 tests green,
eslint --max-warnings 0).

STATE (end of 2026-06-01 session):
- v1.0 "Curation, in context" is fully built AND fully UI-reviewed: all 8 phases of
  docs/internal/v1-vision/08_ui-review-decisions.md Section 3 are implemented and gated green
  on feat/v1.0-curation-in-context. Commit map is in that doc's "Status" block and in memory
  project_v1-ui-review.
- main has been RECONCILED: feat/v1.0-curation-in-context was merged into main (merge commit
  af27a71, parents old-main 6fb1825 + v1.0 tip bd951bc), so main now contains the v1.0 line and
  origin/main HEAD serves manifest.json at 1.0.0-rc.1 (id tag-curator, name Tag Curator). The
  community-directory reads manifest from main HEAD, so this is now correct.
- EVERYTHING IS PUSHED and in sync with origin: main (af27a71),
  feat/v1.0-curation-in-context (bd951bc, an ancestor of main), release/v0.1.0 (fbba18c). Tags
  1.0.0-rc.1 and v0.1.0 are on origin. The subsumed feat/nn-compat-phase1 branch and its
  worktree were PRUNED (deleted local + remote); it lost nothing (41a6041 is reachable from
  main/v1.0). Remaining worktrees: primary (feat/v1.0-curation-in-context) +
  _worktrees/v0.1.0 (detached f04adbd archive of the BRAT-tested build).
- 1.0.0-rc.1 is a PUBLISHED GitHub PRE-RELEASE (prerelease:true, draft:false) with the artifact
  quartet (main.js, manifest.json, styles.css, versions.json). main.js/styles.css are
  gitignored - shipped only via release.yml on tag push. BRAT installs from releases (not
  branches) and needs its "include pre-releases" option enabled to see rc1.

IMMEDIATE CONTEXT: the user is BRAT-smoke-testing 1.0.0-rc.1 in a real vault. This is the first
live-vault test of the version-fragile Properties + Autocomplete DOM selectors and a real
Notebook Navigator install. Expect possible selector fixes (each scope is kill-switchable via
settings.scopeEnabled for exactly this reason; see src/observers/*Observer.ts extending
ObserverBase, and the observers[]/seedObserver/applyScopeEnabled fan-out in src/main.ts).
TESTING.md has the smoke matrix.

NEXT WORK once the smoke test passes (all USER-GATED - do not cut GA without an explicit go):
1. GA release: bump version 1.0.0-rc.1 -> 1.0.0 in manifest.json + package.json + versions.json
   (release.yml's tag-vs-manifest guard requires them equal; a tag with no "-" is marked a full
   release, not prerelease). Commit, tag 1.0.0, push the tag; release.yml ships the quartet.
2. Add a plugin screenshot (publish-plugin-planning.md lists this as a GA blocker).
3. Open the community-plugin directory submission PR against
   obsidianmd/obsidian-releases (manifest id tag-curator, repo jprisant/obsidian-tag-curator).
   Full checklist + reviewer-guideline notes in docs/internal/publish-plugin-planning.md.

OPTIONAL / DEFERRED (only if asked):
- Phase 8 hygiene leftover: unify the repeated `app.plugins as unknown as {...}` casts
  (src/ui/settingsTab.ts, src/ui/welcomeModal.ts,
  src/ui/curationWorkspace/curationWorkspaceView.ts) into one typed helper. Not a blocker.
- Open design decisions in 08_ui-review-decisions.md Sections 4-5: secondary-nav anchor row
  (adopt vs skip), leaf-name final confirm, an Astro docs page, fundingUrl, submit-now vs
  defer, and the opt-in NN flag-to-color mirroring fast-follow (nnColorMirror).
- Prune the _worktrees/v0.1.0 archive worktree if no longer wanted.

Key files: src/ui/ruleEditor.ts (the Phase 3 name-first editor + E5 preview accordion with
override pins), src/ui/settingsTab.ts (5-tab IA + scopes pills), src/ui/welcomeModal.ts,
src/ui/curationWorkspace/ (the workspace leaf: curationWorkspaceView, tagTable, bulkBar,
rowMenu), src/observers/ (4 scope observers on ObserverBase), src/engine/ (ruleEngine, presets,
matchers), styles.css. Docs: docs/internal/v1-vision/ (vision bundle + 08_ui-review-decisions),
docs/internal/publish-plugin-planning.md, docs/internal/scope-and-decisions.md (master D-NN
log), TESTING.md.
```
