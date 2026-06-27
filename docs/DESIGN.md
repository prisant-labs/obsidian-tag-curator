# Design System

Design reference for obsidian-tag-curator's UI. The plugin's visual language is **Obsidian's own**: it borrows the host theme's colors, fonts, and spacing rather than imposing its own, so it looks native in any theme (light, dark, or community). Anyone (or any agent) generating or restyling UI for this plugin should follow the rules below. The implementation lives in `styles.css`; the component/layer design behind these surfaces is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Prime rules

1. **No hardcoded colors.** Every color comes from an Obsidian theme variable (`var(--text-muted)`, `var(--interactive-accent)`, `var(--background-secondary)`, `var(--divider-color)`, ...). The plugin defines no literal hex values in component styling.
2. **Own only `tag-curator`-prefixed classes.** Decorate Obsidian's rendered elements (`.tag-pane-tag`, `.multi-select-pill`, ...) by adding plugin-owned classes; never restyle a host base class destructively.
3. **Display-only and reversible.** Styling expresses state (hidden / flagged / selected); it never alters content. Removing a class fully restores the element.

## Color

The plugin owns exactly three themeable values, defined as CSS custom properties on `:root` and registered with Style Settings (so power users can override them from a GUI), with sensible defaults when Style Settings is absent:

| Variable | Default | Use |
|---|---|---|
| `--tag-curator-flag-color` | `var(--text-warning)` | flagged tag name / accent in preview mode |
| `--tag-curator-flag-bg` | `var(--background-modifier-hover)` | wash behind a flagged row or pill |
| `--tag-curator-flag-weight` | `inherit` | flagged name weight (the bold toggle sets 700) |

Everything else is a direct Obsidian variable: accent is `--interactive-accent`; text tiers are `--text-normal` / `--text-muted` / `--text-faint`; surfaces are `--background-primary` / `--background-secondary`; borders are `--divider-color` / `--background-modifier-border`.

## Class-name families

Each surface uses a short prefix so styles stay scoped and greppable:

| Prefix | Surface |
|---|---|
| `tag-curator-*` | core decoration + plugin-root containers |
| `tc-*` | shared utilities (`tc-hidden`, `tc-pill`, `tc-action-link`) |
| `sb-*` | state banner |
| `tcw-*` | welcome modal |
| `tcst-*` | settings tab |
| `tcr-*` | rule editor |
| `tct-*` | curation workspace + tag table |

Scope decoration classes: `.tag-curator-hidden` / `.tag-curator-flagged` (tag pane), `.tc-nn-hidden` / `.tc-nn-flagged` (Notebook Navigator), `.tc-prop-hidden` / `.tc-prop-flagged` (Properties), `.tc-ac-hidden` / `.tc-ac-flagged` (Autocomplete).

## Components

- **Cards** (presets, rules, integrations): `var(--background-secondary)` fill, `1px solid var(--divider-color)`, `border-radius: 9-10px`, `12-14px` padding.
- **Switch toggle**: a 38x22 pill (`tcst-toggle` / `tcr-toggle` / `tcw-toggle`); `var(--background-modifier-border)` when off, `var(--interactive-accent)` when on, with a white knob that slides. Keyboard-operable (see Accessibility).
- **Pills / badges**: `border-radius: 999px`, uppercase, `letter-spacing: 0.04em`, small (10-11px). Status pills tint with success / warning / muted theme colors.
- **State banner**: a left-accent-bar callout (`border-left: 3px`), tinted wash, filled round icon, solid action button. One variant per non-default state (preview uses warning, off uses accent).
- **Flag treatment** (preview mode): a `var(--tag-curator-flag-bg)` wash, an `inset 2px 0 0 var(--tag-curator-flag-color)` accent bar, and a flag-colored name. **Hidden treatment**: `display: none`.

## Typography and spacing

- **Font**: `inherit` (Obsidian's UI font) everywhere; no custom font stack.
- **Size scale**: roughly 10.5px (labels, pills), 13px (body), 16-26px (titles, stat values). Counts use `font-variant-numeric: tabular-nums`.
- **Weight**: 400 body, 600 labels and headings, 700 titles and stat values.
- **Spacing**: 8px base rhythm; gaps of 6-14px; card padding 11-18px.

## Layout

- **Flex columns** for panes and modals; **CSS grid** for the rule editor (`1fr 300px`) and the virtualized tag table (one `--tct-grid` template shared by the header and rows so columns stay aligned).
- **Responsive**: the rule-editor workspace collapses to a single column at `max-width: 900px`; on mobile the curation pane opens full-width rather than splitting.

## Accessibility

- Native controls (`<button>`, `<input>`) are used wherever possible (keyboard-operable for free).
- Non-button controls built from div / span / anchor (tabs, toggles, cards, sortable headers, chips) go through `makeActivatable` (`src/util/a11y.ts`): `role` + `tabindex` + Enter/Space activation. Switches add an `aria-label`; toggles, chips, and cards reflect state with `aria-pressed` / `aria-checked`.
- No nested interactive controls; no `innerHTML` / `outerHTML` (build DOM with `createEl` / `createDiv` / `createSpan`).

## Do / Don't

**Do:** use theme variables; own only `tag-curator`-prefixed classes; keep styling reversible; give every interactive control a keyboard path.

**Don't:** hardcode colors or fonts; restyle Obsidian base classes destructively; use `innerHTML`; set inline `style.*` for anything but computed geometry (transforms, positions, the grid template variable).
