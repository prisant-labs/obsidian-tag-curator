# Tag Curator Project Overview

**Document purpose:** Executive summary and detailed project overview for the Tag Curator Obsidian plugin. (confidence: high)

**Source basis:** This document consolidates the project specification and the implementation-ready technical research documents dated April 29 to April 30, 2026. (confidence: high)

**Project name:** Tag Curator. (confidence: high)

**Project type:** Obsidian community plugin for vault-wide tag visibility, filtering, and curation. (confidence: high)

**Proposed license:** Apache 2.0. (confidence: high)

**Proposed organization:** `product-on-purpose`. (confidence: high)

**Recommended MVP framing:** Build a focused v0.1 around tag pane filtering, rule presets, and a basic tag list before expanding into graph view, autocomplete, aliases, integrations, and advanced metadata workflows. (confidence: high)

---

> **📌 v0.1 Implementation Status (2026-05-28).** This overview is the **strategic framing** that informed v0.1. The MVP framing has held; what has changed is the concrete UI direction (settled after a 7-round design review). For the canonical record:
>
> - **What is shipping in v0.1** -> see `docs/internal/release-plans/plan_v0.1.0.md` "Status as of 2026-05-28" section, plus the locked design in `docs/internal/release-plans/plan_v0.1.0/ui-design_v0.1.0_converged.html`.
> - **All design decisions** (D-001 through D-011) and **open questions** (Q-001 through Q-008) are in `docs/internal/scope-and-decisions.md`. Cross-reference there before treating any specific UI / IA description below as authoritative.
> - **Engine + storage** are complete and tested (118/118). UI implementation against the locked design is the remaining v0.1 work.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Thesis](#project-thesis)
3. [Problem Statement](#problem-statement)
4. [Target Users and Use Cases](#target-users-and-use-cases)
5. [Product Strategy](#product-strategy)
6. [Core Conceptual Model](#core-conceptual-model)
7. [Feature Overview](#feature-overview)
8. [Technical Architecture Overview](#technical-architecture-overview)
9. [Integration Strategy](#integration-strategy)
10. [Mobile Strategy](#mobile-strategy)
11. [Performance and Reliability Strategy](#performance-and-reliability-strategy)
12. [UX and Settings Design](#ux-and-settings-design)
13. [Roadmap](#roadmap)
14. [Risks and Mitigations](#risks-and-mitigations)
15. [Distribution and Release Strategy](#distribution-and-release-strategy)
16. [Recommended Next Steps](#recommended-next-steps)
17. [Open Questions](#open-questions)
18. [Reference Links](#reference-links)

---

# Executive Summary

## One-sentence summary

Tag Curator is a local-first Obsidian plugin that hides, flags, groups, and curates noisy tags across Obsidian's user interface without modifying the user's notes. (confidence: high)

## Executive position

Obsidian treats many `#token` strings as first-class tags, which works well for small and carefully governed vaults but becomes noisy in large, heterogeneous, clipped, templated, or long-lived vaults. (confidence: high) Tag Curator addresses this by adding a reversible display-layer governance system for tags, using rules, scopes, presets, and optional integrations with existing tag-related plugins. (confidence: high)

The strongest product analogy is **Linter for tag visibility**. (confidence: high) Users define rules, see which tags are affected, preview impact, and apply non-destructive visibility actions across selected UI surfaces. (confidence: high)

The core implementation path is feasible because the highest-value v0.1 target, the native tag pane, has stable DOM selectors and can be filtered with scoped `MutationObserver` logic without patching Obsidian internals. (confidence: high)

## Strategic value

Tag Curator solves a governance problem, not just a cosmetic one. (confidence: high) It helps users maintain a usable tag taxonomy without forcing destructive file rewrites, which is valuable for users who rely on Obsidian as a long-term knowledge base. (confidence: high)

The project is strongest when positioned as a **visibility and curation layer** rather than a tag renamer, color manager, explorer replacement, or query engine. (confidence: high) That positioning reduces scope creep and creates clean boundaries with Tag Wrangler, Colored Tags Wrangler, Notebook Navigator, Dataview, Tasks, and Bases. (confidence: high)

## Recommended MVP

The recommended MVP should include tag pane filtering, a simple rule engine, a small set of built-in presets, a basic settings UI, and a tag list sorted by count. (confidence: high) This is the best balance of user value, engineering risk, and release speed. (confidence: high)

Recommended v0.1 scope:

1. **Tag pane filtering.** Hide matching tags in the native tag pane. (confidence: high)
2. **Rule engine.** Support regex, frequency, and explicit list matchers. (confidence: high)
3. **Hide action only.** Defer flagging, grouping, aliasing, and color delegation. (confidence: high)
4. **Built-in presets.** Include hex code, URL anchor, numeric, single-character, and orphan tag presets. (confidence: high)
5. **Basic tag list.** Show all tags with counts and visibility status. (confidence: high)
6. **Panic disable.** Add a command to immediately remove all Tag Curator DOM effects. (confidence: high)

## Recommended implementation posture

The plugin should use DOM filtering and metadata observation, not metadata patching. (confidence: high) It should never alter `MetadataCache.getTags()`, mutate note content, or interfere with query layers such as Dataview, Tasks, or Bases. (confidence: high)

The implementation should be phased around the lowest-risk UI surfaces first. (confidence: high) The tag pane is the primary v0.1 target, autocomplete and properties chips are good v0.2 candidates, and Bases, graph view, and color delegation should be deferred until the core experience is stable. (confidence: high)

## Main feasibility assessment

The v0.1 scope is feasible. (confidence: high) The highest-value technical surface is stable enough, Obsidian's plugin lifecycle supports the needed observer pattern, and the project can gracefully degrade when companion plugins are absent. (confidence: high)

The broader v0.5 vision is plausible but contains several fragile surfaces. (confidence: medium) The main fragile areas are Bases rendering, graph view filtering, Colored Tags Wrangler write integration, and Notebook Navigator hidden-tag synchronization. (confidence: high)

## Main risks

1. **Colored Tags Wrangler cannot be treated as a write API.** It has no programmatic API, so color delegation should be re-architected through Notebook Navigator metadata when possible or through Tag Curator's own CSS injection. (confidence: high)
2. **Notebook Navigator hidden tags are not available through the public API.** Syncing hidden tags requires reading settings or limiting integration to menu and metadata features. (confidence: high)
3. **Graph view nodes are canvas-rendered, not DOM-addressable.** Graph filtering is more complex than tag pane filtering and should not be part of v0.1. (confidence: high)
4. **Bases is volatile.** Bases-related selector and format changes make it a poor MVP target. (confidence: high)
5. **Mobile requires careful regex and UI handling.** iOS lookbehind regex is a known failure mode, and touch UI should be treated separately from desktop context-menu behavior. (confidence: high)

---

# Project Thesis

## The core thesis

Obsidian users need a reversible, local-first, rule-based tag visibility layer because tag noise accumulates faster than most users can manually curate it. (confidence: high)

The underlying tag data should remain untouched. (confidence: high) Users should be able to hide, flag, group, or review tags without rewriting note files, breaking search behavior, or altering the semantic data consumed by other plugins. (confidence: high)

## Why this matters

Tags are only useful when they help users navigate, filter, and understand their vault. (confidence: high) When the tag pane is filled with one-off clipping artifacts, CSS color codes, URL fragments, templater remnants, typos, and stale concepts, the tag system becomes less useful as a discovery and navigation mechanism. (confidence: high)

Tag Curator provides a display-layer governance model. (confidence: high) This allows users to keep historical and accidental tags in the vault while restoring usefulness to tag-driven UI surfaces. (confidence: high)

## Product category

Tag Curator belongs in the category of **Obsidian vault hygiene and taxonomy governance tooling**. (confidence: high) It overlaps partially with tag management, but it should not be framed primarily as a tag rename, query, or styling plugin. (confidence: high)

Adjacent categories:

1. **Tag management.** Tag Wrangler handles destructive rename and merge workflows. (confidence: high)
2. **Tag styling.** Colored Tags Wrangler handles tag colors. (confidence: high)
3. **Navigation.** Notebook Navigator provides alternative file and tag navigation. (confidence: high)
4. **Query and reporting.** Dataview, Tasks, and Bases query the actual data and should not be filtered by Tag Curator. (confidence: high)

---

# Problem Statement

## Primary problem

Large Obsidian vaults accumulate accidental and low-value tags that degrade tag-based navigation and autocomplete. (confidence: high)

Common sources of tag noise include:

1. **Hex color codes.** Web-clipped CSS values like `#FFAA00` or `#abcdef` can appear as tags. (confidence: high)
2. **URL fragments.** Strings like `#section-3` can be interpreted as tags. (confidence: high)
3. **Templater fragments.** Template content can introduce accidental tags. (confidence: high)
4. **Single-use experiments.** One-off tags clutter tag pane and autocomplete. (confidence: high)
5. **Capitalization drift.** Variants like `#AI`, `#ai`, and `#Ai` create duplicate-looking concepts. (confidence: high)
6. **Stale taxonomy.** Tags unused for years remain visible alongside current working tags. (confidence: high)
7. **No native filtering model.** Obsidian's native tag pane does not provide rule-based filtering, blocking, review queues, or taxonomy governance. (confidence: high)

## Why existing solutions do not fully solve it

Tag Wrangler is strong for renaming and merging tags, but it is not designed to provide a reversible display-layer visibility system. (confidence: high)

Colored Tags Wrangler is useful for visual styling, but it is not a curation engine and does not expose a write API for programmatic color assignment. (confidence: high)

Notebook Navigator includes hidden-tag behavior in its own navigation surface, but it does not provide a vault-wide, cross-surface tag curation layer through a public hidden-tags API. (confidence: high)

Dataview, Tasks, and Bases query real vault data and should not be used as display-layer tag filters. (confidence: high)

---

# Target Users and Use Cases

## Primary users

1. **Large-vault PKM users.** These users have years of notes, web clips, templates, imported content, and mixed tag conventions. (confidence: high)
2. **Obsidian power users.** These users understand plugins, settings, scopes, and rule-based workflows. (confidence: high)
3. **Researchers and writers.** These users need clean current-topic navigation without deleting historical or experimental tags. (confidence: medium)
4. **Developers and technical note-takers.** These users are likely to encounter code, CSS, URLs, and markdown artifacts that produce tag noise. (confidence: high)
5. **Taxonomy-oriented users.** These users want canonical tag sets, review workflows, and visibility profiles. (confidence: high)

## Primary use cases

1. **Clean the tag pane.** Hide accidental tags from native tag navigation. (confidence: high)
2. **Reduce autocomplete noise.** Prevent low-value tags from appearing while typing `#`. (confidence: high)
3. **Review new tags.** Use inbox mode to triage newly discovered tags. (confidence: high)
4. **Identify orphans.** Surface single-use tags for cleanup, hiding, or review. (confidence: high)
5. **Consolidate concepts visually.** Display aliases under canonical tags without rewriting notes. (confidence: high)
6. **Switch visibility contexts.** Use profiles like Writing mode, Curation mode, Default mode, and Demo mode. (confidence: high)
7. **Diagnose hidden tags.** Ask why a tag disappeared and see which rule affected it. (confidence: high)

## Non-target use cases

1. **Destructive tag rewriting.** Tag Curator should defer to Tag Wrangler. (confidence: high)
2. **Tag color assignment as a core feature.** Tag Curator should defer to styling tools or optional internal CSS fallback. (confidence: high)
3. **Replacing the file explorer.** Tag Curator should not compete with Notebook Navigator. (confidence: high)
4. **Replacing query systems.** Tag Curator should not filter Dataview, Tasks, or Bases query results at the data layer. (confidence: high)

---

# Product Strategy

## Strategic positioning

Tag Curator should be positioned as a **reversible tag visibility and curation engine**. (confidence: high)

This positioning is stronger than calling it a tag hider because it captures the broader value: governance, workflows, rules, review, profiles, and integrations. (confidence: high)

## Design principles

1. **Files are sacred.** The plugin should never modify note content. (confidence: high)
2. **Reversible by default.** Uninstalling or disabling the plugin should immediately restore the original tag display. (confidence: high)
3. **Composable, not monolithic.** The plugin should integrate with Tag Wrangler, Notebook Navigator, and Colored Tags Wrangler rather than replace them. (confidence: high)
4. **Data-layer respect.** The plugin should avoid hiding tags from Dataview, Tasks, Bases, and other query layers. (confidence: high)
5. **Progressive disclosure.** Basic users should get presets, while advanced users can build rules. (confidence: high)
6. **Performance first.** Observers should be scoped, updates debounced, and expensive work avoided during typing. (confidence: high)
7. **Local-first.** No telemetry, no network calls, and all configuration should live in the vault's `.obsidian` folder. (confidence: high)

## Scope discipline

The project should explicitly avoid becoming an all-purpose tag platform. (confidence: high) Its durable value is in making existing Obsidian tag surfaces more useful without taking ownership of every adjacent concern. (confidence: high)

Recommended scope boundary:

| Area | Tag Curator Role | Confidence |
|---|---|---|
| Tag visibility | Own directly | high |
| Rule-based curation | Own directly | high |
| Non-destructive alias display | Own directly | high |
| Tag renaming | Delegate to Tag Wrangler | high |
| Tag coloring | Delegate or optionally fallback | high |
| File navigation | Complement Notebook Navigator | high |
| Query filtering | Do not own | high |
| Full taxonomy rewrite | Do not own | high |

---

# Core Conceptual Model

## Three-plane model

Tag Curator's rules should be modeled across three planes: detection, action, and scope. (confidence: high)

A rule equals **what matches**, **what happens**, and **where it applies**. (confidence: high)

## Detection plane

The detection plane defines how a tag is matched. (confidence: high)

Supported detection types:

1. **Regex pattern.** Match tags like hex codes, URL anchors, and single-character tags. (confidence: high)
2. **Frequency threshold.** Match tags used fewer than or greater than a specified number of times. (confidence: high)
3. **First-seen age.** Match newly discovered tags. (confidence: high)
4. **Last-used age.** Match stale tags. (confidence: high)
5. **Source.** Match frontmatter-only, inline-only, or mixed-source tags. (confidence: high)
6. **Folder origin.** Match tags found only in specific folders such as Clippings. (confidence: high)
7. **Manual list.** Match explicit allow or block lists. (confidence: high)
8. **Similarity.** Match near-duplicates using edit distance. (confidence: high)

## Action plane

The action plane defines what the plugin does when a rule matches. (confidence: high)

Recommended actions:

1. **Hide.** Remove tag visibility from selected UI scopes. (confidence: high)
2. **Show only.** Use whitelist behavior for allow-only mode. (confidence: high)
3. **Flag for review.** Keep visible but visually mark the tag. (confidence: high)
4. **Group under virtual parent.** Display-only grouping without changing files. (confidence: medium)
5. **Delegate color.** Use supported companion plugin behavior where available, with caution. (confidence: medium)

## Scope plane

The scope plane defines where a matched action applies. (confidence: high)

Potential scopes:

1. Native tag pane. (confidence: high)
2. Editor autocomplete. (confidence: high)
3. Properties panel tag chips. (confidence: high)
4. Search results and filter chips. (confidence: medium)
5. Quick switcher. (confidence: medium)
6. Backlinks and outgoing links panes. (confidence: medium)
7. Hover preview popups. (confidence: medium)
8. Graph and local graph. (confidence: low)
9. Bases tag columns. (confidence: low)
10. Notebook Navigator tag tree. (confidence: medium)
11. Tag Wrangler context menu. (confidence: high)

## Rule priority model

Rules should compose by priority with documented conflict resolution. (confidence: high) The shipping model is **highest-priority match wins** (Q-005, corrected 2026-05-28: the earlier draft used "last-match-wins" wording which the engine implemented as priority-desc sort + last in loop, which inverted the semantics to lowest-priority-wins; fixed) plus an always-show override for safety. (confidence: high)

The UX should make conflict resolution visible because invisible priority behavior can cause user confusion. (confidence: high)

---

# Feature Overview

## Built-in presets

Built-in presets should reduce setup friction and make the plugin useful immediately. (confidence: high)

Recommended presets:

1. **Hide hex color codes.** Regex such as `^#[0-9A-Fa-f]{3,8}$`. (confidence: high)
2. **Hide URL anchors.** Configurable patterns for common URL fragment artifacts. (confidence: medium)
3. **Hide pure-numeric tags.** Useful as an edge-case preset, though Obsidian already rejects many numeric-only tags. (confidence: medium)
4. **Hide single-character tags.** Targets accidental `#a` or `#x` tags. (confidence: high)
5. **Hide orphan tags.** Matches tags with count less than or equal to 1. (confidence: high)
6. **Hide stale tags.** Matches tags not used for a defined time period. (confidence: high)
7. **Hide clipping-folder tags.** Targets tags only found under folders such as `Clippings/`. (confidence: high)
8. **Flag near-duplicate tags.** Uses edit distance to surface likely duplicates. (confidence: medium)

## Modes

Tag Curator should support modes that align to different user workflows. (confidence: high)

1. **Default mode.** Rules hide matching tags. (confidence: high)
2. **Allow-only mode.** Only allowlisted tags appear. (confidence: high)
3. **Inbox mode.** New tags require review before being accepted, hidden, or merged. (confidence: high)
4. **Dry-run mode.** Preview hidden tags without changing display behavior. (confidence: high)

## Tag list view

The tag list view should be the main operational UI for understanding and managing tag state. (confidence: high)

Recommended columns:

1. Tag name. (confidence: high)
2. Count. (confidence: high)
3. First seen date. (confidence: high)
4. Last used date. (confidence: high)
5. Source type. (confidence: high)
6. Visibility by scope. (confidence: high)
7. Rule affecting tag. (confidence: high)
8. Description. (confidence: high)
9. Aliases. (confidence: high)
10. Reviewed status. (confidence: high)

Recommended bulk actions:

1. Hide selected tags. (confidence: high)
2. Unhide selected tags. (confidence: high)
3. Alias to canonical tag. (confidence: high)
4. Add description. (confidence: high)
5. Export selected tags. (confidence: medium)
6. Send to Tag Wrangler for rename. (confidence: high)

## Rule editor

The rule editor should make rules testable before they affect the vault UI. (confidence: high)

Recommended capabilities:

1. Rule name and description. (confidence: high)
2. Enabled toggle. (confidence: high)
3. Priority ordering. (confidence: high)
4. Match criteria selector. (confidence: high)
5. Action selector. (confidence: high)
6. Scope selector. (confidence: high)
7. Live preview of affected tags. (confidence: high)
8. Single-tag test field. (confidence: high)

## Curation panels

Curation panels should turn tag cleanup from a manual search task into a workflow. (confidence: high)

Recommended panels:

1. Recently created tags. (confidence: high)
2. Recently used tags. (confidence: high)
3. Orphan tags. (confidence: high)
4. Stale tags. (confidence: high)
5. Suggested merges. (confidence: high)
6. Untagged notes. (confidence: medium)

## Aliases and display merging

Aliases should be display-only and should not rewrite note files. (confidence: high)

Example model:

```yaml
canonical: "#ai"
aliases:
  - "#AI"
  - "#Ai"
  - "#artificial-intelligence"
  - "#machine-learning/ai"
```

This creates a reversible visual consolidation path while preserving original notes. (confidence: high)

## Profiles

Profiles should allow users to switch between different visibility configurations. (confidence: high)

Example profiles:

1. **Writing mode.** Hide admin, process, and cleanup tags. (confidence: high)
2. **Curation mode.** Show orphans, stale tags, and review queues. (confidence: high)
3. **Default mode.** Apply only basic noise filters. (confidence: high)
4. **Demo mode.** Show everything for screenshots, training, or support. (confidence: high)

## Export and import

Export and import should support portability across vaults and community rule sharing. (confidence: high)

Supported formats should include JSON first and YAML as a later convenience option. (confidence: medium)

## Diagnostics

Diagnostics are essential because hidden tags can otherwise feel like data loss. (confidence: high)

Recommended diagnostics:

1. **Why is this tag hidden?** Show the matching rule. (confidence: high)
2. **Status bar indicator.** Show hidden tag count and active rule count. (confidence: high)
3. **Filtered hidden view.** Click from status bar into hidden tags. (confidence: high)
4. **Debug log.** Dev-mode only, written to plugin folder. (confidence: high)
5. **Health check.** Warn when expected integrations are missing or rule count is unusually high. (confidence: high)

---

# Technical Architecture Overview

## Recommended architecture

Tag Curator should use DOM filtering over rendered UI elements, supported by Obsidian metadata cache reads and plugin settings storage. (confidence: high)

It should not monkey-patch Obsidian internals. (confidence: high) It should not patch metadata APIs. (confidence: high) It should not rewrite user notes except through explicit handoff to external tools such as Tag Wrangler. (confidence: high)

## Core runtime pattern

The plugin should follow this runtime sequence:

1. Load settings from `.obsidian/plugins/tag-curator/data.json`. (confidence: high)
2. Wait for Obsidian workspace layout readiness. (confidence: high)
3. Locate target UI containers by scope. (confidence: high)
4. Run an initial filter pass. (confidence: high)
5. Attach scoped `MutationObserver` instances to target containers. (confidence: high)
6. Re-apply filters on relevant DOM changes, metadata updates, layout changes, and settings changes. (confidence: high)
7. Disconnect observers and remove plugin classes or attributes on unload. (confidence: high)

## Tag pane filtering

The native tag pane is the best initial target. (confidence: high)

The relevant DOM structure is expected to include a `.workspace-leaf-content[data-type="tag"]` container with a `.tag-container` and `.tag-pane-tag` rows. (confidence: high)

A single observer per tag pane container should be enough because the tag pane appears to be eagerly rendered rather than virtualized. (confidence: high)

## Metadata cache usage

The plugin should use Obsidian's metadata cache as the source of truth for tags. (confidence: high)

The safest tag extraction path is to normalize through Obsidian's tag metadata rather than scanning raw file text with a custom regex. (confidence: high)

The implementation should account for metadata event caveats by subscribing to multiple signals. (confidence: high)

Recommended event handling:

1. `metadataCache.on('changed')` for file content changes. (confidence: high)
2. `metadataCache.on('resolved')` for cache batch completion. (confidence: high)
3. `metadataCache.on('deleted')` for deleted file cache cleanup. (confidence: high)
4. `vault.on('rename')` for rename handling. (confidence: high)
5. `workspace.on('layout-change')` for reattaching observers. (confidence: high)

## Storage model

Recommended storage files:

1. `.obsidian/plugins/tag-curator/data.json` for rules, profiles, aliases, and settings. (confidence: high)
2. `.obsidian/plugins/tag-curator/tags.json` for per-tag metadata such as first seen, last seen, count, reviewed state, and description. (confidence: high)
3. Optional sidecar cache files for very large computed data. (confidence: medium)

Settings should use schema versioning from the beginning. (confidence: high)

## Data model

Recommended rule model:

```typescript
interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  match: MatchCriteria;
  action: Action;
  scopes: Scope[];
  notes?: string;
}
```

Recommended tag metadata model:

```typescript
interface TagMeta {
  tag: string;
  firstSeen: number;
  lastSeen: number;
  count: number;
  description?: string;
  aliases?: string[];
  reviewed?: boolean;
}
```

This model supports both immediate filtering and later curation workflows. (confidence: high)

## Accessibility rules

DOM hiding should preserve accessibility and Obsidian behavior. (confidence: high)

Recommended rules:

1. Hide tag pane rows with class-based CSS and set `aria-hidden="true"`. (confidence: high)
2. Do not remove tag pane nodes from the DOM because Obsidian may internally index tree items. (confidence: high)
3. For property chips, hide visually and remove inner remove buttons from tab navigation when hidden. (confidence: high)
4. For suggestion items, prefer data-layer filtering rather than CSS hiding because hidden suggestions can still receive keyboard focus. (confidence: high)
5. Preserve `href` attributes on tag links because Obsidian click handlers rely on them. (confidence: high)

## Regex safety

The plugin should avoid JavaScript regex lookbehind in tag matching because it can crash plugin loading on older iOS versions. (confidence: high)

An iOS-safe regex strategy should be used for any tag parsing that must occur outside Obsidian's metadata cache. (confidence: high)

## Graph view limitation

Graph view tag nodes are not DOM-addressable because the graph is rendered through a canvas scene. (confidence: high)

Graph filtering should be deferred until a robust approach is identified. (confidence: high)

## Bases limitation

Bases support should be deferred until after MVP because Bases selectors and file format behavior have been volatile. (confidence: high)

---

# Integration Strategy

## Tag Wrangler

Tag Wrangler should be treated as the destructive rename and merge partner. (confidence: high)

The integration contract is through workspace events, not through a public API object. (confidence: high)

Recommended Tag Wrangler actions:

1. Add Tag Curator actions to Tag Wrangler context menus. (confidence: high)
2. Offer hide, mark canonical, add alias, add to rule, and send to inbox actions. (confidence: high)
3. Use Tag Wrangler for actual note rewrites when users want true tag renaming. (confidence: high)

Fallback behavior should be available when Tag Wrangler is absent. (confidence: high)

## Notebook Navigator

Notebook Navigator should be treated as a navigation and metadata integration partner. (confidence: high)

Notebook Navigator exposes a documented API for metadata, navigation, tag menus, and events. (confidence: high)

However, hidden tags are not exposed through the public API. (confidence: high) Hidden-tag sync should therefore be treated as fragile unless empirically verified through settings file inspection. (confidence: high)

Recommended Notebook Navigator integration:

1. Register Tag Curator actions in Notebook Navigator tag menus where supported. (confidence: high)
2. Use Notebook Navigator metadata APIs for tag color or icon metadata where appropriate. (confidence: medium)
3. Avoid assuming direct public hidden-tag read/write support. (confidence: high)
4. Feature-detect all API calls and degrade gracefully. (confidence: high)

## Colored Tags Wrangler

Colored Tags Wrangler should be treated as a read-only styling source, not a write target. (confidence: high)

It does not expose a programmatic API for setting tag colors. (confidence: high)

Recommended re-architecture:

1. Observe Colored Tags Wrangler's injected stylesheet if installed. (confidence: medium)
2. Read existing color assignments for display compatibility. (confidence: medium)
3. Use Notebook Navigator `setTagMeta` for color writes when available. (confidence: medium)
4. Fall back to Tag Curator's own internal palette and CSS injection when Notebook Navigator is absent. (confidence: medium)

## Dataview, Tasks, and Bases

Tag Curator should not hide tags from Dataview, Tasks, or Bases at the data layer. (confidence: high)

Those plugins and core features should continue to see real vault data. (confidence: high)

If users want query-level exclusion, they should use the query syntax of the relevant tool. (confidence: high)

## Templater and QuickAdd

Templater and QuickAdd should be treated as possible sources of tag noise rather than direct integration priorities. (confidence: medium)

Folder-based and source-based rules can help users manage tags created from templates or automation. (confidence: high)

---

# Mobile Strategy

## Recommendation

The plugin should set `isDesktopOnly` to `false`. (confidence: high)

The core features can work on mobile if implemented carefully. (confidence: high)

## Mobile-equivalent features

1. Tag pane filtering. (confidence: high)
2. Editor autocomplete filtering. (confidence: high)
3. Settings UI. (confidence: high)
4. Rule evaluation. (confidence: high)

## Gracefully degraded mobile features

1. Properties chip filtering may require larger touch hit areas. (confidence: high)
2. Bulk actions should avoid desktop-only multi-select assumptions. (confidence: high)
3. Progress UI should use notices or mobile-safe modals. (confidence: high)

## Desktop-only or deferred mobile features

1. Right-click tag context menus. (confidence: high)
2. Hover preview filtering. (confidence: high)
3. Bases column rendering in v0.1. (confidence: high)
4. Graph view filtering in v0.1. (confidence: high)

## Mobile-specific implementation constraints

1. Avoid lookbehind regex. (confidence: high)
2. Scope observers to specific containers rather than `document.body`. (confidence: high)
3. Avoid Node or Electron APIs. (confidence: high)
4. Test on real devices because `app.emulateMobile()` is not equivalent to real mobile runtime behavior. (confidence: high)

---

# Performance and Reliability Strategy

## Performance target

Tag Curator should add negligible idle cost and low observable interaction cost. (confidence: high)

Recommended targets:

| Metric | Green Target | Confidence |
|---|---:|---|
| Plugin load to ready | Under 50 ms | high |
| DOM observer callback p95 | Under 2 ms | high |
| Tag pane filter pass | Under 16 ms | high |
| Heap delta at 10k notes | Under 30 MB | medium |
| Incremental DOM update | 1 to 5 ms expected | medium |

## Performance posture

The plugin should avoid running full-vault scans during active typing. (confidence: high)

Rule evaluation can be performed over unique tag lists rather than every note on every interaction. (confidence: high)

DOM updates should use classes or attributes rather than repeated structural DOM removal. (confidence: high)

## Reliability safeguards

Recommended safeguards:

1. Panic disable command. (confidence: high)
2. Custom `data-tag-curator-hidden` or class marker for every DOM modification. (confidence: high)
3. Automatic cleanup on unload. (confidence: high)
4. Schema-versioned settings. (confidence: high)
5. Sidecar corruption recovery by rebuilding from metadata cache. (confidence: high)
6. Debounced writes to avoid excessive disk activity. (confidence: high)
7. Feature detection for every companion plugin integration. (confidence: high)

## Benchmarking

The implementation plan includes a benchmark harness concept that can measure load time, observer overhead, metadata event rates, heap usage, and filter latency. (confidence: high)

This should be included behind a development flag and exposed through a command such as `Tag Curator: Run benchmark`. (confidence: high)

---

# UX and Settings Design

## Settings structure

Recommended settings areas:

1. **General.** Mode, default scopes, profile selector, master toggle. (confidence: high)
2. **Rules.** Rule list, ordering, filtering, creation, editing. (confidence: high)
3. **Tags.** Tag list, bulk operations, curation panels. (confidence: high)
4. **Aliases.** Canonical tag and alias mapping editor. (confidence: high)
5. **Profiles.** Saved rule-set configurations. (confidence: high)
6. **Integrations.** Auto-detected Tag Wrangler, Notebook Navigator, and Colored Tags Wrangler state. (confidence: high)
7. **Advanced.** Sidecar location, debug log, export, import, and reset. (confidence: high)

## Onboarding

A first-run welcome experience should help users enable safe presets and understand where filtering will apply. (v0.1 reality: the multi-step wizard described in earlier drafts is dropped per D-002; v0.1 ships a single first-run welcome modal per D-008 instead.) (confidence: high)

Recommended onboarding flow:

1. Explain that Tag Curator does not modify notes. (confidence: high)
2. Ask users which presets to enable. (confidence: high)
3. Ask which UI scopes to filter. (confidence: high)
4. Offer inbox mode explanation but keep default mode simple. (confidence: high)
5. Detect integrations and ask whether to enable compatible hooks. (confidence: high)
6. Show the tag list after setup. (confidence: high)

## Discoverability

The UX must prevent the fear that tags have been deleted. (confidence: high)

Recommended discoverability pattern:

1. Always show hidden tag counts. (confidence: high)
2. Provide `Why is this tag hidden?` diagnostics. (confidence: high)
3. Provide one-click override. (confidence: high)
4. Provide a dry-run mode. (confidence: high)
5. Provide a panic disable command. (confidence: high)

## Visual design

The plugin should use Obsidian CSS variables and avoid hardcoded colors. (confidence: high)

The UI should respect light themes, dark themes, and common community themes. (confidence: high)

---

# Roadmap

## v0.1: MVP

Goal: Prove the core display-layer filtering model in the native tag pane. (confidence: high)

Scope (locked as of 2026-05-28; see `release-plans/plan_v0.1.0.md` status section for exact code/design state):

1. **Engine + storage** (shipped). Rule engine with regex, frequency, and list match types; highest-priority match wins (Q-005). 5 built-in toggleable presets (hex, URL anchor, single-character, numeric, orphan). `previewMode` setting (renamed from `dryRun`, schema v2 migration; D-003). Tag metadata sidecar (`tags.json` with `firstSeen`, `lastSeen`, `count`, `sources`). Multi-pane tag observer with ARIA preservation and `registerEvent` hygiene. 118/118 tests pass.
2. **Tag pane scope only** (confirmed; graph + autocomplete + properties chip = v0.2). (confidence: high)
3. **6 commands** (`toggle-enable`, `panic-disable`, `toggle-preview-mode`, `open-tag-list`, `open-tag-list-hidden`, `rescan-tags`) + status bar item + persistent state banner (D-007) for non-default plugin state.
4. **UI design locked** (round-7 approved; UI code pending). Top-tab Settings shell with Tag List rendered both as a Settings tab and as a sidebar leaf (D-011). Rule editor = card view + right-docked preview (D-010, supersedes the earlier master-detail and wizard plans; D-002 closed). Welcome modal on first run (D-008). Priority architected, hidden from UI (D-009).
5. **GitHub project** [#2](https://github.com/users/jprisant/projects/2) with 16 issues (#1-#4 historical scope notes; #6-#17 backlog items B001-B012).

## v0.2: Broader UI filtering

Goal: Extend filtering beyond the tag pane. (confidence: high)

Scope:

1. Editor autocomplete filtering. (confidence: high)
2. Properties panel tag chip filtering. (confidence: high)
3. Tag metadata sidecar. (confidence: high)
4. First seen, last seen, and count tracking. (confidence: high)
5. Recently created, orphan, and stale curation panels. (confidence: high)

## v0.3: Curation workflows

Goal: Move from hiding tags to governing tag taxonomy. (confidence: high)

Scope:

1. Aliases and display-merge behavior. (confidence: high)
2. Profiles. (confidence: high)
3. Tag Wrangler integration. (confidence: high)
4. Inbox mode. (confidence: high)
5. Dry-run mode. (confidence: high)

## v0.4: Ecosystem and portability

Goal: Make the plugin work better in advanced Obsidian setups. (confidence: high)

Scope:

1. Notebook Navigator integration. (confidence: high)
2. Suggested merges with edit distance. (confidence: high)
3. Export and import. (confidence: high)
4. Community rule packs. (confidence: medium)

## v0.5 and later: Advanced surfaces

Goal: Address higher-risk surfaces after the core model is stable. (confidence: high)

Scope:

1. Bases scope. (confidence: medium)
2. Colored Tags Wrangler compatibility and fallback color handling. (confidence: medium)
3. Mobile polish. (confidence: high)
4. Localization. (confidence: medium)
5. SQLite or IndexedDB backend for very large vaults. (confidence: low)
6. Community plugin directory submission. (confidence: high)

---

# Risks and Mitigations

## Risk 1: Over-scoping the MVP

**Risk:** The full vision includes many surfaces, integrations, modes, and advanced workflows. (confidence: high)

**Mitigation:** Keep v0.1 limited to tag pane filtering, basic rules, and basic settings. (confidence: high)

## Risk 2: Fragile DOM selectors

**Risk:** Obsidian UI selectors can change across versions or themes. (confidence: medium)

**Mitigation:** Use the most stable selectors available, keep observers scoped, feature-detect containers, and maintain a manual QA matrix across core themes and platforms. (confidence: high)

## Risk 3: Colored Tags Wrangler has no write API

**Risk:** The original delegate-color idea assumes an API that does not exist. (confidence: high)

**Mitigation:** Treat Colored Tags Wrangler as read-only, route writes through Notebook Navigator where possible, or own a fallback palette inside Tag Curator. (confidence: high)

## Risk 4: Notebook Navigator hidden-tag sync is fragile

**Risk:** Notebook Navigator's hidden tags are not in the public API. (confidence: high)

**Mitigation:** Avoid two-way hidden-tag sync until the settings shape is empirically verified and version-gated. (confidence: high)

## Risk 5: Graph view is not DOM-filterable

**Risk:** Graph view tag nodes are rendered in canvas and cannot be hidden with ordinary DOM selectors. (confidence: high)

**Mitigation:** Defer graph filtering until after v0.1 and treat it as a separate research task. (confidence: high)

## Risk 6: Bases instability

**Risk:** Bases selectors and formats have changed, making early support more expensive to maintain. (confidence: high)

**Mitigation:** Defer Bases support to v0.5 or later and guard it behind feature detection. (confidence: high)

## Risk 7: Mobile runtime constraints

**Risk:** Mobile behavior differs from desktop, particularly around context menus, hover, regex support, and touch targets. (confidence: high)

**Mitigation:** Use mobile-safe regex, avoid desktop-only assumptions, and test on real iOS and Android devices. (confidence: high)

## Risk 8: User confusion over hidden tags

**Risk:** Users may think the plugin deleted or corrupted their tags. (confidence: high)

**Mitigation:** Build diagnostics, status indicators, dry-run mode, one-click overrides, and panic disable from the beginning. (confidence: high)

---

# Distribution and Release Strategy

## Recommended repository structure

The repository should follow normal Obsidian plugin conventions. (confidence: high)

Recommended tree:

```text
tag-curator/
├── .github/
│   ├── workflows/
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
├── src/
│   ├── main.ts
│   ├── settings.ts
│   ├── dom/
│   ├── integrations/
│   ├── engine/
│   ├── storage/
│   ├── ui/
│   └── dev/
├── __tests__/
├── scripts/
├── manifest.json
├── manifest-beta.json
├── versions.json
├── package.json
├── esbuild.config.mjs
├── styles.css
├── README.md
├── CHANGELOG.md
└── LICENSE
```

## Recommended manifest posture

The plugin should use `isDesktopOnly: false` because the core feature set can work on mobile. (confidence: high)

The recommended `minAppVersion` is `1.9.10` if Bases awareness remains part of the compatibility target. (confidence: high)

If v0.1 omits Bases entirely, `1.8.0` may provide broader reach with little functional loss. (confidence: medium)

## Beta distribution

BRAT is the recommended beta distribution path before community plugin directory submission. (confidence: high)

The release process should attach `manifest.json`, `main.js`, and `styles.css` to GitHub releases. (confidence: high)

## Community plugin directory

Submission to the Obsidian community plugin directory should happen after the core feature set is stable, likely after v0.3. (confidence: high)

Common rejection risks to avoid:

1. UI string sentence-case violations. (confidence: high)
2. Metadata mismatch between manifest, README, and community plugin entry. (confidence: high)
3. Hard-coded `.obsidian` paths instead of `Vault.configDir`. (confidence: high)
4. Deprecated workspace APIs. (confidence: high)
5. Unawaited promises. (confidence: high)
6. Plugin command IDs that redundantly include the plugin ID. (confidence: high)
7. Settings headings implemented with raw HTML instead of Obsidian settings APIs. (confidence: high)

---

# Recommended Next Steps

## Immediate next steps

1. **Lock v0.1 scope.** Commit to tag pane filtering, basic rules, basic settings, and a tag list. (confidence: high)
2. **Create repository from Obsidian sample plugin.** Use the official sample plugin as the starting point. (confidence: high)
3. **Implement settings schema.** Add `schemaVersion`, defaults, and migration scaffolding immediately. (confidence: high)
4. **Build tag pane observer.** Implement scoped observation and class-based hiding. (confidence: high)
5. **Implement preset rules.** Start with hex codes, URL anchors, numeric tags, single-character tags, and orphan tags. (confidence: high)
6. **Add panic disable.** Provide a command that removes every Tag Curator DOM effect. (confidence: high)
7. **Add minimal diagnostics.** Show why a hidden tag was hidden. (confidence: high)
8. **Create benchmark command.** Add development-only benchmark command early to catch performance regressions. (confidence: high)

## First validation milestone

The first meaningful milestone is a working local plugin that can hide selected native tag pane rows using user-configurable rules without modifying note files. (confidence: high)

Acceptance criteria:

1. A user can enable a preset rule. (confidence: high)
2. Matching tags disappear from the native tag pane. (confidence: high)
3. Disabling the rule restores the tags. (confidence: high)
4. Disabling the plugin restores all tags. (confidence: high)
5. The plugin does not alter note files. (confidence: high)
6. The plugin works on desktop and at least one real mobile device. (confidence: medium)

## Research tasks before v0.3+

1. Verify Notebook Navigator hidden-tag settings shape. (confidence: high)
2. Inspect Tag Wrangler's current event call site. (confidence: high)
3. Confirm Bases tag-cell DOM in current Obsidian versions. (confidence: high)
4. Validate autocomplete filtering through `EditorSuggest` rather than CSS hiding. (confidence: high)
5. Test iOS and Android mobile behavior on real devices. (confidence: high)

---

# Open Questions

1. The exact Notebook Navigator hidden-tags settings shape still needs empirical verification. (confidence: high)
2. The current Tag Wrangler `workspace.trigger('tag-wrangler:contextmenu', ...)` implementation should be inspected directly before integration work. (confidence: high)
3. The current Bases tag-cell DOM path should be inspected before committing to Bases support. (confidence: high)
4. The best UX for nested tag aliasing remains unresolved. (confidence: medium)
5. The plugin's performance on 50k+ note vaults needs real testing. (confidence: medium)
6. The ideal storage backend for massive vaults is not known yet. (confidence: low)
7. The right timing for community plugin submission depends on whether v0.3 is considered stable enough. (confidence: medium)

---

# Reference Links

## Obsidian development

- Obsidian plugin sample: https://github.com/obsidianmd/obsidian-sample-plugin
- Obsidian plugin API docs: https://docs.obsidian.md/Home
- Obsidian releases repository: https://github.com/obsidianmd/obsidian-releases
- Obsidian API repository: https://github.com/obsidianmd/obsidian-api

## Adjacent plugins

- Tag Wrangler: https://github.com/pjeby/tag-wrangler
- Notebook Navigator: https://github.com/johansan/notebook-navigator
- Notebook Navigator API reference: https://github.com/johansan/notebook-navigator/blob/main/docs/api-reference.md
- Colored Tags Wrangler: https://github.com/code-of-chaos/obsidian-colored_tags_wrangler
- Dataview: https://github.com/blacksmithgu/obsidian-dataview
- Tasks: https://github.com/obsidian-tasks-group/obsidian-tasks
- Linter: https://github.com/platers/obsidian-linter
- Templater: https://github.com/SilentVoid13/Templater

## Testing and beta distribution

- obsidian-typings: https://github.com/Fevol/obsidian-typings
- jest-environment-obsidian: https://github.com/obsidian-community/jest-environment-obsidian
- BRAT: https://github.com/TfTHacker/obsidian42-brat

## Related Obsidian forum threads

- Do not treat hexadecimal numbers as tags: https://forum.obsidian.md/t/dont-treat-hexadecimal-numbers-as-tags/37143
- Allow users to turn off tags or customize tag recognition: https://forum.obsidian.md/t/allow-users-to-turn-off-tags-or-customize-tag-recognition/26292
- Hide tags in the tags pane: https://forum.obsidian.md/t/hide-tags-in-the-tags-pane/53588
- Hexadecimal color codes in markdown notes included in tag pane: https://forum.obsidian.md/t/hexidecimal-color-codes-in-md-notes-are-included-in-tag-pane/4097

---

# Bottom Line

Tag Curator is a credible and useful Obsidian plugin concept because it solves a persistent tag-noise problem with a reversible display-layer model. (confidence: high)

The best path is to ship a narrow v0.1 that proves native tag pane filtering and rule presets, then expand gradually into autocomplete, properties, profiles, aliases, integrations, and advanced curation panels. (confidence: high)

The project should avoid patching Obsidian internals, avoid modifying notes, avoid filtering query layers, and avoid overcommitting to fragile surfaces like Bases and graph view too early. (confidence: high)

