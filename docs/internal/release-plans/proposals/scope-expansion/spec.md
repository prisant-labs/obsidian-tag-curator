# Scope Expansion (Graph + Autocomplete + Properties Chip) - Specification

| Field | Value |
|---|---|
| Status | **Draft / Unreleased** |
| Backlog IDs | Issues [#1](https://github.com/jprisant/obsidian-tag-curator/issues/1) (graph), [#2](https://github.com/jprisant/obsidian-tag-curator/issues/2) (autocomplete), [#3](https://github.com/jprisant/obsidian-tag-curator/issues/3) (properties chip) |
| Original target | v0.2 (per spec §9, confirmed) |
| Authors | Tag Curator team |
| Last updated | 2026-05-28 |

---

## 1. Vision

v0.1 ships tag filtering in **one** surface: the native left-sidebar tag pane. Users expect Tag Curator to be consistent: if a tag is hidden in the tag pane, it should also be invisible in the graph, the autocomplete dropdown, and the properties chip area. v0.2 makes that promise real.

This proposal adds **three new observers**, each scoped to one Obsidian surface, sharing the v0.1 rule engine and the locked design system (state banner, Settings, Rule editor) unchanged.

---

## 2. Surfaces in scope

| Scope key | Surface | Mobile? | Notes |
|---|---|---|---|
| `graph` | Global graph view + local graph view | iOS: limited | DOM `.graph-view` container; node + edge SVG elements |
| `autocomplete` | Tag autocomplete dropdown shown while typing `#` in editor | yes | DOM `.suggestion-container` filtered to tag suggestions |
| `properties` | Properties-panel tag chips (frontmatter `tags:` rendered as chips) | yes | DOM `.metadata-properties-container` |

Not in this proposal (v0.3+):

- Search facets / filter chips
- Quick switcher
- Backlinks / outgoing links pane
- Hover preview popups
- Bases tag columns
- Notebook Navigator tag tree (separate integration spec)

---

## 3. Engine impact

Zero. The rule engine already accepts a `scopes: Scope[]` field on every rule (`src/types.ts`). v0.1 only consumes the `tag-pane` scope; v0.2 lights up additional values.

Default scope per new rule:

```typescript
DEFAULT_SETTINGS.defaultScopes = ['tag-pane'];
```

stays the same. Users opt new rules into the new scopes via the Rule editor's Scope dropdown (which v0.1 already renders with v0.2 placeholders).

---

## 4. Per-surface contract

### 4.1 Graph view scope

**DOM target.** `.graph-view`'s SVG `<g>` containing nodes; each node has a `data-id` or text label containing the tag.

**Hide behavior.** When a tag's rule applies, the corresponding node is hidden via `display: none` on a class, and connected edges are hidden via `opacity: 0.05` (not fully removed so layout doesn't shift catastrophically). Toggle off restores both.

**Flag behavior** (Preview mode). Matched nodes carry a `tag-curator-flag-node` class that adds a small badge ring (CSS only).

**Performance.** Graph view re-renders on every layout change. Observer reuses Obsidian's `workspace.on('layout-change')` (already used by tagPaneObserver) to attach/detach across surface lifecycle.

**Mobile.** Graph view on iOS Obsidian Mobile is limited; filtering still applies but the UX is best-effort.

### 4.2 Autocomplete scope

**DOM target.** `.suggestion-container` rendered while typing in the editor. Tag suggestions live in `.suggestion-item` with a leading `#`.

**Hide behavior.** Suggestion items matching a hidden tag are removed from the dropdown via `display: none`. Keyboard navigation (`up`/`down` arrows) must skip the hidden items - the observer manages this via index tracking after each refresh of the dropdown.

**Flag behavior.** Matched suggestions get a `.tag-curator-flagged-suggestion` class that color-tints the item; user can still select it.

**Performance.** Suggestion container re-renders on every keystroke. Observer uses a `MutationObserver` scoped to the dropdown, debounced at 16 ms (one frame).

**Mobile.** Full support. Native mobile autocomplete uses the same DOM container.

### 4.3 Properties chip scope

**DOM target.** `.metadata-properties-container` per note's properties panel. Tag chips live in `.metadata-property[data-property-key="tags"] .metadata-property-value` as `<span>` elements containing `#tagname`.

**Hide behavior.** Hidden tag chips get a class that collapses them out of the chip flow. The chip text in the underlying frontmatter is unchanged - this is display-only.

**Flag behavior.** Matched chips get a flag border treatment.

**Performance.** Properties panel renders on note open. Observer uses `workspace.on('file-open')` to attach to the panel of the active note.

**Mobile.** Full support.

---

## 5. UX surfaces

### 5.1 Rule editor: Scope dropdown lights up

The Rule editor's Scope dropdown (v0.1 mocked with v0.2 placeholders) gets real values in v0.2:

```
Scope
[tag-pane           ▼]
  tag-pane                    (default)
  tag-pane + graph
  tag-pane + graph + autocomplete
  tag-pane + properties
  all surfaces (every scope)
```

Per the spec data model, scope is a `Scope[]` array. The dropdown collapses common combinations for ease of use; an "Advanced" expansion offers per-scope checkboxes.

### 5.2 Settings > General: Default scopes

A new "Default scopes for new rules" multi-select under General lets users set what scope checkboxes are pre-ticked when they create a rule:

```
Default scopes for new rules
[x] Tag pane
[ ] Graph
[ ] Autocomplete
[ ] Properties chip
```

Persists as `settings.defaultScopes: Scope[]`.

### 5.3 Welcome modal copy update

The v0.1 welcome modal's "Tag Curator will start by hiding these noisy tags" section adds a single line:

> Rules apply to the tag pane by default. To extend a rule to the graph, autocomplete, or properties chips, edit it in Settings > Custom rules.

### 5.4 State banner: no change

The persistent state banner (D-007) is global - it sits above any Tag Curator surface and reflects plugin-level state. It does NOT report per-scope status.

### 5.5 Status bar: per-surface affordance (optional)

The status bar's "N tags hidden" copy stays focused on the tag pane count (the most-seen surface). A hover-tooltip option could show per-scope breakdown:

```
Tag Curator: 38 tags hidden
  - Tag pane: 38
  - Graph: 38
  - Autocomplete: 38
  - Properties: 38
```

If all scopes show the same number (the common case), the tooltip can simplify to "All scopes."

---

## 6. Migration

Schema v4 → v5:

```typescript
if (inferred < 5) {
  // No data shape change - existing rules with scopes: ['tag-pane'] continue to work.
  // Defaults bumped to record that the user is aware of v0.2 multi-scope support.
}
```

No user-facing migration prompt needed. All existing rules continue to apply only to `tag-pane` because that's what they're configured for.

---

## 7. Performance

Each observer is independently scoped + debounced:

| Observer | Re-attachment trigger | Debounce |
|---|---|---|
| `tagPaneObserver` (v0.1, unchanged) | `workspace.on('layout-change')` | requestAnimationFrame |
| `graphObserver` (new) | `workspace.on('layout-change')` | requestAnimationFrame |
| `autocompleteObserver` (new) | `MutationObserver` on `.suggestion-container` | 16 ms |
| `propertiesObserver` (new) | `workspace.on('file-open')` | requestAnimationFrame |

**Memory.** Each observer holds a Set of element references for cleanup. Cap at ~10k entries; otherwise prune.

**CPU.** Worst case is graph view at a 50k-node graph: ~100 ms per re-attach. Acceptable for v0.2; v0.5+ can introduce SQLite indexing per spec §9.

---

## 8. ARIA & accessibility

Per spec §7.6 and v0.1 contract, hidden elements get `aria-hidden="true"` so screen readers skip them. Each surface:

- **Tag pane** (v0.1): already aria-hidden.
- **Graph**: SVG nodes get `aria-hidden`; the descriptive label for the graph reports total visible vs total nodes.
- **Autocomplete**: hidden suggestion items removed via `display: none` are naturally skipped by ARIA and keyboard navigation.
- **Properties chip**: hidden chips get `aria-hidden` and `tabindex="-1"`.

---

## 9. Edge cases

1. **Graph view: node deletion vs hide.** Tag Curator hides nodes, never deletes them from Obsidian's graph model. Layout stays consistent across toggle on/off.
2. **Autocomplete: empty dropdown.** If every suggestion is hidden, the dropdown collapses (Obsidian's default behavior). No fallback message - the user is already typing.
3. **Properties: empty tag chip area.** If every chip is hidden, the row shows the property key with no values. Tag Curator does NOT remove the property row itself.
4. **Local graph in a markdown editor.** Local graph uses a different DOM container; `graphObserver` attaches to both global and local automatically.
5. **Mode (allow-only).** If/when allow-only mode lands (separate proposal), each new scope respects the same mode-aware evaluation. Tags NOT matching any allow rule are hidden in every active scope.
6. **Preview mode + new scopes.** A flagged tag is flagged in every active scope simultaneously (consistent visual language).

---

## 10. Acceptance criteria

A v0.2 release containing this proposal must:

- Graph view, autocomplete, properties panel each independently hide tags per rule configuration.
- Rule editor's Scope dropdown exposes all four scope options; combinations work.
- Settings > General has a Default scopes multi-select.
- State banner behavior unchanged (still plugin-level).
- BRAT smoke matrix's existing 6 cells extended to verify each scope in cell 1 + cell 4 (mobile).
- Engine + storage tests unchanged (no engine model change). 122/122 existing tests still pass.
- 4 new test suites (`graphObserver`, `autocompleteObserver`, `propertiesObserver`, default-scope persistence): at least 12 tests each.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Obsidian's graph DOM changes between minor versions | Observer queries by stable selector (`.graph-view`); detection failures log a warning and skip silently. |
| Autocomplete keyboard skipping is fragile | Observer manages index tracking after each dropdown refresh; integration test verifies arrow-up/down behavior. |
| Properties panel chip layout differs per Obsidian theme | `display: none` removes from layout uniformly; tested against Default Dark, Default Light, and one popular community theme. |
| Mobile autocomplete behaves differently | Cell 4 of the BRAT matrix explicitly tests autocomplete on iOS. |
| Performance regression on large graphs | requestAnimationFrame coalescing; cap re-attachment frequency at 60 Hz; profile against a 10k-node synthetic graph. |

---

## 12. References

- v0.1 spec §4.1 (Scope plane, defines all scope keys)
- v0.1 spec §9 (Roadmap places these scopes in v0.2)
- B011 file-filter on rules (composes with new scopes, but ships separately)
- GitHub issues [#1](https://github.com/jprisant/obsidian-tag-curator/issues/1), [#2](https://github.com/jprisant/obsidian-tag-curator/issues/2), [#3](https://github.com/jprisant/obsidian-tag-curator/issues/3)
