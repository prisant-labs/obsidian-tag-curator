# Tag Curator: Obsidian Plugin Specification

**A vault-wide tag visibility and curation engine for Obsidian.**

Version: Draft 0.1
Date: April 29, 2026
License (proposed): Apache 2.0
Org (proposed): `product-on-purpose`

---

## 1. Vision

Obsidian treats every `#token` as a first-class tag. For users with large, heterogeneous vaults this creates a long tail of accidental tags: hex color codes from web clippings, URL anchors, templater fragments, single-use experiments, typos. The native tag pane and graph view become noisy enough that they stop being useful as navigation tools.

**Tag Curator is a rule-based engine that filters, classifies, and surfaces tags across Obsidian's UI.** The underlying notes are never modified. The plugin is fully reversible by uninstalling. Its mental model is "Linter for tag visibility": rules + actions + scopes.

---

## 2. Problem Statement

Concrete pain points the plugin addresses:

1. Hex color codes (`#FFAA00`, `#abcdef`) parsed as tags from web-clipped CSS content, especially via MarkDownload.
2. URL fragments (`#section-3`) misread as tags.
3. Single-use experimental tags polluting autocomplete.
4. Templater code fragments treated as tags.
5. Inconsistent capitalization (`#AI`, `#ai`, `#Ai`) creating duplicate-looking entries.
6. No way to govern a "canonical" tag taxonomy at the display layer.
7. Native tag pane has no built-in filtering, blocking, or curation.
8. Stale tags (untouched for years) cluttering current views.

The Obsidian forum has tracked variations of these complaints since 2020. Forum threads remain open with no native fix planned. ([2022 thread](https://forum.obsidian.md/t/dont-treat-hexadecimal-numbers-as-tags/37143), [2021 thread](https://forum.obsidian.md/t/allow-users-to-turn-off-tags-or-customize-tag-recognition/26292))

---

## 3. Design Principles

1. **Files are sacred.** Tag Curator never modifies note content. All filtering is at display time only.
2. **Reversible by default.** Uninstalling restores original behavior immediately.
3. **Composable, not monolithic.** Integrate with Tag Wrangler, Notebook Navigator, Colored Tags Wrangler rather than absorbing their features.
4. **Data-layer respect.** Don't hide tags from queries (Dataview, Tasks, Bases). Hide from display only.
5. **Progressive disclosure.** Beginners get sensible presets; power users get a full rule engine.
6. **Performance first.** Scoped DOM observers, debounced writes, predictable resource use.
7. **Local-first.** No telemetry, no network calls, all data in vault `.obsidian` folder.

---

## 4. Architecture

### 4.1 Three-plane model

The engine has three orthogonal planes that compose into rules:

**Detection plane: how tags are matched.**
- Regex pattern
- Frequency threshold (used N times or fewer / more)
- First-seen age (newer than X days)
- Last-used age (untouched for X days)
- Source (frontmatter only, inline only, both)
- Folder origin (only tags found in notes under path X)
- Manual list (explicit allow / block)
- Edit-distance similarity (near-duplicates of given tag)

**Action plane: what to do when matched.**
- Hide
- Show only (whitelist polarity flip, used in allow-only mode)
- Flag for review (visible but visually marked)
- Group under virtual parent (display-only nesting)
- Delegate color (defer to Colored Tags Wrangler if installed)

**Scope plane: where the action applies.**
- Tag pane (native)
- Graph view (global)
- Local graph
- Editor autocomplete
- Properties panel (frontmatter tags)
- Search facets / filter chips
- Quick switcher
- Backlinks/outgoing links panes
- Hover preview popups
- Bases tag columns
- Notebook Navigator tag tree (if installed)
- Tag Wrangler context menu (if installed)

A **rule** = (detection, action, scope). Rules compose by priority. Last match wins; a special "always show" override exists for safety.

### 4.2 Data model

```typescript
interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  match: MatchCriteria;
  action: Action;
  scopes: Scope[];   // empty array = use global default
  notes?: string;    // user-written comment
}

interface MatchCriteria {
  type: "regex" | "frequency" | "age" | "source" | "folder" | "list" | "similarity";
  pattern?: string;
  operator?: "<" | "<=" | ">" | ">=" | "=";
  value?: number | string;
  list?: string[];
}

type Action = "hide" | "show-only" | "flag" | "group" | "delegate-color";

type Scope =
  | "tag-pane"
  | "graph"
  | "local-graph"
  | "autocomplete"
  | "properties"
  | "search-facets"
  | "quick-switcher"
  | "backlinks"
  | "hover-preview"
  | "bases"
  | "notebook-navigator"
  | "tag-wrangler-menu";
```

Stored in `.obsidian/plugins/tag-curator/data.json`.

### 4.3 Tag metadata sidecar

Beyond rules, the plugin maintains its own per-tag metadata, separate from Obsidian's metadata cache:

```typescript
interface TagMeta {
  tag: string;
  firstSeen: number;     // ms epoch
  lastSeen: number;
  count: number;
  description?: string;  // user-written glossary entry
  aliases?: string[];    // tags to display-merge under this canonical
  reviewed?: boolean;    // for inbox mode
}
```

Updated incrementally on `metadata-cache:changed` events. Debounced sidecar writes every 5 seconds. Stored in `.obsidian/plugins/tag-curator/tags.json`.

---

## 5. Features

### 5.1 Built-in rule presets

Ship with a curated set of toggleable presets. Users can disable, edit, copy, or delete:

- **Hide hex color codes** (`/^#[0-9A-Fa-f]{3,8}$/`)
- **Hide URL anchors** (configurable list of common patterns)
- **Hide pure-numeric tags** (note: Obsidian already strips these, but useful for edge cases)
- **Hide single-character tags** (`#a`, `#x`)
- **Hide orphan tags** (count <= 1)
- **Hide stale tags** (lastSeen > 365 days ago)
- **Hide clipping-folder tags** (tags only ever appearing in `Clippings/`)
- **Flag near-duplicate tags** (Levenshtein distance <= 2)

### 5.2 Modes

- **Default mode.** Rules hide matched tags.
- **Allow-only mode (whitelist).** Show only tags that match at least one allow rule. Useful for users with a curated taxonomy who treat unknown tags as drafts.
- **Inbox mode.** Newly-detected tags land in a "needs review" queue. Until reviewed, they show with a visual indicator. Reviewing means accepting (add to taxonomy), hiding (add to hide list), or merging (alias to existing).
- **Dry-run mode.** Show what a rule would hide without actually hiding it. Useful for testing new rules safely.

### 5.3 Tag list view (the main UI)

A sortable, filterable table of every tag in the vault:

- Tag name
- Count (current)
- First seen (date)
- Last used (date)
- Source (frontmatter / inline / both)
- Visible? (per scope, color-coded indicators)
- Rule that affects it (if any)
- Description (if set)
- Aliases (if set)
- Reviewed status (inbox mode)

Bulk operations: select N tags, then apply hide / unhide / alias to canonical / add description / export / send to Tag Wrangler for rename.

Filter the list itself: show only orphans, show only frontmatter tags, show only tags matching pattern, show only tags hidden by rule X, show only unreviewed (inbox), etc.

### 5.4 Rule editor

For each rule, a form with:

- Name and description
- Enabled toggle
- Priority (drag to reorder)
- Match criteria (form switches based on active match type)
- Action selector
- Scope checkboxes (with global default fallback indicator)
- **Live preview**: list of tags currently affected by this rule
- **Test field**: type a tag string, see whether the rule would match (and which other rules also affect it)

### 5.5 Curation panels

Dedicated views for common curation workflows:

- **Recently created tags.** Tags first seen in the last 7/30 days. Triage queue for the inbox-mode user.
- **Recently used tags.** Tags whose `lastSeen` was within the last N days. "What am I writing about lately."
- **Orphan tags.** Tags with count = 1.
- **Stale tags.** Tags with `lastSeen` > 365 days ago.
- **Suggested merges.** Pairs of tags within edit distance <= 2, with one-click "merge alias" or "rename via Tag Wrangler" actions.
- **Untagged notes.** Notes with zero tags (useful for taxonomy completeness checks).

### 5.6 Aliases and display-merging

Declarative tag aliasing without modifying files:

```yaml
canonical: "#ai"
aliases: ["#AI", "#Ai", "#artificial-intelligence", "#machine-learning/ai"]
```

In display, all aliases collapse under canonical. Original notes are unchanged. Useful for:

- Smoothing capitalization inconsistencies
- Consolidating synonyms
- Migrating to a new naming scheme without rewriting hundreds of files

**Important caveat**: aliases are display-only. Search for `#AI` still finds notes tagged `#AI`. Aliases just visually group them under `#ai` in the tag pane and graph.

For users who want true file-content rewrites, Tag Curator surfaces a "rewrite via Tag Wrangler" action that opens Tag Wrangler's rename dialog.

### 5.7 Profiles

Saved rule-set configurations the user can switch between:

- **"Writing mode"** hides admin/process tags
- **"Curation mode"** shows orphans and low-frequency tags for cleanup
- **"Default mode"** applies hex/URL filters only
- **"Demo mode"** shows everything (for screenshots, support requests)

One-click profile switch via command palette, status bar, or keyboard hotkey.

Notebook Navigator already has a "Vault profiles" feature; if installed, offer a sync option.

### 5.8 Export / import

- Export current rules + aliases + descriptions as JSON or YAML
- Import from file
- Import community rule packs (e.g., "web clipping cleanup," "academic writing," "developer notes," "PKM hygiene")
- Diff view when importing: see which rules will be added, modified, removed

Useful for sharing rule sets across vaults (e.g., personal vs work) or with the community.

### 5.9 Diagnostics

- **"Why is this tag hidden?"** right-click action shows which rule(s) hid it
- Optional debug log of rule evaluations (dev mode only, written to plugin folder, not console spam)
- Status bar indicator: "X tags hidden by Y rules" (clickable to open tag list filtered to hidden)
- **Health check** on plugin load: warn if integrations expected (Tag Wrangler, Notebook Navigator) are not detected, or if rule count is unusually high

### 5.10 Command palette commands

Every major action is exposed as a command:

- Toggle Tag Curator on/off (kill switch)
- Open tag list view
- Switch profile
- Mark current tag (under cursor) as canonical
- Add current tag to hide list
- Quick-create rule from current tag
- Show recently created tags panel
- Show orphan tags panel
- Run dry-run preview
- Reload rule presets

### 5.11 Hotkeys

All commands above are hotkey-bindable per Obsidian convention. No defaults shipped (avoid stomping on user bindings).

### 5.12 Mobile considerations

Tag Curator should work on Obsidian mobile, with awareness that:

- Mobile tag pane and properties panel render differently
- Mobile autocomplete UI is distinct from desktop
- Some integrations (Notebook Navigator) work on mobile, others may not
- Touch targets in the settings UI need adequate sizing
- Bulk-select operations need a long-press alternative

---

## 6. Plugin Integrations

### 6.1 Tag Wrangler

Tag Wrangler ([github](https://github.com/pjeby/tag-wrangler), 870+ stars, actively maintained as of March 2026 release 0.6.4) is the de facto rename/merge plugin. Tag Curator integrates by listening for Tag Wrangler's documented context menu event and adding curation actions:

- "Hide tag (Tag Curator)"
- "Mark as canonical"
- "Add alias..."
- "Add to rule..."
- "Send to Inbox"

If Tag Wrangler is absent, Tag Curator provides its own right-click handler with the same actions.

A courtesy issue could be opened on Tag Wrangler describing the integration so the maintainer is aware. Not a PR (scope mismatch confirmed by maintainer's stated philosophy on [issue #34](https://github.com/pjeby/tag-wrangler/issues/34)).

### 6.2 Notebook Navigator

Notebook Navigator ([github](https://github.com/johansan/notebook-navigator), released 2025) replaces Obsidian's file explorer and has its own tag tree with built-in hidden-tag support and Vault Profiles.

Integration options:

- Detect on plugin load
- Offer "sync hidden tags with Notebook Navigator" toggle
- Offer "sync profiles" toggle (Tag Curator profile <-> NN profile)
- Honor Notebook Navigator's tag-color settings if both visible

If Notebook Navigator's public API exposes the hidden list as read/write, sync is two-way. If read-only, Tag Curator can read NN's hidden list as input but not write to it.

NN's author has stated avoidance of "DOM hacks or monkey-patching" but Tag Curator's DOM-styling approach (set `display: none` on already-rendered nodes) is distinct from NN's concern (modifying internal Obsidian classes/methods). The two are technically and philosophically compatible.

### 6.3 Colored Tags Wrangler

Orthogonal concern. Tag Curator does not assign colors directly; users who want color rules use [Colored Tags Wrangler](https://github.com/code-of-chaos/obsidian-colored_tags_wrangler). If both installed, Tag Curator can offer "apply color via Colored Tags Wrangler when this rule matches" as a delegate action.

### 6.4 Tasks, Dataview, Bases

Tag Curator deliberately does NOT hide tags from these. They are query layers and should see real, unfiltered data. Filtering at the data layer would silently break user queries.

If a user explicitly wants Dataview to ignore certain tags, they should use Dataview's own query syntax. Tag Curator can offer a settings tooltip explaining this.

### 6.5 Templater, QuickAdd

These plugins generate tags via templates. Tag Curator can offer rules like "ignore tags inserted by Templater between dates X and Y" or "ignore tags in templates folder." Template-generated tags are a known source of taxonomy noise.

---

## 7. Technical Architecture

### 7.1 Approach: DOM filtering, not metadata patching

Tag Curator hides tags by manipulating the DOM at render time. It does NOT monkey-patch `MetadataCache.getTags()` or any other internal Obsidian API.

Rationale:

1. Monkey-patching internals is fragile across Obsidian releases.
2. Patching the data layer would corrupt query results in Dataview/Tasks/Bases.
3. DOM filtering is fully reversible (uninstall restores immediately).
4. Tag Curator's approach (set `display: none` on rendered nodes) is what every theme plugin does. It is safe.

### 7.2 Observer pattern

For each scoped UI area:

1. On `app.workspace.onLayoutReady()`, locate the container element using documented selectors.
2. Run an initial filter pass.
3. Attach a `MutationObserver` **scoped to that container** (NOT `document.body`).
4. On mutation, re-evaluate visible tags within the container.
5. On `app.workspace.on("layout-change", ...)`, re-locate containers in case panes were rearranged.
6. On unload, disconnect all observers and clear all inline `display: none` styles.

### 7.3 Tag metadata tracking

Listen for `metadata-cache:changed` events. For each changed file:

1. Read its tags via `app.metadataCache.getFileCache(file)?.tags` and frontmatter parsing.
2. For each tag, update `lastSeen` to now and increment count for the affected file delta.
3. For new tags, set `firstSeen` to now and (in inbox mode) mark as unreviewed.
4. Debounce sidecar write (5 seconds default, configurable).

### 7.4 Storage

- `.obsidian/plugins/tag-curator/data.json`: rules, profiles, aliases, settings.
- `.obsidian/plugins/tag-curator/tags.json`: per-tag metadata sidecar.
- Optional: SQLite via `better-sqlite3` for very large vaults (50K+ notes). Out of scope for v0.1.

Both files are pretty-printed JSON for human readability and easy git diffing.

### 7.5 Performance characteristics

For a 10K-note vault with 1,500 unique tags and 30 rules (representative of an active PKM user):

- **Idle**: near-zero CPU
- **Active editing**: <1% additional CPU, undetectable in practice
- **Initial load**: 50-200ms one-time on workspace ready
- **Memory**: 2-5MB working set + ~150KB sidecar
- **Mobile**: comparable to Linter or Tag Wrangler

Rule evaluation cost: O(M*R) where M = unique tag count, R = rule count. Realistic worst case ~10ms per full re-evaluation.

DOM update cost: ~5-20ms initial sweep, ~1-5ms per incremental update.

### 7.6 Reliability and safety

- All inline DOM modifications use a custom data attribute (`data-tag-curator-hidden`) so they're greppable and removable on uninstall.
- A "panic disable" command in the palette nukes all DOM modifications immediately, even if settings UI fails to load.
- Settings save is atomic (write-temp-then-rename).
- No destructive operations without confirmation.
- Sidecar corruption handled gracefully (rebuild from metadata cache on next load).

---

## 8. UX Design

### 8.1 Settings tab structure

```
Tag Curator
├── General
│   ├── Mode (default / allow-only / inbox)
│   ├── Default scope (checkboxes for UI areas)
│   ├── Profile selector
│   └── Master enable/disable toggle
├── Rules
│   ├── [Rule list with drag-to-reorder]
│   ├── [Filter and search]
│   └── [+ Add rule]
├── Tags
│   ├── [Tag list view, filterable, sortable]
│   ├── [Bulk operations toolbar]
│   └── [Curation panels: recent / orphan / stale]
├── Aliases
│   └── [Canonical -> aliases mapping editor]
├── Profiles
│   └── [Saved rule-set configurations]
├── Integrations
│   ├── Tag Wrangler (auto-detected)
│   ├── Notebook Navigator (auto-detected)
│   └── Colored Tags Wrangler (auto-detected)
└── Advanced
    ├── Sidecar location
    ├── Debug log toggle
    ├── Export / import
    └── Reset all
```

### 8.2 Onboarding

First-run wizard, skippable at any step:

1. "Welcome. Let's set up Tag Curator." (intro)
2. "Pick presets you'd like enabled." (checkboxes for hex, URL, orphan, etc.)
3. "Pick UI areas to filter." (checkboxes for tag pane, graph, autocomplete...)
4. "Want to enable Inbox mode?" (yes / no / explain)
5. "Detected integrations: [Tag Wrangler, Notebook Navigator]. Enable?"
6. Done. Show tag list with current state.

### 8.3 Discoverability and the "where did my tag go?" prevention

Whenever a tag is hidden, the UI makes it discoverable why:

- Status bar shows "X tags hidden"
- Click status bar to open tag list filtered to hidden tags
- Each hidden tag shows which rule hid it
- One-click "show this tag" override per tag

### 8.4 Visual treatment

- Use existing Obsidian CSS variables (no hardcoded colors)
- Respect light/dark theme
- Style Settings plugin support (expose key colors and sizes)
- Accessibility: keyboard navigation through settings, ARIA labels on bulk operation buttons, sufficient contrast for the "rule that hid this tag" indicator

---

## 9. Roadmap

**v0.1 (MVP, 2-3 weekends).**
- Rule engine with regex, frequency, list match types
- Hide action only
- Tag pane scope only
- 5 built-in presets (hex, URL anchor, numeric, single-char, orphan)
- Basic settings UI
- Tag list view with sort by count

**v0.2.**
- Graph view scope
- Autocomplete scope
- Tag metadata sidecar (firstSeen, lastSeen, count)
- Recently created / orphan / stale curation panels

**v0.3.**
- Aliases / display-merge
- Profiles
- Tag Wrangler integration
- Inbox mode
- Dry-run mode

**v0.4.**
- Notebook Navigator integration
- Suggested merges (Levenshtein)
- Export / import
- Community rule packs (curated collection in repo)

**v0.5+.**
- Bases scope
- Colored Tags Wrangler delegate integration
- Mobile polish
- Localization
- SQLite backend for very large vaults
- Submit to Obsidian community plugin directory

---

## 10. Non-goals

Things Tag Curator deliberately will NOT do:

- Modify note content. (Use Tag Wrangler.)
- Color tags. (Use Colored Tags Wrangler.)
- Replace the file explorer. (Use Notebook Navigator.)
- Index or query tags. (Use Dataview.)
- Run on every keystroke. (Debounced.)
- Send telemetry. (Local-first, no network.)
- Sync settings across devices independently. (Use Obsidian Sync or git.)

---

## 11. Open Questions and Risks

- Tag Wrangler integration event signature (need to read source).
- Notebook Navigator API read/write capability for hidden tags.
- Bases tag rendering DOM path (may need separate observer).
- Mobile autocomplete and properties panel DOM differences.
- How to handle nested tags in alias merging (`#a/b` aliased to `#a/c`?).
- Performance on 50K+ note vaults (worth real-device test).
- Whether to publish to community plugin directory or keep self-hosted.
- Internationalization: do non-English tag names break any of the regex presets?
- Conflict resolution when two rules target the same tag with different actions (priority + last-match-wins documented but UX needs polish).

---

## 12. License & Distribution

- Apache 2.0 (matching `pm-skills` repo convention)
- Hosted under `product-on-purpose` GitHub org
- Submitted to Obsidian community plugin directory after v0.3 stabilization
- Semantic versioning
- Changelog maintained
- Issue templates for bug / feature / integration

---

## 13. Prior Art and References

**Obsidian forum threads (open feature requests):**
- "Don't treat hexadecimal numbers as tags" (open since 2022): https://forum.obsidian.md/t/dont-treat-hexadecimal-numbers-as-tags/37143
- "Allow customizing tag recognition" (open since 2021): https://forum.obsidian.md/t/allow-users-to-turn-off-tags-or-customize-tag-recognition/26292
- "Hide tags in tag pane" (open since 2023): https://forum.obsidian.md/t/hide-tags-in-the-tags-pane/53588
- "Hexidecimal color codes in tag pane" (filed as bug 2020, archived): https://forum.obsidian.md/t/hexidecimal-color-codes-in-md-notes-are-included-in-tag-pane/4097

**Adjacent plugins:**
- Tag Wrangler: https://github.com/pjeby/tag-wrangler
- Notebook Navigator: https://github.com/johansan/notebook-navigator
- Colored Tags Wrangler: https://github.com/code-of-chaos/obsidian-colored_tags_wrangler
- Color Palette: https://www.obsidianstats.com/plugins/color-palette
- Linter (architectural model): https://github.com/platers/obsidian-linter

**Development resources:**
- Obsidian plugin sample: https://github.com/obsidianmd/obsidian-sample-plugin
- Obsidian plugin API docs: https://docs.obsidian.md/Home

---

## 14. Appendix: Example Configuration

```yaml
# .obsidian/plugins/tag-curator/data.json (rendered as YAML for readability)

settings:
  mode: default            # default | allow-only | inbox
  defaultScopes:
    - tag-pane
    - graph
  inboxAutoReview: false
  dryRun: false
  debugLog: false
  sidecarDebounceMs: 5000

rules:
  - id: hide-hex-codes
    name: "Hide hex color codes"
    enabled: true
    priority: 100
    match:
      type: regex
      pattern: "^#[0-9A-Fa-f]{3,8}$"
    action: hide
    scopes: [tag-pane, graph]
    notes: "Catches CSS hex codes from web clippings"

  - id: flag-orphans
    name: "Flag single-use tags"
    enabled: false
    priority: 50
    match:
      type: frequency
      operator: "<="
      value: 1
    action: flag
    scopes: [tag-pane]
    notes: "Surfaces likely typos and one-off experiments"

  - id: hide-stale
    name: "Hide tags untouched for a year"
    enabled: false
    priority: 40
    match:
      type: age
      operator: ">="
      value: 365
    action: hide
    scopes: [tag-pane, autocomplete]

aliases:
  - canonical: "#ai"
    aliases: ["#AI", "#Ai", "#artificial-intelligence"]
  - canonical: "#pkm"
    aliases: ["#PKM", "#personal-knowledge-management"]

profiles:
  - name: "Writing mode"
    enabledRules: [hide-hex-codes, hide-templater-fragments]
    disabledRules: [flag-orphans]
  - name: "Curation mode"
    enabledRules: [flag-orphans, hide-stale]
    disabledRules: [hide-hex-codes]

integrations:
  tagWrangler: auto
  notebookNavigator: sync-hidden
  coloredTagsWrangler: delegate
```

---

## 15. Appendix: File Tree

```
tag-curator/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug.md
│   │   ├── feature.md
│   │   └── integration.md
│   └── workflows/
│       └── release.yml
├── src/
│   ├── main.ts                 # Plugin entry
│   ├── engine/
│   │   ├── ruleEngine.ts
│   │   ├── matchers.ts
│   │   └── actions.ts
│   ├── observers/
│   │   ├── tagPaneObserver.ts
│   │   ├── graphObserver.ts
│   │   └── autocompleteObserver.ts
│   ├── integrations/
│   │   ├── tagWrangler.ts
│   │   ├── notebookNavigator.ts
│   │   └── coloredTagsWrangler.ts
│   ├── storage/
│   │   ├── settings.ts
│   │   └── tagMeta.ts
│   ├── ui/
│   │   ├── settingsTab.ts
│   │   ├── tagListView.ts
│   │   ├── ruleEditor.ts
│   │   └── onboarding.ts
│   └── types.ts
├── styles.css
├── manifest.json
├── package.json
├── esbuild.config.mjs
├── tsconfig.json
├── README.md
├── CHANGELOG.md
└── LICENSE
```
