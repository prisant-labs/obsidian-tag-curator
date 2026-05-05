# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-05-04

### Added

- **Rule Engine** with three match types: regex, frequency (count-based), and explicit list
- **Priority-based rule evaluation** - last matching rule wins
- **5 built-in presets**: hex color codes, URL anchors, single-char tags, orphans, numeric tags
- **Tag pane filtering** - DOM-based, non-destructive hiding via `display: none`
- **Tag list view** - sortable, searchable table of all vault tags with metadata
- **Custom rule editor** - modal interface for creating and editing rules
- **Tag metadata tracking** - firstSeen, lastSeen, count, sources
- **Settings UI** with preset toggles, custom rule management, and debug options
- **Status bar integration** and command palette commands
- **Comprehensive documentation** (README with usage guide and examples)
- **Full reversibility** - uninstall immediately restores all tags

### Technical

- esbuild configuration for v0.13.12 compatibility
- TypeScript strict mode enabled
- ~1,600 lines of typed source code
- 34.1 KB minified bundle
- Debounced metadata persistence (5 second default)
- Scoped DOM observers for performance

### Known Limitations

- Tag pane scope only (graph view, autocomplete coming in v0.2)
- Hide action only (flag, group, delegate coming later)
- No aliases/display-merge (coming in v0.3)
- No rule profiles (coming in v0.3)
- Default mode only (allow-only and inbox modes in v0.2+)

## Planned Releases

**v0.2** - Graph scope, autocomplete scope, tag metadata panels, allow-only mode

**v0.3** - Aliases, profiles, Tag Wrangler integration, inbox mode

**v0.4+** - Notebook Navigator, Colored Tags Wrangler, export/import, mobile polish
