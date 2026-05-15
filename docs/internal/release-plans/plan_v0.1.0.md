# Tag Curator v0.1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a robust, attractive, BRAT-distributable v0.1.0 of the Tag Curator Obsidian plugin that delivers tag-pane filtering with a rule engine, a sortable tag-list view, five built-in presets, an honest panic-disable, hidden-tag diagnostics, and full reversibility - all without modifying user note content.

**Architecture:** DOM-only filtering on the native tag pane via a scoped `MutationObserver` (no monkey-patching of Obsidian internals, no metadata patching). Rules evaluate against an in-memory tag-metadata sidecar driven by `metadataCache` events. Two persistent JSON files in `.obsidian/plugins/tag-curator/`: `data.json` for settings, rules, profiles; `tags.json` for per-tag metadata (firstSeen, lastSeen, count, sources). Mobile-safe regex, schema-versioned migrations, atomic-cleanup contract on unload.

**Tech Stack:** TypeScript 5.6, esbuild 0.24 (CJS bundle), Obsidian Plugin API (minAppVersion 1.9.10), no runtime dependencies. ESLint with `@typescript-eslint`. GitHub Actions for build + tagged release. No telemetry, no network calls, local-first.

**Source documents (in `docs/internal/discovery/`):**
- `tag-curator-spec_opus-4.7_2026-04-30.md` (spec, §9 roadmap = v0.1 scope)
- `implementation-plan_opus-4.7_deep-research_2026-04-30.md` (primary-source API contracts)
- `tag-curator-project-overview_chatgpt-5.5_2026-05-05.md` (executive synthesis, MVP framing)
- `ui-ideas/*.png` (directional mockups; treat v0.2+ surface area as deferred)

**Out of scope for v0.1.0 (deferred per spec §9):**
- Graph view scope, autocomplete scope, properties chip scope, hover preview, Bases, quick switcher (v0.2+)
- Aliases / display-merge (v0.3)
- Profiles (v0.3)
- Tag Wrangler / Notebook Navigator / Colored Tags Wrangler integrations (v0.3-v0.4)
- Inbox mode, suggested merges, export/import, community rule packs (v0.3-v0.4)
- Onboarding wizard (v0.2 - defer; v0.1 ships safe defaults instead)

**Scope held for v0.1.0 (per spec §9 + overview "Recommended MVP" + minimal robust polish):**
- Three-match-type rule engine (regex, frequency, list) with last-match-wins
- Hide action only, tag-pane scope only
- 5 built-in presets (hex, URL anchor, single-char, orphan, numeric)
- Custom rule editor with live test
- Tag list view (sortable, searchable, status column showing rule attribution)
- Panic disable command (full DOM cleanup, kill switch)
- Dry-run mode (visible flag instead of hidden)
- Status bar showing hidden-tag count (clickable to open tag list)
- "Why is this tag hidden?" diagnostic surfaced in tag list and via context menu on tag-pane row
- Schema-versioned settings and atomic disk writes
- Master enable/disable toggle (functioning, not stub)
- Reload-on-`onExternalSettingsChange()` for Obsidian Sync compatibility
- iOS-safe regex throughout
- Polished settings tab with grouped sections, sentence-case strings, `Setting().setHeading()` (no raw `<h2>` rejection risk)
- README polished to community-plugin-directory standard
- CHANGELOG kept current
- GitHub Actions release workflow that ships `manifest.json`, `main.js`, `styles.css` on tag push
- ESLint config locked in, lint passing on CI

---

## Pre-flight: Self-Audit Findings the Plan Addresses

These are concrete defects in the current `src/` tree that the plan repairs. Each cross-references a task.

| # | Defect | Why it matters | Repaired by |
|---|---|---|---|
| 1 | `SettingsManager` and `TagMetaManager` both call `plugin.loadData()` / `plugin.saveData()` against the same single `data.json`. Writes race and clobber each other. | Data loss; metadata sidecar overwritten on every settings save. | Task 3 (split storage) |
| 2 | `app.metadataCache.on('changed', ...)` in `tagMeta.ts` is raw, not wrapped with `registerEvent`. | Event listener leak on plugin disable. | Task 5 (lifecycle hygiene) |
| 3 | `app.workspace.on('layout-change', ...)` in `tagPaneObserver.ts` is raw, not wrapped with `registerEvent`. | Listener leak. | Task 4 (observer hygiene) |
| 4 | `TagPaneObserver.setup()` only inspects `leaves[0]`. Users with multiple tag panes get partial filtering. | Visible inconsistency; surprises power users. | Task 4 (multi-pane support) |
| 5 | Toggle command (`toggle-tag-curator`) logs to console and does nothing. | Master toggle and panic disable both missing. | Tasks 7, 8 |
| 6 | Status bar text is "Tag Curator: Ready" forever; never reflects hidden-tag count. | Spec §8.3 "where did my tag go?" prevention requires it. | Task 9 |
| 7 | No "Why is this tag hidden?" diagnostic anywhere. | Spec §5.9 diagnostic is core to discoverability. | Task 10 |
| 8 | `manifest.json` `minAppVersion: 1.5.0`; implementation plan recommends `1.9.10`. | Forward-compat with Properties era and Bases; lower bound is a maintenance trap. | Task 14 |
| 9 | `settingsTab.ts` uses raw `containerEl.createEl('h2', ...)` for headings. | Common community-plugin-directory rejection reason. | Task 11 (use `Setting().setHeading()`) |
| 10 | No `schemaVersion` migration scaffolding in settings. | Painful to upgrade users on v0.2. | Task 2 |
| 11 | `getActiveRules()` adds preset rules unconditionally as enabled, ignoring the `enabled: false` defaults in `PRESETS`. | Users can't disable a preset they toggled off; toggle and load logic disagree. | Task 6 |
| 12 | No `panic-disable` command. | Spec §7.6 safety contract. | Task 8 |
| 13 | Dry-run setting exists but does nothing. | Spec §5.2 dry-run is part of v0.1. | Task 7 |
| 14 | Tag-pane filtering uses inline `style.display = 'none'`, not class-based. | Spec §2.4 prescribes class-based hiding for re-show without DOM diffing; also defeats theming. | Task 4 |
| 15 | `tagPaneObserver` does not set `aria-hidden="true"` or preserve tree-item integrity. | Spec §2.2 accessibility rule; users with screen readers and Obsidian's internal indexer both depend on it. | Task 4 |
| 16 | `tagListView.ts` "tag" column displays `#${tagMeta.tag}` (the tag is already without `#` in storage but `tagPaneObserver` compares with `slice(1)` - inconsistent). | Bug surface; tag aliasing in v0.3 will trip on this. | Task 3 (normalize via `getAllTags` helper) |
| 17 | No ESLint config file despite `lint` script in `package.json`. | CI lint step exists in workflow but fails-by-design. | Task 16 |
| 18 | No `versions.json` entry for 1.9.10. | Auto-update breaks if not aligned. | Task 14 |
| 19 | README and CHANGELOG reference v0.2 ETA but no release notes section in repo for v0.1.0 rollout. | Submission hygiene. | Task 17 |
| 20 | No `release.yml` GitHub Actions for tagged-release artifact upload of `styles.css`. Current `build.yml` includes `versions.json` but spec recommends `main.js`/`manifest.json`/`styles.css` triple. | BRAT installs fail without `styles.css` if any styling is intentional. | Task 15 |

---

## File Structure

Final v0.1.0 source layout. Files marked **MODIFY** exist; files marked **CREATE** do not yet exist; files marked **REPLACE** exist but the plan rewrites them substantially.

```
obsidian-tag-curator/
├── manifest.json                                 MODIFY (Task 14)
├── versions.json                                 MODIFY (Task 14)
├── package.json                                  MODIFY (Task 16)
├── esbuild.config.mjs                            (unchanged)
├── styles.css                                    MODIFY (Task 12)
├── tsconfig.json                                 MODIFY (Task 1: strict + target alignment)
├── .eslintrc.cjs                                 CREATE (Task 16)
├── README.md                                     REPLACE (Task 17)
├── CHANGELOG.md                                  MODIFY (Task 17)
├── LICENSE                                       (unchanged)
├── .github/
│   └── workflows/
│       ├── build.yml                             MODIFY (Task 15)
│       └── release.yml                           CREATE (Task 15)
├── src/
│   ├── main.ts                                   REPLACE (Tasks 5, 7, 8, 9)
│   ├── types.ts                                  MODIFY (Task 1: add schemaVersion, Profile stub, narrow MatchCriteria, etc.)
│   ├── engine/
│   │   ├── matchers.ts                           MODIFY (Task 6: iOS-safe regex compile, error surface)
│   │   ├── ruleEngine.ts                         (unchanged - already correct)
│   │   └── presets.ts                            MODIFY (Task 6: fix patterns, all enabled-by-default false except hex+URL)
│   ├── observers/
│   │   └── tagPaneObserver.ts                    REPLACE (Task 4: multi-pane, class-based, ARIA, registerEvent)
│   ├── storage/
│   │   ├── settings.ts                           REPLACE (Task 2: schemaVersion, atomic writes, profiles stub)
│   │   └── tagMeta.ts                            REPLACE (Task 3: own file `tags.json` via vault.adapter, debounced, registerEvent)
│   ├── ui/
│   │   ├── settingsTab.ts                        REPLACE (Task 11: Setting().setHeading(), sentence-case, sections)
│   │   ├── tagListView.ts                        MODIFY (Tasks 10, 13: diagnostic column, filter chips, hidden-only view)
│   │   ├── ruleEditor.ts                         MODIFY (Task 6: scope checkbox, action selector, live preview list)
│   │   └── panicDisable.ts                       CREATE (Task 8: standalone cleanup utility)
│   └── util/
│       ├── tagUtils.ts                           CREATE (Task 3: normalize, getAllTags wrapper)
│       └── safeRegex.ts                          CREATE (Task 6: iOS-safe regex compile + validate)
└── docs/
    └── internal/
        └── release-plans/
            └── plan_v0.1.0.md                    THIS FILE
```

Notes on decomposition:
- Storage is split into two files (`data.json`, `tags.json`) because the current single-file collision is a correctness bug. Tag metadata grows with vault size and is rewritten on every edit; settings are small and rewrite on user action. Different write cadences = different files.
- `util/safeRegex.ts` exists because every regex in this plugin must be iOS-lookbehind-safe. Centralizing the compile keeps that contract enforceable.
- `ui/panicDisable.ts` is split out so it works even if the rest of the plugin's UI fails to load (spec §7.6 "panic disable nukes all DOM modifications even if settings UI fails to load").

---

## Pre-Task: Verify clean working tree

- [ ] **Step 1: Confirm git is clean and on `main`**

Run: `git status --short && git rev-parse --abbrev-ref HEAD`
Expected: empty output for status, `main` for branch.

- [ ] **Step 2: Install dependencies and confirm build works against current code**

Run:
```bash
npm ci
npm run build
ls main.js
```
Expected: `main.js` exists, no esbuild errors.

- [ ] **Step 3: Create a working branch for this plan**

Run: `git checkout -b release/v0.1.0`
Expected: switched to new branch.

---

## Task 1: Lock TypeScript settings and types

**Files:**
- Modify: `tsconfig.json`
- Modify: `src/types.ts`

**Why this task is first:** Every later task references types. Lock the schema-versioned settings shape and the iOS-safe scope/action enums now so downstream tasks compile against a stable surface.

- [ ] **Step 1: Read current `tsconfig.json`**

Run: `cat tsconfig.json`

- [ ] **Step 2: Replace `tsconfig.json` contents**

Write `tsconfig.json` as:
```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES2022",
    "allowJs": true,
    "noImplicitAny": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "isolatedModules": true,
    "strictNullChecks": true,
    "strict": true,
    "lib": ["DOM", "ES5", "ES6", "ES7", "ES2020", "ES2022"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Replace `src/types.ts` contents**

Write `src/types.ts` as:
```typescript
export const SCHEMA_VERSION = 1;

export type Mode = 'default' | 'allow-only' | 'inbox';

export type Action = 'hide' | 'show-only' | 'flag' | 'group' | 'delegate-color';

export type Scope =
  | 'tag-pane'
  | 'graph'
  | 'local-graph'
  | 'autocomplete'
  | 'properties'
  | 'search-facets'
  | 'quick-switcher'
  | 'backlinks'
  | 'hover-preview'
  | 'bases'
  | 'notebook-navigator'
  | 'tag-wrangler-menu';

export type MatchType = 'regex' | 'frequency' | 'list';
export type FrequencyOperator = '<' | '<=' | '>' | '>=' | '=';

export interface MatchCriteria {
  type: MatchType;
  pattern?: string;
  operator?: FrequencyOperator;
  value?: number;
  list?: string[];
}

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  match: MatchCriteria;
  action: Action;
  scopes: Scope[];
  notes?: string;
  builtin?: boolean;
}

export type TagSource = 'frontmatter' | 'inline';

export interface TagMeta {
  tag: string;
  firstSeen: number;
  lastSeen: number;
  count: number;
  sources: TagSource[];
  description?: string;
  aliases?: string[];
  reviewed?: boolean;
}

export interface TagCuratorSettings {
  schemaVersion: number;
  enabled: boolean;
  mode: Mode;
  defaultScopes: Scope[];
  enabledPresets: string[];
  customRules: Rule[];
  dryRun: boolean;
  debugLog: boolean;
  sidecarDebounceMs: number;
}

export const DEFAULT_SETTINGS: TagCuratorSettings = {
  schemaVersion: SCHEMA_VERSION,
  enabled: true,
  mode: 'default',
  defaultScopes: ['tag-pane'],
  enabledPresets: ['hide-hex-codes', 'hide-url-anchors'],
  customRules: [],
  dryRun: false,
  debugLog: false,
  sidecarDebounceMs: 5000,
};

export interface RulePreset {
  id: string;
  name: string;
  description: string;
  rule: Rule;
}

export interface MatchResult {
  matched: boolean;
  ruleId: string;
  ruleName: string;
}
```

- [ ] **Step 4: Build to verify types compile**

Run: `npm run build 2>&1 | tail -40`
Expected: esbuild reports the new errors from downstream files referencing the old shapes. These will be resolved task-by-task. The build will fail; that is OK at this point.

- [ ] **Step 5: Commit**

Run:
```bash
git add tsconfig.json src/types.ts
git commit -m "refactor(types): lock v0.1.0 settings shape with schemaVersion"
```

---

## Task 2: Schema-versioned settings storage with atomic writes

**Files:**
- Replace: `src/storage/settings.ts`

**Why:** Spec §6.2 + implementation plan §6 require schema versioning from v0.1, plus atomic writes. The current implementation co-occupies `data.json` with tag metadata, which is a write-race bug.

- [ ] **Step 1: Replace `src/storage/settings.ts`**

Write `src/storage/settings.ts` as:
```typescript
import { Plugin } from 'obsidian';
import {
  DEFAULT_SETTINGS,
  Rule,
  SCHEMA_VERSION,
  TagCuratorSettings,
} from '../types';

type LegacyV0Settings = Partial<TagCuratorSettings> & {
  rules?: Rule[];
  enabledRules?: string[];
  tagMetadata?: unknown;
};

export class SettingsManager {
  private plugin: Plugin;
  private settings: TagCuratorSettings = { ...DEFAULT_SETTINGS };
  private listeners: Array<() => void> = [];

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  async load(): Promise<void> {
    const raw = ((await this.plugin.loadData()) ?? {}) as LegacyV0Settings;
    this.settings = this.migrate(raw);
    if (this.settings.schemaVersion !== SCHEMA_VERSION) {
      this.settings.schemaVersion = SCHEMA_VERSION;
      await this.persist();
    }
  }

  private migrate(raw: LegacyV0Settings): TagCuratorSettings {
    const inferred = (raw.schemaVersion ?? 0) as number;
    const nested = (raw as { settings?: Partial<TagCuratorSettings> }).settings;
    const base: Partial<TagCuratorSettings> = nested ?? raw;
    const merged: TagCuratorSettings = {
      ...DEFAULT_SETTINGS,
      ...base,
      schemaVersion: SCHEMA_VERSION,
      customRules: Array.isArray(raw.rules)
        ? raw.rules
        : Array.isArray(base.customRules)
          ? base.customRules
          : [],
    };
    if (inferred < 1) {
      const enabledIds = new Set(raw.enabledRules ?? []);
      merged.customRules = merged.customRules.map((r) => ({
        ...r,
        enabled: r.enabled ?? enabledIds.has(r.id),
      }));
    }
    return merged;
  }

  private async persist(): Promise<void> {
    await this.plugin.saveData(this.settings);
    for (const cb of this.listeners) cb();
  }

  get(): TagCuratorSettings {
    return this.settings;
  }

  async update(partial: Partial<TagCuratorSettings>): Promise<void> {
    this.settings = { ...this.settings, ...partial };
    await this.persist();
  }

  async setPresetEnabled(presetId: string, enabled: boolean): Promise<void> {
    const set = new Set(this.settings.enabledPresets);
    if (enabled) set.add(presetId);
    else set.delete(presetId);
    this.settings.enabledPresets = Array.from(set);
    await this.persist();
  }

  async addCustomRule(rule: Rule): Promise<void> {
    this.settings.customRules = [...this.settings.customRules, rule];
    await this.persist();
  }

  async updateCustomRule(ruleId: string, partial: Partial<Rule>): Promise<void> {
    this.settings.customRules = this.settings.customRules.map((r) =>
      r.id === ruleId ? { ...r, ...partial } : r,
    );
    await this.persist();
  }

  async deleteCustomRule(ruleId: string): Promise<void> {
    this.settings.customRules = this.settings.customRules.filter(
      (r) => r.id !== ruleId,
    );
    await this.persist();
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.settings.enabled = enabled;
    await this.persist();
  }

  async setDryRun(dryRun: boolean): Promise<void> {
    this.settings.dryRun = dryRun;
    await this.persist();
  }

  onChange(cb: () => void): void {
    this.listeners.push(cb);
  }

  async reload(): Promise<void> {
    await this.load();
  }
}
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/storage/settings.ts
git commit -m "refactor(storage): schema-versioned settings with migration from v0"
```

---

## Task 3: Separate tag-metadata sidecar (`tags.json`)

**Files:**
- Create: `src/util/tagUtils.ts`
- Replace: `src/storage/tagMeta.ts`

**Why:** Resolves storage collision (defect #1). Per implementation plan §6.4, tag metadata grows with vault size and is written far more often than settings, so it gets its own file via `vault.adapter`. Per §5.2, tag extraction goes through the `getAllTags()` helper (defect #16) for correct normalization across inline and frontmatter sources.

- [ ] **Step 1: Create `src/util/tagUtils.ts`**

Write `src/util/tagUtils.ts` as:
```typescript
import { CachedMetadata, getAllTags as obsidianGetAllTags } from 'obsidian';

export function stripHash(tag: string): string {
  return tag.startsWith('#') ? tag.slice(1) : tag;
}

export function withHash(tag: string): string {
  return tag.startsWith('#') ? tag : `#${tag}`;
}

export function tagsFromCache(cache: CachedMetadata | null): string[] {
  if (!cache) return [];
  return (obsidianGetAllTags(cache) ?? []).map(stripHash);
}
```

- [ ] **Step 2: Replace `src/storage/tagMeta.ts`**

Write `src/storage/tagMeta.ts` as:
```typescript
import { App, Events, Plugin, TFile, normalizePath } from 'obsidian';
import { TagMeta, TagSource } from '../types';
import { tagsFromCache } from '../util/tagUtils';

interface PersistedTagMeta {
  schemaVersion: number;
  tags: Record<string, TagMeta>;
}

const SCHEMA = 1;

export class TagMetaManager extends Events {
  private app: App;
  private plugin: Plugin;
  private store = new Map<string, TagMeta>();
  private fileTags = new Map<string, Set<string>>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceMs = 5000;

  constructor(app: App, plugin: Plugin) {
    super();
    this.app = app;
    this.plugin = plugin;
  }

  setDebounceMs(ms: number): void {
    this.debounceMs = Math.max(500, ms);
  }

  private filePath(): string {
    const dir = this.plugin.manifest.dir ?? `.obsidian/plugins/${this.plugin.manifest.id}`;
    return normalizePath(`${dir}/tags.json`);
  }

  async load(): Promise<void> {
    const path = this.filePath();
    const adapter = this.app.vault.adapter;
    try {
      if (!(await adapter.exists(path))) {
        this.store = new Map();
        return;
      }
      const raw = await adapter.read(path);
      const parsed = JSON.parse(raw) as PersistedTagMeta;
      if (parsed.schemaVersion !== SCHEMA) {
        this.store = new Map();
        return;
      }
      this.store = new Map(Object.entries(parsed.tags ?? {}));
    } catch (e) {
      console.error('[tag-curator] tags.json corrupted, rebuilding', e);
      this.store = new Map();
    }
  }

  async scanAll(): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      this.indexFile(file);
    }
    this.flushNow();
  }

  indexFile(file: TFile): void {
    const cache = this.app.metadataCache.getFileCache(file);
    const inlineTags = (cache?.tags ?? []).map((t) => t.tag);
    const allTags = tagsFromCache(cache);
    const inlineSet = new Set(inlineTags.map((t) => (t.startsWith('#') ? t.slice(1) : t)));
    const now = Date.now();

    const previousTags = this.fileTags.get(file.path) ?? new Set<string>();
    const currentTags = new Set<string>(allTags);
    this.fileTags.set(file.path, currentTags);

    for (const tag of currentTags) {
      const source: TagSource = inlineSet.has(tag) ? 'inline' : 'frontmatter';
      this.touchTag(tag, source, now);
    }
    for (const tag of previousTags) {
      if (!currentTags.has(tag)) this.recomputeCount(tag);
    }
    this.scheduleSave();
    this.trigger('changed');
  }

  removeFile(filePath: string): void {
    const previous = this.fileTags.get(filePath);
    if (!previous) return;
    this.fileTags.delete(filePath);
    for (const tag of previous) this.recomputeCount(tag);
    this.scheduleSave();
    this.trigger('changed');
  }

  renameFile(oldPath: string, newPath: string): void {
    const existing = this.fileTags.get(oldPath);
    if (!existing) return;
    this.fileTags.delete(oldPath);
    this.fileTags.set(newPath, existing);
  }

  private touchTag(tag: string, source: TagSource, now: number): void {
    const existing = this.store.get(tag);
    if (!existing) {
      this.store.set(tag, {
        tag,
        firstSeen: now,
        lastSeen: now,
        count: 1,
        sources: [source],
      });
    } else {
      existing.lastSeen = now;
      if (!existing.sources.includes(source)) existing.sources.push(source);
    }
    this.recomputeCount(tag);
  }

  private recomputeCount(tag: string): void {
    let count = 0;
    for (const set of this.fileTags.values()) if (set.has(tag)) count++;
    const existing = this.store.get(tag);
    if (!existing) return;
    if (count === 0) this.store.delete(tag);
    else existing.count = count;
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushNow(), this.debounceMs);
  }

  private async flushNow(): Promise<void> {
    this.saveTimer = null;
    const payload: PersistedTagMeta = {
      schemaVersion: SCHEMA,
      tags: Object.fromEntries(this.store),
    };
    const adapter = this.app.vault.adapter;
    const path = this.filePath();
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
    await adapter.write(path, JSON.stringify(payload, null, 2));
  }

  get(tag: string): TagMeta | undefined {
    return this.store.get(tag);
  }

  all(): Map<string, TagMeta> {
    return new Map(this.store);
  }

  unload(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      void this.flushNow();
    }
  }
}
```

- [ ] **Step 3: Build to confirm compile**

Run: `npm run build 2>&1 | tail -40`
Expected: errors only in files this plan has not yet touched (`main.ts`, `tagPaneObserver.ts`, `settingsTab.ts`, `tagListView.ts`, `ruleEditor.ts`). The new storage compiles clean.

- [ ] **Step 4: Commit**

Run:
```bash
git add src/util/tagUtils.ts src/storage/tagMeta.ts
git commit -m "refactor(storage): move tag metadata to dedicated tags.json sidecar"
```

---

## Task 4: Rewrite tag pane observer (multi-pane, class-based, ARIA, registerEvent)

**Files:**
- Replace: `src/observers/tagPaneObserver.ts`

**Why:** Fixes defects #2, #3, #4, #14, #15. Implementation plan §1.4 and §2.2 specify the pattern.

- [ ] **Step 1: Replace `src/observers/tagPaneObserver.ts`**

Write `src/observers/tagPaneObserver.ts` as:
```typescript
import { App, Plugin, View, WorkspaceLeaf } from 'obsidian';
import { Rule, TagMeta } from '../types';
import { RuleEngine } from '../engine/ruleEngine';

const HIDDEN_CLASS = 'tag-curator-hidden';
const FLAG_CLASS = 'tag-curator-flagged';
const TAG_ATTR = 'data-tag-curator-rule';
const TAG_VIEW_TYPE = 'tag';

interface Filterable extends View {
  containerEl: HTMLElement;
}

export class TagPaneObserver {
  private app: App;
  private plugin: Plugin;
  private observers = new WeakMap<HTMLElement, MutationObserver>();
  private containers = new Set<HTMLElement>();
  private rules: Rule[] = [];
  private metadata = new Map<string, TagMeta>();
  private dryRun = false;
  private enabled = true;
  private rafQueued = false;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
  }

  init(): void {
    this.app.workspace.onLayoutReady(() => this.attachAll());
    this.plugin.registerEvent(
      this.app.workspace.on('layout-change', () => this.attachAll()),
    );
  }

  setRules(rules: Rule[]): void {
    this.rules = rules;
    this.scheduleApply();
  }

  setMetadata(metadata: Map<string, TagMeta>): void {
    this.metadata = metadata;
    this.scheduleApply();
  }

  setDryRun(dryRun: boolean): void {
    this.dryRun = dryRun;
    this.scheduleApply();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clearAll();
    else this.scheduleApply();
  }

  countHidden(): number {
    let count = 0;
    for (const container of this.containers) {
      count += container.querySelectorAll(`.${HIDDEN_CLASS}`).length;
    }
    return count;
  }

  ruleForElement(el: HTMLElement): string | null {
    return el.getAttribute(TAG_ATTR);
  }

  attachAll(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(TAG_VIEW_TYPE)) {
      this.attachLeaf(leaf);
    }
  }

  private attachLeaf(leaf: WorkspaceLeaf): void {
    const maybeDeferred = leaf as WorkspaceLeaf & {
      isDeferred?: boolean;
      loadIfDeferred?: () => void;
    };
    if (maybeDeferred.isDeferred) maybeDeferred.loadIfDeferred?.();
    const view = leaf.view as Filterable;
    const containerEl = view?.containerEl;
    if (!containerEl || this.observers.has(containerEl)) return;
    const obs = new MutationObserver(() => this.scheduleApply());
    obs.observe(containerEl, { childList: true, subtree: true });
    this.observers.set(containerEl, obs);
    this.containers.add(containerEl);
    this.plugin.register(() => {
      obs.disconnect();
      this.containers.delete(containerEl);
    });
    this.apply(containerEl);
  }

  private scheduleApply(): void {
    if (this.rafQueued) return;
    this.rafQueued = true;
    requestAnimationFrame(() => {
      this.rafQueued = false;
      for (const container of this.containers) this.apply(container);
    });
  }

  private apply(root: HTMLElement): void {
    if (!this.enabled) {
      this.clearWithin(root);
      return;
    }
    const rows = root.querySelectorAll<HTMLElement>('.tag-pane-tag');
    for (const row of Array.from(rows)) {
      const textEl = row.querySelector('.tag-pane-tag-text') ?? row;
      const tag = (textEl.textContent ?? '').trim();
      if (!tag) continue;
      const normalized = tag.startsWith('#') ? tag.slice(1) : tag;
      const meta = this.metadata.get(normalized);
      const result = RuleEngine.evaluateTag(normalized, meta, this.rules);
      if (result && !this.dryRun) {
        row.classList.add(HIDDEN_CLASS);
        row.classList.remove(FLAG_CLASS);
        row.setAttribute('aria-hidden', 'true');
        row.setAttribute(TAG_ATTR, result.ruleId);
      } else if (result && this.dryRun) {
        row.classList.add(FLAG_CLASS);
        row.classList.remove(HIDDEN_CLASS);
        row.removeAttribute('aria-hidden');
        row.setAttribute(TAG_ATTR, result.ruleId);
      } else {
        row.classList.remove(HIDDEN_CLASS);
        row.classList.remove(FLAG_CLASS);
        row.removeAttribute('aria-hidden');
        row.removeAttribute(TAG_ATTR);
      }
    }
  }

  private clearWithin(root: HTMLElement): void {
    const rows = root.querySelectorAll<HTMLElement>(`.${HIDDEN_CLASS}, .${FLAG_CLASS}`);
    for (const row of Array.from(rows)) {
      row.classList.remove(HIDDEN_CLASS);
      row.classList.remove(FLAG_CLASS);
      row.removeAttribute('aria-hidden');
      row.removeAttribute(TAG_ATTR);
    }
  }

  clearAll(): void {
    for (const container of this.containers) this.clearWithin(container);
  }

  unload(): void {
    this.clearAll();
    this.containers.clear();
  }
}
```

- [ ] **Step 2: Build to confirm compile**

Run: `npm run build 2>&1 | tail -40`
Expected: remaining errors in `main.ts`, settings UI, etc. Observer compiles.

- [ ] **Step 3: Commit**

Run:
```bash
git add src/observers/tagPaneObserver.ts
git commit -m "refactor(observer): multi-pane tag observer with ARIA and class-based hiding"
```

---

## Task 5: Rewrite `main.ts` to wire lifecycle correctly

**Files:**
- Replace: `src/main.ts`

**Why:** Defect #2 (raw `on()`), missing master toggle, missing panic disable wire-up, missing onExternalSettingsChange hook, no metadata cache event registration. Implementation plan §1.3 + §1.4 specify the pattern.

- [ ] **Step 1: Replace `src/main.ts`**

Write `src/main.ts` as:
```typescript
import { Notice, Plugin, TFile, WorkspaceLeaf, getAllTags } from 'obsidian';
import { SettingsManager } from './storage/settings';
import { TagMetaManager } from './storage/tagMeta';
import { TagPaneObserver } from './observers/tagPaneObserver';
import { TagCuratorSettingTab } from './ui/settingsTab';
import { TagListView, TAG_LIST_VIEW_TYPE } from './ui/tagListView';
import { resolveActiveRules } from './engine/presets';
import { panicCleanup } from './ui/panicDisable';

export default class TagCuratorPlugin extends Plugin {
  settingsManager!: SettingsManager;
  tagMetaManager!: TagMetaManager;
  tagPaneObserver!: TagPaneObserver;
  private statusBarEl: HTMLElement | null = null;
  private lastHiddenCount = 0;

  async onload(): Promise<void> {
    this.settingsManager = new SettingsManager(this);
    await this.settingsManager.load();
    const settings = this.settingsManager.get();

    this.tagMetaManager = new TagMetaManager(this.app, this);
    this.tagMetaManager.setDebounceMs(settings.sidecarDebounceMs);
    await this.tagMetaManager.load();

    this.tagPaneObserver = new TagPaneObserver(this.app, this);
    this.tagPaneObserver.setRules(resolveActiveRules(settings));
    this.tagPaneObserver.setMetadata(this.tagMetaManager.all());
    this.tagPaneObserver.setDryRun(settings.dryRun);
    this.tagPaneObserver.setEnabled(settings.enabled);
    this.tagPaneObserver.init();

    this.registerView(TAG_LIST_VIEW_TYPE, (leaf: WorkspaceLeaf) => new TagListView(leaf, this));

    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass('tag-curator-status');
    this.statusBarEl.addEventListener('click', () => this.openTagListWithHiddenFilter());

    this.addSettingTab(new TagCuratorSettingTab(this.app, this));

    this.settingsManager.onChange(() => {
      const next = this.settingsManager.get();
      this.tagMetaManager.setDebounceMs(next.sidecarDebounceMs);
      this.tagPaneObserver.setRules(resolveActiveRules(next));
      this.tagPaneObserver.setDryRun(next.dryRun);
      this.tagPaneObserver.setEnabled(next.enabled);
      this.refreshStatusBar();
    });

    this.registerEvent(
      this.tagMetaManager.on('changed', () => {
        this.tagPaneObserver.setMetadata(this.tagMetaManager.all());
        this.refreshStatusBar();
      }),
    );

    this.registerEvent(
      this.app.metadataCache.on('changed', (file) => this.tagMetaManager.indexFile(file)),
    );
    this.registerEvent(
      this.app.metadataCache.on('resolved', () => {
        this.tagPaneObserver.setMetadata(this.tagMetaManager.all());
        this.tagPaneObserver.attachAll();
        this.refreshStatusBar();
      }),
    );
    this.registerEvent(
      this.app.metadataCache.on('deleted', (file) => this.tagMetaManager.removeFile(file.path)),
    );
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if (file instanceof TFile) this.tagMetaManager.renameFile(oldPath, file.path);
      }),
    );

    this.addCommand({
      id: 'toggle-enable',
      name: 'Toggle enable',
      callback: () => this.toggleEnable(),
    });
    this.addCommand({
      id: 'panic-disable',
      name: 'Panic disable (remove all DOM effects now)',
      callback: () => this.panicDisable(),
    });
    this.addCommand({
      id: 'toggle-dry-run',
      name: 'Toggle dry-run mode',
      callback: () => this.toggleDryRun(),
    });
    this.addCommand({
      id: 'open-tag-list',
      name: 'Open tag list view',
      callback: () => this.openTagList(),
    });
    this.addCommand({
      id: 'open-tag-list-hidden',
      name: 'Open tag list (hidden tags only)',
      callback: () => this.openTagListWithHiddenFilter(),
    });
    this.addCommand({
      id: 'rescan-tags',
      name: 'Rescan vault tags',
      callback: () => this.rescanTags(),
    });

    void this.tagMetaManager.scanAll().then(() => {
      this.tagPaneObserver.setMetadata(this.tagMetaManager.all());
      this.refreshStatusBar();
    });

    this.refreshStatusBar();
  }

  async onExternalSettingsChange(): Promise<void> {
    await this.settingsManager.reload();
    const next = this.settingsManager.get();
    this.tagPaneObserver.setRules(resolveActiveRules(next));
    this.tagPaneObserver.setDryRun(next.dryRun);
    this.tagPaneObserver.setEnabled(next.enabled);
    this.refreshStatusBar();
  }

  onunload(): void {
    this.tagPaneObserver?.unload();
    this.tagMetaManager?.unload();
    panicCleanup(document);
  }

  private async toggleEnable(): Promise<void> {
    const current = this.settingsManager.get().enabled;
    await this.settingsManager.setEnabled(!current);
    new Notice(`Tag Curator ${!current ? 'enabled' : 'disabled'}`);
  }

  private async toggleDryRun(): Promise<void> {
    const current = this.settingsManager.get().dryRun;
    await this.settingsManager.setDryRun(!current);
    new Notice(`Dry-run ${!current ? 'on' : 'off'}`);
  }

  private panicDisable(): void {
    this.tagPaneObserver.setEnabled(false);
    panicCleanup(document);
    void this.settingsManager.setEnabled(false);
    new Notice('Tag Curator: panic disable activated. All DOM effects removed.');
  }

  private async rescanTags(): Promise<void> {
    new Notice('Tag Curator: rescanning vault tags…');
    await this.tagMetaManager.scanAll();
    this.tagPaneObserver.setMetadata(this.tagMetaManager.all());
    this.refreshStatusBar();
    new Notice('Tag Curator: rescan complete');
  }

  private async openTagList(): Promise<void> {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(TAG_LIST_VIEW_TYPE);
    let leaf: WorkspaceLeaf | null = leaves[0] ?? null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type: TAG_LIST_VIEW_TYPE });
    }
    workspace.revealLeaf(leaf);
  }

  private async openTagListWithHiddenFilter(): Promise<void> {
    await this.openTagList();
    const leaves = this.app.workspace.getLeavesOfType(TAG_LIST_VIEW_TYPE);
    const view = leaves[0]?.view;
    if (view && 'setHiddenOnly' in view) {
      (view as { setHiddenOnly: (v: boolean) => void }).setHiddenOnly(true);
    }
  }

  private refreshStatusBar(): void {
    if (!this.statusBarEl) return;
    const hidden = this.tagPaneObserver.countHidden();
    this.lastHiddenCount = hidden;
    const dry = this.settingsManager.get().dryRun;
    const enabled = this.settingsManager.get().enabled;
    if (!enabled) {
      this.statusBarEl.setText('Tag Curator: off');
      return;
    }
    if (dry) {
      this.statusBarEl.setText(`Tag Curator: ${hidden} flagged (dry-run)`);
      return;
    }
    this.statusBarEl.setText(hidden === 1 ? '1 tag hidden' : `${hidden} tags hidden`);
  }

  exposeForBenchmark(): { applyHideList: () => void } {
    void getAllTags; // silence unused import in production builds
    return { applyHideList: () => this.tagPaneObserver.attachAll() };
  }
}
```

- [ ] **Step 2: Commit (build will fail until tasks 6-8 land)**

Run:
```bash
git add src/main.ts
git commit -m "refactor(main): proper lifecycle wiring with registerEvent and onExternalSettingsChange"
```

---

## Task 6: Fix presets, add safe-regex helper, fix preset enabled-state collisions

**Files:**
- Create: `src/util/safeRegex.ts`
- Modify: `src/engine/matchers.ts`
- Modify: `src/engine/presets.ts`

**Why:** Defects #11, plus implementation plan §5.3 (iOS lookbehind crash) and §5.1 (nested tags). The current `hide-hex-codes` pattern fails on input `#FFAA00` because it strips the `#` before matching but the pattern starts with `^#`. The "URL anchors" pattern is over-eager (any "foo-3" matches). Presets need accurate iOS-safe patterns.

- [ ] **Step 1: Create `src/util/safeRegex.ts`**

Write `src/util/safeRegex.ts` as:
```typescript
const LOOKBEHIND_RE = /\(\?<[=!]/;

export class UnsafeRegexError extends Error {}

export function compileSafeRegex(pattern: string): RegExp {
  if (LOOKBEHIND_RE.test(pattern)) {
    throw new UnsafeRegexError(
      'Lookbehind assertions are not supported (iOS < 16.4 will crash).',
    );
  }
  return new RegExp(pattern);
}

export function validateSafeRegex(pattern: string): { ok: true } | { ok: false; reason: string } {
  try {
    compileSafeRegex(pattern);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
```

- [ ] **Step 2: Modify `src/engine/matchers.ts`**

Replace contents with:
```typescript
import { MatchCriteria, TagMeta } from '../types';
import { compileSafeRegex } from '../util/safeRegex';

const REGEX_CACHE = new Map<string, RegExp | null>();

function regexFor(pattern: string): RegExp | null {
  if (REGEX_CACHE.has(pattern)) return REGEX_CACHE.get(pattern) ?? null;
  try {
    const compiled = compileSafeRegex(pattern);
    REGEX_CACHE.set(pattern, compiled);
    return compiled;
  } catch (e) {
    console.warn('[tag-curator] invalid regex', pattern, e);
    REGEX_CACHE.set(pattern, null);
    return null;
  }
}

export class TagMatcher {
  static matches(tag: string, meta: TagMeta | undefined, criteria: MatchCriteria): boolean {
    switch (criteria.type) {
      case 'regex':
        return this.matchRegex(tag, criteria.pattern ?? '');
      case 'frequency':
        if (!meta) return false;
        return this.matchFrequency(meta.count, criteria.operator, criteria.value ?? 0);
      case 'list':
        return (criteria.list ?? []).includes(tag);
      default:
        return false;
    }
  }

  private static matchRegex(tag: string, pattern: string): boolean {
    if (!pattern) return false;
    const re = regexFor(pattern);
    return re ? re.test(tag) : false;
  }

  private static matchFrequency(count: number, op: MatchCriteria['operator'], value: number): boolean {
    switch (op) {
      case '<': return count < value;
      case '<=': return count <= value;
      case '>': return count > value;
      case '>=': return count >= value;
      case '=': return count === value;
      default: return false;
    }
  }
}
```

- [ ] **Step 3: Replace `src/engine/presets.ts`**

Write `src/engine/presets.ts` as:
```typescript
import { Rule, RulePreset, TagCuratorSettings } from '../types';

export const PRESETS: RulePreset[] = [
  {
    id: 'hide-hex-codes',
    name: 'Hide hex color codes',
    description: 'Hide tags that look like hex color codes (e.g. FFAA00, abcdef).',
    rule: {
      id: 'hide-hex-codes',
      name: 'Hide hex color codes',
      enabled: true,
      priority: 100,
      builtin: true,
      match: { type: 'regex', pattern: '^[0-9A-Fa-f]{3,8}$' },
      action: 'hide',
      scopes: ['tag-pane'],
      notes: 'Catches CSS hex codes from web clippings, especially via MarkDownload.',
    },
  },
  {
    id: 'hide-url-anchors',
    name: 'Hide URL anchor fragments',
    description: 'Hide tags that look like URL fragments (e.g. section-3, top, content).',
    rule: {
      id: 'hide-url-anchors',
      name: 'Hide URL anchor fragments',
      enabled: true,
      priority: 95,
      builtin: true,
      match: {
        type: 'regex',
        pattern: '^(top|bottom|navigation|content|main|header|footer|sidebar|toc)$|^[a-z]+-[0-9]+$',
      },
      action: 'hide',
      scopes: ['tag-pane'],
      notes: 'Common URL fragment patterns from web clippings.',
    },
  },
  {
    id: 'hide-single-char',
    name: 'Hide single-character tags',
    description: 'Hide tags of one ASCII letter (e.g. #a, #x).',
    rule: {
      id: 'hide-single-char',
      name: 'Hide single-character tags',
      enabled: false,
      priority: 90,
      builtin: true,
      match: { type: 'regex', pattern: '^[A-Za-z]$' },
      action: 'hide',
      scopes: ['tag-pane'],
      notes: 'Likely typos or single-character shortcuts.',
    },
  },
  {
    id: 'hide-numeric',
    name: 'Hide purely numeric tags',
    description: 'Hide tags that contain only digits (edge case; Obsidian usually strips these).',
    rule: {
      id: 'hide-numeric',
      name: 'Hide purely numeric tags',
      enabled: false,
      priority: 85,
      builtin: true,
      match: { type: 'regex', pattern: '^[0-9]+$' },
      action: 'hide',
      scopes: ['tag-pane'],
      notes: 'Catchall for numeric tags.',
    },
  },
  {
    id: 'hide-orphans',
    name: 'Hide orphan tags (count <= 1)',
    description: 'Hide tags that appear in one or fewer notes.',
    rule: {
      id: 'hide-orphans',
      name: 'Hide orphan tags (count <= 1)',
      enabled: false,
      priority: 80,
      builtin: true,
      match: { type: 'frequency', operator: '<=', value: 1 },
      action: 'hide',
      scopes: ['tag-pane'],
      notes: 'Tags appearing only once are likely typos or experiments.',
    },
  },
];

export function getPresetById(id: string): RulePreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function resolveActiveRules(settings: TagCuratorSettings): Rule[] {
  const presetRules: Rule[] = settings.enabledPresets
    .map((id) => getPresetById(id)?.rule)
    .filter((r): r is Rule => Boolean(r))
    .map((r) => ({ ...r, enabled: true }));
  const customRules = settings.customRules.filter((r) => r.enabled);
  return [...presetRules, ...customRules].sort((a, b) => b.priority - a.priority);
}
```

- [ ] **Step 4: Build to confirm progress**

Run: `npm run build 2>&1 | tail -40`
Expected: remaining errors only in UI files (settingsTab, tagListView, ruleEditor) plus panicDisable.ts not yet created.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/util/safeRegex.ts src/engine/matchers.ts src/engine/presets.ts
git commit -m "fix(engine): iOS-safe regex compile, accurate presets, deterministic active-rule resolution"
```

---

## Task 7: Implement dry-run mode in observer + settings UI hook

**Files:**
- (already wired by Task 4 observer and Task 5 main.ts; this task verifies and adds a CSS variant)

**Why:** Dry-run must visibly flag tags rather than hide them, so users can preview rule impact before committing. Spec §5.2 inbox-mode is deferred to v0.2, but dry-run is part of v0.1.

- [ ] **Step 1: Skim `src/observers/tagPaneObserver.ts` to confirm dry-run logic is present**

Run: `grep -n FLAG_CLASS src/observers/tagPaneObserver.ts`
Expected: lines from the implementation in Task 4 confirming the `tag-curator-flagged` class path.

- [ ] **Step 2: Add status verification command**

This step has no code; it is a check that Task 4 wired things correctly. No commit needed.

---

## Task 8: Create `panicDisable.ts` standalone cleanup utility

**Files:**
- Create: `src/ui/panicDisable.ts`

**Why:** Spec §7.6: panic disable must work even if settings UI fails. It must be importable from main with no dependencies on settings or observer state.

- [ ] **Step 1: Create `src/ui/panicDisable.ts`**

Write `src/ui/panicDisable.ts` as:
```typescript
const CLASSES = ['tag-curator-hidden', 'tag-curator-flagged'];
const ATTR = 'data-tag-curator-rule';

export function panicCleanup(doc: Document): void {
  for (const cls of CLASSES) {
    const nodes = doc.querySelectorAll<HTMLElement>(`.${cls}`);
    for (const node of Array.from(nodes)) {
      node.classList.remove(cls);
      node.removeAttribute('aria-hidden');
      node.removeAttribute(ATTR);
    }
  }
  const attributed = doc.querySelectorAll<HTMLElement>(`[${ATTR}]`);
  for (const node of Array.from(attributed)) {
    node.removeAttribute(ATTR);
    node.removeAttribute('aria-hidden');
  }
}
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/ui/panicDisable.ts
git commit -m "feat(safety): standalone panic-disable cleanup for emergency DOM reset"
```

---

## Task 9: Status bar polish

**Files:**
- (handled by `refreshStatusBar()` in Task 5 main.ts)

**Why:** Defect #6. Spec §8.3 mandates a discoverable hidden-tag count.

- [ ] **Step 1: Manual verification only**

Confirm `src/main.ts` `refreshStatusBar` formats `0`, `1`, and `N>1` distinctly, that clicking the status bar opens the tag list filtered to hidden, and that text changes between "off", "N tags hidden", and "N flagged (dry-run)" based on settings state.

Run: `grep -n refreshStatusBar src/main.ts`
Expected: matches the three branches.

- [ ] **Step 2: No commit (covered by Task 5)**

---

## Task 10: Tag list view rebuild (filter chips, diagnostic column, hidden-only mode)

**Files:**
- Modify: `src/ui/tagListView.ts`

**Why:** Defects #7, #16. Spec §5.3 columns and bulk operations; for v0.1 we keep this honest by surfacing the diagnostic ("which rule hid this") plus a hidden-only filter and a rule-attribution column. We do NOT ship bulk operations or alias UI in v0.1 - those are v0.3.

- [ ] **Step 1: Replace `src/ui/tagListView.ts`**

Write `src/ui/tagListView.ts` as:
```typescript
import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import TagCuratorPlugin from '../main';
import { TagMeta } from '../types';
import { RuleEngine } from '../engine/ruleEngine';
import { withHash } from '../util/tagUtils';
import { resolveActiveRules } from '../engine/presets';

export const TAG_LIST_VIEW_TYPE = 'tag-curator-list';

type SortKey = 'name' | 'count' | 'firstSeen' | 'lastSeen';
type Filter = 'all' | 'hidden' | 'orphans' | 'recent';

export class TagListView extends ItemView {
  plugin: TagCuratorPlugin;
  private searchInput!: HTMLInputElement;
  private tbody!: HTMLTableSectionElement;
  private summaryEl!: HTMLElement;
  private sortKey: SortKey = 'count';
  private sortDesc = true;
  private filter: Filter = 'all';

  constructor(leaf: WorkspaceLeaf, plugin: TagCuratorPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return TAG_LIST_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Tag list';
  }

  getIcon(): string {
    return 'tags';
  }

  setHiddenOnly(on: boolean): void {
    this.filter = on ? 'hidden' : 'all';
    this.refresh();
  }

  async onOpen(): Promise<void> {
    this.build();
    this.refresh();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  private build(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass('tag-curator-list-root');

    const header = root.createDiv({ cls: 'tag-curator-list-header' });
    header.createEl('h2', { text: 'Vault tags' });
    this.summaryEl = header.createDiv({ cls: 'tag-curator-list-summary' });

    const filterBar = root.createDiv({ cls: 'tag-curator-list-filter' });
    this.searchInput = filterBar.createEl('input', {
      type: 'text',
      placeholder: 'Filter by tag name',
      cls: 'tag-curator-search',
    });
    this.searchInput.addEventListener('input', () => this.refresh());

    const chipBar = filterBar.createDiv({ cls: 'tag-curator-chip-bar' });
    this.buildChip(chipBar, 'all', 'All');
    this.buildChip(chipBar, 'hidden', 'Hidden');
    this.buildChip(chipBar, 'orphans', 'Orphans');
    this.buildChip(chipBar, 'recent', 'Recent 30d');

    const wrapper = root.createDiv({ cls: 'tag-curator-table-wrapper' });
    const table = wrapper.createEl('table', { cls: 'tag-curator-table' });
    const thead = table.createEl('thead');
    const headerRow = thead.createEl('tr');
    this.buildSortableHeader(headerRow, 'Tag', 'name');
    this.buildSortableHeader(headerRow, 'Count', 'count');
    this.buildSortableHeader(headerRow, 'First seen', 'firstSeen');
    this.buildSortableHeader(headerRow, 'Last used', 'lastSeen');
    headerRow.createEl('th', { text: 'Source' });
    headerRow.createEl('th', { text: 'Status' });
    this.tbody = table.createEl('tbody');
  }

  private buildChip(container: HTMLElement, key: Filter, label: string): void {
    const chip = container.createEl('button', {
      cls: 'tag-curator-chip',
      text: label,
    });
    if (this.filter === key) chip.addClass('is-active');
    chip.addEventListener('click', () => {
      this.filter = key;
      const all = container.querySelectorAll<HTMLElement>('.tag-curator-chip');
      for (const el of Array.from(all)) el.removeClass('is-active');
      chip.addClass('is-active');
      this.refresh();
    });
  }

  private buildSortableHeader(row: HTMLElement, label: string, key: SortKey): void {
    const cell = row.createEl('th', { text: label, cls: 'tag-curator-sortable' });
    cell.addEventListener('click', () => {
      if (this.sortKey === key) this.sortDesc = !this.sortDesc;
      else {
        this.sortKey = key;
        this.sortDesc = true;
      }
      this.refresh();
    });
  }

  private refresh(): void {
    const metaMap = this.plugin.tagMetaManager.all();
    const settings = this.plugin.settingsManager.get();
    const rules = resolveActiveRules(settings);
    const search = this.searchInput.value.toLowerCase().trim();
    const now = Date.now();
    const RECENT_MS = 30 * 24 * 60 * 60 * 1000;

    let rows = Array.from(metaMap.values());
    if (search) rows = rows.filter((r) => r.tag.toLowerCase().includes(search));

    const rowResults = rows.map((row) => ({
      meta: row,
      result: RuleEngine.evaluateTag(row.tag, row, rules),
    }));

    let filtered = rowResults;
    if (this.filter === 'hidden') filtered = rowResults.filter((r) => r.result !== null);
    else if (this.filter === 'orphans') filtered = rowResults.filter((r) => r.meta.count <= 1);
    else if (this.filter === 'recent')
      filtered = rowResults.filter((r) => now - r.meta.firstSeen <= RECENT_MS);

    filtered.sort((a, b) => {
      const va = this.valueFor(a.meta);
      const vb = this.valueFor(b.meta);
      if (typeof va === 'string' && typeof vb === 'string') {
        return this.sortDesc ? vb.localeCompare(va) : va.localeCompare(vb);
      }
      return this.sortDesc ? (vb as number) - (va as number) : (va as number) - (vb as number);
    });

    this.tbody.empty();
    for (const { meta, result } of filtered) this.renderRow(meta, result?.ruleName, result?.ruleId);

    const total = metaMap.size;
    const hidden = rowResults.filter((r) => r.result !== null).length;
    this.summaryEl.setText(
      `${total} total · ${hidden} affected by rules · showing ${filtered.length}`,
    );
  }

  private valueFor(meta: TagMeta): string | number {
    switch (this.sortKey) {
      case 'name': return meta.tag;
      case 'count': return meta.count;
      case 'firstSeen': return meta.firstSeen;
      case 'lastSeen': return meta.lastSeen;
    }
  }

  private renderRow(meta: TagMeta, ruleName: string | undefined, ruleId: string | undefined): void {
    const tr = this.tbody.createEl('tr', {
      cls: ruleName ? 'tag-curator-row tag-curator-row-hidden' : 'tag-curator-row',
    });
    tr.createEl('td', { text: withHash(meta.tag), cls: 'tag-curator-name-cell' });
    tr.createEl('td', { text: String(meta.count), cls: 'tag-curator-num-cell' });
    tr.createEl('td', {
      text: new Date(meta.firstSeen).toLocaleDateString(),
      cls: 'tag-curator-date-cell',
    });
    tr.createEl('td', {
      text: new Date(meta.lastSeen).toLocaleDateString(),
      cls: 'tag-curator-date-cell',
    });
    tr.createEl('td', { text: meta.sources.join(', ') });
    const status = tr.createEl('td');
    if (ruleName) {
      const badge = status.createEl('span', {
        cls: 'tag-curator-badge tag-curator-badge-hidden',
        text: `Hidden by ${ruleName}`,
      });
      badge.title = `Rule id: ${ruleId ?? ''}. Click to copy.`;
      badge.addEventListener('click', () => {
        if (ruleId) {
          void navigator.clipboard.writeText(ruleId);
          new Notice(`Copied rule id: ${ruleId}`);
        }
      });
    } else {
      status.createEl('span', {
        cls: 'tag-curator-badge tag-curator-badge-visible',
        text: 'Visible',
      });
    }
  }
}
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/ui/tagListView.ts
git commit -m "feat(ui): tag list with filter chips and rule attribution"
```

---

## Task 11: Settings tab rewrite (Setting().setHeading, sentence-case, sections)

**Files:**
- Replace: `src/ui/settingsTab.ts`

**Why:** Defects #9, plus general polish. Community-plugin-directory rejection avoidance per implementation plan §8.3.

- [ ] **Step 1: Replace `src/ui/settingsTab.ts`**

Write `src/ui/settingsTab.ts` as:
```typescript
import { App, PluginSettingTab, Setting } from 'obsidian';
import TagCuratorPlugin from '../main';
import { PRESETS } from '../engine/presets';
import { RuleEditorModal } from './ruleEditor';

export class TagCuratorSettingTab extends PluginSettingTab {
  plugin: TagCuratorPlugin;

  constructor(app: App, plugin: TagCuratorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('tag-curator-settings');

    this.renderGeneral(containerEl);
    this.renderPresets(containerEl);
    this.renderCustomRules(containerEl);
    this.renderAdvanced(containerEl);
    this.renderAbout(containerEl);
  }

  private renderGeneral(container: HTMLElement): void {
    new Setting(container).setName('General').setHeading();
    const s = this.plugin.settingsManager.get();

    new Setting(container)
      .setName('Enable Tag Curator')
      .setDesc('Master switch. When off, no filtering is applied.')
      .addToggle((t) => {
        t.setValue(s.enabled).onChange(async (v) => {
          await this.plugin.settingsManager.setEnabled(v);
        });
      });

    new Setting(container)
      .setName('Mode')
      .setDesc('How Tag Curator interprets rules. Allow-only and inbox modes arrive in v0.2.')
      .addDropdown((d) => {
        d.addOption('default', 'Default (hide matched)')
          .addOption('allow-only', 'Allow-only (preview)')
          .addOption('inbox', 'Inbox (preview)')
          .setValue(s.mode)
          .onChange(async (v) => {
            await this.plugin.settingsManager.update({ mode: v as typeof s.mode });
          });
      });

    new Setting(container)
      .setName('Dry-run mode')
      .setDesc('Flag matching tags instead of hiding them. Use this to preview rule impact safely.')
      .addToggle((t) => {
        t.setValue(s.dryRun).onChange(async (v) => {
          await this.plugin.settingsManager.setDryRun(v);
        });
      });
  }

  private renderPresets(container: HTMLElement): void {
    new Setting(container).setName('Built-in presets').setHeading();
    const s = this.plugin.settingsManager.get();
    for (const preset of PRESETS) {
      const enabled = s.enabledPresets.includes(preset.id);
      new Setting(container)
        .setName(preset.name)
        .setDesc(preset.description)
        .addToggle((t) => {
          t.setValue(enabled).onChange(async (v) => {
            await this.plugin.settingsManager.setPresetEnabled(preset.id, v);
          });
        });
    }
  }

  private renderCustomRules(container: HTMLElement): void {
    new Setting(container).setName('Custom rules').setHeading();
    const s = this.plugin.settingsManager.get();

    new Setting(container)
      .setName('Add a rule')
      .setDesc('Create a custom regex, frequency, or list rule.')
      .addButton((b) => {
        b.setButtonText('New rule')
          .setCta()
          .onClick(() => {
            const modal = new RuleEditorModal(this.app, this.plugin, undefined, async (rule) => {
              await this.plugin.settingsManager.addCustomRule(rule);
              this.display();
            });
            modal.open();
          });
      });

    if (s.customRules.length === 0) {
      container.createEl('p', {
        cls: 'tag-curator-empty-state',
        text: 'No custom rules yet. Built-in presets are enough for most users.',
      });
      return;
    }

    for (const rule of s.customRules) {
      const row = new Setting(container)
        .setName(rule.name)
        .setDesc(
          `${rule.match.type} rule · ${rule.enabled ? 'enabled' : 'disabled'} · priority ${rule.priority}`,
        );
      row.addToggle((t) => {
        t.setValue(rule.enabled).onChange(async (v) => {
          await this.plugin.settingsManager.updateCustomRule(rule.id, { enabled: v });
          this.display();
        });
      });
      row.addButton((b) => {
        b.setButtonText('Edit').onClick(() => {
          const modal = new RuleEditorModal(this.app, this.plugin, rule, async (updated) => {
            await this.plugin.settingsManager.updateCustomRule(rule.id, updated);
            this.display();
          });
          modal.open();
        });
      });
      row.addButton((b) => {
        b.setButtonText('Delete')
          .setWarning()
          .onClick(async () => {
            await this.plugin.settingsManager.deleteCustomRule(rule.id);
            this.display();
          });
      });
    }
  }

  private renderAdvanced(container: HTMLElement): void {
    new Setting(container).setName('Advanced').setHeading();
    const s = this.plugin.settingsManager.get();

    new Setting(container)
      .setName('Debug logging')
      .setDesc('Write rule evaluation traces to the developer console.')
      .addToggle((t) => {
        t.setValue(s.debugLog).onChange(async (v) => {
          await this.plugin.settingsManager.update({ debugLog: v });
        });
      });

    new Setting(container)
      .setName('Metadata save debounce (ms)')
      .setDesc('How long to wait before persisting tag metadata to tags.json.')
      .addText((t) => {
        t.setPlaceholder('5000')
          .setValue(String(s.sidecarDebounceMs))
          .onChange(async (v) => {
            const parsed = parseInt(v, 10);
            if (!isNaN(parsed)) {
              await this.plugin.settingsManager.update({ sidecarDebounceMs: parsed });
            }
          });
      });

    new Setting(container)
      .setName('Panic disable')
      .setDesc('Remove all Tag Curator DOM effects immediately and turn off the plugin.')
      .addButton((b) => {
        b.setButtonText('Panic disable')
          .setWarning()
          .onClick(() => {
            (this.app as unknown as { commands: { executeCommandById: (id: string) => void } })
              .commands.executeCommandById(`${this.plugin.manifest.id}:panic-disable`);
            this.display();
          });
      });
  }

  private renderAbout(container: HTMLElement): void {
    new Setting(container).setName('About').setHeading();
    const about = container.createDiv({ cls: 'tag-curator-about' });
    about.createEl('p', {
      text:
        'Tag Curator is a vault-wide tag visibility engine. It is display-only, file-safe, and fully reversible.',
    });
    about.createEl('p', { text: `Version ${this.plugin.manifest.version}.` });
    const links = about.createDiv({ cls: 'tag-curator-links' });
    const repo = links.createEl('a', {
      text: 'Repository',
      href: 'https://github.com/jprisant/obsidian-tag-curator',
    });
    repo.setAttribute('target', '_blank');
    repo.setAttribute('rel', 'noopener');
  }
}
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/ui/settingsTab.ts
git commit -m "refactor(ui): polished settings tab with Setting().setHeading() and sections"
```

---

## Task 12: Style polish

**Files:**
- Modify: `styles.css`

**Why:** The visual mockups in `docs/internal/discovery/ui-ideas/` are directional; for v0.1 we ship clean type, clear chips, and clear status indicators using Obsidian CSS variables. We do not chase the mockups' v0.3 sidebar nav.

- [ ] **Step 1: Replace `styles.css`**

Write `styles.css` as:
```css
/* Tag Curator v0.1.0 */

.tag-pane-tag.tag-curator-hidden {
  display: none !important;
}

.tag-pane-tag.tag-curator-flagged .tag-pane-tag-text::after {
  content: " (dry-run)";
  font-size: 0.75em;
  opacity: 0.65;
  margin-left: 4px;
}

.tag-pane-tag.tag-curator-flagged {
  outline: 1px dashed var(--text-accent);
  outline-offset: -1px;
  border-radius: 4px;
}

.tag-curator-status {
  cursor: pointer;
  user-select: none;
}

.tag-curator-status:hover {
  color: var(--text-accent);
}

.tag-curator-settings .setting-item-heading {
  margin-top: 1.5rem;
}

.tag-curator-empty-state {
  color: var(--text-muted);
  font-style: italic;
  margin: 0.5rem 0 1rem;
  font-size: 0.875rem;
}

.tag-curator-about {
  background: var(--background-secondary);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin-top: 0.5rem;
}

.tag-curator-about p {
  margin: 0.25rem 0;
  font-size: 0.875rem;
}

.tag-curator-links {
  margin-top: 0.5rem;
  display: flex;
  gap: 1rem;
}

.tag-curator-links a {
  color: var(--text-accent);
  text-decoration: none;
}

.tag-curator-links a:hover {
  text-decoration: underline;
}

.tag-curator-list-root {
  padding: 0;
}

.tag-curator-list-header {
  padding: 1rem 1rem 0.5rem;
  border-bottom: 1px solid var(--divider-color);
}

.tag-curator-list-header h2 {
  margin: 0 0 0.25rem 0;
  font-size: 1.1rem;
}

.tag-curator-list-summary {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.tag-curator-list-filter {
  padding: 0.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-bottom: 1px solid var(--divider-color);
  background: var(--background-secondary);
}

.tag-curator-search {
  width: 100%;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--input-border-color);
  border-radius: 4px;
  background: var(--background-primary);
  color: var(--text-normal);
  font-size: 0.85rem;
}

.tag-curator-chip-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tag-curator-chip {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
  color: var(--text-normal);
  font-size: 0.75rem;
  cursor: pointer;
}

.tag-curator-chip.is-active {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
}

.tag-curator-table-wrapper {
  overflow: auto;
}

.tag-curator-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.tag-curator-table th {
  position: sticky;
  top: 0;
  background: var(--background-secondary);
  text-align: left;
  padding: 0.45rem 0.6rem;
  font-weight: 600;
  border-bottom: 1px solid var(--divider-color);
}

.tag-curator-sortable {
  cursor: pointer;
  user-select: none;
}

.tag-curator-sortable:hover {
  background: var(--background-modifier-hover);
}

.tag-curator-table td {
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--divider-color);
}

.tag-curator-row-hidden {
  opacity: 0.55;
}

.tag-curator-row:hover {
  background: var(--background-modifier-hover);
}

.tag-curator-name-cell {
  color: var(--text-accent);
  font-weight: 500;
}

.tag-curator-num-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.tag-curator-date-cell {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.tag-curator-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
}

.tag-curator-badge-hidden {
  background: var(--background-modifier-error);
  color: var(--text-on-accent);
}

.tag-curator-badge-visible {
  background: var(--background-modifier-success);
  color: var(--text-on-accent);
}
```

- [ ] **Step 2: Commit**

Run:
```bash
git add styles.css
git commit -m "style: refresh tag list and settings styles for v0.1.0"
```

---

## Task 13: Rule editor enhancements (action/scope selectors, regex safety feedback, live preview)

**Files:**
- Modify: `src/ui/ruleEditor.ts`

**Why:** The current modal is missing action selector (only "hide" implied) and a live "tags currently affected" preview. We add: action selector defaulting to `hide`, scope checkbox locked to `tag-pane` in v0.1 with a "more scopes in v0.2" note, regex pattern validation against `validateSafeRegex`, and a live count of affected tags.

- [ ] **Step 1: Replace `src/ui/ruleEditor.ts`**

Write `src/ui/ruleEditor.ts` as:
```typescript
import { App, Modal, Notice, Setting } from 'obsidian';
import TagCuratorPlugin from '../main';
import { Rule } from '../types';
import { RuleEngine } from '../engine/ruleEngine';
import { validateSafeRegex } from '../util/safeRegex';

type SaveFn = (rule: Rule) => Promise<void>;

export class RuleEditorModal extends Modal {
  private plugin: TagCuratorPlugin;
  private working: Rule;
  private onSave: SaveFn;
  private isNew: boolean;
  private previewEl!: HTMLElement;
  private testResultEl!: HTMLElement;
  private regexStatusEl!: HTMLElement;

  constructor(app: App, plugin: TagCuratorPlugin, rule: Rule | undefined, onSave: SaveFn) {
    super(app);
    this.plugin = plugin;
    this.isNew = !rule;
    this.working = rule ? { ...rule } : this.blankRule();
    this.onSave = onSave;
  }

  private blankRule(): Rule {
    return {
      id: `rule-${Date.now()}`,
      name: 'New rule',
      enabled: true,
      priority: 50,
      match: { type: 'regex', pattern: '' },
      action: 'hide',
      scopes: ['tag-pane'],
    };
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('tag-curator-rule-editor');
    contentEl.createEl('h2', { text: this.isNew ? 'New rule' : 'Edit rule' });

    new Setting(contentEl)
      .setName('Name')
      .addText((t) =>
        t.setValue(this.working.name).onChange((v) => {
          this.working.name = v || 'Untitled rule';
          this.refreshPreview();
        }),
      );

    new Setting(contentEl)
      .setName('Enabled')
      .addToggle((t) =>
        t.setValue(this.working.enabled).onChange((v) => {
          this.working.enabled = v;
          this.refreshPreview();
        }),
      );

    new Setting(contentEl)
      .setName('Priority')
      .setDesc('Higher priority rules win when multiple rules match the same tag.')
      .addSlider((s) =>
        s
          .setLimits(0, 100, 5)
          .setValue(this.working.priority)
          .setDynamicTooltip()
          .onChange((v) => {
            this.working.priority = v;
            this.refreshPreview();
          }),
      );

    new Setting(contentEl)
      .setName('Match type')
      .addDropdown((d) =>
        d
          .addOption('regex', 'Regex pattern')
          .addOption('frequency', 'Frequency (count)')
          .addOption('list', 'Explicit list')
          .setValue(this.working.match.type)
          .onChange((v) => {
            this.working.match = { type: v as Rule['match']['type'] };
            this.onOpen();
          }),
      );

    this.renderCriteria(contentEl);
    this.renderTestArea(contentEl);
    this.renderPreview(contentEl);

    new Setting(contentEl)
      .setName('Notes')
      .addTextArea((t) =>
        t.setValue(this.working.notes ?? '').onChange((v) => {
          this.working.notes = v;
        }),
      );

    new Setting(contentEl)
      .addButton((b) =>
        b
          .setButtonText('Save')
          .setCta()
          .onClick(async () => {
            if (this.working.match.type === 'regex') {
              const check = validateSafeRegex(this.working.match.pattern ?? '');
              if (!check.ok) {
                new Notice(`Regex error: ${check.reason}`);
                return;
              }
            }
            await this.onSave(this.working);
            this.close();
          }),
      )
      .addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()));

    this.refreshPreview();
  }

  private renderCriteria(contentEl: HTMLElement): void {
    if (this.working.match.type === 'regex') {
      new Setting(contentEl)
        .setName('Pattern')
        .setDesc('JavaScript regex. Lookbehind is not allowed (iOS crash).')
        .addText((t) =>
          t
            .setPlaceholder('^[0-9A-Fa-f]{3,8}$')
            .setValue(this.working.match.pattern ?? '')
            .onChange((v) => {
              this.working.match.pattern = v;
              this.updateRegexStatus(v);
              this.refreshPreview();
            }),
        );
      this.regexStatusEl = contentEl.createDiv({ cls: 'tag-curator-regex-status' });
      this.updateRegexStatus(this.working.match.pattern ?? '');
    }
    if (this.working.match.type === 'frequency') {
      new Setting(contentEl)
        .setName('Operator')
        .addDropdown((d) =>
          d
            .addOption('<', 'Less than')
            .addOption('<=', 'Less than or equal')
            .addOption('=', 'Equal to')
            .addOption('>=', 'Greater than or equal')
            .addOption('>', 'Greater than')
            .setValue(this.working.match.operator ?? '<=')
            .onChange((v) => {
              this.working.match.operator = v as Rule['match']['operator'];
              this.refreshPreview();
            }),
        );
      new Setting(contentEl)
        .setName('Count value')
        .addText((t) =>
          t
            .setPlaceholder('1')
            .setValue(String(this.working.match.value ?? 1))
            .onChange((v) => {
              const parsed = parseInt(v, 10);
              this.working.match.value = isNaN(parsed) ? 0 : parsed;
              this.refreshPreview();
            }),
        );
    }
    if (this.working.match.type === 'list') {
      new Setting(contentEl)
        .setName('Tags (one per line)')
        .setDesc('Each line is one tag. Hashes optional.')
        .addTextArea((t) =>
          t
            .setPlaceholder('#draft\n#temp')
            .setValue((this.working.match.list ?? []).map((s) => `#${s}`).join('\n'))
            .onChange((v) => {
              this.working.match.list = v
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((s) => (s.startsWith('#') ? s.slice(1) : s));
              this.refreshPreview();
            }),
        );
    }
  }

  private renderTestArea(contentEl: HTMLElement): void {
    new Setting(contentEl)
      .setName('Test tag')
      .setDesc('Type a tag (with or without #) to see whether this rule would match.')
      .addText((t) =>
        t.setPlaceholder('#temp-001').onChange((v) => {
          const tag = v.startsWith('#') ? v.slice(1) : v;
          const matches = tag ? RuleEngine.testTag(tag, this.working) : false;
          this.testResultEl.setText(tag ? (matches ? 'Would match' : 'Would not match') : '');
          this.testResultEl.toggleClass('is-match', matches);
        }),
      );
    this.testResultEl = contentEl.createDiv({ cls: 'tag-curator-test-result' });
  }

  private renderPreview(contentEl: HTMLElement): void {
    new Setting(contentEl).setName('Live preview').setHeading();
    this.previewEl = contentEl.createDiv({ cls: 'tag-curator-rule-preview' });
  }

  private updateRegexStatus(pattern: string): void {
    if (!this.regexStatusEl) return;
    if (!pattern) {
      this.regexStatusEl.setText('');
      this.regexStatusEl.removeClass('is-error');
      return;
    }
    const check = validateSafeRegex(pattern);
    if (check.ok) {
      this.regexStatusEl.setText('Regex is valid.');
      this.regexStatusEl.removeClass('is-error');
    } else {
      this.regexStatusEl.setText(`Regex error: ${check.reason}`);
      this.regexStatusEl.addClass('is-error');
    }
  }

  private refreshPreview(): void {
    if (!this.previewEl) return;
    const all = this.plugin.tagMetaManager.all();
    const affected: string[] = [];
    for (const [tag, meta] of all) {
      if (RuleEngine.testTagWithMeta(tag, meta, this.working)) {
        affected.push(tag);
        if (affected.length >= 50) break;
      }
    }
    this.previewEl.empty();
    if (affected.length === 0) {
      this.previewEl.createEl('p', {
        cls: 'tag-curator-empty-state',
        text: 'No tags in the vault match this rule yet.',
      });
      return;
    }
    const header = this.previewEl.createEl('p');
    header.setText(`${affected.length}${affected.length >= 50 ? '+' : ''} tag(s) match:`);
    const list = this.previewEl.createEl('ul', { cls: 'tag-curator-preview-list' });
    for (const tag of affected) list.createEl('li', { text: `#${tag}` });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
```

- [ ] **Step 2: Extend `RuleEngine` with `testTagWithMeta`**

Modify `src/engine/ruleEngine.ts`. After the existing `testTag` method, append a new static method:
```typescript
  static testTagWithMeta(tag: string, meta: import('../types').TagMeta | undefined, rule: import('../types').Rule): boolean {
    return TagMatcher.matches(tag, meta, rule.match);
  }
```

Make sure `TagMatcher` is imported at the top (it already is).

- [ ] **Step 3: Add styles for regex/test status and preview list**

Append to `styles.css`:
```css
.tag-curator-rule-editor h2 {
  margin-top: 0;
}

.tag-curator-regex-status {
  font-size: 0.75rem;
  color: var(--text-muted);
  padding: 0 1rem 0.5rem;
}

.tag-curator-regex-status.is-error {
  color: var(--text-error);
}

.tag-curator-test-result {
  font-size: 0.85rem;
  padding: 0.25rem 1rem 0.75rem;
  color: var(--text-muted);
}

.tag-curator-test-result.is-match {
  color: var(--interactive-accent);
  font-weight: 600;
}

.tag-curator-rule-preview {
  padding: 0 1rem 1rem;
  max-height: 14rem;
  overflow: auto;
}

.tag-curator-preview-list {
  margin: 0.25rem 0;
  padding-left: 1.25rem;
  font-size: 0.8rem;
  color: var(--text-muted);
  font-family: var(--font-monospace);
}
```

- [ ] **Step 4: Build to confirm full compile**

Run: `npm run build 2>&1 | tail -40`
Expected: zero errors. `main.js` produced.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/ui/ruleEditor.ts src/engine/ruleEngine.ts styles.css
git commit -m "feat(ui): rule editor with regex safety validation and live preview"
```

---

## Task 14: Manifest, versions, mobile targeting

**Files:**
- Modify: `manifest.json`
- Modify: `versions.json`

**Why:** Defects #8, #18. Implementation plan §8.6 + the version-targeting recommendation.

- [ ] **Step 1: Replace `manifest.json`**

Write `manifest.json` as:
```json
{
  "id": "tag-curator",
  "name": "Tag Curator",
  "version": "0.1.0",
  "minAppVersion": "1.9.10",
  "description": "Hide, flag, and curate noisy tags across Obsidian's UI. Display-only, file-safe, fully reversible.",
  "author": "JP Prisant",
  "authorUrl": "https://github.com/jprisant",
  "helpUrl": "https://github.com/jprisant/obsidian-tag-curator#readme",
  "isDesktopOnly": false
}
```

- [ ] **Step 2: Replace `versions.json`**

Write `versions.json` as:
```json
{
  "0.1.0": "1.9.10"
}
```

- [ ] **Step 3: Commit**

Run:
```bash
git add manifest.json versions.json
git commit -m "chore(manifest): set minAppVersion to 1.9.10 and align versions.json"
```

---

## Task 15: GitHub Actions release workflow

**Files:**
- Modify: `.github/workflows/build.yml`
- Create: `.github/workflows/release.yml`

**Why:** Defect #20. Implementation plan §8.2.

- [ ] **Step 1: Replace `.github/workflows/build.yml`**

Write `.github/workflows/build.yml` as:
```yaml
name: build

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - name: Verify build artifacts
        run: |
          test -f main.js
          test -f manifest.json
          test -f versions.json
          test -f styles.css
```

- [ ] **Step 2: Create `.github/workflows/release.yml`**

Write `.github/workflows/release.yml` as:
```yaml
name: release

on:
  push:
    tags:
      - '*'

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - name: Verify artifacts
        run: |
          test -f main.js
          test -f manifest.json
          test -f styles.css
      - name: Create release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            manifest.json
            main.js
            styles.css
            versions.json
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 3: Commit**

Run:
```bash
git add .github/workflows/build.yml .github/workflows/release.yml
git commit -m "ci: tagged-release workflow uploads main.js/manifest.json/styles.css/versions.json"
```

---

## Task 16: ESLint config and lint pass

**Files:**
- Create: `.eslintrc.cjs`
- Modify: `package.json`

**Why:** Defect #17. CI runs `npm run lint`; the script exists but no config does. Fix the contract.

- [ ] **Step 1: Create `.eslintrc.cjs`**

Write `.eslintrc.cjs` as:
```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2022,
  },
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
  ignorePatterns: ['main.js', 'node_modules/', 'docs/'],
};
```

- [ ] **Step 2: Run lint to detect violations**

Run: `npm run lint 2>&1 | tail -40`
Expected: zero errors. If there are violations from `--max-warnings 0`, address them inline (most likely unused imports in older files we have not touched).

- [ ] **Step 3: Relax `--max-warnings 0` to `--max-warnings 24` for now**

Modify `package.json` lint script. Replace:
```json
    "lint": "eslint src --ext .ts,.tsx --max-warnings 0"
```
with:
```json
    "lint": "eslint src --ext .ts,.tsx --max-warnings 0"
```

(No change. Verify build still passes lint. If it fails, address each warning. Only as a last resort, bump to `--max-warnings 5` and document the count in CHANGELOG.)

- [ ] **Step 4: Commit**

Run:
```bash
git add .eslintrc.cjs package.json
git commit -m "ci(lint): add ESLint config for TypeScript strict checking"
```

---

## Task 17: README, CHANGELOG, and supporting docs polish

**Files:**
- Replace: `README.md`
- Modify: `CHANGELOG.md`

**Why:** Defect #19. Submission readiness.

- [ ] **Step 1: Replace `README.md`**

Write `README.md` as:
```markdown
# Tag Curator

A vault-wide tag visibility and curation engine for Obsidian. Hide, flag, and surface tags across the native tag pane without modifying a single note.

> Display-only. File-safe. Fully reversible.

## What it does

Tag Curator gives you a rule engine that controls which tags appear in Obsidian's tag pane. Your notes are never touched. Disabling or uninstalling the plugin restores every tag immediately.

Five built-in presets ship enabled or disabled to taste:

- Hide hex color codes such as `#FFAA00` or `#abcdef` (often imported from web clippings).
- Hide URL anchor fragments such as `#top`, `#section-3`, or `#sidebar`.
- Hide single-character tags such as `#a` or `#x`.
- Hide purely numeric tags.
- Hide orphan tags (used in one or fewer notes).

You can also write your own rules: regex patterns, frequency thresholds, or explicit allow lists.

## Install (BRAT, until directory submission)

1. Install the BRAT plugin from the Obsidian Community Plugins directory.
2. In BRAT settings, add `jprisant/obsidian-tag-curator`.
3. Enable Tag Curator under Community Plugins.

## Install (manual)

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Copy them to `<your-vault>/.obsidian/plugins/tag-curator/`.
3. Reload Obsidian and enable Tag Curator under Community Plugins.

## Quick start

1. Open Settings -> Community Plugins -> Tag Curator.
2. Toggle a preset (start with "Hide hex color codes").
3. Open the tag pane. Hidden tags disappear.
4. Run "Tag Curator: Open tag list view" from the command palette to see every tag and its visibility status.
5. Click the status bar item to see only hidden tags.

## Safety contract

Tag Curator never modifies note content. It does not patch `metadataCache.getTags()` or any other internal Obsidian API. Dataview, Tasks, and Bases see the real, unfiltered tag data.

If the plugin behaves unexpectedly, run "Tag Curator: Panic disable" from the command palette. Every Tag Curator DOM modification is removed immediately and the plugin disables itself.

## Commands

- Tag Curator: Toggle enable
- Tag Curator: Panic disable (remove all DOM effects now)
- Tag Curator: Toggle dry-run mode
- Tag Curator: Open tag list view
- Tag Curator: Open tag list (hidden tags only)
- Tag Curator: Rescan vault tags

## Modes

- Default (v0.1.0): rules hide matching tags.
- Dry-run (v0.1.0): rules visibly flag matching tags instead of hiding them, useful for preview.
- Allow-only and inbox modes: preview options reserved for v0.2.

## What lives in `.obsidian/plugins/tag-curator/`

- `data.json`: settings, presets, custom rules.
- `tags.json`: per-tag metadata (count, first seen, last seen, source).

Both are pretty-printed JSON for easy git diffing.

## Performance

For typical vaults (under 10k notes, under 1,500 unique tags), Tag Curator's overhead is imperceptible. The tag pane observer is scoped to the tag-pane container, debounced through `requestAnimationFrame`, and applies class-based hiding rather than DOM removal.

## Roadmap

- v0.1: tag-pane filtering, rule engine, presets, custom rules, tag list view, panic disable, dry-run.
- v0.2: editor autocomplete and properties chip filtering, recently created / orphan / stale panels.
- v0.3: aliases / display-merge, profiles, Tag Wrangler integration, inbox mode.
- v0.4: Notebook Navigator integration, suggested merges, export and import, community rule packs.
- v0.5+: Bases scope, Colored Tags Wrangler delegation, mobile polish, community plugin directory.

## Non-goals

- Modifying note content (use Tag Wrangler).
- Coloring tags (use Colored Tags Wrangler).
- Replacing the file explorer (Notebook Navigator's role).
- Filtering query results in Dataview, Tasks, or Bases.
- Telemetry of any kind.

## License

Apache 2.0.

## Support

- Issues: https://github.com/jprisant/obsidian-tag-curator/issues
- Repository: https://github.com/jprisant/obsidian-tag-curator
```

- [ ] **Step 2: Replace `CHANGELOG.md` v0.1.0 entry**

Write `CHANGELOG.md` as:
```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-05-14

Initial public release.

### Added

- Rule engine with three match types: regex, frequency, and explicit list.
- Priority-based rule evaluation (last match wins among enabled rules sorted by priority).
- Five built-in presets: hex color codes, URL anchor fragments, single-character tags, purely numeric tags, orphan tags.
- Tag-pane filtering via scoped MutationObserver and class-based hiding (no DOM removal).
- Tag list view: sortable, searchable, with filter chips (All, Hidden, Orphans, Recent 30d) and rule-attribution status column.
- Custom rule editor: regex / frequency / list, live affected-tag preview, regex safety validation against iOS lookbehind crash, test field.
- Master enable / disable toggle wired to a status bar item.
- Dry-run mode: visibly flag matched tags rather than hide them.
- Panic disable command: full DOM cleanup plus settings off-switch.
- Status bar item: shows hidden tag count, dry-run state, or off-state; click to open tag list filtered to hidden.
- Tag metadata sidecar (`tags.json`): first seen, last seen, count, source per tag.
- Schema-versioned settings with migration from any prior local v0 state.
- `onExternalSettingsChange` support: reload settings cleanly when Obsidian Sync rewrites `data.json`.
- Apache 2.0 license, README polished for community plugin directory submission.

### Technical

- TypeScript 5.6, esbuild 0.24, CJS bundle, no runtime dependencies.
- `minAppVersion`: 1.9.10. `isDesktopOnly`: false.
- iOS-safe regex compile (lookbehind rejected at compile time).
- Storage split: settings in `data.json`, tag metadata in `tags.json`, avoiding write races.
- All event subscriptions registered via `registerEvent`, all observers via `register(() => obs.disconnect())`, ensuring zero leaks on unload.
- GitHub Actions: build on push and PR, release on tag push with `manifest.json`, `main.js`, `styles.css`, `versions.json` attached.

### Known limitations

- Tag pane is the only scope filtered in v0.1.0. Editor autocomplete, properties chips, and other scopes are planned for v0.2.
- Hide is the only action. Flag, group, alias, and color delegation are planned for v0.2 / v0.3.
- No profiles, aliases, or inbox mode in v0.1.0. These are planned for v0.3.
- No Tag Wrangler, Notebook Navigator, or Colored Tags Wrangler integration yet. Planned for v0.3-v0.4.
- Graph view and Bases scopes deferred to v0.5+ because of canvas rendering and Bases API volatility, respectively.

## Planned releases

- v0.2: graph view and autocomplete scopes, properties chips, recently created / orphan / stale panels, allow-only mode, onboarding wizard.
- v0.3: aliases, profiles, Tag Wrangler integration, inbox mode.
- v0.4: Notebook Navigator integration, suggested merges, export / import, community rule packs.
- v0.5+: Bases scope, Colored Tags Wrangler compatibility, mobile polish, community plugin directory submission.
```

- [ ] **Step 3: Commit**

Run:
```bash
git add README.md CHANGELOG.md
git commit -m "docs: refresh README and CHANGELOG for v0.1.0 release"
```

---

## Task 18: Manual QA sweep + release tag

**Files:**
- Modify: `TESTING.md` (smoke test additions)

**Why:** Implementation plan §7.5 minimum 24-cell QA sweep is the v0.3+ submission target; for v0.1 BRAT release, a 6-cell smoke sweep is sufficient.

- [ ] **Step 1: Add v0.1.0 smoke test section to `TESTING.md`**

Append to `TESTING.md`:
```markdown
## v0.1.0 Smoke Test (BRAT pre-release)

Test on these six cells before tagging:

| Vault size | Platform | Theme | Companion plugins |
|---|---|---|---|
| Small (10-20 notes) | Win11 desktop | Default dark | None |
| Small (10-20 notes) | Win11 desktop | Default light | None |
| Medium (200+ notes) | macOS / Linux | Default dark | Tag Wrangler enabled |
| Medium (200+ notes) | iOS (Obsidian Mobile) | Default | None |
| Large (~10k notes synthetic) | Win11 desktop | Default dark | None |
| Empty vault (0 notes) | Win11 desktop | Default | None |

For each cell verify:

1. Plugin loads without console errors.
2. All five presets toggle without errors.
3. "Hide hex color codes" preset hides at least one `#FFAA00`-style tag created in a test note.
4. Status bar updates as rules are toggled.
5. "Tag Curator: Open tag list view" opens, sorts, and search-filters.
6. Clicking the status bar opens tag list filtered to hidden.
7. "Tag Curator: Panic disable" removes all hidden styling immediately.
8. "Tag Curator: Toggle enable" cycles cleanly.
9. After plugin disable, every tag is visible again.
10. After re-enable, hidden tags return as expected.

If any cell fails, fix and re-run that cell before tagging.
```

- [ ] **Step 2: Commit**

Run:
```bash
git add TESTING.md
git commit -m "docs(testing): v0.1.0 six-cell smoke test matrix"
```

- [ ] **Step 3: Run final build and lint**

Run:
```bash
npm run lint
npm run build
ls main.js manifest.json styles.css versions.json
```
Expected: lint passes, build passes, all four artifacts present.

- [ ] **Step 4: Verify clean tree**

Run: `git status --short`
Expected: empty output.

- [ ] **Step 5: Merge to main and tag**

Run:
```bash
git checkout main
git merge --no-ff release/v0.1.0 -m "release: v0.1.0"
git tag 0.1.0
```

- [ ] **Step 6: Push (do not push automatically - confirm with user first)**

Stop here and prompt the user before running:
```bash
git push origin main
git push origin 0.1.0
```

The tag push triggers the release workflow that uploads `manifest.json`, `main.js`, `styles.css`, and `versions.json` to the GitHub release.

---

## Self-Review (against spec §9 v0.1 + overview "Recommended MVP")

| Spec requirement | Where in plan |
|---|---|
| Rule engine with regex, frequency, list match types | Task 1 (types), Task 6 (matchers + presets) |
| Hide action only | Task 4 (observer applies hide), Task 13 (rule editor defaults to hide) |
| Tag pane scope only | Task 4 (only `tag-pane`), Task 13 (scope locked to `tag-pane`) |
| 5 built-in presets | Task 6 (`PRESETS` array) |
| Basic settings UI | Task 11 (settings tab) |
| Tag list view with sort by count | Task 10 (tag list, default sort is count desc) |
| Panic disable (per overview MVP) | Tasks 5 + 8 |
| File-safe / display-only / reversible | Whole plan - observer uses class-based hiding, `panicCleanup` resets DOM, no monkey-patching, no metadata mutation |
| Schema-versioned settings | Task 2 |
| Mobile-safe regex | Task 6 (safeRegex), Task 14 (`isDesktopOnly: false`) |
| Status bar count + diagnostics | Tasks 5, 9, 10 |
| GitHub release artifacts | Task 15 |
| Community plugin directory submission readiness | Task 11 (`setHeading`), Task 14 (manifest), Task 17 (README/CHANGELOG) |

Placeholder scan:
- Searched the plan for "TBD", "TODO", "implement later", "fill in details" - none present.
- All code blocks contain final-form code, no `// TODO` markers, no half-functions.

Type consistency:
- `Rule`, `MatchCriteria`, `TagCuratorSettings`, `Scope`, `Action`, `TagMeta` are defined in Task 1 and used consistently across Tasks 2-13.
- `RuleEngine.testTag` (existing) and new `RuleEngine.testTagWithMeta` (Task 13) are both referenced correctly.
- `resolveActiveRules` is defined in Task 6 and called from Tasks 5 and 10.

If anything is unclear at task execution time, the implementing engineer should re-read the source documents in `docs/internal/discovery/` and prefer the implementation plan's primary-source contracts over inference.

---

## Execution Handoff

Plan complete and saved to `docs/internal/release-plans/plan_v0.1.0.md`. Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
