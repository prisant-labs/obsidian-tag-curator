# Notebook Navigator Compatibility - Implementation Plan

| Field | Value |
|---|---|
| Status | **Draft / Unreleased** |
| Relates to | Scope-expansion issues #1-3, Scope `notebook-navigator` (`src/types.ts:18`) |
| Companion docs | `spec_nn-compat.md`, `findings_nn-integration-seam.md` |
| Estimated effort | 6.5 to 10 working days (hide + flag both in v1) |
| Owner | TBD |

---

## Goal

Make Tag Curator's hide and flag rules apply inside Notebook Navigator's (NN) tag tree at runtime, matching the contract in `spec_nn-compat.md`. Reuse the already-declared `notebook-navigator` scope, refactor a shared observer base out of the existing tag-pane observer, add an NN-specific MutationObserver decorator that is idempotent and survives NN's virtualization, and delegate flagging to NN's public API (opt-in color mirroring, default off). Runtime interop only; never copy NN source; never write NN's private settings.

---

## Phased build order

| Phase | Title | Files | Tests | Days | Notes |
|---|---|---|---|---|---|
| 1 | Shared `ObserverBase` refactor | `src/observers/observerBase.ts` (new), `src/observers/tagPaneObserver.ts` | existing `tests/tagPaneObserver.test.ts` must pass unchanged | 1.5 | - |
| 2 | NN detection + version / API gating | `src/integrations/notebookNavigator.ts` (new), `src/types/notebook-navigator.d.ts` (hand-written local) | `tests/nnDetection.test.ts` (new) | 1 | - |
| 3 | NN tag-tree hide decorator | `src/observers/notebookNavigatorObserver.ts` (new), `styles.css` | `tests/notebookNavigatorObserver.test.ts` (new, happy-dom) | 2 | - |
| 4 | Flagging via NN API (opt-in color) | `src/observers/notebookNavigatorObserver.ts` (extend), `src/integrations/notebookNavigator.ts` (extend) | `tests/nnFlagging.test.ts` (new) | 1.5 | - |
| 5 | Tests + integration sweep | the test files above; `TESTING.md` | unit green + manual BRAT matrix | 1 | - |
| 6 | Docs + settings wiring | `src/main.ts`, README, `scope-and-decisions.md`, this plan | none | 0.5 | - |

All five design decisions in `spec_nn-compat.md` Section 11 are resolved (2026-05-29). **All phases are part of v1**, including Phase 4 (flagging): the decisions landed on hide + flag shipping together, with color mirroring opt-in. No phase is blocked on an open decision.

---

## Phase 1: Shared `ObserverBase` refactor (~1.5 days)

**Why first:** the NN observer needs the same MutationObserver lifecycle the tag-pane observer already has (container tracking, `requestAnimationFrame` coalescing via `scheduleApply`, enable / preview state, clear-on-unload). Extracting that base first means Phase 3 is a small subclass, not a copy-paste of `tagPaneObserver.ts`.

### 1.1 Extract `ObserverBase`

Create `src/observers/observerBase.ts` holding the host-agnostic machinery currently in `TagPaneObserver` (`src/observers/tagPaneObserver.ts`):

- `observers: WeakMap<HTMLElement, MutationObserver>`, `containers: Set<HTMLElement>`.
- `rules`, `metadata`, `previewMode`, `enabled` fields with their `set*` methods and `scheduleApply()`.
- The `requestAnimationFrame` coalescing in `scheduleApply` (`tagPaneObserver.ts:104-111`).
- `attachLeaf` container-wiring, `clearWithin`, `clearAll`, `unload` (`tagPaneObserver.ts:84-162`).

Leave **host-specific** behavior as abstract / overridable hooks:

- `protected abstract getViewType(): string` (native pane returns `'tag'`; NN returns its leaf view type).
- `protected abstract apply(root: HTMLElement): void` (the decorate pass; native vs NN differ in selector, targeting, and class names).
- `protected getObserveTarget(containerEl): HTMLElement` (native observes `containerEl`; NN observes the inner `.nn-navigation-pane-scroller[data-pane="navigation"]`).
- Class-name constants (`HIDDEN_CLASS`, `FLAG_CLASS`, `TAG_ATTR`) become per-subclass so NN uses `tc-nn-*` and never collides with the native classes.

### 1.2 Re-base `TagPaneObserver`

Rewrite `TagPaneObserver` to `extends ObserverBase`, keeping its current `apply()` body (the `.tag-pane-tag` logic at `tagPaneObserver.ts:113-143`) as the concrete `apply` override and `'tag'` as its view type. Behavior must be byte-for-byte equivalent.

### 1.3 Tests

The existing `tests/tagPaneObserver.test.ts` (17 happy-dom cases) is the regression gate: it must pass **unchanged**. If any test needs editing, the refactor changed behavior and is wrong. Add no new tests in this phase; the value is a proven, reusable base.

---

## Phase 2: NN detection + version / API gating (~1 day)

**Decisions resolved:** version gating requires a recent NN via the constant `MIN_API_VERSION = '2.0.0'` (decision 2); types are a hand-written minimal local interface, not a vendored `.d.ts` (decision 4). NN absent is a silent no-op; NN present but below `MIN_API_VERSION` shows a one-time notice and skips the entire scope (no hide, no flag).

### 2.1 Detection module

Create `src/integrations/notebookNavigator.ts`:

```typescript
// Pseudocode shape; no NN source imported.
export interface NnHandle {
  api: NotebookNavigatorAPI | null;   // null when API absent / too old
  apiVersion: string | null;
  hasDom: boolean;                     // NN view present in the workspace
}

export function detectNotebookNavigator(app: App): NnHandle | null {
  const plugin = app.plugins.plugins['notebook-navigator'];
  if (!plugin) return null;            // silent no-op when NN absent
  const api = plugin.api ?? null;      // findings: main.ts:121, .d.ts:28-37
  const apiVersion = api?.getVersion?.() ?? null;
  return { api: gateApiVersion(api, apiVersion), apiVersion, hasDom: true };
}
```

- `MIN_API_VERSION = '2.0.0'` (decision 2; NN 3.x). If NN is absent, `detectNotebookNavigator` returns `null` (silent no-op). If NN is present but `apiVersion < MIN_API_VERSION`, the caller shows a one-time notice and skips the entire scope: neither the hide decorator nor flagging attaches. Only when `apiVersion >= MIN_API_VERSION` is the full handle returned and both seams enabled.
- Subscribe to `nn.on('storage-ready', ...)` and `nn.on('tag-changed', ...)` here and expose register/unregister so Phase 3 can ask for a re-decorate on those events (`findings` Section 5, Approach A; Section 7).

### 2.2 Types

Per decision 4, hand-write a minimal local interface (in `src/types/notebook-navigator.d.ts`) covering only the API members Tag Curator calls: `api.getVersion`, `api.isStorageReady`, `api.whenReady`, `api.on/off`, `api.metadata.setTagMeta/getTagMeta`, and `api.menus.registerTagMenu`. Do not vendor NN's published `.d.ts`, and do not import any NN implementation `.ts`.

### 2.3 Tests

`tests/nnDetection.test.ts`: with a faked `app.plugins.plugins`, assert detection returns `null` when NN is absent (silent no-op), signals the skip-with-one-time-notice path when NN is present but the API is missing or below `MIN_API_VERSION` (the whole scope sits out, no hide and no flag), and returns a full handle enabling both seams when NN is present and new enough.

---

## Phase 3: NN tag-tree hide decorator (~2 days)

**Unblocked.** This is the load-bearing feature. No NN API required for hiding.

### 3.1 The observer

Create `src/observers/notebookNavigatorObserver.ts` extending `ObserverBase` (Phase 1):

- `getViewType()` returns NN's leaf view type; `attachAll` finds NN leaves via `getLeavesOfType` (mirroring `tagPaneObserver.ts:78-82`) or, as a fallback, `document.querySelectorAll('.nn-navigation-pane')` (`findings` Section 5, Approach A).
- `getObserveTarget` returns the inner scroller `.nn-navigation-pane-scroller[data-pane="navigation"]` (`NavigationPaneLayout.tsx:187-192`), observed `{ childList: true, subtree: true }`.
- Class constants: `tc-nn-hidden`, `tc-nn-flagged`, marker attr `data-tc-nn-rule`. Never `nn-*`.

### 3.2 The `apply` (decorate) pass

```typescript
protected apply(root: HTMLElement): void {
  if (!this.enabled) { this.clearWithin(root); return; }
  const rows = root.querySelectorAll<HTMLElement>('.nn-tag[data-tag]');
  for (const row of Array.from(rows)) {
    const dataTag = row.getAttribute('data-tag');        // canonical LOWERCASE path
    if (!dataTag) continue;
    const meta = this.metadata.get(dataTag);             // or descendant-aware lookup
    const result = RuleEngine.evaluateTag(dataTag, meta, this.rules);
    // Flat-nesting: a rule on `photo` must also hit `photo/camera`.
    // Match on dataTag === rule || dataTag.startsWith(rule + '/') inside the engine path.
    if (result && !this.previewMode) { /* add tc-nn-hidden, set marker */ }
    else if (result && this.previewMode) { /* add tc-nn-flagged */ }
    else { /* remove both, remove marker */ }
  }
}
```

Key correctness points (`spec_nn-compat.md` Sections 5.1, 7):

- **Descendant match (flat nesting).** NN rows are flat siblings; hiding `photo` does not hide `photo/camera` structurally. The decorator must apply the rule to every matching `data-tag` including descendants (`findings` Section 1 "Hierarchical nesting", Section 5 Approach A).
- **Idempotency.** Derive class state from current rules every pass; add/remove to match. Never append duplicate badges; skip work via the `data-tc-nn-rule` marker when state is unchanged.
- **`previewMode`** flags instead of hides, exactly parallel to `TagPaneObserver`.

### 3.3 Reapply on NN events

In addition to the inherited MutationObserver + `scheduleApply`, register the Phase 2 `tag-changed` / `storage-ready` callbacks to call `scheduleApply()` (`findings` Section 7). This catches re-renders the observer batches or misses (including NN's own `setTagMeta`-driven re-render).

### 3.4 CSS

Add to `styles.css`:

```css
.nn-tag.tc-nn-hidden { display: none !important; }   /* collapses to zero height in the virtualizer */
.nn-tag.tc-nn-flagged { /* preview-mode highlight, Tag-Curator-owned styling only */ }
```

### 3.5 Wire into the plugin

In `src/main.ts`, construct and `init()` the NN observer alongside `TagPaneObserver`, only when `detectNotebookNavigator` (Phase 2) returns non-null. Feed it the same `setRules` / `setMetadata` / `setPreviewMode` / `setEnabled` from the existing settings/meta change paths.

### 3.6 Tests

`tests/notebookNavigatorObserver.test.ts` (happy-dom, the harness the repo already uses for the tag-pane observer): build a fake `.nn-navigation-pane-scroller[data-pane="navigation"]` with `div.nn-navitem.nn-tag[data-tag][data-level]` rows including a `photo` / `photo/camera` pair, and assert the cases in `spec_nn-compat.md` Section 10 (match, descendant match, idempotency, re-decorate after node removal+reinsert, preview flags, clear-on-unload).

---

## Phase 4: Flagging via NN API, opt-in color (~1.5 days)

**Decisions resolved:** flagging ships in v1 (decision 1), and flag-to-color mirroring is opt-in via a setting, default off (decision 3). This phase is part of v1, not a fast-follow. When the setting is off, Tag Curator never calls `setTagMeta`; when on, it mirrors flags to NN colors with the record-and-restore discipline below.

### 4.1 Flag delegation

When a tag matches a `flag` (or `delegate-color`) action, the NN API is available, and the opt-in color-mirroring setting is enabled (decision 3):

- Call `nn.metadata.setTagMeta(tag, { color | backgroundColor | icon })` (`notebook-navigator.d.ts:324`, `MetadataAPI.ts:646-658`) with the flag-to-color mapping.
- **Record** every `(tag -> value)` Tag Curator sets in an in-memory map so cleanup is precise.
- **Do not clobber** colors the user set in NN: before writing, read `getTagMeta(tag)`; only overwrite values Tag Curator previously owned (`spec_nn-compat.md` Section 5.2 co-ownership caveat).

### 4.2 Optional context menu

`nn.menus.registerTagMenu(callback)` (`notebook-navigator.d.ts:396`) to add a "Hide / flag in Tag Curator" item. Optional even within this phase; can be dropped without affecting the flag path.

### 4.3 Cleanup

On scope-disable / plugin unload, clear only Tag-Curator-set values (`setTagMeta(tag, null)` for each recorded tag), unsubscribe NN events, and disconnect observers (`findings` Section 5, unload checklist).

### 4.4 Tests

`tests/nnFlagging.test.ts`: mock the `nn.metadata` API; assert `setTagMeta` is called for flagged tags with the agreed mapping, that pre-existing user colors are not overwritten, and that unload clears only Tag-Curator-set values.

---

## Phase 5: Tests + integration sweep (~1 day)

- Confirm all unit suites green: re-based tag-pane tests (Phase 1, unchanged), `nnDetection`, `notebookNavigatorObserver`, and `nnFlagging` if Phase 4 shipped.
- Add a `TESTING.md` section "Notebook Navigator compatibility" covering the manual BRAT-vault checks (these need real NN virtualization, which happy-dom does not reproduce):
  - Hide rule scoped to `notebook-navigator`: matching rows collapse in NN's tree.
  - Survives scrolling the NN pane, a metadata change, and a **profile switch** (`findings` Section 4).
  - Survives Tag Curator's own `setTagMeta` re-render (if flagging shipped).
  - Full cleanup on disabling the scope and on unloading Tag Curator (no residual `tc-*` classes, no residual `setTagMeta` colors).
  - NN absent: silent no-op, no console errors.

---

## Phase 6: Docs + settings wiring (~0.5 day)

The shipped scope is fixed (hide + flag, requires NN API `2.0.0`), so the docs describe that directly.

- Settings: the `notebook-navigator` scope already exists in the scope picker because it is in the `Scope` union (`src/types.ts:18`); confirm it renders and is selectable in the rule editor and `defaultScopes`. Add a short helper line noting it requires a recent Notebook Navigator (API `2.0.0`). Add the opt-in flag-to-color toggle (default off, decision 3) to settings.
- README: add `notebook-navigator` to the documented scopes list with a one-line description and the GPL / runtime-interop note.
- `scope-and-decisions.md`: record the five resolved decisions (hide + flag in v1, require recent NN / `MIN_API_VERSION = '2.0.0'`, hand-written local types, opt-in flag-to-color mirroring, reusable-but-uncoupled decorator) as new D-IDs. This is the implementation-time task that lands the decisions in the canonical decisions doc.
- Update this plan and `spec_nn-compat.md` status fields once the target version is confirmed.

---

## Risks and open questions during implementation

1. **Virtualization re-decoration loop.** Reapplying on `tag-changed` while `setTagMeta` itself fires `tag-changed` (`MetadataAPI.ts:336-348, 451`) could loop. Mitigation: the decorator is idempotent and only writes when state actually changes; debounce via the inherited `requestAnimationFrame` coalescing.
2. **NN leaf view type discovery.** The exact NN leaf `view type` string is needed for `getLeavesOfType`. Confirm it at runtime against an installed NN (or fall back to the `.nn-navigation-pane` DOM query, `findings` Section 5).
3. **DOM contract drift across NN versions.** Decorator depends only on `data-tag` + `.nn-tag` (most stable, core to NN drag/drop). Finds-no-rows instead of misbehaving on drift; add the Section 9 runtime self-check diagnostic.
4. **Co-owning NN colors (Phase 4).** Flagging ships, so this applies whenever the opt-in color-mirroring setting is on (decision 3). The record-and-restore discipline in 4.1 / 4.3 is mandatory: record Tag-Curator-set values, never clobber user colors, clear only own values on unload. When the setting is off, Tag Curator never writes NN colors at all.
5. **Aliases interaction.** The aliases proposal (`aliases-display-merge/plan.md` risk #3) also wants NN tag-tree behavior. Per decision 5, build the decorate pass as a generic "decorate rows matching a predicate" step so aliases can reuse it later, without coupling to aliases now.

---

## Rollout

- Flagging is part of v1, not a maybe-fast-follow. All phases (1-6), including Phase 4, ship together in this feature.
- Phases 1-3 deliver the load-bearing hide path and may merge before Phase 4 for incremental review, but Phase 4 (opt-in color flagging) is still in-scope for the same v1 and is not optional.
- Target version is set in Phase 6 once confirmed. Merge into the relevant release-train branch alongside the other scope-expansion work (issues #1-3).
