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

## Highlights of v0.1.0

- **Top-tabbed Settings**: General / Tag list / Presets / Custom rules / Commands / Advanced, with Profiles and Aliases tabs reserved for later releases.
- **Tag list view**, the same component, rendered in two places that stay in sync: a sidebar leaf (right-side panel) and a Settings tab. Multi-select, bulk actions, sortable columns, help-icon tooltips on every column header.
- **Card-view rule editor**: each rule is a full-width card; click to edit in the same surface. A right-docked preview shows affected tags live as you type. No separate wizard, no expand/collapse, no layout shift.
- **First-run welcome modal** that acknowledges what just happened ("Tag Curator is now enabled"), states the file-safe contract, and offers two clear ways to start: applying rules normally, or starting in preview mode so nothing actually disappears.
- **Persistent state banner** above every Tag Curator surface whenever you are in a non-default state. Preview mode on? You see it. Plugin disabled? You see it. Each banner carries an inline action to return to the default.
- **Status bar** that reflects the current state at a glance and is one click away from the hidden-tag list.

<!-- screenshot placeholder: add a screenshot here once the v0.1.0 UI is exercised in a real vault -->

## Install (BRAT, until directory submission)

1. Install the BRAT plugin from the Obsidian Community Plugins directory.
2. In BRAT settings, add `jprisant/obsidian-tag-curator`.
3. Enable Tag Curator under Community Plugins.

## Install (manual)

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Copy them to `<your-vault>/.obsidian/plugins/tag-curator/`.
3. Reload Obsidian and enable Tag Curator under Community Plugins.

## Quick start

1. Enable Tag Curator. The welcome modal opens once: pick **Start curating** (apply rules normally) or **Start in preview mode** (flag matched tags instead of hiding them).
2. Open the tag pane. By default, hex color codes and URL anchor fragments are hidden.
3. Settings, then Tag Curator. Use the **Tag list** tab to see every tag with counts, sources, and rule attribution. Hover the column headers' `?` icons for what each column means.
4. **Custom rules** tab: click `+ New rule`, give it a name, pick a Type (Pattern match / Count threshold / Specific tags), and watch the right-docked preview update live as you type.
5. The status bar shows the current state. Click it to open the tag list filtered to hidden tags.
6. If anything looks wrong: **Settings > General > Run panic disable**. Or run "Tag Curator: Panic disable" from the command palette. Every effect is removed instantly; nothing in your notes changes.

## Safety contract

Tag Curator never modifies note content. It does not patch `metadataCache.getTags()` or any other internal Obsidian API. Dataview, Tasks, and Bases see the real, unfiltered tag data.

If the plugin behaves unexpectedly, run "Tag Curator: Panic disable" from the command palette. This is a one-shot action that produces the "off" state: every Tag Curator DOM modification is removed immediately, the plugin disables itself, and a persistent banner shows "Tag Curator is off" at the top of every Tag Curator surface until you re-enable. The same banner shows "Preview mode is on" whenever preview mode is active, so you always know the plugin's current state.

## Compatibility

Tag Curator is display-only and file-safe, so it plays well with the rest of your tag ecosystem.

- **Dataview, Tasks, and Bases**: unaffected. Because Tag Curator only changes how tags render and never patches the metadata cache or note content, every metadata-cache consumer sees the full, unfiltered tag set. Your queries, indexes, and results are exactly what they would be without Tag Curator installed.
- **Tag Wrangler** (the rename surface): Tag Curator delegates renaming to Tag Wrangler and never writes note content itself. When Tag Wrangler is enabled, the Curation Workspace adds a per-row "Rename with Tag Wrangler" menu item and a bulk "Send to Tag Wrangler" action. When it is not installed, those actions are hidden or disabled and everything else still works.
- **Style Settings** (optional): install it to customize Tag Curator's flagged-tag colors through a GUI. Tag Curator ships built-in defaults for every themeable value, so styling works fully without Style Settings.
- **Notebook Navigator** (optional): when present, Tag Curator decorates Notebook Navigator's tag tree through runtime interop only. There is no source coupling between the two (Notebook Navigator is GPL-3.0, Tag Curator is Apache-2.0); Tag Curator targets the rendered rows from the outside and is a no-op when Notebook Navigator is absent.

None of these plugins is required. Tag Curator works fully standalone; each integration is an optional enhancement that activates only when the partner plugin is enabled.

## Commands

- Tag Curator: Toggle enable
- Tag Curator: Panic disable (remove all DOM effects now)
- Tag Curator: Toggle preview mode
- Tag Curator: Open tag list view
- Tag Curator: Open tag list (hidden tags only)
- Tag Curator: Rescan vault tags

## Modes

- Default (v0.1.0): rules hide matching tags.
- Preview mode (v0.1.0): rules visibly flag matching tags instead of hiding them, so you can see a rule's impact before committing.
- Allow-only and inbox modes: reserved for v0.2.

## What lives in `.obsidian/plugins/tag-curator/`

- `data.json`: settings, presets, custom rules.
- `tags.json`: per-tag metadata (count, first seen, last seen, source).

Both are pretty-printed JSON for easy git diffing.

## Performance

For typical vaults (under 10k notes, under 1,500 unique tags), Tag Curator's overhead is imperceptible. The tag pane observer is scoped to the tag-pane container, coalesced through `requestAnimationFrame`, and applies class-based hiding rather than DOM removal.

## Roadmap

- **v0.1**: tag-pane filtering, rule engine, five presets, custom rules, tag list view (sidebar leaf + Settings tab), panic disable, preview mode, persistent state banner, welcome modal.
- **v0.2** (planned): graph view + autocomplete + properties chip scopes, aliases / display-merge, allow-only mode, conflict resolver view, file-extension file filter on rules, drag-to-reorder rules. See `docs/internal/release-plans/proposals/` for the full per-feature specs.
- **v0.3** (planned): profiles, inbox mode, rule library / preset gallery, tag analytics dashboard.
- **v0.4** (planned): Notebook Navigator integration, suggested-merges curation panel, export and import, community rule packs.
- **v0.5+**: Bases scope, Colored Tags Wrangler delegation, mobile polish, Obsidian community plugin directory submission.

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
