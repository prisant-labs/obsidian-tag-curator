# Tag List Shared Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the tag-list data/logic out of the leaf-bound `TagListView` into a host-agnostic, unit-tested core (`TagListModel` + `TagActions`) that both the sidebar and the settings tab can later consume.

**Architecture:** `TagListModel` owns row-building, filtering, sorting, search, and selection as pure logic over a small `TagListDataSource` interface (no DOM, no Obsidian leaf). `TagActions` owns operations (Tag Wrangler delegation now; per-tag hide/unhide deferred to B009) over a small `TagActionsHost` interface. This is Phase A of the dual-host redesign: it produces tested core modules. Wiring them into render components (`TagViewer`/`TagTable`) is UI-gated and lives in a separate plan.

**Tech Stack:** TypeScript, vitest (`npx vitest run`), Obsidian plugin APIs (only behind the host interfaces).

**Scope source:** `docs/internal/release-plans/proposals/tag-list-dual-host/spec_tag-list-dual-host.md` (Sections 4, 8, 9, 10).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/ui/tagList/tagListModel.ts` (create) | Row types + `TagListModel`: build rows from a `TagListDataSource`, filter/search/sort, view + selection state. No DOM. |
| `src/ui/tagList/tagActions.ts` (create) | `TagActions` over a `TagActionsHost`: `sendToTagWrangler` (functional), `setVisibility`/`applyBulk` (B009-deferred results). No DOM. |
| `tests/tagListModel.test.ts` (create) | Headless unit tests for the model. |
| `tests/tagActions.test.ts` (create) | Headless unit tests for the actions. |

The existing `src/ui/tagListView.ts` is **not modified in this plan** - it keeps working as-is. Re-pointing it at the new core happens in the UI-gated render-component plan, so this plan never breaks the running build.

---

### Task 1: `TagListModel` row-building + visibility

**Files:**
- Create: `src/ui/tagList/tagListModel.ts`
- Test: `tests/tagListModel.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/tagListModel.test.ts
import { describe, expect, it } from 'vitest';
import { TagListModel, TagListDataSource } from '../src/ui/tagList/tagListModel';
import { DEFAULT_SETTINGS, TagCuratorSettings, TagMeta, Rule } from '../src/types';

function meta(tag: string, overrides: Partial<TagMeta> = {}): TagMeta {
  return { tag, firstSeen: 0, lastSeen: 0, count: 1, sources: ['inline'], ...overrides };
}

function hideRule(tag: string): Rule {
  return {
    id: 'h-' + tag, name: 'hide ' + tag, enabled: true, priority: 50,
    match: { type: 'list', list: [tag] }, action: 'hide', scopes: ['tag-pane'],
  };
}

function source(metas: TagMeta[], settings: Partial<TagCuratorSettings> = {}): TagListDataSource {
  const map = new Map(metas.map((m) => [m.tag, m]));
  const s: TagCuratorSettings = { ...DEFAULT_SETTINGS, enabledPresets: [], ...settings };
  return { getSettings: () => s, getMeta: () => map };
}

describe('TagListModel.allRows', () => {
  it('marks an unmatched tag shown and a rule-matched tag hidden', () => {
    const model = new TagListModel(
      source([meta('keep'), meta('drop')], { customRules: [hideRule('drop')] }),
    );
    const rows = model.allRows();
    expect(rows.find((r) => r.meta.tag === 'keep')!.visibility).toBe('shown');
    expect(rows.find((r) => r.meta.tag === 'drop')!.visibility).toBe('hidden');
  });

  it('marks a matched tag flagged (not hidden) when preview mode is on', () => {
    const model = new TagListModel(
      source([meta('drop')], { customRules: [hideRule('drop')], previewMode: true }),
    );
    expect(model.allRows()[0].visibility).toBe('flagged');
  });

  it('attaches every matching rule name to the row', () => {
    const model = new TagListModel(
      source([meta('drop')], { customRules: [hideRule('drop')] }),
    );
    expect(model.allRows()[0].matches.map((m) => m.ruleName)).toContain('hide drop');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tagListModel.test.ts`
Expected: FAIL - cannot find module `../src/ui/tagList/tagListModel`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/ui/tagList/tagListModel.ts
import { TagCuratorSettings, TagMeta } from '../../types';
import { RuleEngine } from '../../engine/ruleEngine';
import { resolveActiveRules } from '../../engine/presets';

export type TagVisibility = 'shown' | 'hidden' | 'flagged';
export type SortKey = 'name' | 'count' | 'firstSeen' | 'lastSeen' | 'source' | 'visible';
export type FilterChip = 'all' | 'hidden' | 'orphans' | 'frontmatter' | 'unreviewed';

export interface TagRow {
  meta: TagMeta;
  matches: Array<{ ruleId: string; ruleName: string }>;
  visibility: TagVisibility;
}

export interface TagListDataSource {
  getSettings(): TagCuratorSettings;
  getMeta(): Map<string, TagMeta>;
}

export class TagListModel {
  private sortBy: SortKey = 'count';
  private sortDesc = true;
  private filter: FilterChip = 'all';
  private search = '';
  private selected = new Set<string>();

  constructor(private data: TagListDataSource) {}

  allRows(): TagRow[] {
    const settings = this.data.getSettings();
    const meta = this.data.getMeta();
    const activeRules = resolveActiveRules(settings);
    const rows: TagRow[] = [];
    for (const tagMeta of meta.values()) {
      const attribution = RuleEngine.getRuleAttribution(tagMeta.tag, tagMeta, activeRules);
      const matches = attribution.allMatches.map((m) => ({ ruleId: m.ruleId, ruleName: m.ruleName }));
      let visibility: TagVisibility = 'shown';
      if (attribution.effective) {
        visibility = settings.previewMode ? 'flagged' : 'hidden';
      }
      rows.push({ meta: tagMeta, matches, visibility });
    }
    return rows;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tagListModel.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/tagList/tagListModel.ts tests/tagListModel.test.ts
git commit -m "feat(taglist): TagListModel row-building + visibility core"
```

---

### Task 2: `TagListModel` filter + search

**Files:**
- Modify: `src/ui/tagList/tagListModel.ts`
- Test: `tests/tagListModel.test.ts`

- [ ] **Step 1: Write the failing test** (append to `tests/tagListModel.test.ts`)

```typescript
describe('TagListModel filtering and search', () => {
  it('hidden chip keeps only non-shown rows', () => {
    const model = new TagListModel(
      source([meta('keep'), meta('drop')], { customRules: [hideRule('drop')] }),
    );
    model.setFilter('hidden');
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['drop']);
  });

  it('orphans chip keeps only count <= 1', () => {
    const model = new TagListModel(source([meta('rare', { count: 1 }), meta('common', { count: 9 })]));
    model.setFilter('orphans');
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['rare']);
  });

  it('frontmatter chip keeps only frontmatter-only tags', () => {
    const model = new TagListModel(source([
      meta('fm', { sources: ['frontmatter'] }),
      meta('both', { sources: ['frontmatter', 'inline'] }),
    ]));
    model.setFilter('frontmatter');
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['fm']);
  });

  it('unreviewed chip keeps only rows without reviewed=true', () => {
    const model = new TagListModel(source([meta('new'), meta('done', { reviewed: true })]));
    model.setFilter('unreviewed');
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['new']);
  });

  it('search is a case-insensitive substring on the tag name', () => {
    const model = new TagListModel(source([meta('Project'), meta('area')]));
    model.setSearch('PROJ');
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['Project']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tagListModel.test.ts`
Expected: FAIL - `model.setFilter is not a function`.

- [ ] **Step 3: Write minimal implementation** (add to the `TagListModel` class)

```typescript
  setFilter(chip: FilterChip): void { this.filter = chip; }
  setSearch(term: string): void { this.search = term.toLowerCase(); }
  get activeFilter(): FilterChip { return this.filter; }

  matchesFilter(row: TagRow): boolean {
    if (this.search && !row.meta.tag.toLowerCase().includes(this.search)) return false;
    switch (this.filter) {
      case 'all': return true;
      case 'hidden': return row.visibility !== 'shown';
      case 'orphans': return row.meta.count <= 1;
      case 'frontmatter':
        return row.meta.sources.length === 1 && row.meta.sources[0] === 'frontmatter';
      case 'unreviewed': return !row.meta.reviewed;
    }
  }

  rows(): TagRow[] {
    return this.allRows().filter((r) => this.matchesFilter(r));
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tagListModel.test.ts`
Expected: PASS (8 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/ui/tagList/tagListModel.ts tests/tagListModel.test.ts
git commit -m "feat(taglist): TagListModel filter chips + search"
```

---

### Task 3: `TagListModel` sort

**Files:**
- Modify: `src/ui/tagList/tagListModel.ts`
- Test: `tests/tagListModel.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```typescript
describe('TagListModel sorting', () => {
  it('sorts by count descending by default', () => {
    const model = new TagListModel(source([meta('a', { count: 2 }), meta('b', { count: 9 })]));
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['b', 'a']);
  });

  it('setSort toggles direction when the same key is set again', () => {
    const model = new TagListModel(source([meta('a', { count: 2 }), meta('b', { count: 9 })]));
    model.setSort('count');          // same key -> desc flips to asc
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['a', 'b']);
  });

  it('sorts by name ascending', () => {
    const model = new TagListModel(source([meta('zebra'), meta('apple')]));
    model.setSort('name', false);
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['apple', 'zebra']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tagListModel.test.ts`
Expected: FAIL - `model.setSort is not a function`.

- [ ] **Step 3: Write minimal implementation** (add to the class; update `rows()` to sort)

```typescript
  setSort(key: SortKey, desc?: boolean): void {
    if (desc === undefined) {
      this.sortDesc = this.sortBy === key ? !this.sortDesc : true;
    } else {
      this.sortDesc = desc;
    }
    this.sortBy = key;
  }
  get sortState(): { key: SortKey; desc: boolean } {
    return { key: this.sortBy, desc: this.sortDesc };
  }

  compare(a: TagRow, b: TagRow): number {
    let av: string | number = 0;
    let bv: string | number = 0;
    switch (this.sortBy) {
      case 'name': av = a.meta.tag; bv = b.meta.tag; break;
      case 'count': av = a.meta.count; bv = b.meta.count; break;
      case 'firstSeen': av = a.meta.firstSeen; bv = b.meta.firstSeen; break;
      case 'lastSeen': av = a.meta.lastSeen; bv = b.meta.lastSeen; break;
      case 'source': av = a.meta.sources.join(','); bv = b.meta.sources.join(','); break;
      case 'visible': av = a.visibility; bv = b.visibility; break;
    }
    if (typeof av === 'string' && typeof bv === 'string') {
      return this.sortDesc ? bv.localeCompare(av) : av.localeCompare(bv);
    }
    return this.sortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number);
  }
```

Then update `rows()` to sort the filtered list:

```typescript
  rows(): TagRow[] {
    const filtered = this.allRows().filter((r) => this.matchesFilter(r));
    filtered.sort((a, b) => this.compare(a, b));
    return filtered;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tagListModel.test.ts`
Expected: PASS (11 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/ui/tagList/tagListModel.ts tests/tagListModel.test.ts
git commit -m "feat(taglist): TagListModel sorting across all keys"
```

---

### Task 4: `TagListModel` selection + lookup

**Files:**
- Modify: `src/ui/tagList/tagListModel.ts`
- Test: `tests/tagListModel.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```typescript
describe('TagListModel selection and lookup', () => {
  it('toggleSelect adds then removes a tag', () => {
    const model = new TagListModel(source([meta('a')]));
    model.toggleSelect('a');
    expect([...model.selection]).toEqual(['a']);
    model.toggleSelect('a');
    expect([...model.selection]).toEqual([]);
  });

  it('clearSelection empties the set', () => {
    const model = new TagListModel(source([meta('a'), meta('b')]));
    model.toggleSelect('a');
    model.toggleSelect('b');
    model.clearSelection();
    expect(model.selection.size).toBe(0);
  });

  it('rowFor returns the row for a tag or undefined', () => {
    const model = new TagListModel(source([meta('a')]));
    expect(model.rowFor('a')!.meta.tag).toBe('a');
    expect(model.rowFor('missing')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tagListModel.test.ts`
Expected: FAIL - `model.toggleSelect is not a function`.

- [ ] **Step 3: Write minimal implementation** (add to the class)

```typescript
  toggleSelect(tag: string): void {
    if (this.selected.has(tag)) this.selected.delete(tag);
    else this.selected.add(tag);
  }
  clearSelection(): void { this.selected.clear(); }
  get selection(): ReadonlySet<string> { return this.selected; }

  rowFor(tag: string): TagRow | undefined {
    return this.allRows().find((r) => r.meta.tag === tag);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tagListModel.test.ts`
Expected: PASS (14 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/ui/tagList/tagListModel.ts tests/tagListModel.test.ts
git commit -m "feat(taglist): TagListModel selection + rowFor lookup"
```

---

### Task 5: `TagActions.sendToTagWrangler`

**Files:**
- Create: `src/ui/tagList/tagActions.ts`
- Test: `tests/tagActions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/tagActions.test.ts
import { describe, expect, it } from 'vitest';
import { TagActions, TagActionsHost } from '../src/ui/tagList/tagActions';

function host(overrides: Partial<TagActionsHost> = {}): TagActionsHost {
  return {
    isPluginEnabled: () => true,
    executeCommand: () => true,
    ...overrides,
  };
}

describe('TagActions.sendToTagWrangler', () => {
  it('returns 0 and dispatches nothing when Tag Wrangler is absent', () => {
    let calls = 0;
    const actions = new TagActions(host({
      isPluginEnabled: () => false,
      executeCommand: () => { calls += 1; return true; },
    }));
    expect(actions.sendToTagWrangler(['a', 'b'])).toBe(0);
    expect(calls).toBe(0);
  });

  it('dispatches the rename command once per tag and counts successes', () => {
    const ids: string[] = [];
    const actions = new TagActions(host({
      executeCommand: (id) => { ids.push(id); return true; },
    }));
    expect(actions.sendToTagWrangler(['a', 'b', 'c'])).toBe(3);
    expect(ids).toEqual([
      'tag-wrangler:rename-tag', 'tag-wrangler:rename-tag', 'tag-wrangler:rename-tag',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tagActions.test.ts`
Expected: FAIL - cannot find module `../src/ui/tagList/tagActions`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/ui/tagList/tagActions.ts
export type BulkAction = 'hide' | 'unhide' | 'send-to-tag-wrangler';

export interface VisibilityResult {
  applied: number;
  deferred: number;
  reason?: 'b009';
}

export interface TagActionsHost {
  isPluginEnabled(id: string): boolean;
  executeCommand(id: string): boolean;
}

export class TagActions {
  constructor(private hostApi: TagActionsHost) {}

  tagWranglerInstalled(): boolean {
    return this.hostApi.isPluginEnabled('tag-wrangler');
  }

  sendToTagWrangler(tags: string[]): number {
    if (!this.tagWranglerInstalled()) return 0;
    let dispatched = 0;
    for (let i = 0; i < tags.length; i++) {
      if (this.hostApi.executeCommand('tag-wrangler:rename-tag')) dispatched += 1;
    }
    return dispatched;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tagActions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/tagList/tagActions.ts tests/tagActions.test.ts
git commit -m "feat(taglist): TagActions Tag Wrangler delegation"
```

---

### Task 6: `TagActions` visibility (B009-deferred) + bulk dispatch

**Files:**
- Modify: `src/ui/tagList/tagActions.ts`
- Test: `tests/tagActions.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```typescript
describe('TagActions visibility and bulk', () => {
  it('setVisibility defers all tags with a b009 reason until the override store ships', () => {
    const actions = new TagActions(host());
    expect(actions.setVisibility(['a', 'b'], 'hide')).toEqual({
      applied: 0, deferred: 2, reason: 'b009',
    });
  });

  it('applyBulk routes send-to-tag-wrangler to a dispatch count', () => {
    const actions = new TagActions(host());
    expect(actions.applyBulk(['a', 'b'], 'send-to-tag-wrangler')).toBe(2);
  });

  it('applyBulk routes hide/unhide to a deferred VisibilityResult', () => {
    const actions = new TagActions(host());
    expect(actions.applyBulk(['a'], 'hide')).toEqual({ applied: 0, deferred: 1, reason: 'b009' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tagActions.test.ts`
Expected: FAIL - `actions.setVisibility is not a function`.

- [ ] **Step 3: Write minimal implementation** (add to the class)

```typescript
  // Per-tag overrides land with B009; until then these report deferral so the
  // UI can show the "coming in v0.2" notice without the action layer touching DOM.
  setVisibility(tags: string[], _to: 'hide' | 'unhide'): VisibilityResult {
    return { applied: 0, deferred: tags.length, reason: 'b009' };
  }

  applyBulk(tags: string[], action: BulkAction): number | VisibilityResult {
    switch (action) {
      case 'send-to-tag-wrangler': return this.sendToTagWrangler(tags);
      case 'hide': return this.setVisibility(tags, 'hide');
      case 'unhide': return this.setVisibility(tags, 'unhide');
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tagActions.test.ts`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/ui/tagList/tagActions.ts tests/tagActions.test.ts
git commit -m "feat(taglist): TagActions B009-deferred visibility + bulk dispatch"
```

---

### Task 7: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole suite + gates**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass, max-warnings 0, no type errors. New tests (19) included in the count.

- [ ] **Step 2: Commit if anything was touched to satisfy lint/types**

```bash
git add -A
git commit -m "chore(taglist): lint/type clean for shared core"
```

---

## Deferred phases (separate plans)

These are intentionally out of this plan:

- **Phase B - render components (UI-gated).** `TagViewer` (sidebar: 2 sortable columns, simple search, All/Hidden/Orphans chips, click->vault search, manage toggle) and `TagTable` (settings full table) consuming this core; re-point `tagListView.ts` at `TagViewer`; replace the `settingsTab.renderTagListTab` stub with `TagTable`. Blocked on `ui_tag-list-dual-host.html` lock + crit. Adapters wire the real plugin into `TagListDataSource` (`getSettings`/`getMeta`) and `TagActionsHost` (`isPluginEnabled`/`executeCommand`).
- **Phase C - B009 per-tag overrides.** Add the override store to settings, an engine check that applies overrides over rule output, a `SCHEMA_VERSION` bump + migration, and replace `TagActions.setVisibility`'s deferred result with real mutation. Lights up Hide/Unhide in both hosts with no render-component change.

---

## Self-Review

**Spec coverage (Phase A scope only):**
- Spec 4.1 `TagListModel` -> Tasks 1-4. Covered.
- Spec 4.2 `TagActions` (sendToTagWrangler functional; hide/unhide deferred) -> Tasks 5-6. Covered.
- Spec 8 (B009 deferral surfaced as a typed `reason: 'b009'` result, no migration) -> Task 6. Covered.
- Spec 9 (headless unit tests for model + actions) -> Tasks 1-6 tests, Task 7 full suite. Covered.
- Spec 10 "build now" rows (`TagListModel`, `TagActions` shape + sendToTagWrangler) -> this plan. Covered. UI-gated and B009-gated rows correctly deferred.

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every run step shows the command and expected result.

**Type consistency:** `TagListDataSource` (`getSettings`/`getMeta`), `TagListModel` methods (`allRows`/`rows`/`setFilter`/`setSearch`/`setSort`/`toggleSelect`/`clearSelection`/`selection`/`rowFor`/`matchesFilter`/`compare`), `TagActionsHost` (`isPluginEnabled`/`executeCommand`), and `TagActions` methods (`sendToTagWrangler`/`setVisibility`/`applyBulk`) are used consistently across tasks. `VisibilityResult` shape matches its assertions. Constructor field is named `hostApi` to avoid shadowing.

**Note:** `TagRow.visibility` is the new name for what `tagListView.ts` calls `Row.visible`; the legacy view is untouched by this plan, so there is no clash.
