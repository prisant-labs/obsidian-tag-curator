# Tag Curator: Obsidian Plugin Specification

**A vault-wide tag visibility and curation engine for Obsidian.**

Version: Draft 0.1
Original date: April 29, 2026
Last reconciled: May 28, 2026 (with locked v0.1 design)
License: Apache 2.0
Org: `product-on-purpose`

---

> **📌 v0.1 Implementation Status (2026-05-28).** This spec is the canonical product reference. Where the spec and the locked v0.1 design diverge, the **locked design wins** for v0.1 - this section calls out the deltas. All open questions, decisions, and the running record of design changes live in **`docs/internal/scope-and-decisions.md`** (D-001 through D-011, Q-001 through Q-008). Source of truth for what is shipping in v0.1:
>
> - **Code state.** Engine, observer, storage, settings, status bar, panic disable, and 6 commands are implemented. 118/118 tests pass. Build, lint, and tsc are green.
> - **Design state (locked).** Settings tab layout, Tag list view, Rule editor (card view + right-docked preview), Welcome modal, state banner, preview-mode naming. See `docs/internal/release-plans/plan_v0.1.0/ui-design_v0.1.0_converged.html`.
> - **Engine behavior.** `previewMode` (renamed from `dryRun`, schema v2 migration); **highest-priority match wins** (Q-005 fixed - earlier "last-match-wins" was a bug); priority is hidden from the UI for v0.1 (architected, default 50; v0.2 will surface drag-to-reorder, B012).
> - **Remaining work to ship.** Translate the locked design to `src/ui/settingsTab.ts`, `tagListView.ts`, `ruleEditor.ts`; release dry-run (`build`/`test`/`lint`/CI sanity); BRAT smoke test sweep.
>
> Sections below mark major divergences with a `→ v0.1 reality:` note pointing to the relevant decision (D-xxx) or open question (Q-xxx).

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
8. **State visibility.** Any non-default plugin state (Preview mode on, plugin disabled) is shown as a persistent banner above every Tag Curator surface, with a one-click action to restore the default. Actions that produce state (panic disable) name the resulting state plainly. See D-007.

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

A **rule** = (detection, action, scope). Rules compose by priority. **The highest-priority matching enabled rule wins** (Q-005: an earlier "last match wins under priority-desc iteration" implementation produced the opposite - lowest-priority win - and was fixed 2026-05-28). A special "always show" override exists for safety.

→ **v0.1 reality:** priority is architected in the engine but **hidden from the UI** for v0.1 (D-009). New custom rules default to `priority: 50`; built-in presets keep their values (80-100). v0.2 surfaces drag-to-reorder (B012).

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

Ship with a curated set of toggleable presets. Presets are `builtin: true` (toggleable but not editable or deletable); a user who wants to change one copies it into a custom rule. Tags are matched **without** the leading `#` (the matcher strips it), so patterns are anchored against the bare tag name.

**v0.1 ships exactly 5 presets** (source: `src/engine/presets.ts`). The two marked "on" are enabled by default; the rest are off until the user opts in:

| Preset id | Name | Match | Default | Notes |
|-----------|------|-------|---------|-------|
| `hide-hex-codes` | Hide hex color codes | regex `^[0-9A-Fa-f]{3,8}$` | **on** | CSS hex codes from web clippings (esp. MarkDownload). |
| `hide-url-anchors` | Hide URL anchor fragments | regex `^(top\|bottom\|navigation\|content\|main\|header\|footer\|sidebar\|toc)$\|^[a-z]+-[0-9]+$` | **on** | Common URL fragment patterns from web clippings. |
| `hide-single-char` | Hide single-character tags | regex `^[A-Za-z]$` | off | Likely typos or single-character shortcuts (`#a`, `#x`). |
| `hide-numeric` | Hide purely numeric tags | regex `^[0-9]+$` | off | Obsidian usually strips these; catchall for the edge cases. |
| `hide-orphans` | Hide orphan tags (count <= 1) | frequency `count <= 1` | off | Tags appearing in one or fewer notes; likely typos or experiments. |

**Deferred to v0.2+** (require data the v0.1 engine does not yet compute, or new match types):

- **Hide stale tags** (`lastSeen` > 365 days ago) - needs a date-comparison match type.
- **Hide clipping-folder tags** (tags only ever appearing in `Clippings/`) - needs per-tag folder provenance.
- **Flag near-duplicate tags** (Levenshtein distance <= 2) - needs a cross-tag similarity match type; pairs with the merge/alias workflow.

### 5.2 Modes

- **Default mode.** Rules hide matched tags.
- **Allow-only mode (whitelist).** Show only tags that match at least one allow rule. Useful for users with a curated taxonomy who treat unknown tags as drafts.
- **Inbox mode.** Newly-detected tags land in a "needs review" queue. Until reviewed, they show with a visual indicator. Reviewing means accepting (add to taxonomy), hiding (add to hide list), or merging (alias to existing).
- **Preview mode.** Show what a rule would hide by visibly flagging matched tags instead of hiding them. Useful for testing new rules safely. (Internal setting key: `previewMode`. Pre-v2 schema called this `dryRun`; migrated automatically.)

### 5.3 Tag list view (the main UI)

→ **v0.1 reality (D-011):** the Tag list ships as a **single component rendered in two host containers**: (1) a sidebar leaf opened by `Tag Curator: Open tag list view`, (2) a Settings tab between General and Presets. State (selection, filter, sort) lives on the plugin, so both views stay in sync. Earlier proposal to keep them separate was reversed in the round-3/4 review when "doubling up two surfaces" was correctly identified as not a real concern.

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

→ **v0.1 reality (D-010, supersedes D-001):** the rule editor is a **card view + right-docked scrollable preview panel**. The main area shows rules as cards (name + Type + enable toggle + "N tags affected" chip). Clicking a card swaps the main area to edit mode; clicking the dashed `+ New rule` card opens edit mode with sensible defaults - **no separate wizard** (D-002 closed). A right-docked preview panel stays visible across both views: vault-wide affected tags in card view; filtered to the selected rule in edit mode, with a stats row (Unique tags / Total instances / Notes touched).
>
> Per D-009, **priority is hidden from the UI** in v0.1 (no drag-to-reorder; engine defaults custom rules to 50). v0.2 surfaces drag-to-reorder via B012.

In **edit mode**, the sectioned form runs top to bottom:

- **Type** (first row): `regex` / `frequency` / `list`. Switches the visible match input.
- **Identity**: Name (enabled toggle is in the view header and on the card; priority is hidden per D-009).
- **Match** (sentence-builder): "When a tag's name `[matches the regex|has a count that|is one of]` `[input]`."
- **Then**: Action (`hide` / `flag` / `show-only` / `group`) + Scope (`tag-pane` in v0.1; `+ graph`, `all surfaces` flagged v0.2).
- **Preview** (right-docked panel): scannable list (tag - count) for tags this rule affects. Sortable by count.

### 5.5 Curation panels

→ **v0.1 reality:** all curation panels are **deferred to v0.2+**. v0.1 ships only the tag list view with filter chips (Hidden, Orphans, Frontmatter, Unreviewed). Each panel below is tracked separately when individually scoped.

Dedicated views for common curation workflows (v0.2+):

- **Recently created tags.** Tags first seen in the last 7/30 days. Triage queue for the inbox-mode user.
- **Recently used tags.** Tags whose `lastSeen` was within the last N days. "What am I writing about lately."
- **Orphan tags.** Tags with count = 1. (Filter chip in the v0.1 tag list approximates this.)
- **Stale tags.** Tags with `lastSeen` > 365 days ago. (Needs the deferred `hide-stale-tags` preset; see §5.1.)
- **Suggested merges.** Pairs of tags within edit distance <= 2, with one-click "merge alias" or "rename via Tag Wrangler" actions. (Pairs with B006.)
- **Untagged notes.** Notes with zero tags (useful for taxonomy completeness checks).

### 5.6 Aliases and display-merging

→ **v0.1 reality:** deferred to v0.3 (B006, D-004). `TagMeta.aliases` already exists in the type; the engine and observer wiring + Tag Wrangler rename delegation arrive in v0.3.

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

→ **v0.1 reality:** deferred to v0.2 (Profiles tab in the v0.1 Settings shell is shown with a `v0.2` badge).

Saved rule-set configurations the user can switch between:

- **"Writing mode"** hides admin/process tags
- **"Curation mode"** shows orphans and low-frequency tags for cleanup
- **"Default mode"** applies hex/URL filters only
- **"Demo mode"** shows everything (for screenshots, support requests)

One-click profile switch via command palette, status bar, or keyboard hotkey.

Notebook Navigator already has a "Vault profiles" feature; if installed, offer a sync option.

### 5.8 Export / import

→ **v0.1 reality:** deferred to v0.3 - file-import path first (B005), then a hosted community index. v0.1's data files (`data.json`, `tags.json`) are pretty-printed JSON for manual export/git-diff use.

- Export current rules + aliases + descriptions as JSON or YAML (v0.3)
- Import from file (v0.3)
- Import community rule packs (e.g., "web clipping cleanup," "academic writing," "developer notes," "PKM hygiene") (v0.3+)
- Diff view when importing: see which rules will be added, modified, removed (v0.3)

Useful for sharing rule sets across vaults (e.g., personal vs work) or with the community.

### 5.9 Diagnostics

- **`RuleEngine.getRuleAttribution(tag, meta, rules)`** is the canonical diagnostic helper. Returns `{ effective, allMatches }` where `effective` is the highest-priority match (Q-005 fix) and `allMatches[]` is every matching rule in priority-descending order with `reason` strings. Powers the "why is this tag hidden?" UX across every surface.
- **Persistent state banner (D-007).** Whenever the plugin is in a non-default state - Preview mode on, or plugin disabled - a top-docked banner appears above every Tag Curator surface (Settings, Tag list, Rule editor) showing the state and a one-click action to restore the default. Two variants: `Preview mode is on` (amber, with `Turn off preview`) and `Tag Curator is off` (muted, with `Turn on`).
- Optional debug log of rule evaluations (Settings > Advanced > Debug logging).
- Status bar indicator: "X tags hidden" (clickable to open tag list filtered to hidden); "(preview): N flagged" when Preview mode is on; "off" when the plugin is disabled.
- **Health check** on plugin load: warn if integrations expected (Tag Wrangler, Notebook Navigator) are not detected, or if rule count is unusually high (deferred to v0.2; B004 covers the welcome-modal detection slice).

### 5.10 Command palette commands

Every major action is exposed as a command. All appear in Obsidian's palette (Cmd/Ctrl+P); each is named for its outcome, not its implementation.

**v0.1 ships exactly 6 commands** (source: `src/main.ts`):

| Command id | Palette name | Functionality |
|------------|--------------|---------------|
| `toggle-enable` | Toggle enable | Flips the plugin's `enabled` flag on/off (the kill switch). Shows a Notice with the new state. |
| `panic-disable` | Panic disable (remove all DOM effects now) | One-shot action that produces the off state. Immediately removes **all** DOM modifications (un-hides every tag), sets `enabled = false`, runs `panicCleanup`, and triggers the persistent "Tag Curator is off" state banner across every Tag Curator surface (see §7.6 and D-007). Works even if the settings UI fails to load. |
| `toggle-preview-mode` | Toggle preview mode | Flips `previewMode`. When on, matched tags are flagged (not hidden) so the user can preview rule impact before committing, and the persistent "Preview mode is on" state banner (D-007) appears above every Tag Curator surface. (Pre-v2 command id was `toggle-dry-run`; renamed.) |
| `open-tag-list` | Open tag list view | Opens (or reveals) the Tag list view in the right sidebar. |
| `open-tag-list-hidden` | Open tag list (hidden tags only) | Opens the Tag list view pre-filtered to tags currently hidden by a rule. Also the click target of the status-bar item. |
| `rescan-tags` | Rescan vault tags | Re-runs `scanAll()` across every markdown file, rebuilding the tag metadata sidecar. Bookended by progress Notices. |

**Deferred to v0.2+:** Switch profile, mark current tag as canonical, add current tag to hide list, quick-create rule from current tag, show recently-created / orphan panels, reload rule presets. (Profiles and inbox panels are themselves v0.2+ features.)

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

#### 6.1.1 Bulk "Send to Tag Wrangler" action (v0.1)

The Tag list view's bulk-actions toolbar includes a **Send to Tag Wrangler** button. This is Tag Curator's primary delegation point for **renaming** - because renaming touches files, Tag Curator does not do it itself.

**Detection.** The button is only enabled when `this.app.plugins.enabledPlugins.has('tag-wrangler')` is true. Otherwise it is hidden with a tooltip "Install Tag Wrangler to enable bulk rename."

**Flow.**

1. User selects N tags in the Tag list view via row checkboxes.
2. User clicks `Send to Tag Wrangler`.
3. For each selected tag, Tag Curator invokes Tag Wrangler's exposed rename command. Two attempted strategies in order:
   - **a.** `this.app.commands.executeCommandById('tag-wrangler:rename-tag')` if the command id is present (preferred; survives Tag Wrangler internal changes).
   - **b.** Triggering the workspace event Tag Wrangler listens on for the tag-pane context menu (`workspace.trigger('hover-link', ...)` shape; documented in spec §6.1 reference issue), passing the tag as payload.
4. Tag Wrangler opens its native rename modal pre-loaded with the tag(s). The user chooses the new name there. Tag Wrangler edits the files.
5. Tag Curator's Tag list view refreshes on the next `metadataCache.changed` event - no extra wiring needed because we already listen for it.

**Why delegate.** Doing the rename ourselves would violate Tag Curator's file-safe contract (we don't write note content). Tag Wrangler is the trusted rename surface. This keeps Tag Curator's responsibilities clean: we curate the *display* of tags; Tag Wrangler curates the *content*.

**Error handling.** If Tag Wrangler's command is not found at runtime (e.g. disabled after we cached the detection), the button shows a Notice "Tag Wrangler is not available - re-enable it and try again," and no Tag Curator state changes.

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
- **Panic disable** is a one-shot action that produces a state. The action: instantly removes every DOM modification (un-hides all tags) and runs `panicCleanup` even if the settings UI fails to load. The state: `enabled = false` is persisted, and a **persistent state banner** ("Tag Curator is off") appears at the top of every Tag Curator surface (Settings, Tag list, Rule editor) until the user re-enables. The banner carries an inline `Turn on` action so resolving the state is one click. Same banner pattern shows "Preview mode is on" (amber) when `previewMode = true`. See decision D-007 in `scope-and-decisions.md`.
- Settings save is atomic (write-temp-then-rename).
- No destructive operations without confirmation.
- Sidecar corruption handled gracefully (rebuild from metadata cache on next load).

---

## 8. UX Design

### 8.1 Settings tab structure

→ **v0.1 reality (locked).** Top-tab layout. Tabs marked with a `v0.2` / `v0.3` badge are visible but show a deferred placeholder.

```
Tag Curator
├── General             ← master enable, Preview mode toggle, stats header, panic disable
├── Tag list (1,542)    ← same component as the sidebar leaf (D-011)
├── Presets (5)         ← 5 built-in toggleable presets (see §5.1)
├── Custom rules (3)    ← card-view rule editor (D-010)
├── Commands            ← reference for the 6 v0.1 commands (see §5.10)
├── Advanced            ← Index maintenance (Reindex now), Performance, Troubleshooting
├── Profiles [v0.2]     ← deferred (§5.7)
└── Aliases [v0.3]      ← deferred (§5.6)
```

- The **General** tab opens with a stats header (Total tags / Hidden now / Active rules / Orphans), then the master `Enable Tag Curator` toggle, the `Preview mode` toggle, and the `If something looks wrong` panic-disable row.
- Whenever the plugin is in a non-default state, a **state banner** (D-007) sits above the panel content.
- Defaults shown on every panel via the persistent banner mean the user always knows the current mode.
- The pre-v0.1 spec had a `Tags` tab and a separate `Rules` tab. v0.1 ships the Tag list and Custom rules tabs (renamed accordingly).

### 8.2 Onboarding

→ **v0.1 reality (D-008, D-002 closed).** Replaced the multi-step wizard with a single, prominent first-run **welcome modal**. Fires once on first enable (state gated by `seenWelcomeModal: true` in settings). The wizard is **dropped** for v0.1 (and unlikely to return - D-002 closed).

**Welcome modal structure** (locked design in `ui-design_v0.1.0_converged.html` section 4):

1. **Header** acknowledges current state. Eyebrow: `Tag Curator is now enabled`. h3: `Choose how to start`. Sub: `Before any tag is curated, here is what you can expect.`
2. **Safety promises** strip (success-tinted background, left-aligned check rows):
   - ✓ **Display-only.** It never edits your notes.
   - ✓ **File-safe.** No content is written to markdown.
   - ✓ **Fully reversible.** Disable Tag Curator and everything returns.
3. **Two presets will run** (toggleable cards). User can untick before committing. (Hex codes and URL anchors on by default; see §5.1.)
4. **Integrations detected** (per-plugin cards with name + state pill + bulleted "what changes"). Detection logic gated to v0.2 (B004); v0.1 ships a hardcoded card set with `Tag Wrangler`, `Notebook Navigator`, `Colored Tags Wrangler`.
5. **Footer.** Primary: `Start curating` (apply rules, matched tags hidden). Secondary: `Start in preview mode` (flag instead of hide). One-sentence explainer next to the buttons explains what Preview mode does.

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

### v0.1 (current release).

**Engine + storage** (shipped):
- Three-match-type rule engine (regex, frequency, list); highest-priority match wins (Q-005)
- `previewMode` mode (renamed from `dryRun`, schema v1 → v2 migration; D-003)
- 5 built-in toggleable presets (hex, URL anchor, single-char, numeric, orphans; §5.1)
- Tag metadata sidecar (`tags.json`) with `firstSeen`, `lastSeen`, `count`, `sources`
- 6 commands (§5.10); status bar; panic disable; persistent state banner pattern (D-007)

**UI** (locked design, implementation pending):
- Top-tab Settings layout including Tag list tab (D-011)
- Tag list view (row-based, sortable, virtualized; `Source` and other column tooltips)
- Rule editor: card view + right-docked preview (D-010, supersedes D-001)
- Welcome modal (D-008); state banner (D-007)
- Priority architected, hidden from UI (D-009)

### v0.2.
- Graph view scope, autocomplete scope, properties chip scope
- Compound criteria builder (AND/OR/NOT) and drag-drop canvas (B001/B002)
- Conflict resolver view (B008)
- Tag detail sheet (B009)
- Hierarchy cascade toggle (B010)
- File-extension file-filter on rules (B011, Q-008 reversal)
- Drag-to-reorder rules in card view (B012)
- Density toggle (B003)
- Plugin-integration detection in welcome modal (B004)
- Curation panels (§5.5)
- Allow-only mode

### v0.3.
- Aliases / display-merge with Tag Wrangler rename delegation (B006, D-004)
- Profiles (§5.7)
- Rule library / preset gallery (B005)
- Tag analytics dashboard (B007; flagged "liked" by reviewer)
- Inbox mode
- Tag Wrangler full integration (beyond the v0.1 §6.1.1 bulk action)

### v0.4.
- Notebook Navigator integration (full)
- Suggested merges (Levenshtein)
- Export / import
- Community rule packs (curated collection in repo)

### v0.5+.
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
- Conflict-resolution UX. The semantics are resolved (highest priority wins, Q-005 fixed); a dedicated conflict-resolver view is deferred to v0.2 (B008). When conflicts are rare in v0.1 rule counts, the tag list's `Rule` column showing every matching rule stacked is sufficient.

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
