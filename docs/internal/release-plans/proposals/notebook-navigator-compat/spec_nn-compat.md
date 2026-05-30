# Notebook Navigator Compatibility - Specification

| Field | Value |
|---|---|
| Status | **Draft / Unreleased** |
| Relates to | Scope-expansion issues #1-3, Scope `notebook-navigator` (already declared in `src/types.ts:18`) |
| GitHub issue | _none yet_ |
| Target | TBD (see Open decisions, Section 11) |
| Authors | Tag Curator team |
| Last updated | 2026-05-29 |
| Primary source | `findings_nn-integration-seam.md` (this directory) |

---

## 1. Vision

Tag Curator already hides and flags tags inside Obsidian's native tag pane, the graph, autocomplete, and the other surfaces enumerated by the `Scope` type. Notebook Navigator (NN) is a popular third-party file explorer that renders its own **tag tree** in a navigation pane. Today that tree is completely outside Tag Curator's reach: a tag the user has hidden everywhere else still appears, un-dimmed and un-flagged, inside NN.

This feature closes that gap. When NN is installed, Tag Curator's existing hide/flag rules apply to NN's tag tree at runtime, so a user's curation is consistent across both the native pane and NN. The work reuses the already-declared `notebook-navigator` scope and parallels the existing `TagPaneObserver`, so this is an additive surface, not a new engine.

This is the v0.1 contract carried forward: **display-only, file-safe, fully reversible.** Tag Curator never changes note content and never writes NN's persisted tag-tree data. Everything it does to NN is a runtime decoration that is fully removed on unload.

---

## 2. Use cases

| User says... | NN compatibility solves it by... |
|---|---|
| "I hid `#temp` and `#archive` with Tag Curator, but they still clutter Notebook Navigator's tag tree." | Tag Curator's hide rules apply to NN's tag-tree rows at runtime; matching rows collapse to zero height. |
| "I use NN as my main explorer and want the same curated tag list I see in the native pane." | The same rules drive both surfaces; NN's tree mirrors the native pane's hidden/flagged state. |
| "I flagged my noisy tags so I notice them, but NN shows them plain." | Where flagging maps to a color, Tag Curator asks NN's own API to color the tag, so NN renders the flag itself (Open decision, Section 11c). |
| "I scrolled NN's tag tree and my hidden tags flickered back." | The decorator is idempotent and reapplies on NN's virtualization re-renders and typed events, so hidden rows stay hidden. |
| "I uninstalled or disabled Notebook Navigator." | Tag Curator feature-detects NN and silently no-ops when it is absent; no errors, no orphaned state. |

---

## 3. Out of scope

This feature is runtime display compatibility only. It does NOT:

- Modify note content. A tag hidden in NN still exists in every note and every query.
- Write NN's native "Hide tags" filter (`vaultProfiles[].hiddenTags`). That path is rejected (Section 6 and Section 8).
- Copy, vendor, adapt, or derive from any Notebook Navigator source code (Section 5, GPL constraint).
- Add new Tag Curator rule actions or match types. It reuses the existing rule engine output.
- Hide tags from NN's search, drag/drop, or file filtering. NN's data model is untouched; only the rendered rows are decorated.
- Provide NN-specific configuration UI beyond a scope toggle. The `notebook-navigator` scope is selected the same way every other scope is.
- Reorder, rename, or re-nest NN's tag tree.

---

## 4. GPL constraint (READ FIRST)

**This is a hard licensing boundary, not a style preference.**

- Notebook Navigator is licensed **GPL-3.0-or-later** (per-file headers and repo `LICENSE`; `findings_nn-integration-seam.md` frontmatter, `license` field).
- Tag Curator is **Apache-2.0**.
- Copying, vendoring, adapting, or deriving from NN source would trigger GPL copyleft on Tag Curator, which is incompatible with shipping Tag Curator under Apache-2.0.

**Only two couplings are permitted, both runtime interop:**

1. **Calling NN's public, documented plugin API and workspace-style events** (`app.plugins.plugins['notebook-navigator'].api`, version 2.0.0).
2. **Observing and mutating NN's rendered DOM and stable `data-*` attributes from the outside.** The DOM contracts and class names cited in this spec are facts about a *running* instance used for targeting. They are not copied code.

**Explicitly forbidden:**

- Importing, pasting, or paraphrasing any NN `.ts` implementation file.
- Depending on NN's private settings schema (for example the `hiddenTags` / `vaultProfiles` shape).

**The one allowed file copy:** NN ships `src/api/public/notebook-navigator.d.ts` specifically so third-party plugins can type the API without importing NN source (`findings` Section 2, "How to obtain it", citing `notebook-navigator.d.ts:28-37`). That published `.d.ts` is an interface contract intended for consumers. Tag Curator may copy or import that single declaration file. Tag Curator must not import any implementation `.ts` file. **Open decision (Section 11d):** confirm with the user / counsel that vendoring the published `.d.ts` is acceptable, or fall back to a hand-written minimal local type for only the API members Tag Curator calls.

---

## 5. Recommended technical approach: two seams

The findings recommend combining two independent seams (`findings` Section 5, "Recommendation"). They are orthogonal: hiding is done by Tag Curator's own DOM decorator; flagging *may* additionally be delegated to NN's API.

### 5.1 Seam 1 - HIDING via a scoped MutationObserver DOM decorator

Hiding is done entirely by Tag Curator, mirroring how `TagPaneObserver` already decorates the native pane. No NN API is required for hiding (the API has no hide method, Section 6).

**Container and scope.** NN renders its tag tree as a React + TanStack-virtualized list (`findings` Section 1). Locate NN's view container at runtime and observe its scroll container:

- Outer container: `div.nn-navigation-pane` (`NavigationPaneLayout.tsx:137`).
- Scroll container to observe: `div.nn-navigation-pane-scroller[data-pane="navigation"]` (`NavigationPaneLayout.tsx:187-192`), with `{ childList: true, subtree: true }`.

**Row targeting.** Each tag row is `div.nn-navitem.nn-tag` (`TagTreeItem.tsx:285`, classes built `TagTreeItem.tsx:196-204`). The single most stable targeting hook is the **`data-tag` attribute = the canonical LOWERCASE tag path** (`TagTreeItem.tsx:288`). Query `.nn-navigation-pane [data-tag]` (or `.nn-tag[data-tag]`) and match the normalized `data-tag` value against Tag Curator's rules via the existing `RuleEngine`.

**Flat nesting caveat.** NN expresses hierarchy by **flattening**, not nested DOM: `photo` and `photo/camera` are separate sibling rows (`findings` Section 1, "Hierarchical nesting", citing `TagTreeItem.tsx:279-282, 306`). Hiding a parent row does NOT structurally hide its children. Tag Curator must therefore apply its rule to every matching `data-tag` including descendants, matching on `dataTag === rule || dataTag.startsWith(rule + '/')` (`findings` Section 5, Approach A).

**Decoration mechanics.** Toggle **Tag Curator's own `tc-*` classes only**, never `nn-*`:

- Hide: add a Tag-Curator-owned class (for example `tc-nn-hidden`) whose CSS in Tag Curator's stylesheet collapses the row (`display: none` collapses it to zero height inside the virtualizer, which is acceptable per `findings` Section 5, Approach A tradeoffs). Prefer a class over inline styles so decorations are easy to find and clean up and never collide with the `nn-*` namespace.
- Mark decorated rows with a `data-tc` marker (or a rule-id attribute like the existing `data-tag-curator-rule`) so re-decoration is idempotent: a row already decorated for the current rule state is skipped.

**Reapplication.** Because the tree is virtualized, raw DOM mutations are transient (Section 7). The decorator reapplies via (a) the MutationObserver (debounced) and (b) NN's typed events `tag-changed` and `storage-ready` (Section 7).

### 5.2 Seam 2 - FLAGGING via NN's public API

Where a Tag Curator flag can be expressed as a color, background, or icon, prefer delegating to NN's own API so NN renders the flag and it survives re-renders automatically (`findings` Section 5, Approach B).

- Obtain the API: `const nn = app.plugins.plugins['notebook-navigator']?.api as NotebookNavigatorAPI | undefined` (`findings` Section 2, citing `notebook-navigator.d.ts:28-37`, `main.ts:121`, `main.ts:494`). API version is `2.0.0` (`src/api/version.ts`); gate readiness with `nn.isStorageReady()` / `nn.whenReady()`.
- Flag a tag: `nn.metadata.setTagMeta(tag, { color?, backgroundColor?, icon? })` (`notebook-navigator.d.ts:324`, impl `MetadataAPI.ts:646-658`). Pass `null` to clear. This persists into NN's own `tagColors` / `tagBackgroundColors` / `tagIcons` and triggers a re-render. The tag input accepts with or without `#` and is normalized to the canonical path.
- Optional context menu: `nn.menus.registerTagMenu(callback)` (`notebook-navigator.d.ts:396`) lets Tag Curator add a "Hide / flag this tag in Tag Curator" item to NN's tag context menu. Good UX, not required for v1.

**Co-ownership caveat.** `setTagMeta` writes into NN's user-visible color settings, which NN's own color feature also writes. Tag Curator would be **co-owning** that state. It must (a) record which tag colors it set, (b) avoid clobbering colors the user set in NN, and (c) clear only its own `setTagMeta` values on unload / scope-disable (`findings` Section 5, Approach B tradeoffs, and the unload checklist in `findings` Section 5). This co-ownership cost is the main reason flagging-via-API is an **Open decision** (Section 11a, 11c), not an automatic inclusion.

### 5.3 Rejected: writing NN's native "Hide tags" filter

Syncing Tag Curator's hidden set into NN's native vault-profile filter (`vaultProfiles[].hiddenTags`) is **rejected** (`findings` Section 3 and Section 5, Approach C):

- There is no public API to write `hiddenTags` (`findings` Section 2, "What is NOT available").
- The only route is rewriting NN's private, profile-scoped `data.json` schema, which is fragile across NN versions and migrations, risks clobbering concurrent NN writes, and is the weakest GPL-boundary story because it couples to NN internals rather than a published contract (`findings` Section 3, "Can Tag Curator feed patterns into this filter?", and Section 5, Approach C).

The recommended DOM decorator achieves the same user-visible result (hidden rows) without any of that risk.

---

## 6. What NN's API does and does not provide

Summarized from `findings` Section 2 so the design's constraints are explicit:

**Available (relevant):**

- `metadata.setTagMeta(tag, { color, backgroundColor, icon })` and `metadata.getTagMeta(tag)` - the supported flag path.
- `menus.registerTagMenu(callback)` - context-menu extension.
- Events via `nn.on(event, cb)` / `once` / `off`: `storage-ready`, `tag-changed` (`{ tag, metadata }`), `nav-item-changed`, `selection-changed`, and others (`notebook-navigator.d.ts:260-297, 403-407`).
- `getVersion()`, `isStorageReady()`, `whenReady()` for feature/version gating.

**NOT available (shapes the design):**

- **No hide / display-filter write method.** This is why hiding must be a DOM decorator.
- **No enumerate-tags / get-tag-tree method.** To know what is displayed, Tag Curator reads the DOM `[data-tag]` rows (or Obsidian's own metadata cache, which it already maintains).
- **No render / per-row decoration hook.** NN's `TagTreeItem` is purely props-driven with no external injection point (`findings` Section 2, citing `TagTreeItem.tsx:46-50, 113`). This is why decoration is external DOM mutation, not a callback.
- **No general settings-write API.** `saveSettingsAndUpdate()` exists on the plugin instance but is private and must not be used.

---

## 7. Virtualization caveat (critical)

NN's tag tree is virtualized with **`@tanstack/react-virtual`** (`findings` Section 4, citing `NavigationPaneContent.tsx:23` and `NavigationPaneLayout.tsx:210`). Only on-screen rows exist in the DOM. A tag scrolled out of view loses its DOM node; scrolled back in, it is a **fresh node without any Tag Curator decoration**.

The tree re-renders or rebuilds on (`findings` Section 4, "Re-render / rebuild triggers"):

- Metadata-cache / content changes (debounced tag-tree rebuild).
- Settings changes - **including Tag Curator's own `setTagMeta` call**, which triggers a re-render (`MetadataAPI.ts:451`).
- Hidden-items toggle, hidden-list, folder-visibility, or **profile** change.
- External settings change (full refresh).
- Scroll / resize (TanStack recomputes visible rows).
- Expand / collapse of a tag.

**Implication.** Any raw DOM mutation is wiped by re-render and by scroll virtualization. Therefore the decorator MUST be:

1. **Idempotent** - safe to run repeatedly; it derives the desired class state from the current rules and applies or removes classes to match, never appending duplicate badges or assuming prior state.
2. **Reapplied** via the MutationObserver on `.nn-navigation-pane-scroller[data-pane="navigation"]` (debounced, mirroring `TagPaneObserver`'s `requestAnimationFrame` coalescing) **plus** NN's typed events: subscribe to `nn.on('tag-changed', ...)` and `nn.on('storage-ready', ...)` to re-assert decorations after NN-initiated re-renders the observer might batch or miss (`findings` Section 5, Approach A; Section 4, "Implication for Tag Curator").

This is the central engineering risk of the feature and the reason the decorator cannot be a one-shot pass.

---

## 8. Data model

**Reuse the existing `notebook-navigator` Scope.** It is already declared in `src/types.ts:18` and flows through `Rule.scopes` and `TagCuratorSettings.defaultScopes`. No type change, no schema bump, no migration is required for hiding: a rule with `notebook-navigator` in its `scopes` simply becomes effective in NN once the observer exists. This mirrors how `tag-pane` already works.

**A new observer extending a shared base.** Today `TagPaneObserver` (`src/observers/tagPaneObserver.ts`) owns the MutationObserver lifecycle, the `requestAnimationFrame` coalescing (`scheduleApply`), enable/preview state, container tracking, and clear-on-unload, all specialized to native `.tag-pane-tag` rows. The NN observer needs the **same lifecycle** but different targeting (NN container, `[data-tag]` rows, `tc-nn-*` classes) and the flat-nesting descendant match.

The plan therefore refactors a host-agnostic **`ObserverBase`** out of `TagPaneObserver` (lifecycle, scheduling, enable/preview, clear/unload) and implements `NotebookNavigatorObserver` on top of it. See the plan, Phase 1.

**No new persistent storage.** Hiding state is derived live from the rule engine. If flagging-via-API ships (Open decision 11a/11c), Tag Curator needs a small in-memory record of which `setTagMeta` values it set so it can clean them up on unload; whether that record needs to persist across reloads is a sub-decision (it can be reconstructed from rules on load, so persistence is likely unnecessary).

---

## 9. Detection, version, and API gating

- **NN present?** Feature-detect `app.plugins.plugins['notebook-navigator']`. If absent, the observer never attaches and the scope is a silent no-op. No errors.
- **API present and new enough?** Read `app.plugins.plugins['notebook-navigator']?.api` and call `getVersion()`. The findings document API version `2.0.0`. Flagging-via-API requires the API; hiding-via-DOM does not.
- **Graceful degradation.** If the API is absent or older than the required version, hiding still works through the DOM decorator (which depends only on the very stable `data-tag` / `.nn-tag` contract). Flagging-via-API silently disables. **Open decision 11b:** the minimum NN / API version to require, and exactly how to degrade (hide-only vs warn the user vs disable the scope).
- **DOM contract drift.** If a future NN version changes `data-tag` or `.nn-tag`, the decorator stops matching rather than misbehaving (it simply finds no rows). The plan includes a cheap runtime self-check (does `.nn-navigation-pane [data-tag]` find rows when NN's tree is visible?) to log a single diagnostic when the contract appears to have changed.

---

## 10. Testing approach

- **Unit (decorator logic against a fake DOM with happy-dom).** The repo already uses happy-dom for `TagPaneObserver` tests (17 existing DOM tests per the session log). Build a fake NN DOM fragment (`.nn-navigation-pane-scroller[data-pane="navigation"]` containing `div.nn-navitem.nn-tag[data-tag="..."]` rows at several `data-level`s, including a `photo` / `photo/camera` parent-descendant pair) and assert:
  - Rows whose `data-tag` matches a hide rule get `tc-nn-hidden`; non-matching rows do not.
  - **Descendant matching:** a rule on `photo` also hides `photo/camera` (flat-nesting rule).
  - Idempotency: running the decorator twice yields identical classes and no duplicated badges.
  - Re-decoration after simulated virtualization: remove and re-insert a row node, run the decorator, confirm the fresh node is re-decorated.
  - `previewMode` flags instead of hides (parallel to `TagPaneObserver`).
  - Clear-on-unload removes every `tc-*` class and `data-tc` marker.
- **Unit (shared base).** After the Phase 1 refactor, the existing `TagPaneObserver` tests must still pass unchanged, proving the base extraction is behavior-preserving.
- **Flagging-via-API (if in scope).** Mock the `nn.metadata.setTagMeta` API surface; assert Tag Curator calls it for flagged tags, records the set values, and clears only its own on unload without clobbering pre-existing user colors.
- **Integration notes (manual, BRAT vault).** Real NN installed: verify hidden tags collapse, survive scrolling the NN pane, survive a metadata change, survive a profile switch, and survive Tag Curator's own `setTagMeta` re-render. Verify full cleanup on disabling the scope and on unloading Tag Curator. These are manual because they need real NN virtualization, which happy-dom does not reproduce.

---

## 11. Open decisions (FLAGGED for the user)

These are deliberately **not decided** in this draft. Each blocks or shapes specific plan phases (noted in the plan).

**(a) v1 scope: hide-only vs hide+flag.**
The robust, low-risk core is **hide-only** via the DOM decorator (Seam 1). Flagging via `setTagMeta` (Seam 2) adds real value but also adds the co-ownership cost of writing into NN's shared color state, with cleanup and conflict handling (Section 5.2). Recommendation to consider: **ship hide-only in v1, add flagging as a fast-follow** once the decorator and detection are proven. Decision needed: include flagging in v1, or sequence it.

**(b) Minimum NN version / API v2 requirement and fallback.**
The findings document NN manifest `3.0.2` and API `2.0.0`. Decision needed: what minimum NN version Tag Curator advertises support for, whether to hard-require API `2.0.0` for the flag path, and the exact graceful-degradation behavior when NN is older or its API is absent (silent hide-only vs a one-time notice vs disabling the scope). Section 9 assumes silent hide-only as the safe default pending this decision.

**(c) Should flagging mirror Tag Curator rule actions to NN colors?**
If flagging ships, should a Tag Curator `flag` (or `delegate-color`) action automatically drive `setTagMeta` color/background, and with what color mapping? This couples Tag Curator's flag semantics to NN's color model and means Tag Curator writes NN's persisted color state. Decision needed: auto-mirror flag/`delegate-color` actions to NN colors, or keep NN flagging an explicit separate opt-in. Tied to (a).

**(d) Vendoring NN's published `.d.ts`.**
NN ships `notebook-navigator.d.ts` for consumers (Section 4). Decision needed: copy/import that single published declaration file, or hand-write a minimal local type covering only the API members Tag Curator calls. Both are GPL-safe under the runtime-interop reading; this is a preference and risk-tolerance call. Only relevant if flagging-via-API (a) is in scope.

**(e) Reused decorator for the aliases feature?**
The separate aliases proposal notes NN's tag tree will need alias-collapsing too (`aliases-display-merge/plan.md` Phase risk #3). Decision needed: design the NN observer's decorate step so the aliases feature can hook the same pass later, or keep them independent. This is a forward-compatibility call, not a v1 blocker.

---

## 12. Acceptance criteria

A release containing this feature must:

1. With NN installed and a hide rule scoped to `notebook-navigator`, matching tag rows in NN's tag tree are visually hidden (collapsed to zero height), and stay hidden across scrolling the NN pane, a metadata change, and a profile switch.
2. Hiding a parent tag also hides its descendant rows (flat-nesting descendant match), proven by a happy-dom unit test.
3. The decorator is idempotent: repeated runs produce identical DOM and never duplicate decorations, proven by a happy-dom unit test.
4. With NN absent, the scope is a silent no-op: no errors, no attached observer, no orphaned state.
5. Disabling the `notebook-navigator` scope, disabling Tag Curator, or unloading the plugin removes every `tc-*` class and `data-tc` marker from NN's DOM and clears any `setTagMeta` value Tag Curator set, restoring NN to its un-decorated state.
6. The refactor to a shared `ObserverBase` preserves all existing `TagPaneObserver` behavior, proven by the existing tag-pane tests passing unchanged.
7. No Notebook Navigator source `.ts` file is imported, copied, or paraphrased; the only NN code dependency permitted is the published `notebook-navigator.d.ts` (subject to Open decision 11d).
8. NN's native `hiddenTags` / `vaultProfiles` settings are never written.
9. If flagging ships (Open decision 11a): flagged tags are colored via `nn.metadata.setTagMeta`, those values survive NN re-renders, and only Tag-Curator-set values are cleared on unload, without clobbering user-set NN colors.
10. Documentation (README scopes list, `scope-and-decisions.md`, this proposal) reflects the shipped behavior and the resolved open decisions.

---

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Virtualization wipes decorations on scroll | Idempotent decorator reapplied via MutationObserver plus `tag-changed` / `storage-ready` events (Section 7). |
| Tag Curator's own `setTagMeta` triggers an NN re-render loop | Decorator is idempotent and debounced; record set values and only re-assert on actual change, not on every event. |
| NN changes its DOM contract (`data-tag` / `.nn-tag`) in a future version | Depend only on the most stable attributes (core to NN drag/drop and selection); decorator finds-no-rows rather than misbehaving; runtime self-check logs one diagnostic (Section 9). |
| GPL contamination | Runtime interop only; published `.d.ts` is the sole permitted code dependency; never write NN private settings (Section 4, Section 5.3). |
| Co-owning NN's tag colors via `setTagMeta` | Record Tag-Curator-set values; never clobber user colors; clear only own values on unload (Section 5.2). Or avoid by shipping hide-only (Open decision 11a). |
| Performance on large tag trees | Reuse `TagPaneObserver`'s `requestAnimationFrame` coalescing; only on-screen rows exist in the DOM (virtualization bounds the work per pass). |

---

## 14. References

- `findings_nn-integration-seam.md` (this directory) - the primary technical source; section and `file:line` citations throughout this spec.
- `src/types.ts:18` - `notebook-navigator` is already a declared `Scope`.
- `src/observers/tagPaneObserver.ts` - the observer this parallels; source of the `ObserverBase` refactor.
- `aliases-display-merge/spec.md` - house style for a proposal spec.
- `tag-list-dual-host/spec_tag-list-dual-host.md` - quality bar; also notes the NN tag-tree as out of its scope (Section 3) and flags the future alias/NN interaction (its Phase risk #3).
- Notebook Navigator: GPL-3.0-or-later, manifest `3.0.2`, public API `2.0.0`. Runtime interop only.
