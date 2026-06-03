# Tag Curator v1.0.0 - IA rework, density, and triage inbox: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the approved v1.0 information-architecture rework: make curation a discoverable "Curate Tags" settings tab (always Manage), turn the dockable leaf into an opt-in "Tag Curator Pane" with a View/Manage mode toggle, calm the table density, split Settings tabs by responsibility, and build the "reviewed" triage inbox.

**Architecture:** Pure-DOM Obsidian plugin (no UI framework). Shared headless core (`TagListModel` + `TagActions` + `RuleEngine`) already drives the table and the live decorators; this plan reuses that core unchanged and re-homes the views around it. Logic that lives in the model/storage/actions layers is unit-tested with vitest; pure-DOM rendering is verified with `npm run build` plus manual entries added to `TESTING.md` (the obsidian stub lacks full DOM/Menu, matching the existing project convention).

**Tech Stack:** TypeScript, esbuild, vitest, Obsidian plugin API. Gate after every task: `npm run typecheck && npm run lint && npm test && npm run build` (expect eslint `--max-warnings 0`, all tests green, production build succeeds).

**Design source of truth:** `docs/internal/release-plans/plan_v1.0.0/ideas/ui_curate-tags-ia-and-modes.html` (rev 4, crit-approved) and the prior `docs/internal/v1-vision/ui-ideas/ui_workspace-density-ideas.html`.

**Conventions:** conventional commits ending with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. No em-dashes or en-dashes anywhere (PreToolUse hook enforces). Commit at each task boundary. Never skip git hooks.

---

## Phasing and release strategy

Three phases, each green-gated and independently shippable as a release candidate so BRAT testing is never blocked:

- **Phase 1 - Quick wins (ship as `1.0.0-rc.3`).** Low-risk polish that unblocks BRAT now and does not depend on the big IA move: fix the dead "Open Tag Curator" button, restore the General stats position, split Rules into Presets / Custom rules tabs, compact the Help commands, move the table filter chips below the search, and add the "Shown" filter.
- **Phase 2 - The triage inbox (ship as `1.0.0-rc.4`).** The "reviewed" data feature: persist `reviewed`, add "Mark reviewed / Mark unreviewed" per-row and bulk actions, surface a reviewed indicator, and make the "Unreviewed" filter real.
- **Phase 3 - The IA rework (ship as `1.0.0-rc.5`, then promote to GA `1.0.0`).** The "Curate Tags" always-Manage settings tab, the opt-in "Tag Curator Pane" with View/Manage modes (View navigates via tag-to-search, Manage = per-row + bulk parity), the `paneEnabled` setting, and removal of the launcher button.

Cut an rc at the end of each phase: bump `manifest.json` + `package.json` + `versions.json`, commit `chore(release): prepare 1.0.0-rc.N`, tag, push the tag (release.yml ships the quartet). Promote to GA `1.0.0` only on explicit user go after the smoke test.

---

## File structure

**Phase 1**
- Modify `src/ui/settingsTab.ts` - General stats order; split `rules` tab into `presets` + `custom` tabs; compact Help commands; close the Settings modal from the launcher (interim, removed in Phase 3).
- Modify `src/ui/curationWorkspace/tagTable.ts` - render the chip row below the search; add the `shown` chip.
- Modify `src/ui/tagList/tagListModel.ts` - add `'shown'` to `FilterChip` and its predicate.
- Modify `styles.css` - chip-row-below-search layout; any new chip styling.
- Test `tests/tagListModel.test.ts` - the `shown` filter predicate.

**Phase 2**
- Modify `src/storage/tagMeta.ts` - `setReviewed(tag, value)` mutator + `changed` trigger.
- Modify `src/ui/tagList/tagActions.ts` - `setReviewed` host method; `markReviewed(tags, value)`; extend `BulkAction`.
- Modify `src/ui/curationWorkspace/curationWorkspaceView.ts` and the Phase 3 settings-tab host - wire `setReviewed` into the `TagActionsHost`.
- Modify `src/ui/curationWorkspace/rowMenu.ts` - "Mark reviewed" / "Mark unreviewed" menu item.
- Modify `src/ui/curationWorkspace/bulkBar.ts` - "Mark reviewed" bulk button.
- Modify `src/ui/curationWorkspace/tagTable.ts` - optional reviewed dot/indicator on the row.
- Modify `styles.css` - reviewed indicator.
- Test `tests/tagMetaManager.test.ts` - `setReviewed`; `tests/tagActions.test.ts` - `markReviewed`; `tests/tagListModel.test.ts` - `unreviewed` predicate against the new flag.

**Phase 3**
- Create `src/ui/tagList/tagTableDeps.ts` - shared factory building `{ model, actions, host }` for any host surface.
- Modify `src/ui/curationWorkspace/curationWorkspaceView.ts` - consume the factory; add the View/Manage mode; View-mode tag-to-search; pane search + collapsible filter pills.
- Modify `src/ui/settingsTab.ts` - new always-Manage "Curate Tags" tab using the factory + `TagTable`; replace the launcher button with the "Enable Tag Curator Pane" toggle.
- Modify `src/storage/types.ts` (`src/types.ts`) - add `paneEnabled`; bump `SCHEMA_VERSION` to 6; default in `DEFAULT_SETTINGS`.
- Modify `src/storage/settings.ts` - `setPaneEnabled`; v5 to v6 migration guard.
- Modify `src/main.ts` - gate the ribbon icon + open-pane commands on `paneEnabled`; add a "manage" mode hint.
- Modify `styles.css` - mode toggle, pane search, collapsible filter pills.
- Test `tests/settings.test.ts` - `paneEnabled` default + migration + `setPaneEnabled`.

---

## Phase 1 - Quick wins (rc.3)

### Task 1: Close the Settings window when the launcher opens the pane

This is the BRAT-blocking bug. The launcher in `renderGeneral` opens a right-sidebar leaf but never dismisses the full-screen Settings modal, so the pane opens behind it and looks dead. (This button is removed in Phase 3; the fix is interim but unblocks testing now.)

**Files:**
- Modify: `src/ui/settingsTab.ts` (the two launcher buttons in `renderGeneral`, around `src/ui/settingsTab.ts:127-144`)

- [ ] **Step 1: Add a modal-close helper and call it from both launcher buttons**

In `src/ui/settingsTab.ts`, add a private helper to the class:

```ts
/** Close the Settings window so a leaf opened from here is not hidden behind it. */
private closeSettings(): void {
  (this.app as unknown as { setting?: { close?: () => void } }).setting?.close?.();
}
```

Then update both launcher `onClick` handlers in `renderGeneral` to close Settings first:

```ts
.addButton((b) =>
  b
    .setButtonText('Open Tag Curator')
    .setCta()
    .onClick(() => {
      this.closeSettings();
      void this.plugin.openCurationWorkspace();
    }),
)
.addButton((b) =>
  b.setButtonText('Open beside the tag pane').onClick(() => {
    this.closeSettings();
    void this.plugin.openBesideTagPane();
  }),
);
```

- [ ] **Step 2: Verify the build is green**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all pass, no warnings.

- [ ] **Step 3: Manual verification (add to TESTING.md smoke matrix)**

Add a row to `TESTING.md`: "Open Settings -> General -> click Open Tag Curator: Settings closes and the pane is visible in the right sidebar." Confirm in a real vault.

- [ ] **Step 4: Commit**

```bash
git add src/ui/settingsTab.ts TESTING.md
git commit -m "fix(settings): close Settings window when launching the pane

The General-tab launcher opened a sidebar leaf but left the full-screen
Settings modal on top, so the pane appeared dead. Close Settings first.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 2: Restore the General dashboard metrics to the top

The stats cards (Total tags / Hidden now / Active rules / Orphans) should sit above the toggles, where they were before the launcher refactor.

**Files:**
- Modify: `src/ui/settingsTab.ts` (`renderGeneral`, `src/ui/settingsTab.ts:116-187`)

- [ ] **Step 1: Move the stats block above the toggles**

In `renderGeneral`, reorder so the `panel.createDiv({ cls: 'tcst-stats' })` block (the four `renderStatCard` calls) is emitted immediately after the launcher `Setting` and before the "Enable Tag Curator" toggle. The simplest edit: cut the stats block from its current position (after the Preview-mode toggle is wrong; it is currently right after the launcher already in source - confirm exact order on read) and ensure final order is: launcher, stats, Enable, Preview, "If something looks wrong" heading, panic.

Note: read `renderGeneral` first; if the stats are already directly after the launcher in source, no change is needed here and this task only applies to the Phase 3 General rebuild. The mock regression was in the HTML only. Verify against source before editing.

- [ ] **Step 2: Build + commit (only if source changed)**

Run: `npm run typecheck && npm run lint && npm run build`

```bash
git add src/ui/settingsTab.ts
git commit -m "refactor(settings): keep dashboard metrics at the top of General

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 3: Split the Rules tab into Presets and Custom rules tabs

`renderRules` currently stacks Presets above Custom rules in one tab. Make them two sibling top-level tabs.

**Files:**
- Modify: `src/ui/settingsTab.ts` (`TabId`, `buildTabDescriptors`, `renderRules`)

- [ ] **Step 1: Update the tab id union and descriptors**

Change the `TabId` type:

```ts
type TabId = 'general' | 'scopes' | 'presets' | 'custom' | 'advanced' | 'help';
```

In `buildTabDescriptors`, replace the single `rules` descriptor with two:

```ts
{
  id: 'presets',
  label: 'Presets',
  badge: String(PRESETS.length),
  badgeKind: 'count',
  render: (p) => this.renderPresetsTab(p),
},
{
  id: 'custom',
  label: 'Custom rules',
  badge: String(customCount),
  badgeKind: 'count',
  render: (p) => this.renderCustomRules(p),
},
```

- [ ] **Step 2: Add the Presets-tab wrapper and delete the combined renderer**

Replace `renderRules` with a thin `renderPresetsTab` that emits the heading + existing `renderPresets`:

```ts
private renderPresetsTab(panel: HTMLElement): void {
  new Setting(panel).setName('Presets').setHeading();
  this.renderPresets(panel);
}
```

`renderCustomRules` already exists and is reused directly as the `custom` tab renderer. Remove the now-unused `renderRules` method.

- [ ] **Step 3: Build (typecheck catches any stale `activeTab` default of `'rules'`)**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: pass. If `activeTab` was ever defaulted to `'rules'`, retype it; the default is `'general'` so no change expected.

- [ ] **Step 4: Manual verification + commit**

Add to `TESTING.md`: "Settings shows Presets and Custom rules as separate tabs, each with a count badge." Then:

```bash
git add src/ui/settingsTab.ts TESTING.md
git commit -m "feat(settings): split Rules into Presets and Custom rules tabs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 4: Compact the Help-tab command list

`renderHelp` renders each command as a full `Setting` row (name + description), which is very tall. Replace the commands block with a dense two-column table; keep FAQ and About.

**Files:**
- Modify: `src/ui/settingsTab.ts` (`renderHelp`, `src/ui/settingsTab.ts:543-610`)
- Modify: `styles.css` (compact command table)

- [ ] **Step 1: Render commands as a compact table**

In `renderHelp`, replace the `for (const [name, desc] of cmds) new Setting(panel)...` loop with a table:

```ts
const table = panel.createEl('table', { cls: 'tcst-cmd-table' });
for (const [name, desc] of cmds) {
  const tr = table.createEl('tr');
  tr.createEl('td', { cls: 'tcst-cmd', text: name });
  tr.createEl('td', { cls: 'tcst-cmd-d', text: desc });
}
```

Keep the existing `cmds` array, the "Commands" heading, the intro `<p>`, and the FAQ/About sections unchanged.

- [ ] **Step 2: Add the table CSS**

Append to `styles.css`:

```css
.tcst-cmd-table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 14px; }
.tcst-cmd-table td { padding: 4px 8px; border-bottom: 1px solid var(--background-modifier-border); vertical-align: top; }
.tcst-cmd-table td.tcst-cmd { font-weight: 600; color: var(--text-normal); white-space: nowrap; width: 1%; }
.tcst-cmd-table td.tcst-cmd-d { color: var(--text-muted); }
```

- [ ] **Step 3: Build + commit**

Run: `npm run typecheck && npm run lint && npm run build`

```bash
git add src/ui/settingsTab.ts styles.css
git commit -m "feat(settings): compact the Help command list into a dense table

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 5: Move the table filter chips below the search bar

In `tagTable.ts` the toolbar currently lays search and chips on one row. Put the chip row beneath the search.

**Files:**
- Modify: `src/ui/curationWorkspace/tagTable.ts` (`buildToolbar`, `src/ui/curationWorkspace/tagTable.ts:90-117`)
- Modify: `styles.css` (`.tct-toolbar`, `.tct-chips`)

- [ ] **Step 1: Make the toolbar stack search over chips**

`buildToolbar` already creates `searchWrap` then `chipBar` inside `.tct-toolbar`. Change `.tct-toolbar` to a column so the chip row drops below the search. In `styles.css` find `.tct-toolbar` and set:

```css
.tct-toolbar { display: flex; flex-direction: column; align-items: stretch; gap: 8px; }
.tct-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.tct-search { width: 100%; }
```

(Adjust to the existing rule names; read `styles.css` for the current `.tct-toolbar`/`.tct-search`/`.tct-chips` definitions and edit in place rather than duplicating.)

- [ ] **Step 2: Build + manual check + commit**

Run: `npm run typecheck && npm run lint && npm run build`
Add to `TESTING.md`: "Workspace toolbar shows the search box on top and the filter chips on their own row beneath it."

```bash
git add src/ui/curationWorkspace/tagTable.ts styles.css TESTING.md
git commit -m "feat(workspace): move filter chips below the search bar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 6: Add the "Shown" filter (visible-only)

Add a `shown` filter chip that matches tags whose visibility is `shown` (the inverse of Hidden). This is testable logic.

**Files:**
- Modify: `src/ui/tagList/tagListModel.ts` (`FilterChip` union + the `matchesFilter` switch, `src/ui/tagList/tagListModel.ts:7-14,87-102`)
- Modify: `src/ui/curationWorkspace/tagTable.ts` (`CHIPS` array, `src/ui/curationWorkspace/tagTable.ts:33-41`)
- Test: `tests/tagListModel.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/tagListModel.test.ts` (follow the existing fixture/setup pattern in that file for building a model with known rows):

```ts
it('shown filter returns only tags whose visibility is shown', () => {
  const model = buildModel(); // existing helper in this file; seeds shown + hidden tags
  model.setFilter('shown');
  const rows = model.rows();
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((r) => r.visibility === 'shown')).toBe(true);
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm test -- tagListModel`
Expected: FAIL - `'shown'` is not assignable to `FilterChip` (type error) or the filter returns everything.

- [ ] **Step 3: Add `shown` to the union and the predicate**

In `src/ui/tagList/tagListModel.ts`, extend `FilterChip`:

```ts
export type FilterChip =
  | 'all'
  | 'shown'
  | 'hidden'
  | 'flagged'
  | 'orphans'
  | 'frontmatter'
  | 'inline'
  | 'unreviewed';
```

Add the case to the `matchesFilter` switch (next to `hidden`):

```ts
case 'shown':
  return row.visibility === 'shown';
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test -- tagListModel`
Expected: PASS.

- [ ] **Step 5: Add the chip to the table toolbar**

In `src/ui/curationWorkspace/tagTable.ts`, update `CHIPS` to insert `Shown` right after `All`:

```ts
const CHIPS: Array<[FilterChip, string]> = [
  ['all', 'All'],
  ['shown', 'Shown'],
  ['hidden', 'Hidden'],
  ['flagged', 'Flagged'],
  ['orphans', 'Orphans'],
  ['frontmatter', 'Frontmatter'],
  ['inline', 'Inline'],
  ['unreviewed', 'Unreviewed'],
];
```

- [ ] **Step 6: Full gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add src/ui/tagList/tagListModel.ts src/ui/curationWorkspace/tagTable.ts tests/tagListModel.test.ts
git commit -m "feat(workspace): add a Shown (visible-only) filter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

**End of Phase 1: cut `1.0.0-rc.3`** (bump the three version files, commit `chore(release): prepare 1.0.0-rc.3`, tag `1.0.0-rc.3`, push tag). Let the user BRAT-test before Phase 2.

---

## Phase 2 - The triage inbox (rc.4)

### Task 7: Persist the reviewed flag in the tag sidecar

`reviewed?: boolean` already exists on `TagMeta`; add a setter to `TagMetaManager` so a tag can be marked reviewed/unreviewed, persisted to `tags.json`, and announced via the existing `changed` event.

**Files:**
- Modify: `src/storage/tagMeta.ts`
- Test: `tests/tagMetaManager.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/tagMetaManager.test.ts` (use the existing manager-construction helper in that file):

```ts
it('setReviewed marks a tag reviewed and fires changed', async () => {
  const mgr = buildManager();           // existing helper
  await seedTag(mgr, 'project');        // existing helper that indexes a tag
  let fired = 0;
  mgr.on('changed', () => { fired += 1; });
  mgr.setReviewed('project', true);
  expect(mgr.get('project')?.reviewed).toBe(true);
  expect(fired).toBeGreaterThan(0);
  mgr.setReviewed('project', false);
  expect(mgr.get('project')?.reviewed).toBe(false);
});
```

If `tests/tagMetaManager.test.ts` has no `buildManager`/`seedTag` helpers, mirror the construction the existing tests in that file use (they already build a `TagMetaManager` with the stub app).

- [ ] **Step 2: Run, verify it fails**

Run: `npm test -- tagMetaManager`
Expected: FAIL - `setReviewed` is not a function.

- [ ] **Step 3: Implement `setReviewed`**

Add to `src/storage/tagMeta.ts`:

```ts
/**
 * Mark a tag reviewed / unreviewed (the triage inbox). No-op if the tag is not
 * in the store. Persists via the debounced sidecar save and announces via
 * `changed` so open views re-render. Tag keys carry no leading '#'.
 */
setReviewed(tag: string, value: boolean): void {
  const existing = this.store.get(tag);
  if (!existing) return;
  existing.reviewed = value;
  this.scheduleSave();
  this.trigger('changed');
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `npm test -- tagMetaManager`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage/tagMeta.ts tests/tagMetaManager.test.ts
git commit -m "feat(storage): persist a per-tag reviewed flag (setReviewed)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 8: Add markReviewed to the action layer

Route reviewing through `TagActions` so the row menu and bulk bar share one path, mirroring `setVisibility`/`setOverride`.

**Files:**
- Modify: `src/ui/tagList/tagActions.ts`
- Test: `tests/tagActions.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/tagActions.test.ts` (the file already builds a `TagActions` with a fake host that records calls; extend that host):

```ts
it('markReviewed sets reviewed on every tag via the host', async () => {
  const calls: Array<[string, boolean]> = [];
  const actions = new TagActions({
    isPluginEnabled: () => false,
    executeCommand: () => false,
    setOverride: () => {},
    setReviewed: (tag, value) => { calls.push([tag, value]); },
  });
  const result = await actions.markReviewed(['a', 'b'], true);
  expect(result.applied).toBe(2);
  expect(calls).toEqual([['a', true], ['b', true]]);
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npm test -- tagActions`
Expected: FAIL - `setReviewed` not in `TagActionsHost`; `markReviewed` not a function.

- [ ] **Step 3: Extend the host and add markReviewed**

In `src/ui/tagList/tagActions.ts`, add to `TagActionsHost`:

```ts
/** Persist a per-tag reviewed flag (the triage inbox). Keys carry no leading '#'. */
setReviewed(tag: string, value: boolean): void | Promise<void>;
```

Extend `BulkAction`:

```ts
export type BulkAction =
  | 'hide'
  | 'unhide'
  | 'mark-reviewed'
  | 'mark-unreviewed'
  | 'send-to-tag-wrangler';
```

Add the method and the `applyBulk` cases:

```ts
async markReviewed(tags: string[], value: boolean): Promise<VisibilityResult> {
  for (const tag of tags) {
    await this.hostApi.setReviewed(tag, value);
  }
  return { applied: tags.length, deferred: 0 };
}
```

In `applyBulk`, add:

```ts
case 'mark-reviewed':
  return this.markReviewed(tags, true);
case 'mark-unreviewed':
  return this.markReviewed(tags, false);
```

- [ ] **Step 4: Run, verify it passes**

Run: `npm test -- tagActions`
Expected: PASS.

- [ ] **Step 5: Wire `setReviewed` into the view's host**

In `src/ui/curationWorkspace/curationWorkspaceView.ts`, add to the `host: TagActionsHost` object (next to `setOverride`):

```ts
setReviewed: (tag, value) => this.plugin.tagMetaManager.setReviewed(tag, value),
```

- [ ] **Step 6: Full gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add src/ui/tagList/tagActions.ts src/ui/curationWorkspace/curationWorkspaceView.ts tests/tagActions.test.ts
git commit -m "feat(actions): markReviewed routes through TagActions (per-tag + bulk)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 9: Add "Mark reviewed" to the per-row menu

**Files:**
- Modify: `src/ui/curationWorkspace/rowMenu.ts`

- [ ] **Step 1: Add the menu item**

In `openRowMenu` (after the override items, before "Why is this affected?"), read the current reviewed state from the host meta and add a toggle item:

```ts
const meta = host.getMeta().get(tag);
const isReviewed = Boolean(meta?.reviewed);
menu.addItem((item) =>
  item
    .setTitle(isReviewed ? 'Mark unreviewed' : 'Mark reviewed')
    .setIcon(isReviewed ? 'rotate-ccw' : 'check')
    .onClick(() => {
      void host /* actions host */;
      void actions.markReviewed([tag], !isReviewed);
    }),
);
```

Note on wiring: `openRowMenu(evt, tag, actions, host)` already receives `actions` (a `TagActions`) and `host` (a `TagListDiagnosticsHost` exposing `getMeta`). Use `actions.markReviewed([tag], !isReviewed)` and `host.getMeta()`; confirm both are in scope at the call site and the `TagListDiagnosticsHost` type includes `getMeta` (it does - it is used for diagnostics).

- [ ] **Step 2: Build + manual check + commit**

Run: `npm run typecheck && npm run lint && npm run build`
Add to `TESTING.md`: "Row menu shows Mark reviewed; after clicking, the same row's menu shows Mark unreviewed, and the Unreviewed filter no longer lists the tag."

```bash
git add src/ui/curationWorkspace/rowMenu.ts TESTING.md
git commit -m "feat(workspace): Mark reviewed / unreviewed in the row menu

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 10: Add "Mark reviewed" to the bulk bar

**Files:**
- Modify: `src/ui/curationWorkspace/bulkBar.ts`

- [ ] **Step 1: Add the bulk button**

In the `BulkBar` constructor, after the Unhide button, add:

```ts
this.addButton('Mark reviewed', 'check', () => this.runBulk('mark-reviewed'));
```

Widen `runBulk`'s parameter type to the new `BulkAction` union (or import and reuse `BulkAction`):

```ts
private async runBulk(action: BulkAction): Promise<void> {
  const tags = [...this.model.selection];
  if (tags.length === 0) return;
  await this.actions.applyBulk(tags, action);
  this.model.clearSelection();
  this.host.requestRefresh();
}
```

Import `BulkAction` from `../tagList/tagActions`.

- [ ] **Step 2: Build + manual check + commit**

Run: `npm run typecheck && npm run lint && npm run build`
Add to `TESTING.md`: "Select 2 tags, click Mark reviewed: both leave the Unreviewed filter."

```bash
git add src/ui/curationWorkspace/bulkBar.ts TESTING.md
git commit -m "feat(workspace): Mark reviewed bulk action

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 11: Confirm the Unreviewed filter and add a reviewed indicator

The `unreviewed` predicate already reads `!row.meta.reviewed`. Add a regression test against a reviewed tag, and a subtle row indicator so reviewed state is visible.

**Files:**
- Modify: `src/ui/curationWorkspace/tagTable.ts` (row render - add a reviewed marker)
- Modify: `styles.css`
- Test: `tests/tagListModel.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('unreviewed filter excludes tags whose meta.reviewed is true', () => {
  const model = buildModel(); // seed two tags; mark one reviewed in its meta
  model.setFilter('unreviewed');
  const rows = model.rows();
  expect(rows.every((r) => !r.meta.reviewed)).toBe(true);
});
```

If the existing `buildModel` helper does not let you set `reviewed` on a seeded tag, extend the fixture so one seeded `TagMeta` has `reviewed: true`.

- [ ] **Step 2: Run, verify it passes (logic already exists)**

Run: `npm test -- tagListModel`
Expected: PASS (this is a guard test that locks the behavior; if it fails, the fixture is wrong, not the code).

- [ ] **Step 3: Render a reviewed marker on the row**

In `renderRow` in `tagTable.ts`, after the tag-name cell, add a small reviewed tick when `row.meta.reviewed`:

```ts
if (row.meta.reviewed) {
  const mark = nameCell.createSpan({ cls: 'tct-reviewed-mark' });
  mark.setAttribute('aria-label', 'Reviewed');
  mark.setAttribute('title', 'Reviewed');
  setIcon(mark, 'check');
}
```

Add CSS to `styles.css`:

```css
.tct-reviewed-mark { margin-left: 6px; color: var(--text-success); opacity: 0.7; }
.tct-reviewed-mark svg { width: 13px; height: 13px; }
```

- [ ] **Step 4: Full gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add src/ui/curationWorkspace/tagTable.ts styles.css tests/tagListModel.test.ts
git commit -m "feat(workspace): reviewed-state row marker + Unreviewed filter guard test

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

**End of Phase 2: cut `1.0.0-rc.4`.** BRAT-test the triage inbox before Phase 3.

---

## Phase 3 - The IA rework (rc.5, then GA)

### Task 12: Extract a shared TagTable dependency factory

`CurationWorkspaceView` builds `model`, `actions`, and the diagnostics `host` inline. Phase 3 needs the same trio inside the settings "Curate Tags" tab, so extract a factory both can call. No behavior change.

**Files:**
- Create: `src/ui/tagList/tagTableDeps.ts`
- Modify: `src/ui/curationWorkspace/curationWorkspaceView.ts` (consume the factory)

- [ ] **Step 1: Create the factory**

```ts
// src/ui/tagList/tagTableDeps.ts
import { App } from 'obsidian';
import TagCuratorPlugin from '../../main';
import { resolveActiveRules } from '../../engine/presets';
import { TagListModel, TagListDataSource } from './tagListModel';
import { TagActions, TagActionsHost } from './tagActions';
import { TagListDiagnosticsHost } from '../curationWorkspace/tagTableHost';

export interface TagTableDeps {
  model: TagListModel;
  actions: TagActions;
  host: TagListDiagnosticsHost;
}

/**
 * Build the headless trio that drives a TagTable, for ANY host surface
 * (the dockable leaf or the Curate Tags settings tab). `requestRefresh` is the
 * surface's own repaint callback.
 */
export function makeTagTableDeps(
  plugin: TagCuratorPlugin,
  app: App,
  requestRefresh: () => void,
): TagTableDeps {
  const dataSource: TagListDataSource = {
    getSettings: () => plugin.settingsManager.get(),
    getMeta: () => plugin.tagMetaManager.all(),
  };
  const model = new TagListModel(dataSource);

  const isPluginEnabled = (id: string): boolean => {
    const plugins = (app as unknown as { plugins?: { enabledPlugins?: Set<string> } }).plugins;
    return Boolean(plugins?.enabledPlugins?.has(id));
  };

  const actionsHost: TagActionsHost = {
    isPluginEnabled,
    executeCommand: (id) => {
      const commands = (app as unknown as {
        commands?: { executeCommandById?: (id: string) => boolean };
      }).commands;
      return Boolean(commands?.executeCommandById?.(id));
    },
    setOverride: (tag, value) => plugin.settingsManager.setOverride(tag, value),
    setReviewed: (tag, value) => plugin.tagMetaManager.setReviewed(tag, value),
  };
  const actions = new TagActions(actionsHost);

  const host: TagListDiagnosticsHost = {
    getSettings: () => plugin.settingsManager.get(),
    getMeta: () => plugin.tagMetaManager.all(),
    getActiveRules: () => resolveActiveRules(plugin.settingsManager.get()),
    isPluginEnabled,
    requestRefresh,
  };

  return { model, actions, host };
}
```

- [ ] **Step 2: Consume it in the view**

In `curationWorkspaceView.ts`, replace the inline construction in the constructor with:

```ts
const deps = makeTagTableDeps(this.plugin, this.app, () => this.refresh());
this.model = deps.model;
this.actions = deps.actions;
this.tableHost = deps.host;
```

- [ ] **Step 3: Full gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: pass (behavior identical).

```bash
git add src/ui/tagList/tagTableDeps.ts src/ui/curationWorkspace/curationWorkspaceView.ts
git commit -m "refactor(workspace): extract makeTagTableDeps factory for reuse

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 13: Add the always-Manage "Curate Tags" settings tab

Add a `curate` tab between General and Scopes that mounts a `TagTable` via the factory. Always full Manage (no view mode here).

**Files:**
- Modify: `src/ui/settingsTab.ts` (`TabId`, `buildTabDescriptors`, new `renderCurate`, lifecycle)

- [ ] **Step 1: Add the tab id + descriptor**

Extend `TabId` with `'curate'`. In `buildTabDescriptors`, insert after `general`:

```ts
{ id: 'curate', label: 'Curate Tags', render: (p) => this.renderCurate(p) },
```

- [ ] **Step 2: Render a TagTable into the panel**

Add fields and a renderer. Keep a reference so it can be destroyed on `hide()`/re-render:

```ts
private curateTable: TagTable | null = null;

private renderCurate(panel: HTMLElement): void {
  this.curateTable?.destroy();
  const host = panel.createDiv({ cls: 'tcst-curate-host' });
  const deps = makeTagTableDeps(this.plugin, this.app, () => this.curateTable?.refresh());
  this.curateTable = new TagTable(host, deps.model, deps.actions, deps.host);
}
```

Import `TagTable` from `./curationWorkspace/tagTable` and `makeTagTableDeps` from `./tagList/tagTableDeps`.

- [ ] **Step 3: Destroy the table when the tab unmounts**

In `display()` (which re-runs on every tab switch) and in `hide()`, destroy any existing `curateTable` to avoid leaked scroll listeners:

```ts
// at the top of display(), alongside the banner teardown:
this.curateTable?.destroy();
this.curateTable = null;
```
and in `hide()`:
```ts
this.curateTable?.destroy();
this.curateTable = null;
```

- [ ] **Step 4: Build + manual check + commit**

Run: `npm run typecheck && npm run lint && npm run build`
Add to `TESTING.md`: "Settings -> Curate Tags shows the full Manage grid (search, chips, selection, bulk bar, row menu); switching away and back does not duplicate rows or leak scrolling."

```bash
git add src/ui/settingsTab.ts TESTING.md
git commit -m "feat(settings): add the always-Manage Curate Tags tab

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 14: Add the paneEnabled setting (schema v6)

**Files:**
- Modify: `src/types.ts` (`SCHEMA_VERSION`, `TagCuratorSettings`, `DEFAULT_SETTINGS`)
- Modify: `src/storage/settings.ts` (`setPaneEnabled`, migration guard)
- Test: `tests/settings.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/settings.test.ts` (it already constructs a `SettingsManager` over a fake plugin with `loadData`/`saveData`):

```ts
it('paneEnabled defaults true and setPaneEnabled persists', async () => {
  const mgr = buildManager({});           // existing helper: empty stored data
  await mgr.load();
  expect(mgr.get().paneEnabled).toBe(true);
  await mgr.setPaneEnabled(false);
  expect(mgr.get().paneEnabled).toBe(false);
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npm test -- settings`
Expected: FAIL - `paneEnabled` missing; `setPaneEnabled` not a function.

- [ ] **Step 3: Add the field, default, migration, and setter**

In `src/types.ts`: bump `export const SCHEMA_VERSION = 6;`, add to `TagCuratorSettings`:

```ts
// Whether the dockable Tag Curator Pane is available (opt-in surface). Curation
// always lives in the Curate Tags settings tab; this only governs the sidebar
// leaf, its ribbon icon, and the open-pane commands. Schema v6 added this.
paneEnabled: boolean;
```

Add to `DEFAULT_SETTINGS`: `paneEnabled: true,`.

In `src/storage/settings.ts` `migrate`, add a guard block:

```ts
if (inferred < 6) {
  if (typeof merged.paneEnabled !== 'boolean') {
    merged.paneEnabled = true;
  }
}
```

Add the setter:

```ts
async setPaneEnabled(paneEnabled: boolean): Promise<void> {
  this.settings.paneEnabled = paneEnabled;
  await this.persist();
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `npm test -- settings`
Expected: PASS.

- [ ] **Step 5: Full gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add src/types.ts src/storage/settings.ts tests/settings.test.ts
git commit -m "feat(settings): add paneEnabled (schema v6) for the opt-in pane

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 15: Replace the launcher with the Enable Pane toggle; gate the pane

Remove the "Open Tag Curator" launcher from General (curation is now the Curate Tags tab) and replace it with the "Enable Tag Curator Pane" toggle. Gate the ribbon icon and open-pane commands on `paneEnabled`.

**Files:**
- Modify: `src/ui/settingsTab.ts` (`renderGeneral`)
- Modify: `src/main.ts` (ribbon registration + open-pane behavior)

- [ ] **Step 1: Swap the launcher Setting for the toggle**

In `renderGeneral`, replace the launcher `Setting` (the two Open buttons) with:

```ts
new Setting(panel)
  .setName('Enable Tag Curator Pane')
  .setDesc(
    'Also surface curation as a dockable sidebar pane you can keep open beside the native tag pane. Curation always lives in the Curate Tags tab; this adds the docked View/Manage option.',
  )
  .addToggle((t) =>
    t.setValue(this.plugin.settingsManager.get().paneEnabled).onChange(async (v) => {
      await this.plugin.settingsManager.setPaneEnabled(v);
      this.plugin.applyPaneEnabled();
    }),
  );
```

Remove the now-dead `closeSettings` helper added in Task 1 (its only callers are gone).

- [ ] **Step 2: Gate the ribbon icon + commands in main.ts**

In `src/main.ts`, store the ribbon element and add/remove it from `applyPaneEnabled`. Replace the current `addRibbonIcon` call with a guarded registration:

```ts
private ribbonEl: HTMLElement | null = null;

private applyPaneEnabled(): void {
  const on = this.settingsManager.get().paneEnabled;
  if (on && !this.ribbonEl) {
    this.ribbonEl = this.addRibbonIcon('tags', 'Open Tag Curator', () => {
      void this.openCurationWorkspace();
    });
  } else if (!on && this.ribbonEl) {
    this.ribbonEl.remove();
    this.ribbonEl = null;
  }
  if (!on) {
    // Close any open pane leaves so disabling actually hides the surface.
    for (const leaf of this.app.workspace.getLeavesOfType(CURATION_VIEW_TYPE)) {
      leaf.detach();
    }
  }
}
```

Make `applyPaneEnabled` public (called from the settings toggle). Call it once at the end of `onload` after registering views. In `openCurationWorkspace`, if `!paneEnabled`, show a Notice ("Enable the Tag Curator Pane in Settings -> General to dock it") and return, so the open-pane commands respect the gate.

- [ ] **Step 3: Build + manual check + commit**

Run: `npm run typecheck && npm run lint && npm run build`
Add to `TESTING.md`: "General has no Open button; the Enable Tag Curator Pane toggle adds/removes the ribbon icon and closes the pane when turned off."

```bash
git add src/ui/settingsTab.ts src/main.ts TESTING.md
git commit -m "feat(settings): replace the launcher with the Enable Pane toggle and gate the pane

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 16: Pane View/Manage mode

Add a View/Manage toggle to `CurationWorkspaceView`. Manage is today's full grid (per-row + bulk). View is read-only: hide selection/bulk/row-menu chrome, and clicking a tag opens an Obsidian search for that tag's notes. Search box and a collapsible filter-pill row are present in both modes.

**Files:**
- Modify: `src/ui/curationWorkspace/curationWorkspaceView.ts`
- Modify: `src/ui/curationWorkspace/tagTable.ts` (mode-aware rendering; tag-as-search-link in View; collapsible chips)
- Modify: `styles.css`

- [ ] **Step 1: Add a paneMode to the view and a toggle in the header**

In `curationWorkspaceView.ts`, add `private paneMode: 'view' | 'manage' = 'view';`. In `buildUI`, next to the Tags/Rules segmented control, add a View/Manage segmented control (only meaningful in Tags mode). On change, set `paneMode`, add/remove a `tcw-mode-view` / `tcw-mode-manage` class on `this.container`, and call `this.table?.setMode(this.paneMode)`.

- [ ] **Step 2: Make TagTable mode-aware**

Add to `TagTable` a `setMode(mode: 'view' | 'manage')` that toggles a `tct-view` class on `this.root` and re-renders. Drive these via CSS off `.tct-view`:
- hide the select column, the select-all header cell, the per-row checkboxes, the bulk bar, and the per-row more-actions button;
- collapse the chip row behind a "Filters" disclosure (see Step 4).

In `renderRow`, when in view mode, render the tag name as a clickable search trigger instead of plain text:

```ts
if (this.mode === 'view') {
  nameCell.addClass('tct-tagname-link');
  nameCell.addEventListener('click', () => this.host.searchTag(row.meta.tag));
}
```

Add `searchTag(tag: string): void` to `TagListDiagnosticsHost`; implement it in `makeTagTableDeps` (Task 12) as:

```ts
searchTag: (tag) => {
  const search = (app as unknown as {
    internalPlugins?: { getPluginById?: (id: string) => { instance?: { openGlobalSearch?: (q: string) => void } } };
  }).internalPlugins?.getPluginById?.('global-search')?.instance;
  search?.openGlobalSearch?.(`tag:#${tag}`);
},
```

- [ ] **Step 3: Default the pane to View**

`paneMode` starts as `'view'`; mount the table in view mode so an opened pane is calm by default. Manage is one click away.

- [ ] **Step 4: Collapsible filter pills**

Wrap the chip bar in a disclosure: a "Filters" button that toggles a `tct-chips-collapsed` class on the chip row (collapsed by default in both modes to keep the narrow pane lean). The search box stays always visible.

- [ ] **Step 5: CSS**

Add `styles.css` rules: `.tcw-modeswitch` reuse for the View/Manage control; `.tct-view .tct-cell-select, .tct-view .tct-cell-actions, .tct-view .tct-bulk-bar { display: none; }`; `.tct-tagname-link { cursor: pointer; color: var(--text-accent); }` with hover underline; `.tct-chips-collapsed { display: none; }`; the Filters toggle caret.

- [ ] **Step 6: Build + manual check + commit**

Run: `npm run typecheck && npm run lint && npm run build`
Add to `TESTING.md`: "Pane opens in View (no checkboxes/bulk/menu); clicking a tag opens search for that tag. Switch to Manage: selection + bulk + row menu return. Filters disclosure expands/collapses the chips in both modes. Search box present in both."

```bash
git add src/ui/curationWorkspace/curationWorkspaceView.ts src/ui/curationWorkspace/tagTable.ts src/ui/tagList/tagTableDeps.ts styles.css TESTING.md
git commit -m "feat(pane): View/Manage modes, tag-to-search in View, collapsible filter pills

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 17: Leaf display polish + final pass

**Files:**
- Modify: `src/ui/curationWorkspace/curationWorkspaceView.ts`
- Modify: `TESTING.md`

- [ ] **Step 1: Confirm naming + default mode**

Leaf `getDisplayText()` stays "Tag Curator". Confirm the pane opens in View, and the Curate Tags settings tab opens in Manage. Confirm the status-bar / deep-link intents (`setHiddenOnly`, `setRuleFilter`) force Manage where they imply action (they call `setMode('tags')`; extend to also `setMode('manage')` on the table when a rule deep-link arrives).

- [ ] **Step 2: Full gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: 250+ tests green (the new model/storage/actions tests added across phases), build succeeds.

- [ ] **Step 3: Full manual smoke (TESTING.md)**

Walk the entire TESTING.md matrix in a real vault, including the new Phase 1-3 rows.

- [ ] **Step 4: Commit**

```bash
git add src/ui/curationWorkspace/curationWorkspaceView.ts TESTING.md
git commit -m "polish(pane): default modes + deep-link forces Manage

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

**End of Phase 3: cut `1.0.0-rc.5`.** After the user's smoke test passes, promote to GA: bump the three version files to `1.0.0`, commit `chore(release): prepare 1.0.0`, tag `1.0.0` (release.yml marks it a full release since the tag has no `-`), add the screenshot, then open the community-directory submission PR per `docs/internal/publish-plugin-planning.md`.

---

## Self-review

**Spec coverage (against the rev-4 board + the two questions):**
- Curate Tags tab, always Manage -> Task 13. [covered]
- Enable Tag Curator Pane toggle + opt-in pane -> Tasks 14, 15. [covered]
- Remove the Open button + bug -> Task 1 (interim fix), Task 15 (removal). [covered]
- Pane View/Manage, View navigates via tag-to-search, Manage = per-row + bulk parity -> Task 16. [covered]
- Pane search + collapsible filter pills (both modes) -> Task 16 Steps 4-5. [covered]
- General stats on top -> Task 2. [covered]
- Rules -> Presets / Custom rules tabs -> Task 3. [covered]
- Compact Help commands -> Task 4. [covered]
- Filter chips below search -> Task 5. [covered]
- Shown / visible-only filter -> Task 6. [covered]
- Unreviewed becomes real: Mark reviewed per-row + bulk + persisted flag -> Tasks 7-11. [covered]

**Placeholder scan:** Task 2 is conditional (it may be a no-op if the source order is already correct - the regression was in the HTML mock); flagged explicitly rather than left vague. All code steps show concrete code.

**Type consistency:** `setReviewed(tag, value: boolean)` is the same signature in `TagMetaManager` (Task 7), `TagActionsHost` (Task 8), and `makeTagTableDeps` (Task 12). `BulkAction` is extended once (Task 8) and consumed in `bulkBar.runBulk` (Task 10). `FilterChip` gains `'shown'` once (Task 6). `paneEnabled` is defined once (Task 14) and read in `settingsTab` + `main` (Task 15). `searchTag` is added to `TagListDiagnosticsHost` (Task 16 Step 2) and implemented in the factory (same task).

**Open risk to verify at execution:** `TagListDiagnosticsHost` currently has no `searchTag`; Task 16 adds it, which means every constructor of that host (the factory) must implement it - the factory is the single construction site after Task 12, so this is contained. Confirm no other code builds a `TagListDiagnosticsHost` literal (grep before editing).
