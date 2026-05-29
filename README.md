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

<!-- screenshot placeholder: add a screenshot here once the v0.1.0 UI lands -->

## Install (BRAT, until directory submission)

1. Install the BRAT plugin from the Obsidian Community Plugins directory.
2. In BRAT settings, add `jprisant/obsidian-tag-curator`.
3. Enable Tag Curator under Community Plugins.

## Install (manual)

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Copy them to `<your-vault>/.obsidian/plugins/tag-curator/`.
3. Reload Obsidian and enable Tag Curator under Community Plugins.

## Quick start

1. Open Settings, then Community Plugins, then Tag Curator.
2. Toggle a preset (start with "Hide hex color codes").
3. Open the tag pane. Hidden tags disappear.
4. Run "Tag Curator: Open tag list view" from the command palette to see every tag and its visibility status.
5. Click the status bar item to filter the tag list to just hidden tags.

## Safety contract

Tag Curator never modifies note content. It does not patch `metadataCache.getTags()` or any other internal Obsidian API. Dataview, Tasks, and Bases see the real, unfiltered tag data.

If the plugin behaves unexpectedly, run "Tag Curator: Panic disable" from the command palette. This is a one-shot action that produces the "off" state: every Tag Curator DOM modification is removed immediately, the plugin disables itself, and a persistent banner shows "Tag Curator is off" at the top of every Tag Curator surface until you re-enable. The same banner shows "Preview mode is on" whenever preview mode is active, so you always know the plugin's current state.

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

- v0.1: tag-pane filtering, rule engine, presets, custom rules, tag list view, panic disable, preview mode.
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
