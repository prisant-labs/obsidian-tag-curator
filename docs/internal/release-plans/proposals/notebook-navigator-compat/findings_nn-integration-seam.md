---
date: 2026-05-29
subject: Notebook Navigator runtime integration seam for Tag Curator
source_repo: notebook-navigator (https://github.com/johansan/notebook-navigator)
source_version: 3.0.2 (manifest.json), API version 2.0.0 (src/api/version.ts / public d.ts)
source_commit: 7a2ae21f67faba6786d0e5d678d2e62b85157b2c
license: GPL-3.0-or-later (per-file headers; LICENSE in repo root)
license_note: >
  Notebook Navigator (NN) is GPL-licensed. This document describes RUNTIME INTEROP ONLY.
  Tag Curator must NOT copy, vendor, adapt, or derive from NN source code (doing so would
  trigger GPL copyleft on Tag Curator). The only acceptable couplings are (a) calling NN's
  public, documented plugin API and workspace events, and (b) observing/mutating NN's
  rendered DOM and stable data-* attributes from the outside. DOM contracts and class names
  cited below are facts about a running instance, used for targeting, not copied code.
---

## Executive summary

Notebook Navigator renders its tag tree as a React + TanStack-virtualized list inside a
view with stable, prefixed CSS classes and rich `data-*` attributes. Each tag row is a
`div.nn-navitem.nn-tag` carrying `data-tag` (canonical lowercase path) and `data-level`,
making external targeting reliable. NN also ships a real public plugin API
(`app.plugins.plugins['notebook-navigator'].api`, version 2.0.0) that exposes tag metadata
setters (`metadata.setTagMeta` for color/background/icon), navigation, selection, typed
workspace-style events (including `tag-changed` and `storage-ready`), and tag context-menu
registration. Crucially, NN's own "Hide tags" filter is applied in the DATA layer before
render (it removes nodes from the tag tree), is stored per vault profile as
`vaultProfiles[].hiddenTags: string[]`, and is NOT exposed through the public API for writes.
The tree is virtualized and re-renders on metadata-cache/content changes, settings changes,
profile changes, and scroll, so any raw DOM mutation must be reapplied. Recommended seam:
use the public API to FLAG tags (via `setTagMeta` color/background, plus `registerTagMenu`),
and to HIDE tags use a MutationObserver-driven CSS-class/attribute decorator on
`[data-tag]` rows scoped to NN's container, reapplied on NN's mutation and `tag-changed`
events. Avoid writing NN's `hiddenTags` settings directly (private, profile-scoped, fragile).

---

## 1. Tag tree rendering: DOM structure and class names

### Where tags are produced and rendered

- Tag-section data is assembled in
  `src/hooks/navigationPane/data/useNavigationPaneTreeSections.ts`
  (`useNavigationPaneTreeSections`, the `tagItems` memo at lines 417-610). This flattens the
  visible tag tree into `CombinedNavigationItem[]`. Hidden-tag filtering already happened
  upstream (see section 3).
- The flattened items are virtualized and rendered in
  `src/components/navigationPane/NavigationPaneLayout.tsx` (lines 200-237).
- Each tag item is rendered by `src/components/TagTreeItem.tsx` (the JSX is at lines 284-339).

### Exact DOM hierarchy (outer to inner)

From `NavigationPaneLayout.tsx`:

```
div.nn-navigation-pane                              (line 137)
  div.nn-navigation-pane-panel                      (line 186)
    div.nn-navigation-pane-scroller[data-pane="navigation"]   (lines 187-192)  <- scroll container
      div.nn-navigation-pane-content                (line 194)
        div[role="tree"]                            (line 200)
          div.nn-virtual-container                  (lines 204-209)  <- height = total virtual size
            div.nn-virtual-nav-item[data-index="<n>"]   (lines 220-226)  <- one per visible virtual row
              <TagTreeItem output>                  (rendered via renderNavigationItem)
```

From `TagTreeItem.tsx` (the tag row itself, lines 284-338):

```
div.nn-navitem.nn-tag                               (line 285, classes built lines 196-204)
    data-tag           = tagNode.path               (canonical LOWERCASE path)   (line 288)
    data-drop-zone     = "tag"                       (line 291)
    data-drop-path     = tagNode.displayPath         (line 293)
    data-drag-path     = tagNode.displayPath         (line 295)
    data-drag-canonical= tagNode.path                (line 297)
    data-drag-type     = "tag"                        (line 299)
    data-draggable     = "true" | undefined           (line 301)
    data-drag-icon / data-drag-icon-color            (lines 303-305)
    data-level         = level                        (line 306)
    role="treeitem"  aria-expanded  aria-level        (lines 310-312)
    style: { '--level': level, '--nn-navitem-custom-bg-color'?: bg }   (lines 279-282)

  div.nn-navitem-content   (also gets search-highlight classes)   (line 314)
    <IndentGuideColumns/>                            (line 315; nesting connector lines)
    div.nn-navitem-chevron.nn-navitem-chevron--has-children|--no-children   (lines 316-322)
    span.nn-navitem-icon          (only if settings.showTagIcons)  (lines 323-325)
    span.nn-navitem-name          (the visible tag label TEXT)     (lines 326-328)
    span.nn-navitem-spacer                           (line 329)
    span.nn-navitem-count         (the count badge; conditional)   (line 335)
       -- OR --
    span.nn-navitem-count.nn-navitem-operator-indicator[data-operator]  (search mode) (lines 330-333)
```

### Element-by-element answers

- **Tags container**: the closest dedicated wrapper is `div[role="tree"]` >
  `div.nn-virtual-container` (NavigationPaneLayout.tsx:200,204). Note: this container holds
  ALL navigation rows (folders, shortcuts, properties, AND tags) intermixed, not a
  tags-only subtree. The scroll container is
  `div.nn-navigation-pane-scroller[data-pane="navigation"]` (line 187-192). The "Tags"
  section header itself is a virtual folder row with id `TAGS_ROOT_VIRTUAL_FOLDER_ID`
  (useNavigationPaneTreeSections.ts:505, 547); it renders as a `VirtualFolderItem`, not a
  `TagTreeItem`.
- **Individual tag row/item**: `div.nn-navitem.nn-tag` (TagTreeItem.tsx:197, 285). The outer
  per-row virtualization wrapper is `div.nn-virtual-nav-item[data-index]`
  (NavigationPaneLayout.tsx:223).
- **Tag name/label element**: `span.nn-navitem-name` containing `{tagNode.name}`
  (TagTreeItem.tsx:326-328). Only the leaf segment name is shown here (e.g. `camera` for
  `photo/camera`), not the full path.
- **Count badge**: `span.nn-navitem-count` (TagTreeItem.tsx:335). In search mode it is
  replaced by `span.nn-navitem-count.nn-navitem-operator-indicator` (lines 330-333).
- **Hierarchical nesting**: nesting is expressed by FLATTENING, not nested DOM. Each tag is a
  sibling row; depth is conveyed by (a) the `--level` CSS custom property and `data-level`
  attribute (TagTreeItem.tsx:279-282, 306), (b) `aria-level` (line 312), and (c)
  `IndentGuideColumns` connector lines (line 315). So `photo` and `photo/camera` are separate
  flat rows, not parent/child DOM nodes. A hidden parent does NOT structurally contain its
  children in the DOM.

### Data-* attributes usable for external targeting

The single most useful targeting hook is **`data-tag` = the canonical lowercase tag path**
(TagTreeItem.tsx:288). Example: a row for `#Photo/Camera` has `data-tag="photo/camera"`.
Secondary stable attributes: `data-drag-canonical` (same canonical path, line 297),
`data-drag-path` / `data-drop-path` (display-cased path, lines 293, 295), `data-level`
(line 306), `data-drag-type="tag"` (line 299). For an external plugin, query
`.nn-navigation-pane [data-tag]` (or `.nn-tag[data-tag]`) and match on the normalized
`data-tag` value.

### State classes already applied to tag rows (reusable signals)

Built in TagTreeItem.tsx:196-204: `nn-selected` (selected), **`nn-excluded`** (a tag that is
normally hidden but currently shown because "show hidden items" is on),
`nn-has-custom-background`, `nn-has-search-match`. The `nn-excluded` styling is defined in
`src/styles/sections/state-hidden-items.css:8-25` and simply dims the row to `opacity: 0.5`.

---

## 2. Public API and events

NN exposes a genuine, versioned public API. This is the GPL-safe coupling surface.

### How to obtain it

- The plugin instance assigns `this.api = new NotebookNavigatorAPI(...)` and `api` is a
  PUBLIC field: `src/main.ts:121` (`api: NotebookNavigatorAPI | null = null`) and
  `src/main.ts:494` (assignment).
- Documented access pattern (from the shipped type declaration,
  `src/api/public/notebook-navigator.d.ts:28-37`):
  ```ts
  const nn = app.plugins.plugins['notebook-navigator']?.api as NotebookNavigatorAPI | undefined;
  ```
- API version is `2.0.0` (`src/api/version.ts`, and the d.ts header). `nn.getVersion()`
  returns it; `nn.isStorageReady()` / `nn.whenReady()` gate tag-data availability.
- NN ships `notebook-navigator.d.ts` specifically so third-party plugins can type the API
  without importing NN source. Tag Curator may copy/import THAT published `.d.ts` (it is an
  interface contract intended for consumers); it must not import implementation `.ts` files.

### What IS available (relevant to tag hide/flag)

Defined in `src/api/NotebookNavigatorAPI.ts` and `src/api/public/notebook-navigator.d.ts`:

- **`metadata.setTagMeta(tag, { color?, backgroundColor?, icon? })`** (d.ts:324;
  impl `src/api/modules/MetadataAPI.ts:646-658`). Sets per-tag color/background/icon. Pass
  `null` to clear. This persists into NN settings (`tagColors` / `tagBackgroundColors` /
  `tagIcons`) and triggers a re-render. This is the supported way to FLAG a tag visually.
  Tag input accepts with/without `#`; normalized to canonical path.
- **`metadata.getTagMeta(tag)`** (d.ts:322; impl MetadataAPI.ts:622-639). Read current
  color/background/icon.
- **`menus.registerTagMenu(callback)`** (d.ts:396; impl via `MenusAPI`). Lets Tag Curator add
  items to NN's tag context menu (callback receives `{ tag, addItem }`,
  `TagMenuExtensionContext` at d.ts:220-225). Good UX hook for "Hide/flag this tag in Tag
  Curator".
- **`navigation.navigateToTag(tag)`** (d.ts:350) and **`selection.getNavItem()`** (d.ts:358,
  returns `{ type:'tag', tag }`) for selection coordination.
- **Events** via `nn.on(event, cb)` / `once` / `off` (d.ts:403-407; impl
  NotebookNavigatorAPI.ts:228-250). Event payloads at d.ts:260-297:
  - `'storage-ready'` - tag data is queryable.
  - `'tag-changed'` - `{ tag, metadata }`; fires when tag color/bg/icon changes
    (MetadataAPI.ts:336-348). Useful to re-assert DOM decorations after NN re-renders due to
    metadata changes.
  - `'nav-item-changed'`, `'selection-changed'`, `'folder-changed'`, `'property-changed'`,
    `'pinned-files-changed'`.
- **`tagCollections`** helpers (d.ts:364-373) to recognize the virtual `__tagged__` /
  `__untagged__` aggregate rows.

### What is NOT available

- **No "hide tag" / display-filter write method.** There is no public API to add a tag to
  NN's hidden-tags filter, nor to register an external tag-visibility predicate. The hidden
  list is a private, profile-scoped setting (section 3).
- **No public "get tag tree" / enumerate-tags method.** The API exposes metadata setters and
  navigation, not the rendered tree model. To enumerate what is currently displayed, an
  external plugin must read the DOM (`[data-tag]` rows) or Obsidian's own metadata cache.
- **No render/decoration hook** (no "registerTagDecorator", no per-row render callback). NN's
  `TagTreeItem` is purely props-driven from internal contexts (TagTreeItem.tsx:46-50, 113);
  there is no external injection point into rendering.
- **No general settings-write API.** `saveSettingsAndUpdate()` exists on the plugin instance
  (main.ts:1132) but is not part of the public `NotebookNavigatorAPI` and reaching into it
  would be an undocumented private coupling.

---

## 3. "Hide tags (vault profile)" display-filter internals

### Where the filtering happens: DATA layer, before render

NN's hide-tags is a data-layer transform, not a DOM/CSS hide:

- Patterns are compiled into a `HiddenTagMatcher` by
  `createHiddenTagMatcher(patterns)` in `src/utils/tagPrefixMatcher.ts:153-211`. Shape
  (tagPrefixMatcher.ts:93-98):
  ```ts
  interface HiddenTagMatcher {
    prefixes: string[];          // full path-prefix matchers
    startsWithNames: string[];   // "temp*"  -> name starts-with
    endsWithNames: string[];     // "*draft" -> name ends-with
    pathPatterns: HiddenTagPathPattern[]; // parsed "a/*" style path patterns
  }
  ```
- Two enforcement points:
  1. **Tree construction** filters hidden tags out as the tree is built from the DB
     (`buildTagTreeFromDatabase`, called in
     `src/context/storage/useTagTreeSync.ts:115-121`, passing `hiddenTags` + `showHiddenItems`).
  2. **Post-build pruning** via `excludeFromTagTree(tree, matcher)`
     (`src/utils/tagTree.ts:485-541`), invoked from
     `useNavigationPaneTreeSections.ts:293` when there are hidden rules and "show hidden
     items" is off. `excludeFromTagTree` removes matching nodes AND their descendants, then
     prunes now-empty parents (tagTree.ts:499-530).
- Matching semantics (`matchesHiddenTagPattern`, tagPrefixMatcher.ts:221-254) operate on the
  normalized lowercase path and the leaf name. Pattern rules are documented at
  tagPrefixMatcher.ts:74-92 (e.g. `archive` hides subtree; `archive/*` hides descendants but
  keeps `archive`; `*draft` is a name suffix match).
- "Show hidden items" toggle: when on, hidden tags are NOT removed; instead the matcher is
  passed as `matcherForMarking` (useNavigationPaneTreeSections.ts:438) so rows still render
  but get the `nn-excluded` dim class (TagTreeItem.tsx:199). `hiddenRootTagNodes` keeps
  hidden roots available for this "show but dim" path.

### Settings data shape and key

`hiddenTags` is PER VAULT PROFILE, not a flat top-level key:

- Defined on `VaultProfile` in `src/settings/types.ts:454` (`hiddenTags: string[]`), inside
  `NotebookNavigatorSettings.vaultProfiles: VaultProfile[]` (types.ts:469) with the active
  profile id at `settings.vaultProfile` (types.ts:470).
- The "Hide tags" UI is a debounced comma-separated text field that reads/writes the ACTIVE
  profile's `hiddenTags`: `src/settings/tabs/DisplayFiltersTab.ts:86-107` (it splits on
  commas, normalizes, dedupes into `activeProfile.hiddenTags`).
- So the on-disk location in NN's `data.json` is roughly
  `vaultProfiles[<index-of settings.vaultProfile>].hiddenTags`.

### Can Tag Curator feed patterns into this filter?

Practically, NO via any supported path:

- There is no public API to push patterns into `hiddenTags` (section 2).
- Writing NN's `data.json` directly (Tag Curator -> `app.vault.adapter` on NN's config file)
  would work mechanically: NN implements `onExternalSettingsChange()` (main.ts:233) which
  Obsidian fires when another process rewrites the plugin's `data.json`, and that path calls
  `notifySettingsUpdateWithFullRefresh()` -> rebuild. BUT this is fragile and not recommended:
  it depends on NN's private settings schema (profile array layout, normalization rules,
  sync-mode handling), risks clobbering concurrent NN writes, is profile-scoped, and any NN
  schema/migration change breaks it. It also blurs the GPL boundary by depending on NN
  internals rather than a published contract.
- Conclusion: **Tag Curator should post-process the rendered tree independently** (DOM
  decoration), and/or use `setTagMeta` for flagging, rather than feeding NN's hidden-tags
  filter.

---

## 4. Re-render behavior (and virtualization)

The tag tree IS virtualized and re-renders frequently, so DOM mutations are transient.

### Virtualization

- NN uses **`@tanstack/react-virtual`** (`Virtualizer` imported in
  `src/components/navigationPane/NavigationPaneContent.tsx:23`; rows rendered from
  `rowVirtualizer.getVirtualItems()` in NavigationPaneLayout.tsx:210).
- Consequences: only on-screen rows exist in the DOM. Scrolling the navigation pane
  mounts/unmounts `div.nn-virtual-nav-item` wrappers and their inner `.nn-tag` rows
  continuously. A tag scrolled out of view loses its DOM node; scrolled back in, it is a
  fresh node WITHOUT any external decoration. The scroll container to watch is
  `.nn-navigation-pane-scroller[data-pane="navigation"]` (NavigationPaneLayout.tsx:187-192).

### Re-render / rebuild triggers

- **Metadata-cache / content changes**: `useTagTreeSync.ts:231-269` subscribes to the
  IndexedDB content-change stream (`db.onContentChange`) and schedules a debounced tag-tree
  rebuild whenever tag data changes (`TIMEOUTS.DEBOUNCE_TAG_TREE`, useTagTreeSync.ts:155-195);
  flushed immediately if the active file's tags change.
- **Settings changes**: `plugin.onSettingsUpdate()` (main.ts:1301-1325) notifies all
  registered React views (`settingsUpdateListeners`, main.ts:1310-1317) -> re-render. Called
  by `saveSettingsAndUpdate()` (main.ts:1132-1135), which `setTagMeta` invokes
  (MetadataAPI.ts:451). So calling `setTagMeta` itself causes a re-render.
- **Hidden-items toggle / hidden-list / folder-visibility / profile change**: effect in
  useTagTreeSync.ts:200-226 reruns on `showHiddenItems`, `hiddenTags`, `hiddenFolders`,
  `fileVisibility`, `profileId` changes.
- **External settings change**: `onExternalSettingsChange()` (main.ts:233) -> full refresh.
- **Scroll / resize**: TanStack re-computes visible rows; `rowVirtualizer.measure()` is also
  called on layout-affecting changes (NavigationPaneContent.tsx:623).
- **Selection / expansion**: expanding/collapsing a tag changes the flattened item list and
  re-renders affected rows.

### Implication for Tag Curator

Any raw DOM mutation (added class, hidden node, injected badge) will be wiped by:
re-render after metadata/content change, settings update (including your own `setTagMeta`),
profile switch, expand/collapse, and especially scroll virtualization. Therefore decoration
MUST be idempotent and reapplied via a `MutationObserver` on NN's container, not done once.

---

## 5. Recommended integration seam(s)

Constraint restated: runtime interop only. Use NN's published API/events and NN's rendered
DOM/`data-*` attributes. Do NOT copy NN source; do NOT depend on NN's private settings schema.

### Approach A (recommended for HIDE): MutationObserver-driven DOM decorator

Scope a `MutationObserver` to NN's view container and, on every relevant mutation, walk
`[data-tag]` rows and apply Tag Curator's visibility/flags by matching the normalized
`data-tag` value against Tag Curator's own rules.

- Find NN's container at runtime by `getLeavesOfType` for NN's view type, or query
  `document.querySelectorAll('.nn-navigation-pane')`; observe the scroller
  `.nn-navigation-pane-scroller[data-pane="navigation"]` with
  `{ childList: true, subtree: true }`.
- For "hide": set `style.display='none'` (or add a Tag-Curator-owned class like
  `tc-hidden` whose CSS in Tag Curator's own stylesheet hides the row). Prefer toggling a
  Tag-Curator class over inline styles so it is easy to find/clean up and never collides with
  NN's `nn-*` namespace. Because nesting is flat (section 1), hiding a parent does NOT hide
  its children - Tag Curator must apply its own rules to every matching `data-tag`, including
  descendants (match on `dataTag === rule || dataTag.startsWith(rule + '/')`).
- For "flag": add a Tag-Curator class / inject a small badge element into the row
  (e.g. inside, after `.nn-navitem-name`). Keep injected nodes tagged with a
  `data-tc` marker so re-decoration is idempotent (skip rows already decorated for the
  current rule version).
- Reassert on NN events too: subscribe to `nn.on('tag-changed', ...)` and
  `nn.on('storage-ready', ...)` (and optionally `nav-item-changed`) to re-run the decorator
  after NN-initiated re-renders that the observer might batch.
- Tradeoffs: + Most robust across NN versions because it depends only on the very stable
  `data-tag` attribute and `nn-tag` row (both are core to NN's drag/drop and selection, so
  unlikely to churn). + No dependency on NN's private settings or React internals.
  - Must handle virtualization (re-decorate on scroll) and debounce observer callbacks for
  performance. - Pure display change; does not reduce NN's tree size, so hidden rows still
  occupy virtualizer slots (acceptable: they collapse to zero height via CSS).

### Approach B (recommended for FLAG only): public API `setTagMeta` + `registerTagMenu`

Use `nn.metadata.setTagMeta(tag, { color | backgroundColor | icon })` to color/badge a tag
through NN's own supported path, and `nn.menus.registerTagMenu(...)` to offer Tag Curator
actions in NN's tag context menu.

- Tradeoffs: + Fully supported, version-stable, survives re-renders automatically (NN owns
  the rendering). + No DOM fragility. - Cannot HIDE (no hide method). - Writes persist into
  NN's settings (`tagColors` etc.) and fire `tag-changed`; this mutates NN's user-visible tag
  styling and is shared with NN's own color feature, so Tag Curator would be co-owning that
  state (need conflict/cleanup handling on unload). - "Flag" appearance is limited to
  color/background/icon, not arbitrary badges.

### Approach C (NOT recommended): write NN's `hiddenTags` settings

Reach into NN's `data.json` `vaultProfiles[].hiddenTags` (or `plugin.saveSettingsAndUpdate`)
to feed patterns into NN's native filter (section 3).

- Tradeoffs: + Reuses NN's exact hide semantics and actually prunes the tree.
  - Depends entirely on NN's PRIVATE, profile-scoped settings schema and normalization; high
  breakage risk across versions/migrations; concurrency hazards; weakest GPL-boundary story
  (couples to internals). Reject for a shipping integration.

### Recommendation

**Combine A and B.** Use **Approach A (MutationObserver decorator on `[data-tag]` rows scoped
to `.nn-navigation-pane`)** as the primary, version-robust seam for HIDING and for rich
custom FLAG badges, made idempotent and reapplied on NN's mutations plus `tag-changed` /
`storage-ready` events to survive re-renders and virtualization. Where Tag Curator's flag can
be expressed as a color/background/icon, additionally prefer **Approach B (`setTagMeta`)** so
that flag is rendered by NN itself and is automatically re-render-safe. Treat NN's public API
as optional enhancement (feature-detect `app.plugins.plugins['notebook-navigator']?.api` and
its `getVersion()`), and degrade gracefully to the DOM decorator when the API is absent or a
future NN version changes it. Explicitly avoid Approach C.

### Minimal seam checklist for Tag Curator

- Detect NN: `const nn = app.plugins.plugins['notebook-navigator']?.api` (optional).
- Locate container: `.nn-navigation-pane` -> observe
  `.nn-navigation-pane-scroller[data-pane="navigation"]` subtree.
- Target rows: `[data-tag]` (canonical lowercase path); match rules including `path + '/'`
  descendants; remember nesting is flat.
- Decorate with Tag-Curator-namespaced classes/attrs (`tc-*`, `data-tc`), never `nn-*`.
- Reapply on: observer mutations (debounced), scroll, and `nn.on('tag-changed' | 'storage-ready')`.
- Optional flags via `nn.metadata.setTagMeta(...)`; optional menu via `nn.menus.registerTagMenu(...)`.
- On unload: disconnect observer, remove all `tc-*`/`data-tc` decorations, and clear any
  `setTagMeta` values Tag Curator set.
