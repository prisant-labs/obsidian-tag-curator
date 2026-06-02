# Tag Curator v0.1.0 - Release Notes (Draft)

| Field | Value |
|---|---|
| Status | **Draft for GitHub release body** |
| Target tag | `0.1.0` |
| Date | TBD (pending BRAT smoke + tag push) |
| Branch | `release/v0.1.0` |

> This file is a working draft of the GitHub release body. When `0.1.0` is tagged, the contents of this file (minus the meta table above) will be posted as the release description.

---

## Tag Curator v0.1.0 - Vault-wide tag visibility and curation, without touching your notes

The first BRAT-distributable release of Tag Curator. Hide, flag, and surface tags across Obsidian's native tag pane using a real rule engine - without modifying a single file. Disable the plugin and every tag returns. Uninstall and the same.

> Display-only. File-safe. Fully reversible.

## What's new

### Rule engine

- Three match types: **regex** (pattern), **frequency** (count threshold), and **specific tags** (list).
- Five built-in presets: hide hex color codes, URL anchor fragments, single-character tags, purely numeric tags, and orphan tags. Toggleable per preset; the first two are enabled by default.
- Custom rules: name, match, action, scope - configured via a card-view editor with a live right-docked preview of affected tags.
- Highest-priority match wins (corrected from the original "last-match-wins" implementation; see "Engineering notes" below).
- Priority lives in the engine but is hidden from the UI for v0.1; new custom rules default to 50. v0.2 will surface drag-to-reorder.

### UI surfaces

- **Top-tabbed Settings**: General, Tag list, Presets, Custom rules, Commands, Advanced. Profiles and Aliases tabs are reserved for later releases.
- **Tag list view**, the same component, rendered in two places that stay in sync: a sidebar leaf (right-side panel) and a Settings tab. Multi-select, bulk actions, sortable columns, help-icon tooltips on every column header. The Rule column stacks every matching rule on its own line; no "+1 more" collapse.
- **Card-view rule editor**: each rule is a full-width card; click to edit in the same surface. A right-docked preview shows affected tags live as you type. No separate wizard, no expand/collapse, no layout shift.
- **First-run welcome modal**: acknowledges the plugin is enabled, lays out the file-safe promise, and offers two clear ways to start - applying rules normally, or starting in preview mode.
- **Persistent state banner** above every Tag Curator surface whenever you are in a non-default state. Preview mode is on? You see it. Plugin is disabled? You see it. Each banner carries an inline action to return to the default.
- **Status bar** that reflects current state at a glance and is one click away from the hidden-tag list.

### Safety and reversibility

- **Panic disable** is one click in Settings > General (or one command in the palette). It instantly removes every DOM effect, sets the plugin to off, and runs cleanup - even if Settings itself fails to load. The resulting "off" state appears as a persistent banner above every surface until you re-enable.
- **Preview mode**: matched tags are flagged in place rather than hidden, so you can see exactly what a rule would do before committing. The "off" state banner gets an amber sibling explaining what is happening.
- **No telemetry. No network calls.** Everything lives in your vault's `.obsidian/plugins/tag-curator/` folder as pretty-printed JSON.

### Commands

All commands appear in the palette prefixed `Tag Curator:`.

| Command | What it does |
|---|---|
| `Toggle enable` | Master kill switch on or off. |
| `Panic disable (remove all DOM effects now)` | One-shot action: remove all effects, disable, run cleanup. |
| `Toggle preview mode` | Flip preview mode; matched tags become flagged, not hidden. |
| `Open tag list view` | Open or reveal the Tag list in the sidebar. |
| `Open tag list (hidden tags only)` | Pre-filtered. Same as clicking the status bar. |
| `Rescan vault tags` | Rebuild the tag sidecar across all notes. |

## Engineering notes

- **Schema-versioned settings with automatic migration.** Schema bumped twice during the v0.1.0 development cycle: v0 to v1 (legacy `rules` to `customRules`), v1 to v2 (`dryRun` to `previewMode` for clarity), v2 to v3 (welcome-modal state). All migrations are silent and one-way; downgrade is guarded against future-version data.
- **Q-005 fix.** A precedence bug in the rule engine returned the lowest-priority matching rule as effective (the sort was correct; the iteration kept the last match). Fixed in v0.1.0 so the highest-priority match wins, matching what "priority" implies. Tests assert the new semantics.
- **118 of 118 tests pass.** Engine, observer, storage, and migrations are covered. Lint, typecheck, and build are green on the release branch.

## Install with BRAT

1. Install BRAT from the Obsidian Community Plugins directory.
2. In BRAT settings, add `jprisant/obsidian-tag-curator`.
3. Pick the latest release tag.
4. Enable Tag Curator under Community Plugins.

## Install manually

1. Download `main.js`, `manifest.json`, and `styles.css` from this release.
2. Copy them to `<your-vault>/.obsidian/plugins/tag-curator/`.
3. Reload Obsidian and enable Tag Curator.

## Compatibility

- **Minimum Obsidian:** 1.9.10.
- **Mobile:** supported. The status bar is desktop-only because Obsidian does not render one on mobile; everything else works.

## Known limitations

Several v0.1.0 surfaces intentionally surface a Notice that points to a backlog item rather than implementing the feature. These are not bugs; they are deliberate v0.2-onward placeholders.

- **Bulk Hide, Bulk Unhide, Bulk "Add description"** in the Tag list show a Notice that the per-tag overrides surface lands with the Tag detail sheet in v0.2 (see GitHub [#14](https://github.com/jprisant/obsidian-tag-curator/issues/14)).
- **Plugin-integration detection in the welcome modal** uses a hardcoded card set in v0.1.0; live detection of installed plugins lands in v0.2 (see [#9](https://github.com/jprisant/obsidian-tag-curator/issues/9)).
- **Curation panels** (recently created, orphan-only, stale-only) are deferred to v0.2 (see [#3](https://github.com/jprisant/obsidian-tag-curator/issues/3)). The Tag list view's filter chips approximate orphan and frontmatter-only filtering.
- **Drag-to-reorder rules** lands in v0.2 (see [#17](https://github.com/jprisant/obsidian-tag-curator/issues/17)). v0.1.0 hides priority entirely; new custom rules default to 50.
- **Compound criteria** (AND, OR, NOT across multiple match types in one rule) lands in v0.2 (see [#6](https://github.com/jprisant/obsidian-tag-curator/issues/6) and [#7](https://github.com/jprisant/obsidian-tag-curator/issues/7)).
- **Graph view, autocomplete, properties chip scopes** are v0.2 (see [#1](https://github.com/jprisant/obsidian-tag-curator/issues/1), [#2](https://github.com/jprisant/obsidian-tag-curator/issues/2), and the scope-expansion proposal under `docs/internal/release-plans/proposals/`).
- **Aliases / display-merge** ships in v0.2 per the proposal (see [#11](https://github.com/jprisant/obsidian-tag-curator/issues/11) and `proposals/aliases-display-merge/`).
- **Tag Wrangler integration**: v0.1.0 ships the bulk **Send to Tag Wrangler** action when Tag Wrangler is enabled; the full integration surface lands in v0.3.

## What's next

The v0.2 milestone groups around two themes: **"Tag Curator works everywhere"** (graph, autocomplete, properties chip scopes) and **"Tag Curator helps you clean up"** (aliases, allow-only mode, conflict resolver, curation panels). See `docs/internal/release-plans/proposals/` in the repo for per-feature specs, implementation plans, and UI mockups.

The 16 v0.2-and-v0.3 GitHub issues are tracked on the [Tag Curator project board](https://github.com/users/jprisant/projects/2).

## Credits

- Reviewer feedback across seven rounds of crit-driven design (`docs/internal/release-plans/plan_v0.1.0/`).
- Original technical research (`docs/internal/discovery/implementation-plan_opus-4.7_deep-research_2026-04-30.md`).
- Tag Wrangler, Notebook Navigator, and the broader Obsidian plugin ecosystem for the patterns Tag Curator composes with rather than reinvents.

## Reporting issues

[Open an issue](https://github.com/jprisant/obsidian-tag-curator/issues/new) with steps to reproduce, vault size, and console output if any.
