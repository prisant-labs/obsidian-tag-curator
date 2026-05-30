# Tag List Dual-Host Redesign - Specification

| Field | Value |
|---|---|
| Status | **Draft / Unreleased** |
| Relates to | D-011 (revised here), B009 (per-tag overrides), settings-tab stub fix |
| GitHub issue | _none yet_ |
| Target | Architecture + read surfaces: next patch (no migration). Functional hide/unhide: v0.2 fast-follow (B009). |
| Authors | Tag Curator team |
| Last updated | 2026-05-29 |

---

## 1. Problem and vision

The Settings "Tag list" tab is a **stub**. `settingsTab.renderTagListTab` (settingsTab.ts:241) renders an info callout with stale "Phase 3 hasn't shipped" copy plus two buttons that just open the sidebar leaf. The real, functional table lives only in `tagListView.ts`, which `extends ItemView` and is bound to a `WorkspaceLeaf`. D-011's promise ("both hosts render the same component") was only half-built, because an `ItemView` cannot be mounted inside a `PluginSettingTab` (a plain element, not a leaf) without first extracting the rendering into a host-agnostic component.

The redesign turns the two hosts into **two differentiated surfaces sharing one tested core**:

- **Sidebar leaf** -> a lightweight **viewer** (browse, click a tag to search it) with an optional light **manage** toggle.
- **Settings tab** -> the full **management table** (all columns, bulk, rule attribution).

This both fixes the stub and gives each host the weight it should have, instead of forcing one component to be both.

---

## 2. Use cases

| User wants to... | Surface | Interaction |
|---|---|---|
| Glance at the vault's tags and jump to notes for one | Sidebar, view mode | Click a tag -> vault search `tag:#name` |
| Sort tags by frequency to find the noisy ones | Either surface | Click the Count header |
| Find a specific tag quickly | Either surface | Simple name search |
| Curate in depth (see source, first/last seen, which rules hit each tag) | Settings, full table | Read the wide table, sort, filter by analysis chips |
| Quickly act on a tag while browsing | Sidebar, manage mode | Toggle manage; select + bulk action |
| Hand noisy tags to Tag Wrangler for a real rename | Either surface | Select -> Send to Tag Wrangler |

---

## 3. Out of scope

- **Aliasing / display-merge** - that is the separate v0.2 aliases proposal.
- **Notebook Navigator tag-tree hiding** - that is Effort A (scope expansion).
- **Drag-to-reorder** of anything (B012).
- **New analysis filters** beyond the existing chip set.
- This spec does **not** itself decide whether per-tag overrides (B009) ship in the same release; see Section 8.

---

## 4. Architecture

One shared, host-agnostic core; two thin render components.

```
        TagListModel                 TagActions
   (rows, filter, sort,        (toggleHidden, applyBulk,
    selection, search)          sendToTagWrangler, ...future)
            \                          /
             \____________  __________/
                          \/
          +---------------+    +----------------+
          |   TagViewer    |    |   TagTable      |
          |  sidebar leaf  |    |  settings tab   |
          | view + manage  |    |   full table    |
          +----------------+    +-----------------+
```

### 4.1 `TagListModel` (UI-independent, buildable now)

Pure data + view-state. No DOM, no leaf. One instance per host (so each host keeps its own sort/filter/search/selection). Reads shared plugin data (`tagMetaManager`, `settingsManager`) and computes rule matches via the existing engine.

```typescript
// src/ui/tagList/tagListModel.ts
export type TagVisibility = 'shown' | 'hidden' | 'flagged';
export type SortKey = 'name' | 'count' | 'firstSeen' | 'lastSeen' | 'source' | 'visible';
export type FilterChip = 'all' | 'hidden' | 'orphans' | 'frontmatter' | 'unreviewed';

export interface TagRow {
  meta: TagMeta;
  matches: Array<{ ruleId: string; ruleName: string }>;
  visibility: TagVisibility;
}

export class TagListModel {
  constructor(plugin: TagCuratorPlugin);

  // view state (per host instance)
  setSort(key: SortKey, desc?: boolean): void;
  setFilter(chip: FilterChip): void;
  setSearch(term: string): void;
  toggleSelect(tag: string): void;
  clearSelection(): void;
  get selection(): ReadonlySet<string>;

  // computed (pure given plugin data + view state)
  rows(): TagRow[];        // filtered + searched + sorted
  allRows(): TagRow[];     // unfiltered (for chip counts)
  rowFor(tag: string): TagRow | undefined;
}
```

The row-building, filter predicates, search predicate, and comparator are pure functions and are the bulk of what makes this unit-testable without an Obsidian leaf - the thing the current `ItemView` cannot do, and the root reason the settings host was left a stub.

### 4.2 `TagActions` (service layer; shape stable now, hide/unhide gated on B009)

Operations over plugin state, callable from any host. Keeping actions here (not inside a render component) is what makes a future quick-manage panel additive UI wiring rather than a re-implementation.

```typescript
// src/ui/tagList/tagActions.ts
export type BulkAction = 'hide' | 'unhide' | 'send-to-tag-wrangler';

export class TagActions {
  constructor(plugin: TagCuratorPlugin);

  // Functional today (delegates to Tag Wrangler, detection-gated):
  sendToTagWrangler(tags: string[]): Promise<number>;

  // Require the per-tag override store (B009, see Section 8).
  // Until B009 lands these keep today's "coming in v0.2" behavior.
  setVisibility(tags: string[], to: 'hide' | 'unhide'): Promise<void>;
  applyBulk(tags: Iterable<string>, action: BulkAction): Promise<void>;

  // Future (not wired now; the seam exists so they drop in cleanly):
  // createRuleFromTag(tag: string): Promise<void>;
  // assignColor(tag: string, color: string): Promise<void>;
}
```

### 4.3 `TagViewer` and `TagTable` (UI-gated)

Thin render components consuming the core. Built after `ui_tag-list-dual-host.html` is locked and crit-reviewed. The column and chip *sets* are decided (Section 5); only layout and interaction polish need the mockup.

---

## 5. Surfaces

These schematics fix the column and chip sets, not the final pixels.

### 5.1 Sidebar - `TagViewer`

The existing leaf (`TAG_LIST_VIEW_TYPE`) becomes a thin wrapper that mounts `TagViewer`.

**View mode (default):**

```
+--------------------------------------+
| [search: filter tags...]             |
| ( All ) ( Hidden ) ( Orphans )       |
+--------------------------------------+
| Tag                    ^ | Count  v  |   <- sortable headers
+--------------------------------------+
| #ai                        |   47    |
| #project/acme              |   31    |
| ~~#FF0000~~ (hidden, struck) |  22    |
| ...                                  |
+--------------------------------------+
```

- Two sortable columns: **Tag**, **Count**. Header click sorts (A-Z / Z-A, count high/low).
- **Simple search**: plain tag-name substring filter (no regex).
- Chips: **All / Hidden / Orphans**. Hidden tags render struck-through but stay visible under "All".
- Row click -> vault search `tag:#name` (opens the search pane). That is the whole interaction.
- Header mode toggle flips to manage mode.

**Light-manage mode (toggle):**

- Each row gains a checkbox and an inline hide/unhide control.
- Row click toggles selection (a small per-row search icon still searches).
- Bulk bar on selection: **Hide / Unhide / Send to Tag Wrangler** (Hide/Unhide gated on B009; Send is functional now).

`TagViewer` deliberately omits first/last-seen, source, rule attribution, and the analysis chips - those are the table's job.

### 5.2 Settings tab - `TagTable`

`renderTagListTab` stops returning the stub and mounts `TagTable` at full capability.

```
+-------------------------------------------------------------------------+
| [search]   ( All )( Hidden )( Orphans )( Frontmatter )( Unreviewed )     |
+-------------------------------------------------------------------------+
| [x] | Tag        | Count | First seen | Last used | Source              |
+-------------------------------------------------------------------------+
| [ ] | #ai        |  47   | 2026-01-02 | 2026-05-20| both                |
|     |  -> rule: hide-orphans                                            |
| [ ] | ~~#FF0000~~ |  22   | 2026-03-01 | 2026-05-28| inline   (hex rule) |
| ...                                                                     |
+-------------------------------------------------------------------------+
| (selection) Hide | Unhide | Send to Tag Wrangler | Clear                |
+-------------------------------------------------------------------------+
```

- Columns: select checkbox, **Tag** (struck if hidden), **Count**, **First seen**, **Last used**, **Source** (inline / frontmatter / both pill). Sortable headers with the existing help-icon tooltips.
- **Rule attribution** stacked per row, every matching rule on its own line (preserves review pin 23).
- Chips: the full set including **Frontmatter / Unreviewed**.
- Bulk bar: Hide / Unhide / Send to Tag Wrangler.
- Click semantics: row/checkbox click selects; header click sorts. No click-to-search (the viewer's job).
- A header link **"Open in sidebar"** replaces the old "Open tag list view" button. The stale "Phase 3" callout is removed.

---

## 6. Decision change (D-011 revision)

D-011 was: *"Tag list renders the same component in both the sidebar leaf and the Settings tab."*

Revised to: *"Both hosts render from one shared core (`TagListModel` + `TagActions`) at different capability levels - sidebar = view/light-manage, settings = full table. State lives on the plugin; view state is per host."*

This supersedes the "identical component" framing while preserving the dual-host and state-sync intent. To be recorded as a new decision entry in `scope-and-decisions.md`.

---

## 7. State and sync model

- **Shared data** (tag meta + settings) lives on the plugin. A `TagActions` call mutates it; both hosts re-render through their existing `settingsManager.onChange` / `tagMetaManager 'changed'` subscriptions. The two hosts therefore stay consistent on what is hidden, counts, etc.
- **Per-host view state** (sort, filter, search, selection) lives on each host's `TagListModel` instance. Selecting tags in the sidebar does not disturb the settings table's selection.

---

## 8. Per-tag hide/unhide dependency (B009) and migration

**Verified current behavior:** v0.1 hiding is purely rule/preset-based. `bulkUnhide()` (tagListView.ts:431) and `bulkAddDescription()` are stubs that show "coming in v0.2 (B009)" Notices. `TagCuratorSettings` (types.ts:57) has no per-tag override field.

**Implication:** a *functional* per-tag hide/unhide needs a persisted override store (for example `overrides: { hidden: string[]; shown: string[] }` on settings, or per-`TagMeta` flags), an engine check that applies overrides over rule output, and a `SCHEMA_VERSION` bump with migration. That is exactly the scope of **B009**.

**Correction to an earlier claim:** "no migration" holds for the architecture and the read surfaces only. Functional hide/unhide does require a migration.

**Recommended sequencing (default):**

- **Phase A - now, no migration.** Shared core (`TagListModel`, `TagActions` shape), read/sort/search/select on both surfaces, the full settings table, `sendToTagWrangler`, and removal of the stub. Hide/Unhide controls render but keep today's B009 notice. This is the no-regret, UI-independent + UI-gated work and it fixes the broken settings tab.
- **Phase B - v0.2 fast-follow (B009).** Per-tag override store + engine check + migration, wired through the already-built `TagActions.setVisibility`. This lights up Hide/Unhide in both hosts with zero render-component changes.

**Open decision for the user:** fold B009 into this effort now (larger, adds a migration and engine change) vs sequence it as the recommended fast-follow. The architecture is identical either way; only the timing of the migration differs.

---

## 9. Testing

- `TagListModel`: unit tests for row-building (meta + rule matches + visibility), each filter chip, the search predicate, and the comparator across every `SortKey`. Headless, no leaf.
- `TagActions`: unit tests for `sendToTagWrangler` (detection-gated, command dispatch count) and, once B009 lands, `setVisibility` / `applyBulk` against the override store.
- `TagViewer` / `TagTable`: lighter DOM smoke tests (renders expected columns/chips for the capability level; click wiring calls the right model/action method).

---

## 10. Buildable-now vs gated (for the token-budget plan)

| Piece | Status |
|---|---|
| `TagListModel` + tests | **Build now** - no persistence change, needed in every version |
| `TagActions` shape + `sendToTagWrangler` + tests | **Build now** |
| Remove settings stub scaffolding / thin leaf wrapper | Build now (wrapper) / with render components (mount) |
| `TagViewer`, `TagTable` visual build | **UI-gated** on `ui_tag-list-dual-host.html` lock |
| Functional per-tag Hide/Unhide | **B009-gated** (Section 8) |

---

## 11. Acceptance criteria

1. `TagListModel` produces correct rows, filtering, search, and sort with no Obsidian leaf, proven by headless unit tests.
2. `TagActions.sendToTagWrangler` behaves exactly as today (detection-gated, sequential dispatch), now callable from any host.
3. The Settings "Tag list" tab renders the full table (no stub, no stale callout) and its data stays in sync with the sidebar via shared plugin state.
4. The sidebar viewer renders the two sortable columns + simple search + All/Hidden/Orphans chips, and a tag click opens vault search for that tag.
5. The sidebar manage toggle reveals selection + bulk bar; Send to Tag Wrangler works; Hide/Unhide behave per the B009 decision (Section 8).
6. No regression in the existing tag-pane hiding, presets, or rule attribution.
7. D-011's revision is recorded in `scope-and-decisions.md`.
