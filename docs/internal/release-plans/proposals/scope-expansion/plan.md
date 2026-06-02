# Scope Expansion - Implementation Plan

| Field | Value |
|---|---|
| Status | **Draft / Unreleased** |
| GitHub issues | [#1](https://github.com/jprisant/obsidian-tag-curator/issues/1), [#2](https://github.com/jprisant/obsidian-tag-curator/issues/2), [#3](https://github.com/jprisant/obsidian-tag-curator/issues/3) |
| Companion docs | `spec.md`, `ui.html` |
| Estimated effort | 5 to 7 working days |
| Owner | TBD |

---

## Goal

Add graph view, autocomplete, and properties chip scopes to Tag Curator. Reuse the v0.1 rule engine and the locked UI; the work is **three new observers** plus a small Rule editor adjustment.

---

## Phased build order

| Phase | Title | Files | Tests | Days |
|---|---|---|---|---|
| 1 | Observer scaffold | `src/observers/graphObserver.ts`, `src/observers/autocompleteObserver.ts`, `src/observers/propertiesObserver.ts` (all new) | per-observer test suites | 2 |
| 2 | CSS hide/flag classes per surface | `styles.css` | manual verification per theme | 0.5 |
| 3 | Rule editor scope dropdown | `src/ui/ruleEditor.ts` | smoke | 0.5 |
| 4 | Default scopes setting | `src/types.ts`, `src/storage/settings.ts`, `src/ui/settingsTab.ts` | unit tests for the new setting | 0.5 |
| 5 | main.ts wiring | `src/main.ts` | smoke | 0.5 |
| 6 | Schema bump v4 -> v5 | `src/types.ts`, `src/storage/settings.ts` | migration tests | 0.5 |
| 7 | Welcome modal copy + spec/docs | `src/ui/welcomeModal.ts`, spec, README, CHANGELOG | none | 0.5 |
| 8 | BRAT smoke + release | TESTING.md additions | smoke matrix cells 1, 3, 4 | 1 |

---

## Phase 1: Observer scaffold (~2 days)

### 1.1 Shared base class (refactor)

`src/observers/baseObserver.ts` (new): extract common lifecycle and DOM-application logic from `tagPaneObserver` so the four observers share:

```typescript
export abstract class BaseSurfaceObserver {
  protected enabled = true;
  protected previewMode = false;
  protected rules: Rule[] = [];
  protected metadata = new Map<string, TagMeta>();
  protected scope: Scope;

  constructor(app: App, plugin: Plugin, scope: Scope) { /* ... */ }

  setRules(rules: Rule[]): void;
  setPreviewMode(v: boolean): void;
  setMetadata(m: Map<string, TagMeta>): void;
  setEnabled(v: boolean): void;

  protected abstract attachAll(): void;
  protected abstract applyToContainer(container: HTMLElement): void;
  protected abstract clearAll(): void;

  // Common rule evaluation that respects the scope filter
  protected evaluateForScope(tag: string, tagMeta: TagMeta | undefined): RuleAttribution | null;
}
```

`tagPaneObserver` is refactored to inherit from `BaseSurfaceObserver`. Behavior is byte-identical; we just consolidate evaluation and lifecycle.

### 1.2 graphObserver

```typescript
// src/observers/graphObserver.ts
export class GraphObserver extends BaseSurfaceObserver {
  constructor(app, plugin) { super(app, plugin, 'graph'); }
  protected attachAll(): void {
    // Find every .graph-view container (global + local).
    // For each, MutationObserver on SVG <g> nodes containing tag labels.
  }
  protected applyToContainer(container: HTMLElement): void {
    // For each node element:
    //   1. Read its data-id / text label to get the tag.
    //   2. Evaluate the rule against this scope.
    //   3. Add/remove tag-curator-graph-hidden / -flagged class accordingly.
    //   4. Edges connecting hidden nodes get tag-curator-graph-edge-hidden (opacity 0.05).
  }
}
```

### 1.3 autocompleteObserver

```typescript
// src/observers/autocompleteObserver.ts
export class AutocompleteObserver extends BaseSurfaceObserver {
  protected attachAll(): void {
    // Listen for document body class changes that signal suggestion-container open.
    // MutationObserver scoped to the body for childList of .suggestion-container.
  }
  protected applyToContainer(container: HTMLElement): void {
    // For each .suggestion-item containing a #tag:
    //   1. Parse the tag.
    //   2. Evaluate.
    //   3. Add/remove tag-curator-suggestion-hidden / -flagged.
    //   4. After hide, re-index the keyboard-navigable items (suggestion-item is iterated by index by Obsidian).
  }
}
```

### 1.4 propertiesObserver

```typescript
// src/observers/propertiesObserver.ts
export class PropertiesObserver extends BaseSurfaceObserver {
  constructor(app, plugin) { super(app, plugin, 'properties'); }
  protected attachAll(): void {
    // Listen for workspace.on('file-open').
    // For the active file's note view, find .metadata-properties-container.
    // MutationObserver on .metadata-property[data-property-key="tags"] children.
  }
  protected applyToContainer(container: HTMLElement): void {
    // For each chip:
    //   1. Read its text content (e.g. "#ai").
    //   2. Evaluate.
    //   3. Add/remove tag-curator-chip-hidden / -flagged.
  }
}
```

### 1.5 Tests

`tests/graphObserver.test.ts`, `tests/autocompleteObserver.test.ts`, `tests/propertiesObserver.test.ts`:

- Hide path: rule matches a tag, the corresponding node/item/chip gains the hide class.
- Flag path: same but preview mode is on.
- Unsubscribe: setEnabled(false) clears all classes.
- Scope filtering: a rule with `scopes: ['tag-pane']` does NOT affect graph/autocomplete/properties surfaces.

---

## Phase 2: CSS (~0.5 day)

Add to `styles.css`:

```css
/* Graph view */
.tag-curator-graph-hidden { display: none; }
.tag-curator-graph-edge-hidden { opacity: 0.05; }
.tag-curator-flag-node { /* small badge ring */ }

/* Autocomplete */
.tag-curator-suggestion-hidden { display: none; }
.tag-curator-flagged-suggestion { background: rgba(245, 201, 124, 0.1); }

/* Properties chip */
.tag-curator-chip-hidden { display: none; }
.tag-curator-flagged-chip { border-color: var(--text-warning); }
```

Verify in Default Dark, Default Light, and one popular community theme.

---

## Phase 3: Rule editor scope dropdown (~0.5 day)

In `src/ui/ruleEditor.ts`, update the Scope select to:

```typescript
const opts: Array<{ value: Scope[]; label: string }> = [
  { value: ['tag-pane'], label: 'tag-pane' },
  { value: ['tag-pane', 'graph'], label: 'tag-pane + graph' },
  { value: ['tag-pane', 'graph', 'autocomplete'], label: 'tag-pane + graph + autocomplete' },
  { value: ['tag-pane', 'properties'], label: 'tag-pane + properties' },
  { value: ['tag-pane', 'graph', 'autocomplete', 'properties'], label: 'all surfaces' },
];
```

Add an "Advanced" expand-link that reveals per-scope checkboxes for users who want a custom subset.

---

## Phase 4: Default scopes setting (~0.5 day)

`src/types.ts`: `defaultScopes` already exists in v0.1 - just ensure DEFAULT_SETTINGS keeps it as `['tag-pane']`.

`src/ui/settingsTab.ts`: in the General panel, add a multi-select for default scopes:

```typescript
new Setting(panel)
  .setName('Default scopes for new rules')
  .setDesc('When you create a new custom rule, these scopes are pre-selected.')
  .addDropdown(...) // or four toggles
```

Persists via `SettingsManager.update({ defaultScopes })`.

---

## Phase 5: main.ts wiring (~0.5 day)

In `TagCuratorPlugin.onload()`:

```typescript
this.tagPaneObserver = new TagPaneObserver(this.app, this);
this.graphObserver = new GraphObserver(this.app, this);
this.autocompleteObserver = new AutocompleteObserver(this.app, this);
this.propertiesObserver = new PropertiesObserver(this.app, this);

const observers = [this.tagPaneObserver, this.graphObserver, this.autocompleteObserver, this.propertiesObserver];

for (const obs of observers) {
  obs.setRules(resolveActiveRules(settings));
  obs.setPreviewMode(settings.previewMode);
  obs.setEnabled(settings.enabled);
  obs.init();
}
```

Settings change handlers fan out to all four.

---

## Phase 6: Schema bump v4 -> v5 (~0.5 day)

If any setting changes are needed (none anticipated), bump to v5 in `src/types.ts` and add a no-op migration in `src/storage/settings.ts`:

```typescript
if (inferred < 5) {
  // No data shape change. Schema bumps to mark that v0.2 multi-scope support is available.
}
```

Add migration tests in `tests/settings.test.ts`.

---

## Phase 7: Welcome modal + docs (~0.5 day)

- `src/ui/welcomeModal.ts`: add a one-line note after the presets section: "Rules apply to the tag pane by default. Extend to graph / autocomplete / properties in Settings > Custom rules."
- Spec `§5.4` Rule editor: update Scope description to list v0.2 options as available, not deferred.
- Spec `§9` Roadmap: move v0.2 entries (graph, autocomplete, properties) from "planned" to "shipped" when the release lands.
- README: add a bullet under "What it does" about multi-surface coverage.
- CHANGELOG: v0.2 entry.

---

## Phase 8: BRAT smoke + release (~1 day)

Extend `TESTING.md` with section "17. Multi-scope rules":

For each new scope (graph, autocomplete, properties), per surface:

- Plugin loads with the new observers attached.
- Create a rule with the scope enabled and a matching tag.
- Verify the tag is hidden in that surface and visible in others (unless those are also in the scope).
- Toggle preview mode: the tag is flagged (not hidden) in the configured scopes.
- Disable the rule: the tag returns in all scopes.
- Mobile (cell 4): autocomplete and properties scopes specifically.

Walk the 6-cell BRAT matrix.

---

## Risks & open questions during implementation

1. **Graph view DOM stability.** Obsidian's graph view internals are minimally documented. Selector strategy must degrade gracefully: log a warning, skip silently.
2. **Autocomplete keyboard navigation.** When some suggestions are hidden, arrow-down should skip them. This requires reading Obsidian's internal index logic. Backup plan: aria-hidden + tabindex="-1" on hidden items, which most consumers respect.
3. **Properties panel mounting timing.** The container exists only when a note has frontmatter. The observer attaches on `file-open` and only acts when the container is found.
4. **Edge cases with hierarchical tags.** A rule matching `#projects` doesn't automatically match `#projects/acme` (that's B010 hierarchy cascade, v0.2 separately). Each observer evaluates exact tag matches per the v0.1 contract.

---

## Rollout

After Phase 8 passes:

1. Merge `release/v0.2.0-scopes` -> `release/v0.2.0`.
2. Final v0.2.0 release is gated on all v0.2 features (this + aliases + allow-only).
3. CHANGELOG and README updated as part of release prep.

Each surface ships independently if priorities shift: graph alone, autocomplete alone, properties alone. The observers are decoupled by scope.
