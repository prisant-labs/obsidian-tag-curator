# Notebook Navigator Compatibility - Implementation Plan

| Field | Value |
|---|---|
| Status | **Draft / Unreleased** |
| Relates to | Scope-expansion issues #1-3, Scope `notebook-navigator` (`src/types.ts:18`) |
| Companion docs | `spec_nn-compat.md`, `findings_nn-integration-seam.md` |
| Estimated effort | 5 to 8 working days (hide-only); +1.5 to 2 days if flagging is in v1 |
| Owner | TBD |

---

## Goal

Make Tag Curator's hide (and optionally flag) rules apply inside Notebook Navigator's (NN) tag tree at runtime, matching the contract in `spec_nn-compat.md`. Reuse the already-declared `notebook-navigator` scope, refactor a shared observer base out of the existing tag-pane observer, add an NN-specific MutationObserver decorator that is idempotent and survives NN's virtualization, and (pending an open decision) optionally delegate flagging to NN's public API. Runtime interop only; never copy NN source; never write NN's private settings.

---

## Phased build order

| Phase | Title | Files | Tests | Days | Gated on |
|---|---|---|---|---|---|
| 1 | Shared `ObserverBase` refactor | `src/observers/observerBase.ts` (new), `src/observers/tagPaneObserver.ts` | existing `tests/tagPaneObserver.test.ts` must pass unchanged | 1.5 | - |
| 2 | NN detection + version / API gating | `src/integrations/notebookNavigator.ts` (new), `src/types/notebook-navigator.d.ts` (vendored or local) | `tests/nnDetection.test.ts` (new) | 1 | 11b, 11d |
| 3 | NN tag-tree hide decorator | `src/observers/notebookNavigatorObserver.ts` (new), `styles.css` | `tests/notebookNavigatorObserver.test.ts` (new, happy-dom) | 2 | - |
| 4 | Optional flagging via NN API | `src/observers/notebookNavigatorObserver.ts` (extend), `src/integrations/notebookNavigator.ts` (extend) | `tests/nnFlagging.test.ts` (new) | 1.5 | **11a, 11c** |
| 5 | Tests + integration sweep | the test files above; `TESTING.md` | unit green + manual BRAT matrix | 1 | - |
| 6 | Docs + settings wiring | `src/main.ts`, README, `scope-and-decisions.md`, this plan | none | 0.5 | 11a, 11b |

"Gated on" references the Open decisions in `spec_nn-compat.md` Section 11. **Phase 4 is fully blocked on decisions 11a and 11c** (whether flagging ships at all). Phases 1 and 3 are unblocked and deliver the load-bearing hide-only feature.

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

**Blocked on:** Open decision 11b (minimum NN / API version, degradation behavior) and 11d (vendored vs local `.d.ts`). The code structure can be built now with the version threshold as a single constant to set once 11b is decided.

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

- `gateApiVersion` returns the API only if `apiVersion >= MIN_API_VERSION` (the constant set by decision 11b; findings document `2.0.0`). Below threshold, the handle keeps `api: null` so the flag path silently disables while the DOM hide path still runs.
- Subscribe to `nn.on('storage-ready', ...)` and `nn.on('tag-changed', ...)` here and expose register/unregister so Phase 3 can ask for a re-decorate on those events (`findings` Section 5, Approach A; Section 7).

### 2.2 Types

Per decision 11d, either vendor NN's published `src/api/public/notebook-navigator.d.ts` into `src/types/notebook-navigator.d.ts` (the one file the GPL findings permit copying, `findings` Section 2 / Section 4 of the spec) or hand-write a minimal local interface covering only `api.getVersion`, `api.isStorageReady`, `api.whenReady`, `api.on/off`, `api.metadata.setTagMeta/getTagMeta`, and `api.menus.registerTagMenu`. No NN implementation `.ts` is imported either way.

### 2.3 Tests

`tests/nnDetection.test.ts`: with a faked `app.plugins.plugins`, assert detection returns `null` when NN is absent, returns a handle with `api: null` when the API is missing or below threshold, and returns a full handle when present and new enough.

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

## Phase 4: Optional flagging via NN API (~1.5 days)

**Fully blocked on Open decisions 11a (does flagging ship in v1) and 11c (auto-mirror flag/`delegate-color` to NN colors).** Do not start until both are resolved. If the decision is hide-only, this phase is cut and folded into a fast-follow.

### 4.1 Flag delegation

When a tag matches a `flag` (or `delegate-color`) action and the NN API is available:

- Call `nn.metadata.setTagMeta(tag, { color | backgroundColor | icon })` (`notebook-navigator.d.ts:324`, `MetadataAPI.ts:646-658`) with the mapping decided in 11c.
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

**Partly gated on 11a / 11b** (the docs must describe the shipped scope of hide-only vs hide+flag and the NN version requirement).

- Settings: the `notebook-navigator` scope already exists in the scope picker because it is in the `Scope` union (`src/types.ts:18`); confirm it renders and is selectable in the rule editor and `defaultScopes`. Add a short helper line noting it requires Notebook Navigator (and API `2.0.0` for flagging, per 11b).
- README: add `notebook-navigator` to the documented scopes list with a one-line description and the GPL / runtime-interop note.
- `scope-and-decisions.md`: record the resolved open decisions (hide-only vs hide+flag, min NN version, `.d.ts` vendoring, flag-to-color mirroring) as new D-IDs.
- Update this plan and `spec_nn-compat.md` status fields once the open decisions are resolved and a target version is set.

---

## Risks and open questions during implementation

1. **Virtualization re-decoration loop.** Reapplying on `tag-changed` while `setTagMeta` itself fires `tag-changed` (`MetadataAPI.ts:336-348, 451`) could loop. Mitigation: the decorator is idempotent and only writes when state actually changes; debounce via the inherited `requestAnimationFrame` coalescing.
2. **NN leaf view type discovery.** The exact NN leaf `view type` string is needed for `getLeavesOfType`. Confirm it at runtime against an installed NN (or fall back to the `.nn-navigation-pane` DOM query, `findings` Section 5).
3. **DOM contract drift across NN versions.** Decorator depends only on `data-tag` + `.nn-tag` (most stable, core to NN drag/drop). Finds-no-rows instead of misbehaving on drift; add the Section 9 runtime self-check diagnostic.
4. **Co-owning NN colors (Phase 4 only).** Avoid entirely if 11a lands hide-only. If flagging ships, the record-and-restore discipline in 4.1 / 4.3 is mandatory.
5. **Aliases interaction.** The aliases proposal (`aliases-display-merge/plan.md` risk #3) also wants NN tag-tree behavior. Open decision 11e: design the decorate pass so aliases can hook it later, or keep independent.

---

## Rollout

- Phases 1-3 alone deliver a shippable hide-only feature (the load-bearing value); they are unblocked by any open decision and can merge first.
- Phase 4 (flagging) merges only after Open decisions 11a / 11c resolve; if deferred, it becomes a clean fast-follow because the observer and detection seams already exist.
- Target version is set in Phase 6 once the open decisions are resolved. Merge into the relevant release-train branch alongside the other scope-expansion work (issues #1-3).
