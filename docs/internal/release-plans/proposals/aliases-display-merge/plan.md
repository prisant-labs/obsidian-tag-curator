# Aliases & Display-Merge - Implementation Plan

| Field | Value |
|---|---|
| Status | **Draft / Unreleased** |
| Backlog ID | B006 / GitHub [#11](https://github.com/jprisant/obsidian-tag-curator/issues/11) |
| Companion docs | `spec.md`, `ui.html` |
| Estimated effort | 7 to 10 working days |
| Owner | TBD |

---

## Goal

Ship the alias / display-merge feature in v0.2, matching the contract in `spec.md`. Add the engine + observer + UI, migrate settings, and ship the documentation update + the suggested-merges curation panel.

---

## Phased build order

| Phase | Title | Files | Tests | Days |
|---|---|---|---|---|
| 1 | Engine & resolver | `src/types.ts`, `src/engine/aliasResolver.ts`, `src/storage/settings.ts` | `tests/aliasResolver.test.ts` | 2 |
| 2 | Observer integration | `src/observers/tagPaneObserver.ts` | `tests/tagPaneObserver.test.ts` (new alias cases) | 1 |
| 3 | Tag list view integration | `src/ui/tagListView.ts` | `tests/tagListView.test.ts` (smoke) | 1 |
| 4 | Aliases settings tab UI | `src/ui/settingsTab.ts`, `src/ui/aliasEditor.ts` (new) | manual + smoke | 2 |
| 5 | Suggested merges panel | `src/ui/suggestedMerges.ts` (new), `src/util/levenshtein.ts` (new) | `tests/levenshtein.test.ts` | 1 |
| 6 | Tag Wrangler delegation | `src/ui/aliasEditor.ts` (extend) | manual against TW 0.6.4 | 0.5 |
| 7 | Commands + welcome-modal copy | `src/main.ts`, `src/ui/welcomeModal.ts` | unit tests for command callbacks | 0.5 |
| 8 | Docs + CHANGELOG | spec, README, CHANGELOG, scope-and-decisions, this plan | none | 0.5 |
| 9 | BRAT smoke + release | TESTING.md additions; manual sweep | matrix | 1 |

---

## Phase 1: Engine & resolver (~2 days)

### 1.1 Types

Update `src/types.ts`:

```typescript
export const SCHEMA_VERSION = 4;

export interface TagCuratorSettings {
  // ... existing ...
  enableAliases: boolean;
  showAliasHint: boolean;
  ignoredMergeSuggestions: string[]; // sorted "a||b" pair keys the user dismissed
}

export const DEFAULT_SETTINGS: TagCuratorSettings = {
  // ... existing ...
  enableAliases: true,
  showAliasHint: true,
  ignoredMergeSuggestions: [],
};
```

### 1.2 Migration

Update `src/storage/settings.ts`:

```typescript
if (inferred < 4) {
  if (typeof merged.enableAliases !== 'boolean') merged.enableAliases = true;
  if (typeof merged.showAliasHint !== 'boolean') merged.showAliasHint = true;
  if (!Array.isArray(merged.ignoredMergeSuggestions)) {
    merged.ignoredMergeSuggestions = [];
  }
}
```

### 1.3 AliasResolver

Create `src/engine/aliasResolver.ts`:

```typescript
import { TagMeta } from '../types';

export interface FoldedTagMeta extends TagMeta {
  foldedCount: number;
  aliasCount: number;
}

export class AliasResolver {
  private canonicalByAlias = new Map<string, string>();

  constructor(private meta: Map<string, TagMeta>) {
    this.rebuildIndex();
  }

  rebuildIndex(): void {
    this.canonicalByAlias.clear();
    for (const [canonical, m] of this.meta) {
      for (const alias of m.aliases ?? []) {
        this.canonicalByAlias.set(alias, canonical);
      }
    }
  }

  canonicalOf(tag: string): string {
    return this.canonicalByAlias.get(tag) ?? tag;
  }

  aliasesOf(canonical: string): string[] {
    return this.meta.get(canonical)?.aliases ?? [];
  }

  mergedCount(canonical: string): number {
    let total = this.meta.get(canonical)?.count ?? 0;
    for (const alias of this.aliasesOf(canonical)) {
      total += this.meta.get(alias)?.count ?? 0;
    }
    return total;
  }

  buildDisplayMap(): Map<string, FoldedTagMeta> {
    const map = new Map<string, FoldedTagMeta>();
    for (const [tag, m] of this.meta) {
      if (this.canonicalByAlias.has(tag)) continue; // skip aliases
      map.set(tag, {
        ...m,
        foldedCount: this.mergedCount(tag),
        aliasCount: (m.aliases ?? []).length,
      });
    }
    return map;
  }

  // Validate that adding `alias` to `canonical` is safe (no chains, no self-ref).
  validateAddition(canonical: string, alias: string): { ok: true } | { ok: false; reason: string } {
    if (canonical === alias) return { ok: false, reason: 'A tag cannot alias itself.' };
    if (this.canonicalByAlias.has(canonical)) {
      return {
        ok: false,
        reason: `"${canonical}" is already an alias of "${this.canonicalByAlias.get(canonical)}". Alias chains are not supported.`,
      };
    }
    if ((this.meta.get(alias)?.aliases ?? []).length > 0) {
      return {
        ok: false,
        reason: `"${alias}" already has its own aliases. Alias chains are not supported.`,
      };
    }
    return { ok: true };
  }
}
```

### 1.4 Tests

`tests/aliasResolver.test.ts`:

- canonicalOf returns input when not aliased
- canonicalOf returns canonical when alias is registered
- aliasesOf returns empty when no aliases
- mergedCount sums canonical + alias counts
- buildDisplayMap skips alias tags
- validateAddition rejects self-reference, chains, and circular cases
- rebuildIndex idempotent

---

## Phase 2: Observer integration (~1 day)

### 2.1 Observer changes

Update `src/observers/tagPaneObserver.ts`:

```typescript
private aliasResolver: AliasResolver | null = null;

setMetadata(meta: Map<string, TagMeta>): void {
  this.metadata = meta;
  this.aliasResolver = new AliasResolver(meta);
  this.scheduleApply();
}

private getCanonical(tag: string): string {
  return this.aliasResolver?.canonicalOf(tag) ?? tag;
}

// In the apply path:
//   1. If the row's tag is an alias, add a hide class with an "aliased" data attribute.
//   2. If the row's tag is canonical AND has aliases AND showAliasHint is on,
//      append a small "+N" badge after the count.
//   3. The merged count rewrite is done via CSS pseudo-element or an inline edit
//      of the count cell text, NOT by overwriting Obsidian's DOM tree structure.
```

### 2.2 New CSS classes

Add to `styles.css`:

```css
.tag-curator-aliased { display: none !important; }
.tag-curator-canonical-badge::after {
  content: "+" attr(data-alias-count);
  /* styling */
}
```

### 2.3 Tests

Extend `tests/tagPaneObserver.test.ts`:

- Hides alias rows when `enableAliases` is on
- Does NOT hide them when `enableAliases` is off
- Adds the canonical-badge class to the canonical row
- Removes the alias class on a clean disable

---

## Phase 3: Tag list view integration (~1 day)

### 3.1 View changes

Update `src/ui/tagListView.ts` to use `AliasResolver.buildDisplayMap()` as the source of rows when `enableAliases` is on:

```typescript
private buildRows(): Row[] {
  const s = this.plugin.settingsManager.get();
  const meta = this.plugin.tagMetaManager.all();
  const activeRules = resolveActiveRules(s);

  const source = s.enableAliases
    ? new AliasResolver(meta).buildDisplayMap()
    : meta;

  return [...source.entries()].map(([tag, m]) => ({
    meta: m,
    matches: RuleEngine.getRuleAttribution(tag, m, activeRules).allMatches,
    visible: this.computeVisible(...),
    aliasCount: 'aliasCount' in m ? m.aliasCount : 0,
  }));
}
```

### 3.2 Row rendering

Add a `+N aliases` affordance after the canonical tag name. On click, expand the row inline to show each alias as a sub-row (visually indented).

### 3.3 Tests

Smoke test that the row count drops by the number of aliases when `enableAliases` is on.

---

## Phase 4: Aliases settings tab UI (~2 days)

### 4.1 Replace the deferred placeholder

In `src/ui/settingsTab.ts`, the Aliases tab moves from the deferred-placeholder list to a real renderer. Pattern matches the Custom rules card view (D-010):

```typescript
private renderAliasesTab(panel: HTMLElement): void {
  new AliasEditor(panel, this.plugin);
}
```

### 4.2 New file: `src/ui/aliasEditor.ts`

Mirrors `src/ui/ruleEditor.ts` structure:

```typescript
export class AliasEditor {
  // Card view of alias groups
  // Edit mode (canonical input + aliases list + add-alias input)
  // Right-docked preview (folded tag stats + per-alias rows)
  // Suggested-merges link in the toolbar
}
```

Approximate length: ~450 lines (smaller than ruleEditor because there's no Match/Type/Scope branching).

### 4.3 Persistence

Aliases write through `SettingsManager.updateAliases(canonical, aliases)`:

```typescript
async updateAliases(canonical: string, aliases: string[]): Promise<void> {
  const m = await this.plugin.tagMetaManager.getMeta(canonical);
  if (!m) {
    // Create a placeholder TagMeta if the canonical doesn't exist as a tag yet.
    this.plugin.tagMetaManager.upsertPlaceholder(canonical);
  }
  await this.plugin.tagMetaManager.setAliases(canonical, aliases);
  this.notifyChanged();
}
```

---

## Phase 5: Suggested merges panel (~1 day)

### 5.1 Levenshtein helper

Create `src/util/levenshtein.ts`:

```typescript
export function levenshtein(a: string, b: string): number {
  // Standard DP implementation. ~30 lines.
}

export function levenshteinCaseInsensitive(a: string, b: string): { distance: number; caseOnly: boolean } {
  // Returns { distance, caseOnly: true } when the only differences are case.
}
```

Tests: `tests/levenshtein.test.ts` with table-driven cases.

### 5.2 Suggested merges generator

```typescript
// src/engine/suggestedMerges.ts
export function findSuggestedMerges(
  meta: Map<string, TagMeta>,
  ignoredPairs: Set<string>,
  maxDistance = 1,
  minCombinedCount = 5,
): SuggestedMerge[];
```

Tag pair keys are sorted alphabetically so `"a||b"` and `"b||a"` collide. Pairs already related by alias are skipped.

### 5.3 Panel UI

A "Suggested merges (N)" link in the Aliases tab toolbar opens a side panel listing candidates with Merge / Ignore buttons. Merge pre-fills the alias editor; Ignore adds the pair key to `ignoredMergeSuggestions` and removes it from the list.

---

## Phase 6: Tag Wrangler delegation (~0.5 day)

### 6.1 Rename-via-canonical action

Add a "Send to Tag Wrangler (rename all to canonical)" button in the alias edit panel. On click:

1. Confirm with a modal: "Tag Wrangler will rename each alias to {canonical} in your notes. This action modifies file content."
2. Iterate aliases; for each, invoke `app.commands.executeCommandById('tag-wrangler:rename-tag')`.
3. Pre-load Tag Wrangler's input with the alias.
4. Tag Wrangler handles the file writes.
5. Tag Curator's `metadataCache.changed` listener auto-removes the renamed alias from the group on the next event.

### 6.2 Manual verification

Test against Tag Wrangler 0.6.4 in the BRAT smoke vault. Confirm the command id is current.

---

## Phase 7: Commands + welcome-modal copy (~0.5 day)

Add the three new commands to `src/main.ts`:

- `add-alias-to-current-tag`
- `mark-tag-as-canonical`
- `open-aliases-tab`

Welcome modal copy (D-008): no change. Aliases are deliberately not introduced at first-run; users discover them.

---

## Phase 8: Docs + CHANGELOG (~0.5 day)

- Update `tag-curator-spec_opus-4.7_2026-04-30.md` §5.6 to reflect v0.2 reality (remove "deferred to v0.3" note, point at this proposal's spec).
- Update `scope-and-decisions.md` to add a D-IDs for any decisions made during implementation (especially: alias chain rejection, case-only suggestion handling).
- Update `README.md` Modes section + add an Aliases entry.
- Update `CHANGELOG.md` v0.2.0 section: new aliases feature, schema v4 migration, new commands.
- Move B006 from `backlog.md` to closed (or update Status to "Shipped v0.2.0").

---

## Phase 9: BRAT smoke + release (~1 day)

Extend `TESTING.md` with a new section "16. Aliases & display-merge" covering:

- Alias group creation, editing, deletion
- Tag pane row folding (aliases hidden, canonical with +N badge)
- Tag list view row folding
- Edge cases (alias chain rejection, self-reference rejection)
- Migration: v3 install with empty aliases stays empty; user adds an alias and reloads to verify persistence
- Tag Wrangler rename-via-canonical (cell 3 of the BRAT matrix)
- Suggested merges panel + Ignore persistence

Walk the 6-cell smoke matrix.

---

## Risks & open questions during implementation

1. **Performance on tag panes with thousands of rows.** The observer must not iterate the full alias map on every mutation. Cache the resolver and rebuild only on settings/meta changes.
2. **Counts in the tag pane DOM.** Obsidian renders the count as part of the row text. Overwriting via CSS pseudo-element is cleaner than reaching into Obsidian's DOM structure. Confirm both approaches against current Obsidian.
3. **Conflict with Notebook Navigator's tag tree.** NN has its own tag tree; verify the alias collapse stays consistent there once NN integration is wired (separate v0.2 work).
4. **Mobile.** Edit panels work on mobile via the modal pattern. Suggested merges may need a list-only mode (no two-column layout).

---

## Rollout

After Phase 9 passes:

1. Merge `release/v0.2.0-aliases` → `release/v0.2.0` (release-train branch).
2. Final v0.2.0 release is gated on all v0.2 features (this + scope expansion + allow-only mode etc.).
3. CHANGELOG and README updated as part of v0.2.0 release prep.

This phased structure means partial completion is shippable as a beta if needed (e.g. Phase 1-4 alone gives a working aliases feature minus suggested merges, which is the load-bearing 60% of value).
