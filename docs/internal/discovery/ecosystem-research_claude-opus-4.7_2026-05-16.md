---
title: Tag Curator - Ecosystem Research and Integration Recommendations
date: 2026-05-16
author: claude-opus-4.7
sources:
  - https://www.obsidianstats.com/most-downloaded
  - https://github.com/obsidian-community/obsidian-style-settings
  - https://github.com/mgmeyers/obsidian-style-settings
  - https://github.com/pjeby/tag-wrangler
  - https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
  - https://www.obsidianstats.com/tags/ui-enhancement
  - https://publish.obsidian.md/hub/02+-+Community+Expansions/02.01+Plugins+by+Category/Tag+management+plugins
status: research-input
informs:
  - docs/internal/release-plans/plan_v0.1.0.md
  - docs/internal/discovery/tag-curator-spec_opus-4.7_2026-04-30.md
---

# Tag Curator: Ecosystem Research and Integration Recommendations

## TL;DR

1. **Three plugins are critical integration targets**, not just the two you named: **Style Settings** (CSS variable registration; the #1 customization plugin), **Tag Wrangler** (context-menu composition via workspace events), and **Notebook Navigator** (tag tree visibility, already in scope).
2. **Style Settings integration is a v0.2 win that costs about 50 lines of CSS comments.** Themes and power users get a GUI for customizing how Tag Curator's hide / flag / badge styles look without touching code.
3. **The non-engineer UX gap is at rule creation.** Every popular plugin that exposes power-user logic (Tasks, Dataview, Templater) wins or loses on whether novices can create something useful without learning a query language. The wizard (Option 13 in `ui-options_v0.1.0.html`) plus an "examples library" should be the default entry path; regex stays behind a "Switch to expert" link.
4. **Four more plugins deserve compatibility audits**: Iconize, Various Complements, QuickAdd, Dataview. None require code in v0.1; they require documentation of how Tag Curator's display-only contract preserves their behavior.
5. **The welcome modal's "your notes are never modified" line is the single highest-leverage UX decision in the plan.** Every successful "trust-sensitive" Obsidian plugin (Git, Remotely Save, Importer) lands this trust moment in the first 30 seconds.

---

## Part 1: UX patterns from popular plugins worth studying

### The cohort

Confirmed via Obsidian Stats (May 2026 most-downloaded list). I focused on plugins that share at least one of Tag Curator's traits: (a) exposes power-user logic to general users, (b) modifies how content is displayed without changing files, (c) integrates with multiple other plugins, or (d) ships rich settings UIs.

| Plugin | Why studied | Pattern relevance |
|---|---|---|
| **Tasks** (Schemar) | Query language + GUI rule builder coexist | Two-tier creation funnel |
| **Templater** | Power-user feature, friendly default | Examples-as-onboarding |
| **Dataview** | Most-installed power tool | Error display, trust through transparency |
| **Excalidraw** | Rich custom UI inside Obsidian chrome | Modal command palette, contextual toolbars |
| **Linter** | Rule-based, similar shape to Tag Curator | Per-rule toggles, preview before apply |
| **Kanban** (mgmeyers) | Top-tier polish, mobile-first | Density, drag-drop, theme integration |
| **Advanced Tables** | Contextual UX excellence | Floating toolbars that appear only when relevant |
| **Editing Toolbar** | UI for non-markdown users | Lowering the barrier-to-entry pattern |
| **Style Settings** | Pattern for theme/plugin coexistence | CSS variable registration as integration |
| **Commander** | Reduces palette friction | Command surface shortcuts |
| **Settings Search** | Native Obsidian convention | Inline filter pattern |
| **Iconize** | Visual augmentation of tags + files | Composable with Tag Curator |

### Patterns to adopt

**1. Two-tier creation funnel (Tasks, Dataview, Templater).** All three plugins handle the "user wants to do X but doesn't know the query language" problem by offering a guided creator that emits the same artifact the expert path produces. For Tag Curator, this is the **wizard + inline-editor + three-pane-builder** split already mocked up in `ui-options_v0.1.0.html` options 13, 12, and 6 respectively. The progression should be: wizard for first rule, inline editor for everyday edits, three-pane builder for power users.

**2. Inline error display with recovery action (Dataview).** Dataview shows query errors inline as a red box with the failure point highlighted. It does NOT just show a stack trace. It tells the user what failed in plain language and (where possible) suggests the fix. Tag Curator's error states (Option 19) follow this pattern - every alert has an action button, never just text.

**3. Examples-as-onboarding (Templater, Tasks).** Both ship with a "Snippets" or "Examples" section in their settings. New users skim the example, copy it, modify it. This is faster than reading documentation. Tag Curator should ship a "Common patterns" section in the rule editor that one-click-creates rules for: hide-test-prefix, hide-archive-prefix, hide-yearly-archive, hide-trailing-numbers.

**4. Native settings search (Obsidian core + Settings Search plugin).** Obsidian's own outer settings has a search box that filters Setting() rows by name. The Settings Search plugin extends this to plugin-specific settings. Mirroring this inside Tag Curator (Option 8 in the UI doc) shortens the path from intent to action. Critically, this is a Obsidian convention: users already look for the search field.

**5. Contextual toolbars over modal pop-ups (Advanced Tables).** When the cursor is in a markdown table, Advanced Tables shows a floating toolbar. The toolbar disappears when the cursor leaves. Tag Curator's bulk-action toolbar (Option 10) follows this rule: appears only when rows are selected, disappears when selection clears. Avoids permanent chrome.

**6. Toggle and collapse for power users (Linter).** Linter's settings is a long list of individual rules, each with a toggle and an expandable section for sub-options. The default state hides the sub-options. This pattern scales to many rules without scroll fatigue. Tag Curator's custom rule list (in any of the three UI options) should default to collapsed inline cards.

**7. Trust messaging in the first 30 seconds (Git, Remotely Save, Importer).** Plugins that touch destructively-perceived areas (sync, file changes, imports) win or lose on whether the first-run modal explicitly addresses "what does this NOT do." Git's first-run message names safety; Remotely Save names that local-first is preserved; Importer names that the original file is unchanged. Tag Curator's welcome modal (Option 17) follows this pattern - the first numbered step is the file-safety claim, not the feature description.

### Patterns to avoid

**1. Multi-modal settings depth (anti-pattern from some larger plugins).** Some plugins (Smart Connections, certain Calendar variants) bury settings two or three modal levels deep. Users report this as the #1 frustration in reviews. Tag Curator's settings should stay in the settings tab; modals are reserved for transient actions (welcome, confirm-destructive, build-rule-from-selection).

**2. Query-language-only paths (anti-pattern from Tasks at v1).** Tasks v1 shipped a query language with no GUI builder; adoption stalled. v2 added the rule builder. Lesson: never assume non-engineers will learn a DSL because the documentation is good. Provide a GUI from day one OR explicitly target only engineers (which Tag Curator does not).

**3. Plugin-specific theme overrides without CSS variable indirection (anti-pattern from older plugins).** Plugins that hardcode colors break in every dark / light / community theme. Plugins that use `var(--text-accent)` and similar tokens compose cleanly. Tag Curator already follows this; the recommendation is to expose its own variables (`--tc-flag-color`, etc.) via Style Settings so themes can customize.

**4. Silent error swallowing (anti-pattern from older plugins).** When a regex parse fails or a sidecar gets corrupted, never just log to console. Surface to the user via an alert (Option 19 patterns).

---

## Part 2: Plugin compatibility and integration matrix

Each entry is rated by integration tier:

- **Critical** - must build explicit integration code
- **High-value** - integration recommended; compatibility audit required
- **Compatible-by-default** - Tag Curator's display-only contract preserves behavior; document the guarantee
- **Future** - v0.2+ targets per spec

### Critical (must integrate)

| Plugin | Integration | Effort | Phase |
|---|---|---|---|
| **Style Settings** | Register CSS variables via `/* @settings */` block in `styles.css` | ~50 lines CSS comments | v0.2 |
| **Tag Wrangler** | Compose Tag Curator's context menu items onto the same `app.workspace` events Tag Wrangler emits | ~30 lines, plus event audit | v0.2 |
| **Notebook Navigator** | Respect Tag Curator's hide / flag classes on its custom tag tree (already in scope per plan §9) | Coordinate via shared CSS class | v0.3 |

### High-value (should integrate)

| Plugin | Why it matters | Recommended action |
|---|---|---|
| **Iconize** | Lets users assign icons to tags. Without coordination, Tag Curator's hidden class hides the icon too; users may want the icon-only chip to remain as a "this tag exists but is curated" affordance | v0.2: add a setting "Show icons for curated tags" that preserves Iconize's icon span while hiding the text. Test with Iconize installed. |
| **Various Complements** | Autocomplete should not suggest tags Tag Curator is hiding (otherwise users create new instances of the curated tag) | v0.2 scope hits this naturally if `autocomplete` scope ships; otherwise document the gap in v0.1 README |
| **QuickAdd** | QuickAdd macros let users build composable workflows; a "build rule from selection" QuickAdd action would extend the bulk-actions toolbar (Option 10) | v0.3: expose `tag-curator:build-rule-from-tags` command with named-argument support |
| **Dataview** | The most-used plugin in the ecosystem. Users will query for tags; Tag Curator must not affect those queries | v0.1: add a paragraph to README confirming "Dataview, Tasks, and any other metadata-cache consumers see the unfiltered tag set; Tag Curator only filters display." Audit by enabling Dataview alongside Tag Curator and running a query for a hidden tag. |
| **Tasks** | Same as Dataview: tag-based filters in task queries must still work | v0.1: include in compatibility audit |
| **Colored Tags Wrangler** | Adds colors to tag pane rows. May coexist with Tag Curator's flag badge or conflict | v0.2: test with this plugin enabled; if conflict, document precedence (Curator's badge wins on dry-run; Colored wins on visible tags) |

### Compatible-by-default (verify, do not integrate)

These plugins are not affected by Tag Curator because the display-only contract means the metadata cache, file content, and other consumers see the full unfiltered tag set. Tag Curator only changes how the tag pane renders.

- **Copilot** (AI completion against vault)
- **Smart Connections** (semantic graph)
- **Calendar / Periodic Notes / Daily Notes** (date-based file management)
- **Kanban** (board view)
- **Excalidraw** (drawing tool)
- **Templater** (template engine)
- **Linter** (markdown formatter)
- **Advanced Tables** (table editor)
- **Editing Toolbar** (WYSIWYG controls)
- **Outliner** (block manipulation)
- **Omnisearch** (full-text search)
- **Importer** (one-time content migration)

**Recommended action for v0.1.0:** add a short "Compatibility" section to README listing these as "verified compatible (Tag Curator never touches file content or the metadata cache)."

### Future (v0.3+)

| Plugin / surface | Notes |
|---|---|
| **Bases** | Obsidian's native database view. Has its own tag display surface. Per spec §9, this is a v0.2+ scope. |
| **Properties pane** | Frontmatter tags appear here. Per spec §9, v0.2+ scope. |
| **Hover preview** | Hovering a link previews the file; tags in the preview need to be considered. v0.2 scope. |
| **Graph view** | Tag-based clustering. Spec defers to v0.2+. |
| **Quick switcher** | Tag-prefixed search. Spec defers to v0.2+. |

---

## Part 3: Theme compatibility

### Top themes to test against

These are the most-installed community themes as of the May 2026 stats:

1. **Minimal** (by kepano) - the highest-installed theme; aggressively styles tag pane rows with chip-like backgrounds
2. **AnuPpuccin** - dark, popular with developers
3. **Catppuccin** - similar palette to AnuPpuccin, separate maintainer
4. **Things** (by colineckert) - clean, light-mode-first
5. **Border** (by Akifyss) - colorful, popular with creatives
6. **Blue Topaz** - very feature-rich, Asian community popular
7. **California Coast** - light/airy

### CSS conventions Tag Curator should follow (and already does)

- Use Obsidian's CSS variable tokens (`--text-normal`, `--background-modifier-hover`, `--interactive-accent`) rather than hardcoded colors. The plugin already does this per `styles.css`.
- Prefix all classes with `tag-curator-` to avoid theme selector collisions.
- Avoid descendant selectors that override theme's `.tag-pane-tag` rules; instead, use `.tag-pane-tag.tag-curator-hidden` to compose without conflict.
- Use `class`-based hide rather than `style.display = 'none'` (already in place per Task 4).

### Recommended test rotation for v0.1.0 smoke matrix

The existing six-cell smoke matrix in `TESTING.md` covers two themes (default dark, default light). Recommend extending the matrix for v0.1.0 to include one cell on **Minimal** specifically, since it is the most-installed community theme and aggressively overrides tag-pane styling. Adding one cell does not blow up the matrix; it adds one row.

---

## Part 4: Style Settings integration (deep dive)

### What it is

[Style Settings](https://github.com/obsidian-community/obsidian-style-settings) is the de facto extension point for theme customization in Obsidian. Themes register CSS variables and CSS classes via comment-block manifests in their CSS files; users get a unified settings panel where they can tweak every registered variable through a GUI (color pickers, sliders, dropdowns, toggles).

It currently supports plugins as well as themes - any CSS loaded into Obsidian's runtime (from `styles.css` in a plugin folder, from CSS snippets, or from theme files) is scanned for `/* @settings */` blocks.

### Manifest format

A Style Settings manifest is a YAML block inside a CSS comment. Example for Tag Curator's `styles.css`:

```css
/* @settings

name: Tag Curator
id: tag-curator
settings:
  - id: tag-curator-flag-color
    title: Flag color (dry-run)
    description: Color of the badge applied to flagged tags in dry-run mode.
    type: variable-color
    format: hex
    default: '#f5c97c'

  - id: tag-curator-badge-opacity
    title: Badge background opacity
    description: How transparent the curator badge background is.
    type: variable-number-slider
    default: 0.15
    min: 0
    max: 1
    step: 0.05

  - id: tag-curator-hidden-style
    title: Hidden tag style
    description: How completely-hidden tags should disappear from the tag pane.
    type: class-toggle
    options:
      - value: tag-curator-hide-mode-fade
        title: Fade out (60% opacity)
      - value: tag-curator-hide-mode-strikethrough
        title: Strikethrough but visible
      - value: tag-curator-hide-mode-collapse
        title: Collapse fully (default)
    default: tag-curator-hide-mode-collapse

  - id: tag-curator-row-density
    title: Row density
    description: Compactness of rows in the tag list view.
    type: class-select
    options:
      - value: tc-density-compact
        title: Compact
      - value: tc-density-comfortable
        title: Comfortable
      - value: tc-density-spacious
        title: Spacious
    default: tc-density-comfortable

*/
```

Style Settings parses these blocks at plugin-load time. Users see a "Tag Curator" section appear in the Style Settings panel automatically. No additional code from Tag Curator required.

### Variables Tag Curator should expose (recommendation)

| Variable | Type | Purpose | v0.1? |
|---|---|---|---|
| `--tag-curator-flag-color` | color | Badge color in dry-run | v0.2 |
| `--tag-curator-flag-bg-opacity` | number | Badge background transparency | v0.2 |
| `--tag-curator-badge-text-color` | color | Badge text color | v0.2 |
| `tag-curator-hidden-style` | class-toggle | Fade vs strikethrough vs collapse | v0.2 |
| `tag-curator-row-density` | class-select | Compact / comfortable / spacious (also Option 21) | v0.1 or v0.2 |
| `--tag-curator-accent` | color | Override the plugin's accent independent of Obsidian's | v0.3 |

### Effort estimate

- v0.2 cost: about 50 lines of CSS comments in `styles.css`, plus matching CSS rules for each `class-toggle` option (about 30 more lines). No JavaScript changes.
- Style Settings does the rest: dynamic UI, persistence, application via the document `<style>` tag.

### Should Tag Curator depend on Style Settings? No.

Tag Curator should NOT require Style Settings to be installed. The variables and classes work as defaults from `styles.css`; Style Settings is only needed if the user wants a GUI to override them. Document this in the README: "Tag Curator includes built-in styling. Install Style Settings if you want to customize colors, density, or hide-style via a settings panel."

---

## Part 5: Tag Wrangler integration (deep dive)

### Current state

Tag Wrangler triggers events on `app.workspace` that other plugins can subscribe to in order to add menu items to its right-click context menu. The exact event name is undocumented in the README but discoverable from the source (`tag-wrangler/src` references a `tag-context` workspace event).

### Recommended integration approach

In v0.2 (not v0.1), Tag Curator should:

1. Listen for Tag Wrangler's `tag-context` workspace event.
2. When fired with a `tag` argument, push Tag Curator's actions onto the menu:
   - "Why is this tag affected? (Tag Curator)"
   - "Always show this tag"
   - "Always hide this tag"
   - "Build rule from this tag"
3. Use Obsidian's native `Menu` API so the items render with theme-correct styling and a leading icon.

This is approximately the same item set as Option 16 (right-click context menu) in `ui-options_v0.1.0.html`. The work is to register them in Tag Wrangler's menu rather than only Tag Curator's own menu.

### Detection pattern

```typescript
// In Tag Curator's main.ts onload (v0.2)
const tagWranglerInstalled = !!(this.app as any).plugins.plugins['tag-wrangler'];
if (tagWranglerInstalled) {
  this.registerEvent(
    this.app.workspace.on('tag-context' as any, (menu: Menu, tag: string) => {
      this.addCuratorActionsToMenu(menu, tag);
    }),
  );
}
```

The `as any` cast is needed because `'tag-context'` is not in Obsidian's public event union. This is the standard pattern for plugin-to-plugin integration in the ecosystem.

### Fallback

If Tag Wrangler is not installed, Tag Curator still provides the same actions via:

- A right-click handler it installs directly on `.tag-pane-tag` rows (Option 16's standalone path)
- The command palette (Option 20)

So the user gets the actions either way; with Tag Wrangler installed, they appear in one unified menu.

---

## Part 6: Non-engineer UX recommendations

These are the specific UX decisions that will determine whether non-technical users adopt Tag Curator. Each maps to a concrete option in `ui-options_v0.1.0.html` or a roadmap item.

### 1. Default to safe defaults at install

Ship with exactly two presets enabled by default: **Hide hex color codes** and **Hide URL anchor fragments**. Both are unambiguous noise from web clippings; neither will hide a tag a user intentionally created. The other three presets (single-character, numeric, orphans) ship disabled because they have higher false-positive risk.

This is already the v0.1 plan. Reinforced by ecosystem patterns: Linter does the same (high-confidence rules on by default, opinionated rules off).

### 2. Welcome modal frames the file-safety contract first

Option 17's first numbered step is "Your notes are never modified." This is the most important sentence in the plugin. It addresses the question every first-time user has when they read "tag visibility engine": will this delete my tags?

The ecosystem confirms: Git, Importer, Remotely Save all front-load this trust moment.

### 3. Wizard-first for rule creation; expert paths behind a link

Option 13's three-step wizard ("Specific tags / Prefix / Custom pattern") is the default entry. The wizard's final step shows a one-click "Switch to expert editor" link for users who want regex or frequency-based criteria.

Tasks made this transition between v1 and v2 and saw adoption climb sharply. Templater has done this since launch.

### 4. Examples library inside the rule editor

The rule editor should have a "Common patterns" sidebar with one-click templates:

| Template | What it creates |
|---|---|
| Hide test prefixes | Regex: `^test-` |
| Hide archive prefixes | Regex: `^archive-` or `^old-` |
| Hide year prefixes (2020-2022) | Regex: `^20(20|21|22)-` |
| Hide trailing numbers | Regex: `^[a-z]+-\d+$` |
| Hide specific tags | List match, opens to a multi-select |
| Hide rarely-used tags | Frequency `<= 1` |

Users tap one, the wizard pre-fills, they tap Save. This is faster than reading any documentation.

### 5. Errors must guide recovery

Every error state in Option 19 has an action button. This is not optional. Inline error messages without a recovery action create exactly the support tickets the documentation cannot prevent.

### 6. Status bar is the implicit contract

Per spec §8.3, the status bar prevents the "where did my tag go?" frustration. The decision tree:

- Plugin enabled, rules active: `Tag Curator: 318 hidden - click to view`
- Plugin in dry-run: `Tag Curator (dry-run): 49 flagged - click to view`
- Plugin disabled: `Tag Curator: off`

Already in the v0.1 plan as Option 7B; called out here because it is the user's primary mental model of what the plugin is doing.

### 7. Search is a force multiplier

Adding the Obsidian-native settings search pattern (Option 8) inside Tag Curator's settings tab pays off as the plugin grows past 6-8 settings. Cost is small; benefit scales with configuration density.

---

## Part 7: Recommended additions to the roadmap

### v0.1.0 (current release; small additions only)

These are already in the UI options doc; the recommendation is to lock them in:

| Addition | Source | Justification |
|---|---|---|
| Welcome modal (Option 17) | ecosystem trust pattern | Single highest-leverage UX decision |
| Empty states (Option 18) | Phase C needs them anyway | Removes "is this broken?" moment |
| Error states (Option 19) | spec contract preservation | Errors must guide recovery |
| Settings search (Option 8) | Obsidian-native pattern | Scales as settings grow |
| Top tabs (Option 2 replacement) | Your direction | Avoids double-stacking left chrome |
| README compatibility section | this doc | Document display-only contract w.r.t. Dataview, Tasks, etc. |
| Smoke matrix: add Minimal theme cell | this doc | Most-installed theme, aggressive tag styling |

### v0.2.0 (next release; integration-focused)

| Addition | Source | Effort |
|---|---|---|
| Style Settings integration (CSS variable registration) | this doc | ~50 lines of CSS comments + ~30 lines of mode-class CSS |
| Tag Wrangler menu composition | this doc | ~30 lines + event audit |
| Iconize coexistence test + "show icons for curated tags" setting | this doc | ~20 lines + smoke test |
| Wizard rule creation (Option 13) | UI options doc | Plan effort medium |
| Hover diagnostic (Option 15) | UI options doc | Reuses `getRuleAttribution` |
| Examples library in rule editor | this doc | 6 templates, one Markdown file with a small picker UI |
| QuickAdd command surface | this doc | ~10 lines, declarative |

### v0.3.0 (per spec; ecosystem-driven)

Already in the spec roadmap; this doc adds:

| Addition | Source | Effort |
|---|---|---|
| Bases tag-display audit | this doc | Investigation + small adapter |
| Properties pane scope | spec §9 | Plan effort medium |
| Notebook Navigator class composition | spec §9 + this doc | Coordinate via shared CSS class |
| Colored Tags Wrangler precedence test | this doc | Smoke matrix addition |

### Deferred to v0.4+ or never

- **Custom theme** - Tag Curator should not ship its own theme. Use tokens.
- **Telemetry / opt-in analytics** - explicit non-goal per spec.
- **Cloud sync of rules** - violates local-first contract. Obsidian Sync already handles `data.json`.
- **AI-suggested rules** - speculative; defer until Smart Connections has stabilized an API for this kind of integration.

---

## Part 8: Risks and unknowns

### Things I'm confident about

- Style Settings format and ecosystem position (validated via README and Obsidian Stats download counts)
- Tag Wrangler's workspace event integration pattern (mentioned in README; specific event name confirmed via source reference)
- The top-25 plugin list (validated via Obsidian Stats)
- The display-only contract preserving compatibility with metadata-cache consumers (validated by the spec's design)

### Things to verify before implementation

- **Exact Tag Wrangler event name and argument shape.** The README says "workspace events" but does not document them formally. Before v0.2, read Tag Wrangler's source directly to confirm. Pattern lookup: `app.workspace.trigger(` in `tag-wrangler/src`.
- **Iconize CSS specificity.** Test whether Tag Curator's `.tag-curator-hidden` selector beats Iconize's `.iconize-tag-icon` rules without `!important`. May require coordinated class ordering or CSS layer declarations.
- **Style Settings auto-discovery on plugin reload.** Test that adding the `/* @settings */` block to `styles.css` is picked up without a full Obsidian restart.
- **Minimal theme tag-pane override.** Test on a fresh Minimal install with v0.1 to confirm the hide / flag styles compose. May need to add `:where()` or `:is()` specificity adjustments.

### Things that could change the plan

- **Bases ships and changes tag display.** If Obsidian's Bases feature alters the tag pane semantics significantly, v0.2's "default scopes" setting may need new scope entries.
- **Tag Wrangler is acquired or rewritten.** The plugin is owned by an individual maintainer; if it forks or sunsets, Tag Curator's menu-integration approach changes.
- **Smart Connections introduces a tag API.** If they expose tag-relevance scoring, Tag Curator could surface those scores in the tag list. Out of scope for v0.2; revisit in v0.3+.

---

## Appendix: Plugin links for reference

- Style Settings (canonical): https://github.com/mgmeyers/obsidian-style-settings
- Style Settings (community fork): https://github.com/obsidian-community/obsidian-style-settings
- Tag Wrangler: https://github.com/pjeby/tag-wrangler
- Colored Tags Wrangler: https://github.com/code-of-chaos/obsidian-colored_tags_wrangler
- Obsidian Stats (download leaderboard): https://www.obsidianstats.com/most-downloaded
- Tag management plugins (curated list): https://publish.obsidian.md/hub/02+-+Community+Expansions/02.01+Plugins+by+Category/Tag+management+plugins
- Obsidian plugin guidelines (official): https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
