# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - Unreleased

"Curation, in context." The active curation loop moves out of the Settings modal and into a real, dockable pane that sits beside the tag pane, so every change is visible as it lands. (Release pending final testing.)

### Added

- **Tag Curator pane (the Curation Workspace)**: a dockable, splittable pane (not a settings screen) holding the tag table, the inline card-based rule editor, a live preview, bulk actions, and per-row "why is this hidden?" diagnostics. The table shows count, first/last seen, source, per-scope visibility, and the affecting rule; it is sortable, searchable, and virtualized for large vaults. The pane is opt-in (an Enable toggle gates it) and has two modes: **View** (browse tags, tap a tag to search for it) and **Manage** (the full curation grid).
- **Open beside the tag pane**: the command opens the pane and the native tag pane as a split in one move, delivering the live side-by-side loop (edit a rule on one side, watch tags hide or flag on the other).
- **Curate Tags settings tab**: the full Manage grid is also available directly in Settings, for curation without opening the pane.
- **Reviewed triage**: a per-tag reviewed flag with Mark reviewed / unreviewed (row and bulk), a reviewed-row marker, and an Unreviewed filter, so a large tag set can be worked down like an inbox.
- **Per-tag overrides**: always-show and always-hide, a persisted per-tag decision that beats every rule. Always-show wins over everything (the safety net); always-hide beats every rule but yields to always-show. Overrides resolve ahead of rules, and the rule editor's preview accordion exposes per-row override pins.
- **Four scopes, each independently kill-switchable**: tag pane, Notebook Navigator, Properties, and Autocomplete. Hiding a tag hides it consistently across all four by default; each scope has its own kill switch so a single misbehaving surface can be turned off without disabling the plugin.
- **Notebook Navigator scope** via runtime interop only (no source coupling; Notebook Navigator is GPL-3.0, Tag Curator is Apache-2.0). A silent no-op when Notebook Navigator is absent.
- **Properties scope**: the same hide/flag treatment for frontmatter tags rendered in the Properties panel.
- **Autocomplete scope**: hidden tags stop being suggested in the editor's tag autocomplete, so junk does not creep back.
- **Filtering**: one-click filter chips (relocated below the search bar): Hidden, Flagged, Orphans, a **Shown** (visible-only) filter, Frontmatter, Inline, Unreviewed, and by-rule. A column selector and per-surface columns tailor the table to each host.
- **Presets**: each preset shows a live affected-count that clicks through to the matching tags.
- **Thin Settings**: Settings becomes set-once config, consolidated from an earlier ten-tab layout into a focused set, plus the **Curate Tags** tab. Integration rows show status pills and action links. Profiles (v1.1) and Aliases (v1.2) appear as deferred placeholders.
- **Style Settings registration**: CSS variables registered with Style Settings so themers and power users can restyle hidden and flagged tags with no code; sensible defaults apply when Style Settings is absent.
- **Tag Wrangler delegation**: a per-row "Rename with Tag Wrangler" menu item and a bulk "Send to Tag Wrangler" action when Tag Wrangler is present; gracefully hidden or disabled when absent.
- **Trust layer polish**: a welcome modal that leads with the plugin name and de-overclaims, the persistent non-default-state banner, panic disable that clears every scope at once, and an honest, scope-independent status bar.

### Changed

- **Six palette commands**: toggle enable, panic disable, toggle preview mode, open the panel, open beside the tag pane, and rescan vault tags. The standalone tag-list commands from v0.1 were retired; the pane subsumes them.
- Settings consolidated from ten tabs into a focused set, and inline styles were moved to CSS classes (themable, and to satisfy the plugin review guidelines).
- The curation leaf is named "Tag Curator"; rule editing is name-first with type cards and an anchored "New rule" action.
- Panic disable now removes display effects across all four scopes in one shot, not just the tag pane.

### Migration

- Settings schema advances to **v6**, automatic and additive. v3 -> v4 introduces the per-tag `overrides` store (defaulting to `{}`); later steps add per-scope enables, the reviewed flag, and the opt-in pane state (`paneEnabled`). Migrations are one-way and guarded; writes use the existing atomic write-temp-then-rename. No user action required.

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
