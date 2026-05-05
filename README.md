# Tag Curator

A vault-wide tag visibility and curation engine for Obsidian. Hide noisy tags, organize taxonomy, and maintain a clean tag pane without modifying your notes.

**Display-only. File-safe. Fully reversible.**

## Features

### Built-in Presets

Ship with 5 toggle-able preset rules that solve common problems:

- **Hide hex color codes** - Remove CSS hex colors (#FFAA00, #abcdef) from web clippings
- **Hide URL anchors** - Hide URL fragments (#section-3, #top) incorrectly parsed as tags
- **Hide orphan tags** - Hide single-use tags (count = 1) that are likely typos
- **Hide single-character tags** - Remove stray single-letter tags (#a, #x)
- **Hide pure numeric tags** - Edge case for numeric-only tags

### Core Functionality

- **Rule Engine** - Match tags using regex patterns, frequency thresholds, or explicit lists
- **Tag Pane Filtering** - Hide matched tags from the native tag pane (DOM-based, display-only)
- **Tag List View** - Sortable, searchable table of all vault tags with metadata
- **Custom Rules** - Create your own rules with an intuitive modal editor
- **Settings UI** - Manage presets, custom rules, and plugin behavior

### Safety & Reversibility

- **DOM-based filtering only** - No modifications to note content or Obsidian metadata
- **Uninstall to restore** - Removing the plugin immediately restores all tags
- **Safe on all vaults** - No special compatibility issues or data migration needed

## Installation

1. Download this plugin from the Obsidian Community Plugins directory (coming in v0.2)
2. Unzip into your vault's `.obsidian/plugins/` folder
3. Reload plugins in Obsidian settings
4. Enable Tag Curator

## Usage

### Quick Start

1. Open Tag Curator settings (in the sidebar, under Plugins)
2. Toggle on the presets you want (recommended: "Hide hex color codes" and "Hide URL anchors")
3. The tag pane will refresh automatically - hidden tags now disappear

### View All Tags

1. Run the command "Tag Curator: Open tag list view" (Cmd/Ctrl - P)
2. See all vault tags sorted by count, with metadata and visibility status
3. Click column headers to sort by different fields
4. Search by tag name to filter the list

### Create Custom Rules

1. In Tag Curator settings, scroll to "Custom Rules"
2. Click "+ New Rule"
3. Choose a match type (Regex, Frequency, or List)
4. Set your pattern or criteria
5. Optionally test a tag to see if the rule would match
6. Click "Save Rule"

### Rule Examples

**Hide tags from a folder:**
- Match type: **Regex**
- Pattern: `^temp-|^draft-|^wip-`
- Action: Hide

**Hide rarely-used tags:**
- Match type: **Frequency**
- Operator: **<= (Less than or equal)**
- Value: **2**
- Action: Hide

**Whitelist specific tags:**
- Match type: **List**
- Tags: (one per line)
  - `important`
  - `project`
  - `reference`

## Settings

- **Mode** - Default (hide matched) or Allow-only (show only matched)
- **Debug logging** - Write rule evaluation logs for troubleshooting
- **Dry run mode** - Preview what rules would hide without applying them

## Modes

### Default Mode (recommended for v0.1)

Rules hide matched tags. Show most tags, hide the noisy ones.

### Allow-only Mode

Invert the logic: show only tags that match at least one rule. Useful for users with a curated taxonomy who treat unknown tags as drafts. (Coming in v0.2)

### Inbox Mode

Newly-detected tags land in a "needs review" queue with a visual indicator. Useful for maintaining a clean taxonomy. (Coming in v0.3)

## Roadmap

**v0.1 (current)** - MVP with rule engine, hide action, tag pane scope, presets, and tag list view

**v0.2** - Graph view scope, autocomplete scope, tag metadata panels (recently created, orphans, stale)

**v0.3** - Aliases/display-merge, profiles, Tag Wrangler integration, inbox mode

**v0.4+** - Notebook Navigator integration, export/import, mobile polish, community rule packs

## Limitations in v0.1

- **Tag pane scope only** - Other UI areas (graph, autocomplete) coming in v0.2
- **Hide action only** - Flag, group, and delegate actions coming later
- **No aliases** - Display-merge coming in v0.3
- **No profiles** - Rule set profiles coming in v0.3

## Integrations

### Planned

- **Tag Wrangler** (v0.3) - Send tags to rename, receive curation actions in context menu
- **Notebook Navigator** (v0.4) - Sync hidden tag lists with Notebook Navigator's tag tree
- **Colored Tags Wrangler** (v0.4) - Delegate color assignments to another plugin

### Not Supported

Tag Curator intentionally does NOT modify query results in Tasks, Dataview, or Bases. These tools see the real, unfiltered tag data. If you want queries to ignore certain tags, use the query syntax of those tools.

## Architecture

Tag Curator uses **DOM filtering**, not metadata patching:

1. Rules are evaluated when the tag pane renders
2. Matched tags are hidden using `display: none` on DOM nodes
3. No modifications to note content or Obsidian's metadata cache
4. Uninstall removes the hidden styling immediately

This approach is:
- **Fully reversible** - No persistent changes to files
- **Safe across releases** - No monkey-patching of internal APIs
- **Query-safe** - Dataview, Tasks, and other query tools see real data

## Troubleshooting

### Tags still showing after enabling a rule?

1. Check if the rule is enabled in settings (toggle should be ON)
2. Open "Tag Curator: Open tag list view" and search for the tag
3. Check the "Status" column - it should say "Hidden (rule-name)"
4. If it says "Visible", the rule didn't match. Click the rule's Edit button to test it.

### Rule not matching as expected?

1. In the rule editor, use the "Test Tag" field at the bottom
2. Type a tag name and see if it says "Would match!" or "No match"
3. For regex rules, test in a regex tester: https://regex101.com

### Performance issues?

Tag Curator runs debounced observers on the tag pane. For typical vaults (< 10K notes, < 1500 tags), overhead is imperceptible. If you notice slowness:

1. Reduce the number of active rules (disable unused presets and custom rules)
2. Simplify regex patterns
3. Report an issue on GitHub with vault size details

## Privacy

Tag Curator is local-first. No telemetry, no network calls, no data leaves your vault. All configuration is stored in `.obsidian/plugins/tag-curator/` as JSON.

## License

Apache 2.0

## Support

- GitHub: https://github.com/jprisant/obsidian-tag-curator
- Issues: https://github.com/jprisant/obsidian-tag-curator/issues