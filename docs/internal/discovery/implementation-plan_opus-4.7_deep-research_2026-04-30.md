# Tag Curator: Implementation-Ready Technical Specification

*Compiled April 30, 2026, from primary-source research against Obsidian 1.5 to 1.10 and major community plugins. Confidence labels (🟢 high / 🟡 medium / 🔴 low) appear inline. Where a finding could not be verified from a fetchable primary source within the research time-box, it is flagged for empirical confirmation in Appendix C.*

---

> **📌 v0.1 Implementation Status (2026-05-28).** This document was the **pre-implementation deep-research dossier** that informed `docs/internal/release-plans/plan_v0.1.0.md`. The recommendations below are still accurate as a reference for *how* to use Obsidian's API surfaces - they have not been re-verified against the shipping code, so treat them as the design rationale, not as a description of current behavior. For current state:
>
> - **What is built** -> `src/` (118/118 tests pass; engine, observer, storage, settings, main are complete).
> - **What is locked but not yet implemented in UI code** -> `docs/internal/release-plans/plan_v0.1.0/ui-design_v0.1.0_converged.html` plus decisions D-001 through D-011 in `docs/internal/scope-and-decisions.md`.
> - **Where this document and the locked design disagree** -> the locked design wins for v0.1. Notably: the wizard described in older sections is dropped (D-002 closed); priority is hidden from the UI (D-009); preview mode replaces dry-run (D-003); rule editor is card view + right-docked preview (D-010 supersedes D-001).
>
> The Obsidian-API reference sections (§1, §2) and primary-source citations remain authoritative reading for anyone implementing the v0.1 UI tasks (`tagListView.ts`, `settingsTab.ts`, `ruleEditor.ts`).

---

## Executive Summary

### Top 5 actionable findings

1. **Tag Wrangler's integration contract is exactly three workspace events**, not a programmatic API. The event you need is `'tag-wrangler:contextmenu'` with payload `(menu: Menu, tagName: string, info: { query?: string; isHierarchy: boolean; tagPage: TFile | undefined })`. Subscribe via `app.workspace.on(...)`. There is no `app.plugins.plugins['tag-wrangler'].api`. (🟢, README "Developer Notes")
2. **Notebook Navigator (NN) ships a real, versioned, documented public API** at `app.plugins.plugins['notebook-navigator'].api` (currently v2.0.0, 2026-03-07). It exposes `metadata.{getTagMeta,setTagMeta}`, `navigation.navigateToTag`, `menus.registerTagMenu`, and a typed event bus. **However, NN's hidden-tags list is *not* in the public API**; it lives in `data.json` as a setting. Tag Curator must read settings file or hook the tag-context menu rather than mutate hidden-tags directly. (🟢)
3. **Colored Tags Wrangler exposes no programmatic API at all.** Integration must be done by observing the injected `<style id="colored-tags-wrangler">` element in `<head>` (its rule shape `a.tag[href="#name"] { color: ... }` is the de-facto contract) or by reading `data.json`. Treat its settings shape as fragile. (🟡)
4. **Tag pane DOM is eagerly rendered (not virtualized)**, with stable class names since the 0.13 era: `.workspace-leaf-content[data-type="tag"] > .tag-container` containing `.tag-pane-tag` rows. A single `MutationObserver` per pane container is sufficient; no scroll-rebinding needed. Graph view tag nodes, by contrast, are PIXI.js canvas-rendered and are **not DOM-addressable**. (🟢 / 🟢)
5. **Bases (introduced 1.9.0, May 2025) is the binding minAppVersion constraint** and the riskiest target surface. The 1.9.0 → 1.9.2 release introduced a breaking `.base` format change and the November 2025 update broke published CSS selectors. Defer Bases column rendering to v0.2 unless you accept higher maintenance. (🟢)

### Top 5 risks

1. **NN public API requires v2.0.0** for `registerTagMenu`. Older NN installs will silently miss tag-menu integration. Mitigate with version gate + feature detection in `getNotebookNavigator()`. (🟢)
2. **iOS lookbehind regex crashes plugin loading on iOS < 16.4.** Any tag-matching regex with `(?<=...)` is a hard fail on field iPads. Use the iOS-safe variant in §5.3 or your plugin will not load on those devices. (🟢)
3. **`metadataCache.on('changed')` does not always fire on frontmatter-only edits** historically (forum bug), and never fires on rename. Subscribe to `'resolved'` and `vault.on('rename')` as well. (🟡)
4. **Colored Tags Wrangler has no API and ships a single-`<style>` rendering model.** A future internal refactor would silently break Tag Curator's color delegation. Document this in your README and version-pin the integration assumptions. (🟡)
5. **Spec assumption "delegate-color action via Colored Tags Wrangler" is partially infeasible.** There is no programmatic "set color for tag X" entry point. Either (a) write the color into NN's `setTagMeta(tag, { color })` (works on NN ≥1.0.0), or (b) have Tag Curator own its own color palette and render directly. Recommend (a) for vaults with NN, (b) otherwise. **This is the one specific spec-architecture risk surfaced by this research.** (🟢)

### Recommended phased build order

- **Phase 0 (1–2 days):** Scaffold from `obsidianmd/obsidian-sample-plugin`. Wire `loadData/saveData`, `PluginSettingTab`, the lifecycle skeleton from §1.3.
- **Phase 1 (1 week):** Tag pane filtering only. `MutationObserver` on `.tag-container`, hide-list + regex matchers. This is the highest-value, lowest-risk feature surface and works identically on desktop and mobile.
- **Phase 2 (1 week):** Editor autocomplete filtering via `EditorSuggest` interception (suppress hidden tags from `#`-trigger). Properties-panel chip filtering.
- **Phase 3 (3–5 days):** Tag Wrangler context-menu integration, NN tag-menu integration. Both purely additive; no functional dependency.
- **Phase 4 (1 week):** Color delegation (Colored Tags Wrangler observation + NN `setTagMeta` write path).
- **Phase 5 (deferred):** Bases column rendering, hover preview, graph view filtering. These are 1.10.0+ features with thinnest API guarantees.
- **Phase 6:** Benchmark harness, beta release via BRAT, community plugin directory submission.

### Confidence assessment of feasibility

**Overall: 🟢 high confidence the v0.1 scope is feasible.** The DOM surfaces are stable, the metadata cache is reliable enough with the documented workarounds, and the integration plugins (Tag Wrangler, NN) are mature with public contracts. The primary fragilities (Colored Tags Wrangler, Bases) can be quarantined to optional features. No spec assumption was found to be fundamentally invalid; one ("delegate-color via CTW") needs the documented workaround.

---

## Section 1: Obsidian Plugin API Reference

### 1.1 Tag-related metadataCache surface

| Method / property | Signature | Notes |
|---|---|---|
| `metadataCache.getTags()` | `(): Record<string, number>` | Returns `{ "#tag": count }` map vault-wide. **Not in public `obsidian.d.ts`**; type via `obsidian-typings`. Cheap O(1). 🟢 |
| `metadataCache.getFileCache(file)` | `(file: TFile): CachedMetadata \| null` | 🟢 |
| `metadataCache.getCache(path)` | `(path: string): CachedMetadata \| null` | path-based variant 🟢 |
| `getAllTags(cache)` (module-level) | `(cache: CachedMetadata): string[] \| null` | Imported from `'obsidian'`. Combines body + frontmatter, dedupes, returns `#`-prefixed strings. **Use this** instead of merging `cache.tags` and `cache.frontmatter.tags` yourself. 🟢 |

`CachedMetadata` (public):

```ts
interface CachedMetadata {
  tags?: TagCache[];                     // body/inline #tags only
  frontmatter?: FrontMatterCache;        // tags under .tags or .tag
  frontmatterPosition?: Pos;             // since 1.4.0
  frontmatterLinks?: FrontmatterLinkCache[]; // since 1.4.0
  // ... headings, sections, listItems, blocks, links, embeds, footnotes
}

interface TagCache {
  tag: string;       // includes leading "#", slash-form preserved (e.g. "#a/b/c")
  position: Pos;
}
```

Important shape difference: **`cache.tags` items include `#`; `cache.frontmatter.tags` values do not.** Always normalize via `getAllTags()`.

### 1.2 Events

| Source | Event | Signature | Caveats |
|---|---|---|---|
| `metadataCache` | `'changed'` | `(file: TFile, data: string, cache: CachedMetadata)` | Does not fire on rename. Has historically been flaky on frontmatter-only edits (forum bug). 🟡 |
| `metadataCache` | `'resolved'` | `()` | Fires once at end of initial scan and after every batch. Use as "cache fully built" signal. 🟢 |
| `metadataCache` | `'deleted'` | `(file: TFile, prevCache: CachedMetadata \| null)` | 🟢 |
| `vault` | `'create'`, `'modify'`, `'delete'`, `'rename'` | standard | Subscribe to `'rename'` for rename detection. 🟢 |
| `workspace` | `'layout-change'` | `()` | High frequency; fires on any leaf add/remove/move. 🟢 |
| `workspace` | `'active-leaf-change'` | `(leaf: WorkspaceLeaf \| null)` | 🟢 |
| `workspace` | `'file-open'` | `(file: TFile \| null)` | 🟢 |

Registration uses `this.registerEvent(this.app.metadataCache.on(...))` so cleanup is automatic on unload.

### 1.3 Plugin lifecycle

| Hook | Introduced | Behavior |
|---|---|---|
| `onload()` | always | Primary init. Auto-fires after every reload, enable, and update. 🟢 |
| `onunload()` | always | Manual cleanup of anything not registered via `register*()`. 🟢 |
| `onUserEnable()` | **1.7.2** | Fires once when user toggles the plugin on for the first time per install. Use for one-time migrations, welcome screens. Does NOT re-fire on plugin reload. 🟢 |
| `onUserDisable()` | 1.7.2 | Symmetric counterpart. 🟡 (lightly documented) |
| `onExternalSettingsChange()` | available | Fires when `data.json` is rewritten by an external process (Obsidian Sync, manual edit). Re-`loadData()` and re-render. 🟢 |

`register*` cleanup contract:

| Method | Cleaned up at unload? |
|---|---|
| `registerEvent(eventRef)` | ✅ via `Events.offref` |
| `registerDomEvent(el, type, cb)` | ✅ via `removeEventListener` |
| `registerInterval(id)` | ✅ via `clearInterval` |
| `register(cb)` | ✅ generic disposer |
| `addCommand`, `addSettingTab`, `addRibbonIcon`, `registerView` | ✅ |

### 1.4 Layout-ready pattern

Tag pane (and other lazy panes) may not exist at `onload()` time. Robust attach pattern:

```ts
import { Plugin, View, WorkspaceLeaf } from 'obsidian';

const TAG_VIEW_TYPE = 'tag'; // internal, stable across 1.5–1.10

export default class TagCurator extends Plugin {
  private observers = new WeakMap<HTMLElement, MutationObserver>();

  async onload() {
    await this.loadSettings();
    this.app.workspace.onLayoutReady(() => this.attachToAllTagPanes());
    this.registerEvent(
      this.app.workspace.on('layout-change', () => this.attachToAllTagPanes())
    );
  }

  private attachToAllTagPanes() {
    for (const leaf of this.app.workspace.getLeavesOfType(TAG_VIEW_TYPE)) {
      // Force load if pane is deferred (1.7.2+)
      // @ts-expect-error obsidian-typings has the proper type
      if (leaf.isDeferred) leaf.loadIfDeferred?.();
      const containerEl = (leaf.view as View & { containerEl: HTMLElement }).containerEl;
      if (!containerEl || this.observers.has(containerEl)) continue;
      const obs = new MutationObserver(() => this.applyFilters(containerEl));
      obs.observe(containerEl, { childList: true, subtree: true });
      this.observers.set(containerEl, obs);
      this.register(() => obs.disconnect());
      this.applyFilters(containerEl); // initial pass
    }
  }

  private applyFilters(root: HTMLElement) { /* see §2 */ }
  async loadSettings() { /* see §6 */ }
}
```

### 1.5 obsidian-typings package

- Repo: https://github.com/Fevol/obsidian-typings
- npm: `obsidian-typings` (3.16.0 as of April 2026)
- Tracks `release/obsidian-public/1.9.10` and `main`.
- Install: `npm i -D obsidian-typings`; add `"types": ["obsidian-typings"]` to `tsconfig.json` or `import 'obsidian-typings'` ambient.
- Reliability: 🟡. Maintainer disclaims accuracy; updates within days of major Obsidian releases. Always feature-detect at runtime when crossing into internal APIs.

---

## Section 2: DOM Structure Reference

### 2.1 Selector reference table

| # | Surface | Container | Item / chip | Tag-name location | Stability | Source |
|---|---|---|---|---|---|---|
| 1 | Tag pane | `.workspace-leaf-content[data-type="tag"] > .tag-container` | `.tag-pane-tag` (with `.tag-pane-tag-self`, `.tree-item-self`) | `.tag-pane-tag-text` (no `#`); count in `.tag-pane-tag-count` | 🟢 stable since 0.13 | Forum t/3645 (2020), t/105697 (2025) |
| 2 | Graph view tag nodes | `.workspace-leaf-content[data-type="graph"] > canvas` | **No DOM nodes** (PIXI.js scene graph) | n/a | 🟢 (canvas-rendered confirmed) | Forum t/66621 |
| 3 | Editor `#` autocomplete | `.suggestion-container` | `.suggestion-item` (active: `.is-selected`) | innerText | 🟡 (popup refactored periodically) | API `EditorSuggest` |
| 4 | Properties tag chips | `.metadata-container > .metadata-property[data-property-key="tags"] .multi-select-container` | `.multi-select-pill` | `.multi-select-pill-content` innerText | 🟢 stable since 1.4 | Forum t/105697 (Sep 2025 app.css dump) |
| 5 | Search result tags | `.workspace-leaf-content[data-type="search"] .search-result-container` | inline `a.tag[href^="#"]` in `.search-result-file-matches` | `href` attribute, innerText | 🟡 | fanis/obsidian-style-tags-in-search-results |
| 6 | Quick switcher tag rows | `.prompt > .prompt-results` | `.suggestion-item` (same as #3) | innerText, `.suggestion-aux` for aliases | 🟡 | API `SuggestModal` |
| 7 | Hover preview tags | `.popover.hover-popover` | inline `a.tag[href="#..."]` | href + innerText | 🟢 | Tag Wrangler README |
| 8 | Backlinks pane tags | `.workspace-leaf-content[data-type="backlink"] .backlink-pane` | inline `a.tag` in `.search-result-file-match` | href + innerText | 🟡 (re-uses search DOM) | inferred from #5 |
| 9 | Bases tag cells | `.workspace-leaf-content[data-type="bases"] .bases-table` (or `.bases-cards`) | `.bases-td[data-property-key="tags"]` containing `.multi-select-pill` or `a.tag` | varies | 🔴 (changed Nov 2025) | EzraMarks/obsidian-bases-css-guide |
| 10 | CodeMirror inline tags | inside `.cm-content` | `.cm-hashtag`, `.cm-hashtag-begin`, `.cm-hashtag-end`, `.cm-tag-<name>` | text content | 🟢 since CM6 (2022) | app.css dump |

### 2.2 ARIA preservation rules

When applying `display:none` or hiding via class:

- **Tag-pane rows**: also set `aria-hidden="true"`. **Do not** `removeChild()`; Obsidian core indexes its tree-item elements internally.
- **Multi-select pills (properties / Bases)**: set `aria-hidden="true"` and `tabindex="-1"` on the inner `.multi-select-pill-remove-button` to keep keyboard nav sane.
- **Suggestion items**: hidden items still receive arrow-key focus. Filter at the data layer (override `EditorSuggest.getSuggestions`) rather than CSS-hiding.
- **`a.tag`**: keep `href` intact (Obsidian's click handler reads it). Toggle via wrapping span if needed.

### 2.3 Tag pane is eager, not virtualized

Confidence 🟡 high. Evidence: Tag Wrangler binds context-menu handlers via DOM event delegation on the pane container with no scroll-rebinding logic, and forum CSS snippets target all `.tag-pane-tag` rows uniformly. Implication: a single `MutationObserver` is sufficient; no `IntersectionObserver` needed.

### 2.4 Companion CSS file (`styles.css`)

```css
/* Hide via class so we can re-show without DOM diffing */
.tag-pane-tag.tag-curator-hidden { display: none !important; }
.metadata-property[data-property-key="tags"] .multi-select-pill.tag-curator-hidden { display: none !important; }
.suggestion-item.tag-curator-hidden { display: none !important; }
.markdown-preview-view a.tag.tag-curator-hidden,
.popover.hover-popover a.tag.tag-curator-hidden,
.search-result-file-matches a.tag.tag-curator-hidden { display: none !important; }

/* Flag treatment */
.tag-pane-tag.tag-curator-flagged .tag-pane-tag-text::after {
  content: " ⚑"; opacity: 0.6;
}
```

---

## Section 3: Integration Plugin APIs

### 3.1 Tag Wrangler (id: `tag-wrangler`)

Public surface is **three workspace events**, not an API object. Latest version is 0.6.4 (March 2025). Confidence 🟢 from README "Developer Notes".

```ts
import { Plugin, Menu, TFile, EventRef } from 'obsidian';

interface TagWranglerContextMenuInfo {
  query?: string;
  isHierarchy: boolean;
  tagPage: TFile | undefined;
}
interface TagPageEvent {
  tag: string;
  file?: TFile | Promise<TFile>;
}

export class TagWranglerBridge {
  constructor(private plugin: Plugin) {}

  isAvailable(): boolean {
    // @ts-ignore app.plugins is internal but stable
    return !!(this.plugin.app as any).plugins?.plugins?.['tag-wrangler']
        && (this.plugin.app as any).plugins?.enabledPlugins?.has?.('tag-wrangler');
  }

  registerContextMenu(handler: (menu: Menu, tagName: string, info: TagWranglerContextMenuInfo) => void): void {
    this.plugin.registerEvent(
      // @ts-ignore - event name not in obsidian.d.ts
      this.plugin.app.workspace.on('tag-wrangler:contextmenu', handler)
    );
  }

  // tag-page:will-create handler MUST be sync; assign evt.file synchronously
  registerWillCreatePage(handler: (evt: TagPageEvent) => void): void {
    this.plugin.registerEvent(
      // @ts-ignore
      this.plugin.app.workspace.on('tag-page:will-create', handler)
    );
  }
}
```

Graceful degradation: if Tag Wrangler is absent, Tag Curator falls back to a DOM-level `contextmenu` listener on `.tag-pane-tag` elements and builds its own `Menu` at the click coordinates.

### 3.2 Notebook Navigator (id: `notebook-navigator`)

NN exposes a typed, versioned public API at `app.plugins.plugins['notebook-navigator'].api`. Current API version is 2.0.0 (2026-03-07). Confidence 🟢 from `docs/api-reference.md`.

```ts
import type { App, TFile, EventRef, MenuItem } from 'obsidian';

// Subset relevant to Tag Curator
interface NotebookNavigatorAPI {
  getVersion(): string;
  whenReady(): Promise<void>;
  on(event: string, cb: (data: any) => void): EventRef;
  off(ref: EventRef): void;
  metadata: {
    getTagMeta(tag: string): { color?: string; backgroundColor?: string; icon?: string } | null;
    setTagMeta(tag: string, meta: { color?: string; backgroundColor?: string; icon?: string }): Promise<void>;
  };
  navigation: {
    navigateToTag(tag: string): Promise<boolean>;
  };
  menus: {
    registerTagMenu(cb: (ctx: { tag: string; addItem: (b: (i: MenuItem) => void) => void }) => void): () => void;
  };
  tagCollections: { isCollection(tag: string): boolean };
}

export class NotebookNavigatorBridge {
  private api: NotebookNavigatorAPI | null = null;

  constructor(private app: App, private plugin: { register(d: () => void): void }) {}

  async init(): Promise<boolean> {
    const plugin = (this.app as any).plugins?.plugins?.['notebook-navigator'];
    const api = plugin?.api as NotebookNavigatorAPI | undefined;
    if (!api) return false;
    if (api.getVersion().split('.')[0] < '2') {
      console.warn('Tag Curator: NN API < 2.0.0; tag menus disabled');
      this.api = api; return true; // metadata API still works on 1.x
    }
    await api.whenReady();
    this.api = api;
    return true;
  }

  registerTagMenu(handler: (tag: string) => Array<{ title: string; icon?: string; onClick: () => void }>): void {
    if (!this.api?.menus?.registerTagMenu) return;
    const dispose = this.api.menus.registerTagMenu(({ tag, addItem }) => {
      if (this.api!.tagCollections.isCollection(tag)) return;
      for (const cmd of handler(tag)) {
        addItem(item => item.setTitle(cmd.title).setIcon(cmd.icon ?? 'tag').onClick(cmd.onClick));
      }
    });
    this.plugin.register(dispose);
  }

  setTagColor(tag: string, color: string, bg?: string): Promise<void> {
    if (!this.api) return Promise.resolve();
    return this.api.metadata.setTagMeta(tag, { color, backgroundColor: bg });
  }
}
```

**Hidden tags caveat:** NN's hidden-tags list is a setting, not part of the public API. To read or mutate it, watch `<vault>/.obsidian/plugins/notebook-navigator/data.json` (typical key: `hiddenTags: string[]`, **shape unverified, treat as fragile**, 🔴) or hook NN's tag-context menu and instruct the user to use NN's own UI.

**Vault Profiles:** internal only. There is a user-facing `Notebook Navigator: Select vault profile <N>` command but no programmatic switch in the public API.

### 3.3 Colored Tags Wrangler (id: `colored-tags-wrangler`)

**No programmatic API.** Latest 0.19.4 (October 2025). Integration must observe the injected stylesheet element. Confidence 🟡.

```ts
import { Plugin } from 'obsidian';

interface TagColor { color?: string; bg?: string }

export class ColoredTagsWranglerBridge {
  private index = new Map<string, TagColor>();

  constructor(private plugin: Plugin) {}

  init(): void {
    const styleEl = document.getElementById('colored-tags-wrangler');
    if (!styleEl) return;
    this.rebuild(styleEl);
    const obs = new MutationObserver(() => this.rebuild(styleEl));
    obs.observe(styleEl, { childList: true, characterData: true, subtree: true });
    this.plugin.register(() => obs.disconnect());
  }

  colorFor(tag: string): TagColor | null {
    const key = tag.replace(/^#/, '');
    return this.index.get(key) ?? null;
  }

  private rebuild(styleEl: HTMLElement) {
    this.index.clear();
    const text = styleEl.textContent ?? '';
    // CTW emits rules like: a.tag[href="#name"] { color:...; background:...; }
    const re = /a\.tag\[href\s*=\s*"#([^"]+)"\]\s*\{([^}]+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const [, tag, body] = m;
      const color = /(?:^|;)\s*color\s*:\s*([^;]+)/.exec(body)?.[1]?.trim();
      const bg = /background(?:-color)?\s*:\s*([^;]+)/.exec(body)?.[1]?.trim();
      this.index.set(tag, { color, bg });
    }
  }
}
```

### 3.4 Version compatibility matrix

| Plugin | id | Min version Tag Curator targets | Latest (Apr 2026) | Mechanism |
|---|---|---|---|---|
| Tag Wrangler | `tag-wrangler` | 0.5.0 | 0.6.4 | `workspace.on('tag-wrangler:contextmenu', ...)` |
| Notebook Navigator | `notebook-navigator` | API 2.0.0 (for tag menus); 1.0.0 for metadata read | API 2.0.0 (2026-03-07) | `plugin.api.menus.registerTagMenu` + events |
| Colored Tags Wrangler | `colored-tags-wrangler` | any | 0.19.4 | DOM `<style id="...">` observer |

### 3.5 Spec-architecture risk surfaced

The spec's "delegate-color" action assumes a programmatic CTW integration. **CTW provides none.** Recommended re-architecture: route color delegation through NN's `setTagMeta(tag, { color })` when NN is present, and fall back to Tag Curator's own internal palette + CSS injection when not. CTW becomes a *read-only* color source, not a write target.

---

## Section 4: Performance Profile with Benchmark Harness

### 4.1 Existing-data synthesis

| Plugin | Vault profile | Pain point | Source |
|---|---|---|---|
| Dataview | ~950 notes / ~4500 links | Multi-second freezes typing `[[` | issues #1154, #1159 |
| Linter | any | 120 ms desktop / >200 ms mobile load (treated as bug) | issue #304 |
| Tasks | ~180 tasks rendered | ~500 ms toggle lag | discussion #2628 |
| Tasks | 17 000 tasks | ~3 min Obsidian startup | discussion #3244 |
| Tasks | hundreds of items rendered | Editing chops | issue #2737 |
| NN | any | Required file-open debouncing | release 2.3.0 notes |
| Tag Wrangler | bulk rename | Seconds-range, accepted with progress UX | README |

Synthesis: anything above ~16 ms per filter pass compounds visibly when stacked with these plugins. Aim for `<2 ms` p95 observer overhead.

### 4.2 Threshold table

| Metric | 🟢 Green | 🟡 Yellow | 🔴 Red | Justification |
|---|---|---|---|---|
| Plugin load (`onload`→ready) | <50 ms | 50–200 ms | >200 ms | Linter community treats >200 ms as a bug |
| DOM observer callback p95 | <2 ms | 2–10 ms | >10 ms | Headroom inside 16 ms frame |
| Filter apply on tag pane | <16 ms | 16–50 ms | >50 ms | One frame; RAIL "instant" budget |
| metadataCache evt/s typical | <50/s | 50–200/s | >200/s | Higher = listener leak |
| metadataCache evt/s heavy bulk | <500/s | 500–2000/s | >2000/s | Tag Wrangler bulk rename |
| Heap delta @ 1k notes | <15 MB | 15–40 MB | >40 MB | Plugin overhead only |
| Heap delta @ 10k notes | <30 MB | 30–80 MB | >80 MB | Mirrors Dataview footprint |
| Heap delta @ 50k notes | <120 MB | 120–250 MB | >250 MB | Mobile GC threshold |

### 4.3 Benchmark harness (full code in Appendix A.1)

The harness ships in `src/dev/benchmark.ts`, registered behind a `DEV_MODE` flag, runnable via the command palette as **"Tag Curator: Run benchmark"**. It measures:

1. Plugin load time (markStart/markReady around `onload`).
2. DOM observer callback p50/p95/p99 under simulated typing.
3. metadataCache `'changed'` rate under typical and heavy editing.
4. Heap delta at current vault size.
5. Filter-apply latency on a freshly remounted tag pane (10 iterations).

Output: `console.table` + a modal with copyable markdown report.

### 4.4 Synthetic vault generator

`scripts/gen-vault.ts` (see Appendix A.2) generates 1k/10k/50k-note vaults with:

- Zipf tag distribution (α=1.2; top ~5 tags in half of all notes).
- 50 root / 200 L2 / 600 L3 nested tags.
- ~60% notes with frontmatter `tags`, ~40% inline `#tags`.
- ~10% multilingual (Cyrillic, CJK, emoji) for Unicode coverage.
- Deterministic via seeded PRNG.

Run: `npx tsx scripts/gen-vault.ts --notes 10000 --out ./bench-vault-10k`.

### 4.5 5-minute developer flow

1. Generate vault (~30–60 s).
2. Open in Obsidian (~10 s indexing).
3. Cmd-P → "Tag Curator: Run benchmark" (~30 s).
4. Read modal, compare to threshold table.

---

## Section 5: Edge Cases and Gotchas

### 5.1 Nested tags

`TagCache.tag` is a **single string** with slashes preserved (`"#a/b/c"`). Obsidian does not pre-split. Use `tag.split('/')` to derive hierarchy. Hiding `#a/b` should hide `#a/b/*` children: implement as `hidden.has(t) || [...hidden].some(h => t.startsWith(h + '/'))`.

### 5.2 Frontmatter formats

All four are valid: scalar `tags: foo`, inline array `tags: [foo, bar]`, block list, and legacy singular `tag:`. Spaces are separators (`tags: philosophy of science` → 3 tags). Leading `#` in YAML must be quoted (treated as comment otherwise). **Always normalize via `getAllTags(cache)`.**

### 5.3 Unicode and the iOS lookbehind trap

Obsidian's documented allowed character set is narrower than what its parser accepts. In practice: Cyrillic, CJK, accented Latin, and even emoji are accepted. Period (`.`) is rejected. Note `#1` is invalid (must contain ≥1 non-numeric char), but `#a2023` is valid.

iOS-safe regex (no lookbehind):

```ts
const TAG_RE_IOS_SAFE = /(^|[^\p{L}\p{N}_\-\/#])#([\p{L}\p{N}_\-\/]*[\p{L}_\-\/][\p{L}\p{N}_\-\/]*)/gu;
```

Lookbehind crashes plugin loading on iOS < 16.4; documented in `docs.obsidian.md/Plugins/Getting+started/Mobile+development`. 🟢

### 5.4 Code blocks, math, HTML comments

Obsidian's metadata parser excludes fenced code blocks, inline code, and `$..$` math from tag extraction. HTML comments `<!-- #tag -->` may still be detected (no special exclusion). **Ground truth is `cache.tags`; do not run your own regex over `vault.read()` output.**

### 5.5 Canvas tags

As of 1.8.x, canvas-file tags are **opt-in** via a setting (some third-party canvas plugins enable). Default `metadataCache.getCache("Foo.canvas")` returns `null`. Tag Wrangler does not handle canvas. **v0.1 recommendation: declare canvas out of scope and document.**

### 5.6 Race conditions

Pattern: monotonic version counter for any async-then-DOM-write operation, plus rAF coalescing for filter applies.

```ts
private profileVersion = 0;
async switchProfile(p: Profile) {
  const my = ++this.profileVersion;
  await this.loadFilters(p);
  if (my !== this.profileVersion) return; // superseded
  this.applyFilters(this.snapshotTags());
}

private rerenderScheduled = false;
private scheduleRerender() {
  if (this.rerenderScheduled) return;
  this.rerenderScheduled = true;
  requestAnimationFrame(() => {
    this.rerenderScheduled = false;
    this.applyFilters(this.snapshotTags());
  });
}
```

Subscribe both `metadataCache.on('changed')` and `metadataCache.on('resolved')` for safety against the frontmatter-only-edit bug.

### 5.7 Limits and empty-vault behavior

No documented hard limits. Empirically: tag length up to ~200 chars works (display truncates). Recommend self-imposed warnings at >100 chars or >100 tags per note. `metadataCache.getTags()` returns `{}` (not null) on empty vaults. `getAllTags(cache) ?? []` is the safe pattern.

---

## Section 6: Storage and State Patterns

### 6.1 loadData / saveData

- Path on disk: `<vault>/.obsidian/plugins/<id>/data.json`.
- Atomicity: write-then-fsync on desktop FileSystemAdapter; **not** transactional. Treat as durable but not crash-safe.
- Size: no documented limit; full serialize-and-rewrite each save. Move to sidecar files or IndexedDB above ~1 MB.
- `onExternalSettingsChange()` fires when the file is rewritten externally (Sync, manual edit). Re-load and re-render.

### 6.2 Schema versioning template

```ts
const CURRENT_SCHEMA = 1;
const DEFAULTS: Settings = {
  schemaVersion: CURRENT_SCHEMA,
  hiddenTags: [],
  flaggedTags: [],
  rules: [],
  activeProfile: 'default',
  profiles: { default: { name: 'Default', hiddenTags: [], flaggedTags: [] } },
};

async loadSettings() {
  const raw = (await this.loadData()) ?? {};
  let s: Settings = { ...DEFAULTS, ...raw };
  if ((s.schemaVersion ?? 0) < 1) s = migrate0to1(s);
  // future: if (s.schemaVersion < 2) s = migrate1to2(s); ...
  s.schemaVersion = CURRENT_SCHEMA;
  this.settings = s;
  await this.saveData(this.settings);
}

async saveSettings() { await this.saveData(this.settings); }
```

Reference: Linter uses a per-rule keyed schema with sequential migrations; Dataview uses a "dual-read / single-write" strategy (read both old and new keys for N versions).

### 6.3 Profile switching pattern (NN model)

NN does **not** swap the entire settings stack. It stores a fixed sub-record (hiddenFolders, hiddenTags, hiddenNotes, fileVisibility, shortcuts, recentNotes, banner) per profile, with everything else global. Switching = single `activeProfileId` change + React context re-emit + `saveData()`. Files are **not** re-indexed; filtering happens at render time over the cached file list.

For Tag Curator, mirror this approach: profiles partition only the visibility rules (hidden/flagged/grouped/regex-rule sets), keeping core toggles, integration settings, and palettes global.

### 6.4 Obsidian Sync key partitioning

| Setting kind | Where to put it |
|---|---|
| Visibility profile sub-records, rule sets, named regex matchers | `data.json` (synced) |
| Per-device disabled scopes (e.g., disable Bases on mobile) | `perDeviceOverrides[deviceId]` inside `data.json` |
| Large transient caches (computed similarity index) | sidecar via `vault.adapter.write` to `.obsidian/plugins/tag-curator/cache.json` |
| Truly massive indexes (only if needed) | IndexedDB |

---

## Section 7: Testing Strategy

### 7.1 Framework recommendation

**Vitest** is recommended for new plugins (faster, ESM-native, simpler config) **unless** you need `jest-environment-obsidian`'s shimmed `obsidian` module, in which case stay on **Jest 29**. All four major reference plugins (Linter, Dataview, Tasks, NN) use Jest; the ecosystem mock library is Jest-only.

### 7.2 Mocking Obsidian

Canonical: https://github.com/obsidian-community/jest-environment-obsidian. Setup:

```js
// jest.config.js
const { extend } = require('jest-environment-obsidian/jest-preset');
module.exports = extend({
  testEnvironmentOptions: {
    conformance: 'lax',
    version: '1.9.10',     // align with minAppVersion
    missingExports: 'warning',
  },
});
```

Per-file pragma: `@jest-environment jest-environment-obsidian`, `@obsidian-version 1.9.10`.

### 7.3 DOM testing

Use **jsdom** (Jest default; supports `MutationObserver` since v16). Wrap mutation-triggering code with `await Promise.resolve()` or `await new Promise(r => setTimeout(r, 0))` to flush microtasks. Switch to `happy-dom` only if measured test-suite slowdown >2x.

### 7.4 E2E

No major plugin uses Playwright/Electron E2E. Community norm: symlink dev build into a test vault + `pjeby/hot-reload` plugin. Do not invest in Playwright for v0.1.

### 7.5 Manual QA matrix (minimum 24-cell sweep)

| Axis | Cells |
|---|---|
| Vault size | Small (≤100), Medium (~2000), Large (10k+) |
| Platform | Win11 desktop, macOS desktop, Linux AppImage, iOS, Android |
| Obsidian version | minAppVersion (1.9.10), latest stable, latest insider |
| Theme | Default dark, Minimal, AnuPpuccin |
| Companion plugins | None, Tag Wrangler only, NN, kitchen-sink (all 5) |

Minimum sweep: 2 sizes × 3 platforms × 2 themes × 2 companion sets × 1 OB version = 24 cells.

### 7.6 Multi-version testing

Parameterize `@obsidian-version` pragma across `[1.4.0, 1.6.0, 1.8.0, 1.9.10, 1.10.0]` to catch typings drift. For real-app testing, retain old installers from `obsidianmd/obsidian-releases` releases page.

---

## Section 8: Distribution Plan

### 8.1 Submission flow to obsidian-releases

1. Fork https://github.com/obsidianmd/obsidian-releases.
2. Append entry to `community-plugins.json`:
   ```json
   { "id": "tag-curator", "name": "Tag Curator", "author": "<you>",
     "description": "Vault-wide tag visibility and curation engine.",
     "repo": "<you>/obsidian-tag-curator" }
   ```
3. Open PR; the template at `.github/PULL_REQUEST_TEMPLATE/plugin.md` auto-loads.
4. ObsidianReviewBot posts automated review within minutes; rescans every ~6 hours.
5. Manual review by Obsidian staff (commonly @Zachatoo) follows.
6. Expect **multiple weeks** wait time as of 2026.

### 8.2 Required release artifacts

GitHub release with tag exactly matching `manifest.version` (no `v` prefix), containing as individual file assets:

- `manifest.json` (also at repo root)
- `main.js`
- `styles.css` (optional)
- `README.md` (root)
- `LICENSE` (root)

### 8.3 Common rejection reasons (synthesized from recent PRs)

1. Sentence-case violations in UI strings (most common).
2. Description / metadata mismatch between PR body, manifest, and `community-plugins.json` entry.
3. Hard-coded `.obsidian` paths instead of `Vault.configDir`.
4. Use of deprecated `app.workspace.activeLeaf` instead of `getActiveViewOfType()`.
5. `as` casting instead of `instanceof TFile/TFolder`.
6. Unawaited promises / `Promise<void>` where `void` expected.
7. `window.localStorage` instead of `App.saveLocalStorage`.
8. Plugin command IDs that include the plugin ID (Obsidian namespaces automatically).
9. Settings UI using HTML `<h2>` instead of `new Setting().setHeading()`.

### 8.4 BRAT for beta channel

BRAT v2 uses GitHub Releases as source of truth. To ship a beta:

1. Cut a GitHub release with pre-release semver tag (e.g., `0.2.0-beta.1`), marked Pre-release.
2. Attach `main.js`, `manifest.json` (matching beta version), `styles.css`.
3. Beta users add `<you>/tag-curator` in BRAT settings → "Add Beta Plugin".

**Caveat:** Obsidian's auto-updater does not understand SemVer pre-release suffixes. If you ship `1.0.1-beta.1` then `1.0.1` final, users will not auto-roll forward; bump to `1.0.2`.

For pre-1.1 BRAT compatibility, also keep `manifest-beta.json` at repo root with the beta version.

### 8.5 Repo structure

```
tag-curator/
├── .github/
│   ├── workflows/{release.yml, ci.yml, eslint-obsidian.yml}
│   ├── ISSUE_TEMPLATE/{bug_report.md, feature_request.md}
│   └── PULL_REQUEST_TEMPLATE.md
├── src/{main.ts, settings.ts, dom/, integrations/, dev/benchmark.ts}
├── __tests__/
├── scripts/gen-vault.ts
├── manifest.json
├── manifest-beta.json    # optional, BRAT-pre-1.1 compat
├── versions.json
├── package.json
├── esbuild.config.mjs
├── styles.css
├── README.md
└── LICENSE
```

### 8.6 manifest.json template

```json
{
  "id": "tag-curator",
  "name": "Tag Curator",
  "version": "0.1.0",
  "minAppVersion": "1.9.10",
  "description": "Hide, filter, flag, and curate tags across Obsidian's UI.",
  "author": "<you>",
  "authorUrl": "https://github.com/<you>",
  "fundingUrl": "https://github.com/sponsors/<you>",
  "helpUrl": "https://github.com/<you>/obsidian-tag-curator#readme",
  "isDesktopOnly": false
}
```

```json
// versions.json
{ "0.1.0": "1.9.10" }
```

---

## Mobile Compatibility Strategy (Decision 1)

### Reference plugin precedent

| Plugin | `isDesktopOnly` | Reason |
|---|---|---|
| Tag Wrangler | `true` | Right-click context menu paradigm doesn't translate to touch (maintainer's stated reason in issue #31) |
| Notebook Navigator | `false` | Tested on Linux, macOS, Windows, Android, iOS, iPadOS in PR #6886; proves complex tag UIs ship cross-platform |
| Linter | `false` | Listed in Obsidian Hub mobile-compatible plugins |

### DOM survey

| Surface | Desktop | iOS | Android | Notes |
|---|---|---|---|---|
| Tag pane | ✅ | ✅ (sidebar drawer) | ✅ | Same DOM classes |
| Editor `#` autocomplete | ✅ | ✅ | ✅ | CodeMirror 6 identical cross-platform |
| Properties tag chips | ✅ | ⚠️ small hit targets, clipping bug | ⚠️ same | DOM identical |
| Graph view | ✅ | ✅ | ✅ | Performance limited on low-end mobile |
| Quick switcher | ✅ | ✅ | ✅ | Same modal DOM |
| Hover preview | ✅ | ❌ no hover event | ❌ no hover event | Replaced with tap-hold tooltip on mobile |
| Right-click context menu | ✅ | ❌ inconsistent | ❌ inconsistent | Why Tag Wrangler chose desktop-only |

### Tiered strategy for v0.1

| Feature | Desktop | iOS | Android | Tier |
|---|---|---|---|---|
| Tag pane filtering | Full | Full | Full | (a) mobile-equivalent |
| Editor autocomplete filter | Full | Full | Full | (a) mobile-equivalent |
| Properties chip filter | Full | Reduced (44px hit target padding) | Reduced | (b) graceful degrade |
| Bulk tag rename | Full + progress modal | Notice-toast progress, RAF chunked | Same | (b) graceful degrade |
| Settings UI | Full | Full | Full | (a) mobile-equivalent |
| Tag-chip context menus | Full | Command palette equivalent | Command palette equivalent | (c) desktop-only UI; mobile gets command-palette fallback |
| Hover preview tags | Full | Disabled | Disabled | (c) desktop-only |
| Bases column rendering | Full (1.10.0+) | Disabled v0.1 | Disabled v0.1 | (c) deferred |
| Graph view filter | Full | Disabled | Disabled | (c) desktop-only |

### Recommendation: `"isDesktopOnly": false` (🟢)

Rationale: core scope (tag pane + autocomplete + properties chips) is feasible on mobile. Setting `true` removes the plugin from the mobile community catalog entirely, frustrating sync users. Conditionalize desktop-only features:

```ts
import { Platform } from 'obsidian';
if (!Platform.isMobile) {
  this.registerHoverPreviewIntegration();
}
if (Platform.isIosApp) {
  // 44px hit-target CSS class
  document.body.addClass('tag-curator-ios');
}
```

### Mobile-specific concerns

- iOS HIG requires 44 × 44 pt touch targets. Properties chips render at ~22 px; add hit-area padding via CSS class.
- Avoid `(?<=...)` lookbehind regex (crashes plugin load on iOS < 16.4).
- Scope `MutationObserver` to `leaf.view.containerEl`, not `document.body` (battery + scroll-fan-out on mobile).
- Disconnect observers when leaf hides (`workspace.on('layout-change')`).
- No Node/Electron APIs: use `vault.adapter.read/write`, `normalizePath`.
- `app.emulateMobile()` flips DOM/CSS but does not disable Node; real-device testing required.

---

## Version Targeting Recommendation (Decision 3)

### minAppVersion across reference plugins

| Plugin | Latest | minAppVersion | Confidence |
|---|---|---|---|
| Tag Wrangler | 0.6.4 | not directly verified; likely 1.4+ | 🔴 |
| Notebook Navigator | 2.5.x+ | 1.8.0 (bumped at v1.3.13) | 🟢 / 🟡 |
| Linter | 1.31.2 | not directly verified; likely 1.0–1.4 | 🔴 |
| Dataview | 0.5.70 | 0.13.11 | 🟢 |
| Tasks | 7.23.1 | 1.4.0 | 🟢 |
| Templater | latest 2.x | 1.5.0 | 🟢 |
| Calendar | recent | 0.9.11 | 🟢 |

Median for actively-maintained 2025–2026 plugins targeting Properties-era APIs: **1.4.0–1.8.0**.

### Obsidian release cadence and breaking changes

One minor version every 4–6 months. Backward compat across 1.x is highly conservative; most "breaking" changes are additive or internal.

| Version | Date | Relevant change |
|---|---|---|
| 1.4.0 | Aug 2023 | Properties panel introduced |
| 1.7.2 | 2024 | `onUserEnable`, `WorkspaceLeaf.isDeferred`, `loadIfDeferred` |
| 1.8.0 | Feb 2025 | `getLanguage()` API; `app.workspace.activeLeaf` deprecated |
| 1.9.0 | May 2025 | **Bases** core plugin; `.base` files; **removed legacy singular `tag`/`alias`/`cssclass`** |
| 1.9.2 | Jun 2025 | Bases formula syntax overhaul (breaking) |
| 1.9.10 | Aug 2025 | Tags view fixes; Bases performance |
| 1.10.0 | Oct 2025 | Bases plugin API (`registerView` for Bases) |

### Tag Curator's binding constraints

| Dependency | Required Obsidian |
|---|---|
| Properties panel | 1.4.0 |
| `metadataCache` events | always |
| `onLayoutReady` | always |
| `app.workspace.trigger` (Tag Wrangler) | always |
| `WorkspaceLeaf.isDeferred` | 1.7.2 (use feature detection if going lower) |
| Bases tag rendering (read-only) | **1.9.0** |
| Bases custom view registration | 1.10.0 (only if Tag Curator registers a Bases view) |

### Recommendation

**`"minAppVersion": "1.9.10"`** (🟢).

| Choice | User reach (Apr 2026) | Tradeoff |
|---|---|---|
| 1.4.0 | Maximum | Bases features dead code |
| 1.8.0 | ~95% | Bases must feature-detect |
| 1.9.0 | ~85% | 1.9.0 vs 1.9.2 Bases format diff requires guards |
| **1.9.10** ✅ | ~75–80% | Cleanest Bases experience |
| 1.10.0 | ~60% | Required if registering Bases view |

If v0.1 omits Bases entirely, you can safely drop to **1.8.0** for broader reach without functional loss.

---

## Appendix A: Code Examples

### A.1 Benchmark harness (`src/dev/benchmark.ts`)

```ts
import { App, Plugin, MetadataCache, TFile, Notice, Modal, MarkdownView } from 'obsidian';

type Sample = number;
interface Stats { n: number; mean: number; p50: number; p95: number; p99: number; max: number }
interface Row {
  metric: string; n: number; p50: string; p95: string; p99: string; max: string;
  verdict: '🟢' | '🟡' | '🔴' | '—';
}

const THRESH = {
  load:        { green: 50,  yellow: 200 },
  obsCallback: { green: 2,   yellow: 10  },
  filterApply: { green: 16,  yellow: 50  },
  cacheRate:   { green: 50,  yellow: 200 },
  heap10k:     { green: 30,  yellow: 80  },
} as const;

function pct(arr: Sample[], p: number): number {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
function stats(arr: Sample[]): Stats {
  if (!arr.length) return { n: 0, mean: NaN, p50: NaN, p95: NaN, p99: NaN, max: NaN };
  const sum = arr.reduce((a, b) => a + b, 0);
  return { n: arr.length, mean: sum / arr.length, p50: pct(arr, 50), p95: pct(arr, 95), p99: pct(arr, 99), max: Math.max(...arr) };
}
const fmt = (x: number) => Number.isFinite(x) ? x.toFixed(2) : '—';
function verdict(value: number, green: number, yellow: number): Row['verdict'] {
  if (!Number.isFinite(value)) return '—';
  if (value <= green) return '🟢';
  if (value <= yellow) return '🟡';
  return '🔴';
}

export class TagCuratorBench {
  constructor(private plugin: Plugin) {}

  static markStart() { (globalThis as any).__tcLoadStart = performance.now(); }
  static markReady() { (globalThis as any).__tcLoadEnd = performance.now(); }

  registerCommand() {
    this.plugin.addCommand({
      id: 'tag-curator-run-benchmark',
      name: 'Run benchmark',
      callback: () => this.runAll(),
    });
  }

  async runAll() {
    new Notice('Tag Curator benchmark starting…');
    const t0 = performance.now();
    const rows: Row[] = [];
    rows.push(this.measureLoad());
    rows.push(await this.measureObserverOverhead());
    rows.push(...(await this.measureMetadataRate()));
    rows.push(...this.measureMemory());
    rows.push(await this.measureFilterApply());
    const dur = (performance.now() - t0).toFixed(0);
    console.table(rows);
    new BenchReportModal(this.plugin.app, this.toMarkdown(rows, dur)).open();
    new Notice(`Benchmark done in ${dur}ms`);
  }

  private measureLoad(): Row {
    const s = (globalThis as any).__tcLoadStart;
    const e = (globalThis as any).__tcLoadEnd;
    const ms = (typeof s === 'number' && typeof e === 'number') ? e - s : NaN;
    return {
      metric: 'Plugin load (ms)', n: 1,
      p50: fmt(ms), p95: fmt(ms), p99: fmt(ms), max: fmt(ms),
      verdict: verdict(ms, THRESH.load.green, THRESH.load.yellow),
    };
  }

  private async measureObserverOverhead(): Promise<Row> {
    const samples: Sample[] = [];
    const target = document.querySelector<HTMLElement>('.tag-container, .nav-files-container') ?? document.body;
    const probe = new MutationObserver((muts) => {
      const t = performance.now();
      for (const m of muts) void m.target.nodeName;
      samples.push(performance.now() - t);
    });
    probe.observe(target, { childList: true, subtree: true, characterData: true });
    const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const ed = view?.editor;
    for (let i = 0; i < 200; i++) {
      if (ed) {
        const c = ed.getCursor();
        ed.replaceRange('x', c);
        ed.replaceRange('', c, { line: c.line, ch: c.ch + 1 });
      } else {
        const sp = document.createElement('span');
        target.appendChild(sp); target.removeChild(sp);
      }
      await new Promise(r => setTimeout(r, 4));
    }
    await new Promise(r => setTimeout(r, 50));
    probe.disconnect();
    const s = stats(samples);
    return {
      metric: 'DOM observer callback (ms)', n: s.n,
      p50: fmt(s.p50), p95: fmt(s.p95), p99: fmt(s.p99), max: fmt(s.max),
      verdict: verdict(s.p95, THRESH.obsCallback.green, THRESH.obsCallback.yellow),
    };
  }

  private async measureMetadataRate(): Promise<Row[]> {
    const cache = this.plugin.app.metadataCache;
    let count = 0;
    const handler = () => { count++; };
    cache.on('changed' as any, handler);
    count = 0;
    const tA = performance.now();
    await this.simulateTypicalEditing(2000);
    const ratesTypical = (count * 1000) / (performance.now() - tA);
    count = 0;
    const tB = performance.now();
    await this.simulateBulkRename(50);
    const ratesHeavy = (count * 1000) / (performance.now() - tB);
    cache.off('changed' as any, handler);
    const mk = (label: string, rate: number, t: { green: number; yellow: number }): Row => ({
      metric: label, n: 1, p50: fmt(rate), p95: fmt(rate), p99: fmt(rate), max: fmt(rate),
      verdict: verdict(rate, t.green, t.yellow),
    });
    return [
      mk("metadataCache 'changed' typical evt/s", ratesTypical, THRESH.cacheRate),
      mk("metadataCache 'changed' heavy evt/s", ratesHeavy, { green: 500, yellow: 2000 }),
    ];
  }

  private async simulateTypicalEditing(ms: number) {
    const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const ed = view?.editor;
    const end = performance.now() + ms;
    while (performance.now() < end) {
      if (ed) {
        const c = ed.getCursor();
        ed.replaceRange(' #t', c);
        ed.replaceRange('', c, { line: c.line, ch: c.ch + 3 });
      }
      await new Promise(r => setTimeout(r, 30));
    }
  }

  private async simulateBulkRename(nFiles: number) {
    const files = this.plugin.app.vault.getMarkdownFiles().slice(0, nFiles);
    await Promise.all(files.map((f: TFile) =>
      this.plugin.app.vault.process(f, (txt) =>
        txt.includes('#bench-x') ? txt.replace(/#bench-x/g, '#bench-y') : txt + '\n#bench-x\n')
    ));
    await new Promise(r => setTimeout(r, 200));
  }

  private measureMemory(): Row[] {
    const m: any = (performance as any).memory ?? null;
    const proc: any = (globalThis as any).process?.memoryUsage?.() ?? null;
    const heapMB = m ? m.usedJSHeapSize / 1048576 : proc ? proc.heapUsed / 1048576 : NaN;
    const noteCount = this.plugin.app.vault.getMarkdownFiles().length;
    const bucket = noteCount < 5000 ? '1k' : noteCount < 25000 ? '10k' : '50k';
    const t = bucket === '1k' ? { green: 15, yellow: 40 } : bucket === '10k' ? THRESH.heap10k : { green: 120, yellow: 250 };
    return [{
      metric: `Heap @ ${bucket} notes (${noteCount}) MB`, n: 1,
      p50: fmt(heapMB), p95: fmt(heapMB), p99: fmt(heapMB), max: fmt(heapMB),
      verdict: verdict(heapMB, t.green, t.yellow),
    }];
  }

  private async measureFilterApply(): Promise<Row> {
    const applyFilter = (this.plugin as any).applyHideList?.bind(this.plugin);
    if (!applyFilter) {
      return { metric: 'Filter apply (applyHideList missing)', n: 0, p50: '—', p95: '—', p99: '—', max: '—', verdict: '—' };
    }
    const samples: Sample[] = [];
    for (let i = 0; i < 10; i++) {
      await this.remountTagPane();
      const t = performance.now();
      await applyFilter();
      samples.push(performance.now() - t);
    }
    const s = stats(samples);
    return {
      metric: 'Filter apply on tag pane (ms)', n: s.n,
      p50: fmt(s.p50), p95: fmt(s.p95), p99: fmt(s.p99), max: fmt(s.max),
      verdict: verdict(s.p95, THRESH.filterApply.green, THRESH.filterApply.yellow),
    };
  }

  private async remountTagPane() {
    const ws = this.plugin.app.workspace;
    for (const l of ws.getLeavesOfType('tag')) l.detach();
    const leaf = ws.getRightLeaf(false);
    if (leaf) await leaf.setViewState({ type: 'tag' });
    await new Promise(r => setTimeout(r, 50));
  }

  private toMarkdown(rows: Row[], dur: string): string {
    const head = `| Metric | n | p50 | p95 | p99 | max | |\n|---|--:|--:|--:|--:|--:|:-:|`;
    const body = rows.map(r => `| ${r.metric} | ${r.n} | ${r.p50} | ${r.p95} | ${r.p99} | ${r.max} | ${r.verdict} |`).join('\n');
    return `# Tag Curator benchmark report\n\n_Total: ${dur} ms_\n\n${head}\n${body}\n`;
  }
}

class BenchReportModal extends Modal {
  constructor(app: App, private md: string) { super(app); }
  onOpen() {
    this.titleEl.setText('Tag Curator benchmark');
    this.contentEl.createEl('pre').setText(this.md);
    const btn = this.contentEl.createEl('button', { text: 'Copy markdown' });
    btn.onclick = () => navigator.clipboard.writeText(this.md);
  }
}
```

### A.2 Synthetic vault generator (`scripts/gen-vault.ts`)

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';

interface Opts {
  notes: number; out: string;
  rootTags: number; l2Tags: number; l3Tags: number;
  alpha: number; frontmatterPct: number; multilingualPct: number; seed: number;
}
const DEFAULTS: Opts = {
  notes: 10_000, out: './bench-vault',
  rootTags: 50, l2Tags: 200, l3Tags: 600,
  alpha: 1.2, frontmatterPct: 0.6, multilingualPct: 0.1, seed: 42,
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROOT_EN = ['work','personal','project','note','idea','ref','todo','read','watch','book','paper','meeting','journal','health','finance','travel','food','music','code','design','research','learning','quote','question','goal'];
const ROOT_CYR = ['работа','заметка','идея','книга','проект','день','вопрос'];
const ROOT_CJK = ['仕事','読書','旅行','学习','项目','会议','笔记'];
const ROOT_EMOJI = ['🚀','🔥','📚','🧠','✅','💡','🎯','🐛'];

function buildVocab(o: Opts, rand: () => number) {
  const mlPool = [...ROOT_CYR, ...ROOT_CJK, ...ROOT_EMOJI];
  const roots: string[] = [];
  for (let i = 0; i < o.rootTags; i++) {
    const useMl = rand() < o.multilingualPct;
    const src = useMl ? mlPool : ROOT_EN;
    roots.push(src[Math.floor(rand() * src.length)] + (useMl ? '' : `-${i}`));
  }
  const l2: string[] = [];
  for (let i = 0; i < o.l2Tags; i++) l2.push(`${roots[Math.floor(rand() * roots.length)]}/sub-${i}`);
  const l3: string[] = [];
  for (let i = 0; i < o.l3Tags; i++) l3.push(`${l2[Math.floor(rand() * l2.length)]}/leaf-${i}`);
  return [...roots, ...l2, ...l3];
}

function zipfSampler(n: number, alpha: number, rand: () => number) {
  const w = new Array(n); let total = 0;
  for (let k = 1; k <= n; k++) { w[k - 1] = 1 / Math.pow(k, alpha); total += w[k - 1]; }
  const cum = new Array(n); let c = 0;
  for (let i = 0; i < n; i++) { c += w[i] / total; cum[i] = c; }
  return () => {
    const r = rand(); let lo = 0, hi = n - 1;
    while (lo < hi) { const m = (lo + hi) >>> 1; if (cum[m] < r) lo = m + 1; else hi = m; }
    return lo;
  };
}

const SENTENCES = [
  'The quick brown fox jumps over the lazy dog.',
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  'Быстрая бурая лиса прыгает через ленивую собаку.',
  '素早い茶色のキツネが怠け者の犬を飛び越える。',
  'Lists make notes scannable, headers make them navigable.',
];

function makeBody(tags: string[], rand: () => number, useFm: boolean) {
  const inline = tags.filter((_, i) => i % 2 === 0).map(t => `#${t}`);
  const fmTags = tags.filter((_, i) => i % 2 === 1);
  const fm = useFm ? `---\ntags:\n${fmTags.map(t => `  - ${t}`).join('\n')}\n---\n\n` : '';
  const paragraphs: string[] = [];
  const nP = 1 + Math.floor(rand() * 4);
  for (let p = 0; p < nP; p++) {
    const s: string[] = [];
    const nS = 1 + Math.floor(rand() * 4);
    for (let i = 0; i < nS; i++) s.push(SENTENCES[Math.floor(rand() * SENTENCES.length)]);
    if (rand() < 0.4 && inline.length) s.push(inline.splice(0, 1 + Math.floor(rand() * 2)).join(' '));
    paragraphs.push(s.join(' '));
  }
  if (inline.length) paragraphs.push(inline.join(' '));
  return fm + paragraphs.join('\n\n') + '\n';
}

function parseArgs(): Opts {
  const o: Opts = { ...DEFAULTS };
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i += 2) {
    const k = a[i].replace(/^--/, '') as keyof Opts;
    const v = a[i + 1];
    (o as any)[k] = isNaN(Number(v)) ? v : Number(v);
  }
  return o;
}

function main() {
  const o = parseArgs();
  const rand = rng(o.seed);
  fs.mkdirSync(o.out, { recursive: true });
  const vocab = buildVocab(o, rand);
  const sample = zipfSampler(vocab.length, o.alpha, rand);
  const FOLDERS = 32;
  for (let f = 0; f < FOLDERS; f++) fs.mkdirSync(path.join(o.out, `f${f}`), { recursive: true });
  const t0 = Date.now();
  for (let i = 0; i < o.notes; i++) {
    const nTags = 1 + Math.floor(rand() * 7);
    const tags = new Set<string>();
    while (tags.size < nTags) tags.add(vocab[sample()]);
    const useFm = rand() < o.frontmatterPct;
    const body = makeBody([...tags], rand, useFm);
    const folder = `f${i % FOLDERS}`;
    fs.writeFileSync(path.join(o.out, folder, `note-${i.toString().padStart(6, '0')}.md`), body);
    if (i % 1000 === 0) console.log(`  ${i}/${o.notes}`);
  }
  fs.mkdirSync(path.join(o.out, '.obsidian'), { recursive: true });
  fs.writeFileSync(path.join(o.out, '.obsidian/app.json'), JSON.stringify({ promptDelete: false }, null, 2));
  console.log(`Done in ${(Date.now() - t0) / 1000}s. Open '${o.out}' in Obsidian.`);
}
main();
```

### A.3 Plugin skeleton (`src/main.ts`)

```ts
import { Plugin, Platform } from 'obsidian';
import { TagCuratorSettings, DEFAULT_SETTINGS, TagCuratorSettingTab } from './settings';
import { TagPaneFilter } from './dom/tagPaneFilter';
import { TagWranglerBridge } from './integrations/tagWrangler';
import { NotebookNavigatorBridge } from './integrations/notebookNavigator';
import { ColoredTagsWranglerBridge } from './integrations/coloredTagsWrangler';
import { TagCuratorBench } from './dev/benchmark';

export default class TagCuratorPlugin extends Plugin {
  settings!: TagCuratorSettings;
  private filter!: TagPaneFilter;
  private tw!: TagWranglerBridge;
  private nn!: NotebookNavigatorBridge;
  private ctw!: ColoredTagsWranglerBridge;

  async onload() {
    TagCuratorBench.markStart();
    await this.loadSettings();
    this.addSettingTab(new TagCuratorSettingTab(this.app, this));

    this.filter = new TagPaneFilter(this);
    this.tw = new TagWranglerBridge(this);
    this.nn = new NotebookNavigatorBridge(this.app, this);
    this.ctw = new ColoredTagsWranglerBridge(this);

    this.app.workspace.onLayoutReady(async () => {
      this.filter.attachAll();
      if (this.tw.isAvailable()) {
        this.tw.registerContextMenu((menu, tag) => {
          menu.addItem(i => i.setTitle(`Curate "${tag}"`).setIcon('tag').onClick(() => this.openCuratorFor(tag)));
        });
      }
      await this.nn.init();
      this.nn.registerTagMenu(tag => [{ title: 'Curate this tag', onClick: () => this.openCuratorFor(tag) }]);
      this.ctw.init();
    });

    this.registerEvent(this.app.workspace.on('layout-change', () => this.filter.attachAll()));
    this.registerEvent(this.app.metadataCache.on('resolved', () => this.filter.scheduleRerender()));
    this.registerEvent(this.app.metadataCache.on('changed', () => this.filter.scheduleRerender()));

    if (process.env.NODE_ENV === 'development') {
      new TagCuratorBench(this).registerCommand();
    }
    TagCuratorBench.markReady();
  }

  async loadSettings() {
    const raw = (await this.loadData()) ?? {};
    this.settings = { ...DEFAULT_SETTINGS, ...raw };
    if ((this.settings.schemaVersion ?? 0) < 1) {
      this.settings.schemaVersion = 1;
      await this.saveData(this.settings);
    }
  }
  async saveSettings() { await this.saveData(this.settings); }
  applyHideList() { this.filter.applyAll(); } // exposed for benchmark
  openCuratorFor(_tag: string) { /* TODO modal */ }
}
```

---

## Appendix B: References

### Primary documentation
- https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
- https://docs.obsidian.md/Plugins/Getting+started/Mobile+development
- https://docs.obsidian.md/Reference/TypeScript+API/Plugin
- https://docs.obsidian.md/Reference/TypeScript+API/MetadataCache
- https://docs.obsidian.md/Reference/TypeScript+API/CachedMetadata
- https://docs.obsidian.md/Reference/TypeScript+API/TagCache
- https://docs.obsidian.md/Reference/TypeScript+API/Workspace
- https://docs.obsidian.md/Reference/TypeScript+API/Platform
- https://docs.obsidian.md/Reference/Manifest
- https://docs.obsidian.md/Reference/CSS+variables/Components/Multi-select
- https://docs.obsidian.md/Developer+policies
- https://help.obsidian.md/tags
- https://help.obsidian.md/sidebar
- https://obsidian.md/changelog/

### Obsidian repos
- https://github.com/obsidianmd/obsidian-sample-plugin
- https://github.com/obsidianmd/obsidian-api
- https://github.com/obsidianmd/obsidian-releases
- https://github.com/obsidianmd/obsidian-help/issues/816 (tags doc inaccuracy)

### Community type definitions and tooling
- https://github.com/Fevol/obsidian-typings (v3.16.0, April 2026)
- https://www.npmjs.com/package/obsidian-typings
- https://github.com/obsidian-community/jest-environment-obsidian
- https://github.com/TfTHacker/obsidian42-brat (BRAT v2.0.4)

### Integration plugins
- https://github.com/pjeby/tag-wrangler (0.6.4, March 2025)
- https://github.com/johansan/notebook-navigator (API 2.0.0, March 2026)
- https://github.com/johansan/notebook-navigator/blob/main/docs/api-reference.md
- https://github.com/code-of-chaos/obsidian-colored_tags_wrangler (0.19.4, October 2025)
- https://github.com/pjeby/tag-wrangler/issues/31 (mobile context menu rationale)

### Reference plugins
- https://github.com/platers/obsidian-linter
- https://github.com/blacksmithgu/obsidian-dataview
- https://github.com/obsidian-tasks-group/obsidian-tasks
- https://github.com/SilentVoid13/Templater
- https://github.com/liamcain/obsidian-calendar-plugin
- https://github.com/Developer-Mike/obsidian-advanced-canvas/issues/155 (canvas metadata cache opt-in)
- https://github.com/EzraMarks/obsidian-bases-css-guide (Nov 2025 Bases selector break)
- https://github.com/fanis/obsidian-style-tags-in-search-results

### Forum threads
- https://forum.obsidian.md/t/3645 (tag pane CSS, 2020)
- https://forum.obsidian.md/t/105697 (app.css dump, Sep 2025)
- https://forum.obsidian.md/t/66621 (graph view PIXI.js)
- https://forum.obsidian.md/t/67394 (frontmatter cache update bug)
- https://forum.obsidian.md/t/35886 (getAllTags empty array)
- https://forum.obsidian.md/t/47621 (frontmatter formatting)
- https://forum.obsidian.md/t/105057 (emoji-as-tag bug)
- https://forum.obsidian.md/t/71870 (period in tags)
- https://forum.obsidian.md/t/46636 (iOS lookbehind crash)
- https://forum.obsidian.md/t/34656 (Tag Wrangler on Android)
- https://forum.obsidian.md/t/59037 (emulateMobile vs real)
- https://forum.obsidian.md/t/112436 (properties tags clipping)

### Issue trackers cited for performance synthesis
- Dataview #1154, #1159, #1064, #2503
- Linter #304, #872, #1268
- Tasks #697, PR #894, #2737, #2275, discussions #2628, #3244
- Notebook Navigator release 2.3.0 notes, PR #6886

Access dates: all April 28–30, 2026.

---

## Appendix C: Open Questions Remaining

Three items remain that could not be resolved from public sources within the research time-box. Each is paired with the empirical test that would resolve it.

### C.1 Notebook Navigator hidden-tags settings shape

**Question:** What is the exact key name and value shape of NN's hidden-tags list in `.obsidian/plugins/notebook-navigator/data.json` on API 2.0.0?

**Why it matters:** If Tag Curator is to read or write NN's hidden-tags via settings file (since it's not in the public API), the shape must be exactly correct.

**Empirical test:** Install NN 2.x in a test vault, add 2–3 hidden tags via NN's settings UI (one root, one nested), then `cat .obsidian/plugins/notebook-navigator/data.json | jq '.'` to inspect the key path and array shape. Confirm whether tags include leading `#` and whether nested tags are stored as `"a/b"` or split.

### C.2 Tag Wrangler exact `workspace.trigger` call site

**Question:** Where in Tag Wrangler 0.6.4's bundled `tag-wrangler.js` does the `workspace.trigger('tag-wrangler:contextmenu', ...)` call happen? Any conditional gates (e.g., does it skip the trigger when `info.tagPage` is undefined)?

**Why it matters:** Confirms the contract documented in the README and reveals any edge cases where the event will not fire (e.g., on tag pages already open, on aliases).

**Empirical test:** Clone the repo, `grep -rn "tag-wrangler:contextmenu" src/`. Read the surrounding 20 lines. Verify the README contract holds in current source.

### C.3 Bases tag-cell DOM stability post-1.10.0

**Question:** What is the current (April 2026) stable selector path for tag-typed columns inside Bases Table and Cards views? The November 2025 update broke the `link()` rendering pattern; have the user-visible cell selectors stabilized?

**Why it matters:** Determines whether Tag Curator's Bases support can ship in v0.1 or must defer to v0.2 with a feature flag.

**Empirical test:** Open a Bases file in Obsidian 1.10.0+ with a `tags` column, inspect via DevTools, document the actual cell DOM (whether it's `.bases-td[data-property-key="tags"]` containing `.multi-select-pill` or has shifted again). Run the same inspection on each subsequent Obsidian release until 1.12.x stabilizes the API.

---

## Things I am unsure about

- **Linter and Tag Wrangler exact current `minAppVersion`** values (raw GitHub fetches were tooling-blocked). The recommendation of `minAppVersion: 1.9.10` for Tag Curator is independent of these, but the comparative table is partially based on inference. (🔴 → 🟡 if verified.)
- **`onUserDisable` exact contract** in 1.7.2+: lightly documented; may not fire on app quit, only on explicit toggle. Don't depend on it for critical cleanup; use `onunload` for that.
- **Notebook Navigator profile-switching internals** beyond the README/release-notes description. The exact file path of the `ProfileService` was not enumerable; the schema sketch in §6.3 is inferred from feature descriptions.
- **`performance.memory` precision**: Chromium-only and approximate without `--enable-precise-memory-info`. The benchmark harness's heap numbers are useful for relative comparison, less useful as absolute MB.
- **Bases internals post-1.10.0**: the API surface is too new for high-confidence claims. Treat any Bases integration as v0.2 work.
- **Whether Obsidian's tag pane will remain eager (non-virtualized)**: this could change if vaults grow into the millions-of-tags range. Current confidence is observational, not architectural.