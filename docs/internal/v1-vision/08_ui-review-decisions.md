# Tag Curator v1.0 - UI review decisions (rc1)

Status: decisions captured 2026-06-01. This document records the decisions and
discussions from the multi-round crit review of the rc1 UI review board, and
translates them into a code-change roadmap for the actual plugin.

- **Source:** crit review, 6 rounds / 27 pins, on
  `docs/internal/v1-vision/ui-ideas/ui_rc1-smoke-review.html`. Full thread archived at
  `~/.crit/reviews/119209942d18/review.json`.
- **Scope:** the review board is a mockup; these are design decisions about how the
  v1.0 Settings, onboarding, and workspace UI should look and behave. Section 3 maps each
  decision to the real source files.
- **Related:** `01_vision-and-ux-thesis.md`, `03_architecture_v1.md`,
  `scope-and-decisions.md` (master D-NN log), `publish-plugin-planning.md`.

---

## 1. Summary

The review converged the v1.0 UI. The throughline that emerged over the rounds:
**make the UI self-evident by structure, not by prose** - the fixes that stuck were
positional/grouping changes and pruning, not labels or explanatory paragraphs.

Headline shifts:

- **Settings information architecture:** prune to 5 tabs, fold the workspace launcher into
  General, merge Integrations into Scopes, fold Commands into a new Help tab, drop the
  v1.1/v1.2 placeholder tabs.
- **Plugin state vs integration state:** make the distinction self-evident by position -
  status pill + action link on the name line (about the plugin), a lone toggle on the
  right (Tag Curator's curate switch). No labels, no prose.
- **Rule editor:** name-first inline title, a three-card type selector with descriptions,
  elegant collapsed cards, an anchored New-rule button, and a gridded preview whose info
  icon expands the row inline (accordion) into a key/value detail panel.
- **Welcome modal:** lead with the "Tag Curator" title and a featured how-it-works intro;
  drop the green callout, the "Our safety promise" subheader, and the "Learn how it works"
  link; move the presets callout under its subheader; compact, expandable integration cards.

---

## 2. Decisions by area

Each entry: the discussion, then the decision. Pin numbers reference the crit thread.

### A. Settings information architecture

- **A1. Five tabs (pins 1, 6).** `General` / `Scopes & integrations` / `Rules` /
  `Advanced` / `Help`. Drop the `Profiles (v1.1)` and `Aliases (v1.2)` placeholder tabs
  (do not ship "coming later" tabs). Fold the Workspace launcher into General; merge
  Integrations into Scopes; merge Presets + Custom rules into Rules; fold Commands into
  Help. **Why:** Obsidian's own guidance is one scrollable page with `setHeading()`
  sections and no native tab API; fewer tabs removes the row wrap and the half-built look.
- **A2. Secondary navigation = section anchors, not sub-tabs (pin 6, 20).** Where a tab has
  multiple sections, use a sticky **anchor row** (jump-to-`setHeading`) over one scrollable
  tab rather than nested sub-tab views. A true sub-tab is reserved for a *heavy* surface
  (Rules -> Presets | Custom rules, since Custom rules opens the editor). Tab bar + anchor
  row are sticky; scroll-spy on the active anchor is a nice-to-have. Primary tabs may carry
  lucide icons (NN-style). **Status: built in the mockup, adoption still open (Section 4).**
- **A3. Help tab content (pin 6).** Commands reference + FAQ + About (plugin version +
  links: GitHub, report an issue, sponsor, docs).
- **A4. Tab content map.** Documented in the mockup (block 6b) and in Section 3 here.

### B. General tab

- **B1. Launcher folded in (pin 6/3).** One primary `Open Tag Curator` button plus a
  secondary `open beside the tag pane` text link - not two equal-weight buttons.
- **B2. Leaf naming (open).** Recommend renaming the leaf's display to **Tag Curator**
  (more discoverable than "Curation Workspace"). The `CURATION_VIEW_TYPE` id stays for
  saved-layout compatibility; only `getDisplayText()` / command labels change. **Confirm.**
- **B3. Keep** the stats header, Enable + Preview toggles, and Panic disable.

### C. Scopes & integrations

- **C1. One merged tab (pins 2, 8).** Group `Obsidian surfaces` (tag pane, Properties,
  autocomplete) separately from `Plugin integrations` (Notebook Navigator, Tag Wrangler,
  Style Settings, Colored Tags Wrangler).
- **C2. Plugin state vs integration state, self-evident by position (pins 5, 18).** On a
  plugin row: `name + status pill + action link` on the left (all about the plugin), and a
  **lone toggle** on the right (Tag Curator's curate switch). No "Curate" label, no
  explanatory paragraph. Native surfaces: `name + toggle` (no pill). This was the key
  resolution after a label and a paragraph were both rejected.
- **C3. Status-pill vocabulary (pin 8).** `Active` (installed + enabled) / `Disabled`
  (installed, off) / `Not installed` / `Update needed` (installed but version too old).
  Detect via `app.plugins.manifests` (installed) vs `enabledPlugins` (enabled) + the NN
  version gate.
- **C4. Action links beside the pill (pins 7, 8, 18).** `Update plugin` (update needed) /
  `Enable plugin` (disabled) / `Open settings` (active) / `Find in Community plugins` (not
  installed). Implement via `app.setting.open()` + `openTabById('community-plugins')` or the
  target plugin's settings.
- **C5. Each scope independently kill-switchable**, effect immediate, no restart.
- **C6. "Works alongside, no setup":** Dataview / Tasks / Bases note (they see real tags).

### D. Welcome modal (D-008 adaptation)

- **D1. Header hierarchy (pins 3, 21).** `Tag Curator` is the prominent title; a small
  green `Now enabled` status; the how-it-works intro featured in normal-weight text. Remove
  the demoted `Choose how to start` line (the footer CTAs already frame the choice).
- **D2. De-emphasize safety, declutter (pins 3, 26).** Remove the green callout box around
  the safety promises; remove the `Our safety promise` subheader so the three safety lines
  sit directly under the intro; remove the `Learn how it works` link (docs link deferred,
  Section 2.I).
- **D3. Presets framing (pins 2, 27).** Heading `Two presets, on by default`; the
  "suggested and enabled by default" callout sits directly under the heading, above the
  preset cards.
- **D4. Integration cards (pins 15, 22).** Compact: `name + status pill + chevron`,
  collapsed by default, expandable for details. De-overclaimed copy (only what v1.0 delivers).

### E. Rules and rule editor

- **E1. Collapsed rule card (pin "elegant card").** `name` + one muted `type · summary`
  line + right-aligned `N tags ›` count link (opens the workspace filtered to that rule).
  Drop the boxed type pill and the stacked two-line layout.
- **E2. Anchored New-rule button (pin "anchored").** A real `+ New rule` button pinned in
  the pane header, not a floating dashed card at the end of the list.
- **E3. Name-first editor (pin 5/"name-first").** The rule name is the first, inline-editable
  element in the title; drop the duplicate `Identity / Name` field.
- **E4. Type selector = three cards (pin 11).** `Pattern match` / `Count threshold` /
  `Specific tags`, each with a one-line description under the title. (User accepted the
  inline card row over a card-dropdown for three fixed options: "let's keep what you made".)
- **E5. Preview pane (pins 10, "7b").** A gridded table with tabular, right-aligned counts;
  **remove the rule-name column**; an info icon expands the row **inline (accordion)** into
  a per-tag detail panel - header (`#tag` + status dot) + a key/value list (Rule, Count,
  First seen, Last used, Override) + actions (Always show / Always hide). Multiple rows can
  stay open. (Reformatted from a dense one-line string after "much more context than I
  anticipated".)

### F. Presets

- **F1. No redundant "off" (pin 9).** Disabled presets drop the literal "off" text and show
  a `would hide N tags` potential count instead (normal text weight, not faint).
- **F2. Live count (pin 4-area).** Enabled presets show the affected count with a
  `calculating...` state while the engine recounts.
- **F3. Click-through (pin 4c).** `N tags affected ›` is a link that opens the workspace
  filtered to that preset's tags.

### G. Surfaces accepted as-is

Status bar strings (pin 13 "great"), state banner variants (pin 14), panic-disable clearing
all four scopes, and the scope-decoration model (hide = `display:none`, flag = preview
highlight) were reviewed and accepted without change.

### H. Integration specifics

- **H1. Style Settings (pin 16).** Registers a `/* @settings */` block exposing
  `--tag-curator-flag-color`, `--tag-curator-flag-bg`, and a `tag-curator-flag-bold` toggle;
  one restyle applies across all scopes. **Only the flagged/preview treatment is themeable**
  (hidden tags are `display:none`, nothing to style). Documented in `03_architecture_v1.md`
  section 8.
- **H2. Tag Wrangler** = rename delegation (`tag-wrangler:rename-tag`). **Notebook Navigator**
  = runtime-interop only (GPL-3.0 vs Apache-2.0; no source coupling).
- **H3. Colored Tags Wrangler** = planned integration. If we commit to it, show `Planned`
  (not `Not installed`) so we don't imply it works the moment it is installed.

### I. Open decisions (need the user)

1. **Leaf display name:** "Tag Curator" (recommended) vs keep "Curation Workspace".
2. **Docs site:** scaffold an Astro page as the "how it works" / Help docs target? (The
   inline "Learn how it works" link was removed for now.)
3. **Secondary-nav adoption (Section 4):** ship the sticky anchor row, or rely on plain
   `setHeading` sections.
4. **`fundingUrl`** in the manifest (publish plan).
5. **Submit-now vs defer** to the community directory (publish plan).
6. **`nnColorMirror`** (flag-to-color mirror) - defer to a follow-up.

---

## 3. Code-change roadmap (decisions -> real files)

Implementation order, mapped to source. Every phase ends green on
`npm run lint && npm run typecheck && npm test && npm run build`. "UI" = rendering only;
"functional" = behavior/data.

| Phase | Decisions | Files | Kind | Risk |
|---|---|---|---|---|
| **1. Settings IA** | A1, A3, B1 | `src/ui/settingsTab.ts`, `src/types.ts` (TabId), `src/main.ts` (command labels) | UI + light functional | medium - touches tab descriptors + render routing |
| **2. Scopes & integrations** | C1-C6 | `src/ui/settingsTab.ts` (renderScopes), plugin detection helper | UI + functional (detection) | medium |
| **3. Rule editor** | E1-E5 | `src/ui/ruleEditor.ts`, `styles.css` | UI | medium-high - editor + preview accordion |
| **4. Presets** | F1-F3 | `src/ui/settingsTab.ts` (renderPresets) + `ruleEditor` card, engine count | UI + functional (live count, deep-link) | low-medium |
| **5. Welcome modal** | D1-D4 | `src/ui/welcomeModal.ts`, `styles.css` | UI | low-medium |
| **6. General + leaf name** | B1, B2, B3 | `src/ui/settingsTab.ts`, `src/ui/curationWorkspace/curationWorkspaceView.ts`, `src/main.ts` | UI | low (rename = display text only) |
| **7. CSS** | all visual | `styles.css` | UI | low (additive) |
| **8. Publish-readiness** | (separate track) | inline styles -> CSS classes; unify `app.plugins` cast; `rowMenu` listener lifecycle | code hygiene | low-medium |

Notes:

- Phases 1-2 are the highest-value and most interdependent (both in `settingsTab.ts`); do
  them as one careful pass.
- The leaf rename (B2) changes only `getDisplayText()` and command names, never
  `CURATION_VIEW_TYPE` (that would orphan saved layouts).
- UI render code is lightly unit-tested; rely on the build/typecheck gate + happy-dom where
  it exists, and a manual smoke pass after each phase.
- Phase 8 maps to `publish-plugin-planning.md` section 5; it can run independently of 1-7.

### Status (implemented 2026-06-01)

All phases are implemented on `feat/v1.0-curation-in-context`, each commit gated
green (typecheck, lint `--max-warnings 0`, 250 tests, build):

- Phase 1 Settings IA - `58f20da`
- Phase 2 Scopes & integrations - `3cd8918`
- Phase 3 Rule editor - `0df0a2d` (E1-E4: name-first title, type cards, anchored
  New rule, collapsed cards) + `bc96762` (E5: preview accordion with key/value
  detail + per-tag override pins)
- Phase 4 Presets - `d2d3a56`
- Phase 5 Welcome modal - `36cb393`
- Phase 6 General + leaf name - `531223e`
- Phase 7 CSS - folded into each feature phase; no standalone pass was needed.
- Phase 8 Publish-readiness - `fa55e83` (every static / show-hide inline style
  moved to a CSS class; `rowMenu` why-popover listener lifecycle hardened).
  Remaining optional hygiene, not a submission blocker: unify the repeated
  `app.plugins` `as unknown as {...}` casts (settingsTab, welcomeModal,
  curationWorkspaceView) into one typed helper.

The open decisions in sections 4-5 below are unchanged and still pending user
direction (secondary-nav adoption, leaf-name final confirm, Astro docs page,
`fundingUrl`, submit-now vs defer, `nnColorMirror`).

---

## 4. Secondary navigation: adopt or not (open)

The sticky anchor-row secondary navigation (Section 2.A2) is built and demonstrated in the
mockup but **not yet committed to ship**. The decision:

- **Adopt:** sticky tab bar + a section-anchor row per multi-section tab (Scopes &
  integrations, maybe Rules), with optional scroll-spy. Closest to Obsidian's
  one-scrollable-page convention while adding wayfinding.
- **Skip:** rely on plain `setHeading` sections in one scroll, no anchor row.

Recommendation: adopt the sticky tab bar regardless (cheap, expected); treat the anchor row
as optional polish for tabs with 3+ sections. Pending the user's call.

---

## Appendix: round-by-round resolution status

All 27 pins reached resolution or an accepted answer over 6 rounds. Pins accepted as-built
include the welcome redesign (3), scope definition bullets (4, 19), the positional plugin
state/integration split (5, 18), the info-icon accordion + key/value detail (10), the type
card selector (11), the architecture Mermaid diagram (12), the compact integration cards
(15, 22), the Style Settings documentation (16), the "Unique" stat label (23), the demo
descriptions (24), the shortened Style Settings copy (25), the welcome modal reflow
(26, 27). The remaining open items are listed in Section 2.I and Section 4.
