# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-05-14

Initial public release.

### Added

- Rule engine with three match types: regex, frequency, and explicit list.
- Priority-based rule evaluation: the highest-priority matching enabled rule wins.
- Five built-in presets: hex color codes, URL anchor fragments, single-character tags, purely numeric tags, orphan tags.
- Tag-pane filtering via scoped MutationObserver and class-based hiding (no DOM removal).
- Tag list view: sortable, searchable, with filter chips and rule-attribution status column.
- Custom rule editor: regex / frequency / list, live affected-tag preview, regex safety validation against iOS lookbehind crash, test field.
- Master enable / disable toggle wired to a status bar item.
- Preview mode: visibly flag matched tags rather than hide them, so you can see a rule's impact before committing.
- Panic disable command: full DOM cleanup plus settings off-switch.
- Status bar item: shows hidden tag count, preview-mode state, or off-state; click to open tag list filtered to hidden.
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

### Changed (post-initial-tag)

- **Renamed "dry-run" to "preview mode" everywhere** (settings field `dryRun` -> `previewMode`, observer `setDryRun` -> `setPreviewMode`, command `toggle-dry-run` -> `toggle-preview-mode`). Settings schema bumped v1 -> v2 with automatic migration that maps the old `dryRun` value onto `previewMode` on first load; nothing for users to do. BRAT testers who bound a hotkey to `toggle-dry-run` will need to rebind to `toggle-preview-mode`.

### Fixed (post-initial-tag)

- **Rule precedence bug:** when more than one rule matched the same tag, the *lowest*-priority match was returned as the winner instead of the highest. Sorting was priority-descending but the iteration kept the last match, inverting the semantics. The diagnostic ("why is this tag affected?") attributed the wrong rule. Fixed: highest-priority match wins, matching what the "priority" label implies. Tests updated.

### Known limitations

- Tag pane is the only scope filtered in v0.1.0. Editor autocomplete, properties chips, and other scopes are planned for v0.2.
- Hide is the only action. Flag, group, alias, and color delegation are planned for v0.2 / v0.3.
- No profiles, aliases, or inbox mode in v0.1.0. These are planned for v0.3.
- No Tag Wrangler, Notebook Navigator, or Colored Tags Wrangler integration yet. Planned for v0.3 to v0.4.
- Graph view and Bases scopes deferred to v0.5+ because of canvas rendering and Bases API volatility, respectively.

## Planned releases

- v0.2: graph view and autocomplete scopes, properties chips, recently created / orphan / stale panels, allow-only mode, plugin-integration detection in the welcome modal (the formal onboarding wizard is dropped; first-run welcome modal ships in v0.1).
- v0.3: aliases, profiles, Tag Wrangler integration, inbox mode.
- v0.4: Notebook Navigator integration, suggested merges, export / import, community rule packs.
- v0.5+: Bases scope, Colored Tags Wrangler compatibility, mobile polish, community plugin directory submission.
