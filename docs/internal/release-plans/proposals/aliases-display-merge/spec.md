# Aliases & Display-Merge - Specification

| Field | Value |
|---|---|
| Status | **Draft / Unreleased** |
| Backlog ID | B006 |
| GitHub issue | [#11](https://github.com/jprisant/obsidian-tag-curator/issues/11) |
| Original target | v0.3 (per spec §9) |
| Recommended target | **v0.2** (re-ranked by user value, 2026-05-28) |
| Authors | Tag Curator team |
| Last updated | 2026-05-28 |

---

## 1. Vision

The single most common complaint Obsidian users have about their tag taxonomy is **case + spelling drift**: a vault accumulates `#ai`, `#AI`, `#Ai`, `#artificial-intelligence`, `#machine-learning/ai`, and `#ML/ai` over time, all referring to the same concept. Search and Dataview correctly treat these as distinct; the tag pane becomes noisy with synonyms.

Tag Curator's display-merge feature lets a user declare a **canonical** tag and a list of **aliases**, and presents them as a single row in every display surface, **without modifying any note content**. The actual file rewrites (if the user wants them) are delegated to Tag Wrangler.

This is the v0.1 contract carried forward: display-only, file-safe, fully reversible.

---

## 2. Use cases

| User says... | Aliases solve it by... |
|---|---|
| "I have `#ai` and `#AI` from years of inconsistent capitalization" | Declare `#ai` canonical; `#AI` becomes an alias. Tag pane shows one row, `#ai (12)` with a tooltip "+1 alias". |
| "I want to migrate from `#project-acme` to `#proj/acme` slowly" | Declare `#proj/acme` canonical, `#project-acme` an alias. Both still resolve in note content; tag pane shows the new name. When ready, batch-rename via Tag Wrangler. |
| "I want to consolidate `#ml`, `#ai`, `#deep-learning` under a single `#ai` umbrella for navigation" | Declare `#ai` canonical, `#ml` and `#deep-learning` as aliases. They still exist as distinct in queries; the tag pane reads cleanly. |
| "I want to find pairs that look similar and decide if they should merge" | Suggested-merges curation panel (Levenshtein <= 2) surfaces candidates. |

---

## 3. Out of scope

This feature is display-only. It does NOT:

- Modify note content. `#AI` in a note stays `#AI`. Tag Wrangler handles renames when the user explicitly chooses.
- Hide tags from query results. `dv.pages('#AI')` still finds the same notes. Same for Tasks, Bases, search.
- Change how Obsidian's `metadataCache.getTags()` reports tags.
- Implement automatic case-normalization across the whole vault. Users opt in per alias group.

---

## 4. Data model

### 4.1 Per-tag aliases (existing field, expanded use)

`TagMeta.aliases: string[]` was added in v0.1 but only carried as an empty array. v0.2 gives it semantics:

```typescript
interface TagMeta {
  tag: string;             // canonical name (no leading #)
  firstSeen: number;
  lastSeen: number;
  count: number;
  sources: TagSource[];
  description?: string;
  aliases?: string[];      // tags that fold INTO this one for display
  reviewed?: boolean;
}
```

If `TagMeta('ai').aliases = ['AI', 'Ai', 'artificial-intelligence']`, then those four tag rows are displayed as a single row in any Tag Curator surface, labeled with the canonical (`ai`).

### 4.2 Alias resolution helper

A new module `src/engine/aliasResolver.ts` provides:

```typescript
export class AliasResolver {
  constructor(meta: Map<string, TagMeta>);

  // Returns the canonical name for any tag (or the tag itself if not aliased).
  canonicalOf(tag: string): string;

  // Returns the list of aliases for a canonical tag.
  aliasesOf(canonical: string): string[];

  // Returns the union of (canonical + aliases) note counts.
  mergedCount(canonical: string): number;

  // Builds a display-merged map: canonical -> { totalCount, sources, ... }
  buildDisplayMap(): Map<string, FoldedTagMeta>;
}

interface FoldedTagMeta extends TagMeta {
  foldedCount: number;     // canonical count + sum of alias counts
  aliasCount: number;      // number of aliases (for "+N aliases" affordance)
}
```

### 4.3 No new persistent storage

Aliases live in the existing `tags.json` sidecar inside each `TagMeta` record. No separate file. Schema bumps to v4 to mark the semantic change.

### 4.4 Settings additions

```typescript
interface TagCuratorSettings {
  // ... existing fields ...
  enableAliases: boolean;          // master toggle, default true
  showAliasHint: boolean;          // "+N aliases" indicator in tag pane, default true
}
```

---

## 5. UX surfaces

### 5.1 Settings tab: Aliases (was deferred placeholder)

Replaces the v0.1 deferred placeholder. Layout follows the rule editor card view (D-010 pattern):

```
+--------------------------------------------------------------------------+
| State banner if non-default state                                        |
+--------------------------------------------------------------------------+
| Aliases   [+ New alias group]                  Suggested merges (4) →    |
+--------------------------------------------------------------------------+
|                                                                          |
| +-----------------------------------------------------------------+     |
| | [ON]  #ai                                          [edit]  [⌄]  |     |
| |       Pattern match (canonical)                                  |     |
| |       3 aliases · 47 instances                                   |     |
| +-----------------------------------------------------------------+     |
|                                                                          |
| +-----------------------------------------------------------------+     |
| | [ON]  #project/acme                               [edit]  [⌄]  |     |
| |       4 aliases · 132 instances                                  |     |
| +-----------------------------------------------------------------+     |
|                                                                          |
| [+ New alias group (dashed)]                                            |
+--------------------------------------------------------------------------+
```

Clicking a card opens edit mode (same pattern as the rule editor):

```
[← Back to aliases / Aliases / Edit group]
[ON]  #ai
      Last edited 3 days ago

CANONICAL
  Tag name [ai]

ALIASES (3)
  [#AI]           [×]
  [#Ai]           [×]
  [#artificial-intelligence]  [×]
  [+ Add alias _____________ ] [Add]

PREVIEW (right-docked)
  Folded tag: #ai
  Unique tags: 4
  Total instances: 47
  Notes touched: 31
  ----------------
  - #ai             - 18 notes
  - #AI             - 14 notes
  - #Ai             - 4 notes
  - #artificial-... - 11 notes

[Delete group]              [Cancel]  [Save]
[Send to Tag Wrangler (rename all to canonical)]
```

### 5.2 Tag list view

The Tag list view collapses alias rows into the canonical when `enableAliases` is on:

```
Tag             | Count | First seen | Last used | Source | Visible? | Rule
ai (+3 aliases) |  47   | Mar 04     | yesterday | both   | shown    | none
project/acme    | 132   | Feb 18     | 2 days ago| both   | shown    | none
```

Hovering "+3 aliases" reveals a tooltip listing the aliased tags. Clicking expands the row to show each alias on its own line beneath the canonical (one click to expand, one click to collapse).

### 5.3 Tag pane (DOM observer)

The same `tagPaneObserver` learns to collapse alias rows. When `#ai` and `#AI` both render, the observer hides `#AI` and rewrites the `#ai` row to show its merged count (with a small "+1" badge if `showAliasHint` is on).

This is **display only**. The DOM modification does not change the underlying tag's data; Obsidian still believes both tags exist.

### 5.4 Welcome modal

The first-run welcome modal does NOT prompt for aliases. Aliases are a tool the user discovers and uses deliberately; defaults are empty.

### 5.5 Status bar

No change.

### 5.6 Commands (new)

| Command id | Palette name | Functionality |
|---|---|---|
| `add-alias-to-current-tag` | Add current tag as alias | When invoked on a tag-pane row, prompts for a canonical to fold this tag into. |
| `mark-tag-as-canonical` | Mark current tag as canonical | Inverse: turns this tag into a new canonical, prompts for aliases. |
| `open-aliases-tab` | Open aliases settings | Shortcut to Settings > Aliases. |

---

## 6. Tag Wrangler integration (spec §6.1 + new §6.1.2)

If a user decides to convert a display-merge into a real rename (commit `#AI` → `#ai` everywhere in note content), they click **Send to Tag Wrangler (rename all to canonical)** in the alias edit panel.

Tag Curator iterates the alias list and, for each, invokes `app.commands.executeCommandById('tag-wrangler:rename-tag')`. Tag Wrangler opens its rename modal pre-loaded with the alias and the canonical as the target.

After rename, the alias entry can be removed (since the underlying tag no longer exists in any note). Tag Curator's `tagMeta.removeFile` listener auto-cleans the alias from the canonical's list on the next `metadataCache.changed` event.

---

## 7. Suggested merges (paired curation panel)

A `Suggested merges` curation panel surfaces tag pairs likely to be intended merges, ordered by similarity:

```
Suggested merges (4 candidates)

| Suggested merge        | Edit distance | Counts (a / b) | Action            |
|------------------------|---------------|----------------|-------------------|
| #ai ↔ #AI              | 1 (case)      | 18 / 14        | [Merge] [Ignore]  |
| #journal ↔ #journals   | 1             | 64 / 8         | [Merge] [Ignore]  |
| #wip ↔ #WIP            | 1 (case)      | 22 / 11        | [Merge] [Ignore]  |
| #todo/now ↔ #todo-now  | 1             | 12 / 5         | [Merge] [Ignore]  |
```

The detection runs on tag-pair Levenshtein distance with these rules:

- Compute pairs only where `count(a) + count(b) >= threshold` (default 5) to suppress noise.
- Skip pairs already related by alias.
- Skip pairs the user has marked Ignore (persistent in settings).
- Treat case-only differences as distance 0 with a `(case)` annotation; default-suggested.

Clicking **Merge** opens the alias edit panel pre-populated with the smaller-count tag as the alias and the larger-count tag as the canonical. The user reviews and saves.

---

## 8. Migration

| Aspect | Before (v0.1, schema v3) | After (v0.2, schema v4) |
|---|---|---|
| `TagMeta.aliases` | always empty array, semantically inert | populated by user; observer respects it |
| `enableAliases` setting | not present | default `true` |
| `showAliasHint` setting | not present | default `true` |
| Existing `data.json` | no aliases configured | migration is a no-op for users who haven't used aliases |

Schema v3 → v4 migration: detects pre-v4 data, defaults the two new settings, bumps `schemaVersion`.

---

## 9. Edge cases & tested behaviors

1. **Alias of an alias.** If `#A` is an alias of `#B`, and `#B` is an alias of `#C`, what happens? Reject at save time with a clear error: "Alias chains are not allowed." Users declare one level of folding.
2. **Self-reference.** A tag aliased to itself is rejected.
3. **Canonical doesn't exist as a tag yet.** Allowed - the canonical becomes the "intended" name even before any note uses it. Tag Curator's tag pane still shows the canonical row sourced from the aliases.
4. **Alias points to a hidden tag.** The canonical inherits the alias's status. If `#ai` is hidden by a rule, the alias `#AI` is also visually hidden under the same banner.
5. **Mobile.** Display-merge works on mobile; the suggested-merges panel scales but is deprioritized in v0.2 for mobile users (defer to desktop-first for the curation panel UI).
6. **Search behavior.** Search for `#AI` still finds notes tagged `#AI`. Aliases never affect Obsidian's search index.
7. **Bulk delete via Tag Wrangler.** After Tag Wrangler renames `#AI` to `#ai`, the next `metadataCache.changed` event removes `AI` from the canonical's aliases. The user does not need to manually clean up.

---

## 10. Acceptance criteria

A v0.2 release containing this feature must:

- Settings > Aliases tab is fully functional (cards + edit mode + right-docked preview).
- Tag pane collapses alias rows; tag list view collapses with "+N aliases" affordance.
- Migration from any schema v3 install is automatic and silent.
- 95%+ test coverage on `AliasResolver` and the observer's alias-collapsing path.
- Tag Wrangler rename-via-canonical path is verified against Tag Wrangler 0.6.4+.
- Documentation in `README.md`, spec §5.6, and `scope-and-decisions.md` D-IDs is current.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Performance on large vaults | `AliasResolver.buildDisplayMap()` runs in O(N) on tag count; precompute on settings change, not per-render. |
| Confusion when canonical is hidden | Display-merge respects rules; both alias and canonical hide together. Documented in "Edge cases" §9. |
| Users expect aliases to affect search | README + welcome-modal hint: "Aliases change what you see, not what Obsidian queries." |
| Tag Wrangler command surface changes | Two-strategy invocation (executeCommandById + workspace event fallback) as per v0.1 §6.1.1. |
| Alias chains | Rejected at save with clear error. Considered for v0.3 if user demand. |

---

## 12. References

- v0.1 spec §5.6 (display-merge stub)
- v0.1 spec §6.1.1 (Tag Wrangler bulk action)
- D-004 in `scope-and-decisions.md` (merge/alias is display-only)
- D-008 (welcome modal pattern - does NOT include alias prompt)
- B006 in `backlog.md`
- GitHub issue [#11](https://github.com/jprisant/obsidian-tag-curator/issues/11)
