# Tag Curator

A vault-wide tag visibility and curation engine for Obsidian. Hide, flag, and surface noisy tags across the places they actually appear, without modifying a single note.

> Display-only. File-safe. Fully reversible.

## What it does

Tag Curator gives you a rule engine that controls which tags appear across Obsidian's UI. Your notes are never touched. Disabling or uninstalling the plugin restores every tag immediately, because nothing was ever written to your files.

The heart of v1.0 is the **Curation Workspace**: a real, dockable workspace leaf (not a settings screen) where you see every change land live. Open it beside the native tag pane and your loop becomes a single continuous glance: edit a rule on one side, watch tags hide or flag on the other, in the same breath.

## The Curation Workspace

The Curation Workspace is where you actually curate. It holds:

- **The tag table.** Every tag in your vault with its count, first and last seen, source (frontmatter or inline), per-scope visibility, and the rule (if any) affecting it. Sortable, searchable, virtualized for large vaults.
- **Filter chips.** One-click filters: Hidden, Flagged, Orphans, Frontmatter, Inline, Unreviewed, By rule.
- **The inline rule editor.** Rules show as cards; click a card to edit in place, or `+ New rule` to create one. The editor never leaves the workspace, so you never lose sight of your tags.
- **Live preview.** As you type a rule, the affected-tags list updates immediately, and so does the real tag pane beside it.
- **Bulk actions.** Select several tags, then hide, unhide, flag, add a description, or send them to Tag Wrangler in one action.
- **Per-row diagnostics.** On any row, ask "why is this hidden?" and Tag Curator names the exact preset, rule, or override responsible. A tag is never hidden without a traceable reason.

### Open it beside the tag pane

Two commands open the workspace:

- **Tag Curator: Open Curation Workspace** opens the workspace on its own.
- **Tag Curator: Open Curation Workspace beside the tag pane** opens the workspace and the native tag pane side by side, arranged for you in one move. This is the side-by-side loop that is the whole point of v1.0.

You can also open it from the status bar or the **Open Curation Workspace** button in Settings.

<!-- screenshot placeholder: Curation Workspace docked beside the native tag pane, mid-edit -->

## Scopes: where curation shows up

A scope is a place in Obsidian where tags appear and where Tag Curator can act. v1.0 covers the four surfaces where tags actually render:

- **Tag pane** - Obsidian's native tag list.
- **Notebook Navigator** - the tag tree in the Notebook Navigator plugin, when present. Runtime interop only; a silent no-op when Notebook Navigator is absent.
- **Properties** - frontmatter tags rendered in the Properties panel.
- **Autocomplete** - the tag suggestions you get while typing, so you are not offered a tag you just hid.

By default, hiding a tag hides it consistently across all four places. Each scope is **independent and reversible on its own**: go to **Settings, then Scopes**, and toggle any scope off with its per-scope kill switch. If a single surface ever misbehaves, switch off just that scope; the others keep working and the plugin stays on.

<!-- screenshot placeholder: Settings > Scopes section with the four scope toggles -->

## Per-tag overrides (the safety net)

Sometimes you do not want a whole rule, just one specific tag handled a certain way. That is an **override**, a per-tag decision that beats every rule:

- **Always show** pins a tag visible no matter what any rule says. If a rule hides one tag too many, pin that tag to always-show and move on. Always-show wins over everything, so a pinned tag can never be hidden by accident.
- **Always hide** pins a single tag out of sight without writing a rule for it.

Set an override from a tag's row in the workspace. Overrides persist and resolve ahead of rules.

## Presets

Five built-in presets ship enabled or disabled to taste:

- Hide hex color codes such as `#FFAA00` or `#abcdef` (often imported from web clippings). On by default.
- Hide URL anchor fragments such as `#top`, `#section-3`, or `#sidebar`. On by default.
- Hide single-character tags such as `#a` or `#x`.
- Hide purely numeric tags.
- Hide orphan tags (used in one or fewer notes).

You can also write your own rules: regex patterns, frequency thresholds, or explicit tag lists, with a live preview as you type.

## Install (BRAT, until directory submission)

1. Install the BRAT plugin from the Obsidian Community Plugins directory.
2. In BRAT settings, click **Add Beta Plugin** and add `https://github.com/prisant-labs/obsidian-tag-curator`.
3. Pick the latest release tag when prompted.
4. Enable Tag Curator under Community Plugins.

BRAT offers updates automatically whenever a new beta is published.

## Install (manual)

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Copy them to `<your-vault>/.obsidian/plugins/tag-curator/`.
3. Reload Obsidian and enable Tag Curator under Community Plugins.

## Quick start

1. Enable Tag Curator. The welcome modal opens once: it states the file-safe contract, then offers **Start curating** (apply rules normally) or **Start in preview mode** (flag matched tags instead of hiding them).
2. Run **Tag Curator: Open Curation Workspace beside the tag pane** from the command palette (Cmd/Ctrl+P). The workspace and the native tag pane sit side by side.
3. Click `+ New rule`, give it a name, pick a Type (Pattern match / Count threshold / Specific tags), and watch the live preview and the real tag pane react as you type.
4. If a rule catches one tag too many, find its row and pin it to **always-show**. It pops back and is safe from every rule.
5. The status bar shows the current state. Click it to open the workspace filtered to hidden tags.
6. If anything looks wrong: **Settings > General > Run panic disable**, or run "Tag Curator: Panic disable" from the command palette. Every effect across every scope is removed instantly; nothing in your notes changes.

## Safety contract

Tag Curator never modifies note content. It does not patch `metadataCache.getTags()` or any other internal Obsidian API. Dataview, Tasks, and Bases see the real, unfiltered tag data.

If the plugin behaves unexpectedly, run "Tag Curator: Panic disable" from the command palette. This is a one-shot action that produces the "off" state: every Tag Curator display effect is removed immediately across all scopes, the plugin disables itself, and a persistent banner shows "Tag Curator is off" at the top of every Tag Curator surface until you re-enable. The same banner shows "Preview mode is on" whenever preview mode is active, so you always know the plugin's current state.

## Compatibility

Tag Curator is display-only and file-safe, so it plays well with the rest of your tag ecosystem.

- **Dataview, Tasks, and Bases**: unaffected. Because Tag Curator only changes how tags render and never patches the metadata cache or note content, every metadata-cache consumer sees the full, unfiltered tag set. Your queries, indexes, and results are exactly what they would be without Tag Curator installed.
- **Tag Wrangler** (the rename surface): Tag Curator delegates renaming to Tag Wrangler and never writes note content itself. When Tag Wrangler is enabled, the Curation Workspace adds a per-row "Rename with Tag Wrangler" menu item and a bulk "Send to Tag Wrangler" action. When it is not installed, those actions are hidden or disabled and everything else still works.
- **Style Settings** (optional): install it to customize Tag Curator's hidden- and flagged-tag styling through a GUI. Tag Curator ships built-in defaults for every themeable value, so styling works fully without Style Settings.
- **Notebook Navigator** (optional): when present, Tag Curator decorates Notebook Navigator's tag tree through runtime interop only. There is no source coupling between the two (Notebook Navigator is GPL-3.0, Tag Curator is Apache-2.0); Tag Curator targets the rendered rows from the outside and is a no-op when Notebook Navigator is absent.

None of these plugins is required. Tag Curator works fully standalone; each integration is an optional enhancement that activates only when the partner plugin is enabled.

## Commands

- Tag Curator: Toggle enable
- Tag Curator: Panic disable (remove all DOM effects now)
- Tag Curator: Toggle preview mode
- Tag Curator: Open Curation Workspace
- Tag Curator: Open Curation Workspace beside the tag pane
- Tag Curator: Open tag list view
- Tag Curator: Open tag list (hidden tags only)
- Tag Curator: Rescan vault tags

## Modes

- Default: rules hide matching tags.
- Preview mode: rules visibly flag matching tags instead of hiding them, so you can see a rule's impact before committing.

## Settings

Settings is set-once config, not a workbench. The work happens in the Curation Workspace. Settings holds:

- **General**: the safety row (panic disable), master enable, preview mode, and an **Open Curation Workspace** button.
- **Scopes**: a per-scope kill switch for each of the four scopes.
- **Presets** and **Custom rules**: manage the rule set.
- **Integrations**: Tag Wrangler, Style Settings, and Notebook Navigator status.
- **Advanced**: index maintenance, sidecar debounce, debug logging.

Profiles and Aliases tabs are present as placeholders for later releases (v1.1 and v1.2).

## What lives in `.obsidian/plugins/tag-curator/`

- `data.json`: settings, presets, custom rules, and per-tag overrides.
- `tags.json`: per-tag metadata (count, first seen, last seen, source).

Both are pretty-printed JSON for easy git diffing.

## Performance

For typical vaults (under 10k notes, under 1,500 unique tags), Tag Curator's overhead is imperceptible. Each scope observer is scoped to its container, coalesced through `requestAnimationFrame`, and applies class-based hiding rather than DOM removal.

## Roadmap

- **v1.0** (current): the Curation Workspace leaf, open-beside-the-tag-pane command, four scopes (tag pane, Notebook Navigator, Properties, Autocomplete) with per-scope kill switches, per-tag overrides, five presets, custom rules, thin Settings, Tag Wrangler delegation, Style Settings registration, and the trust layer (welcome modal, state banner, panic disable, status bar).
- **v1.1** (planned): aliases / display-merge, stale and near-duplicate detection, suggested-merges panel, inbox mode, graph view scope.
- **v1.2** (planned): profiles, export / import, community rule packs, compound criteria (AND/OR/NOT), drag-to-reorder rules.
- **v2.0+**: Bases scope, larger-vault storage, localization, community plugin directory submission.

## Non-goals

- Modifying note content (use Tag Wrangler).
- Coloring tags (use Colored Tags Wrangler).
- Replacing the file explorer (Notebook Navigator's role).
- Filtering query results in Dataview, Tasks, or Bases.
- Telemetry of any kind.

## License

Apache 2.0.

## Support

- Issues: https://github.com/prisant-labs/obsidian-tag-curator/issues
- Repository: https://github.com/prisant-labs/obsidian-tag-curator
