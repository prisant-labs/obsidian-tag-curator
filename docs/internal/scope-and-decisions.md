# Tag Curator - Scope & Decisions (Master)

Living document. The single place to see **what is in v0.1 vs. deferred**, **what is still undecided**, and **the decisions we have made** (with enough context to revisit them later). Updated as conversations produce new scope calls, questions, or decisions.

- **Last updated:** 2026-05-28
- **Companion docs:** spec (`discovery/tag-curator-spec_opus-4.7_2026-04-30.md`), release plan (`release-plans/plan_v0.1.0.md`), backlog (`backlog.md`), UI review log (`release-plans/plan_v0.1.0/ui-review-log_2026-05-28.md`), **proposals (unreleased)** (`release-plans/proposals/`).

## How to maintain this doc

- When a feature is committed or cut, move it between Section 1 tables and note the date.
- When a real decision is made, add it to Section 2 with context, desired outcome, approaches considered, and the recommendation/choice.
- When a question is raised that we cannot close yet, add it to Section 3. Close it by recording the answer and linking the resulting decision.
- Keep backlog IDs (Bxxx) in sync with `backlog.md`.

---

## 1. In scope vs. future

### 1.1 In scope - v0.1.0

| Area | Item | Notes |
|------|------|-------|
| Engine | Single-criterion rules (regex / frequency / list) | `MatchCriteria`; highest-priority match wins (Q-005 fixed). |
| Engine | Rule attribution (`effective` + `allMatches`) | Powers diagnostics. |
| Presets | 5 built-in toggleable presets | hex + URL-anchor on by default; single-char, numeric, orphans off. |
| Storage | Tag metadata sidecar (`tags.json`) | firstSeen / lastSeen / count / sources. Piggybacks `metadataCache` for discovery. |
| UI | Settings tab with top-tabs | General / Presets / Custom rules / Commands / Advanced. |
| UI | General stats header | Total / hidden / active rules / orphans. |
| UI | Tag list view | Row-based, sortable, filterable, multi-select + bulk actions, virtualized. |
| UI | Rule editor | Card view + right-docked preview (D-010, supersedes D-001; D-002 wizard closed). |
| UI | First-run welcome modal | File-safe contract, default presets, preview-first path. |
| UI | Status bar item | Hidden count; click opens hidden-only tag list. |
| Safety | Panic disable | Command + settings button; removes all DOM effects, disables. |
| Modes | Default, allow-only, inbox, preview | "Preview mode" everywhere; renamed from "dry-run" (see D-003). |
| Commands | 6 palette commands | See spec 5.10. |

### 1.2 Future - deferred

| ID | Item | Target | Why deferred |
|----|------|--------|--------------|
| B001 | Compound criteria builder (AND/OR/NOT tree) | v0.2 | Engine model change (`MatchCriteria` -> `MatchNode`); migration. |
| B002 | Drag-drop rule composition canvas | v0.2 | Too complex for v1; row-based preferred for scanning. |
| B003 | Density toggle (compact/comfortable/spacious) | v0.2 | Nice-to-have. |
| B004 | Plugin-integration detection in welcome modal | v0.2 | Modal shows it; detection logic deferred. |
| B005 | Rule library / preset gallery | v0.3 | Needs index + trust model; ship file-import first. |
| B006 | Merge & alias workflow (display-only) | v0.3 | Aliasing data design; rename delegated to Tag Wrangler. |
| B007 | Tag analytics dashboard | v0.3 | **Liked.** Deferred only to avoid feature creep; data exists. |
| B008 | Conflict resolver (inline priority editing) | v0.2 | Complex; only useful when conflicts exist. |
| B009 | Tag detail sheet | v0.2 | Rarely opened; click-heavy. |
| B010 | Hierarchy cascade (with in-use detection) | v0.2 | Needs hierarchy index for performance. |
| - | Stale / clipping-folder / near-duplicate presets | v0.2+ | Need match types v0.1 does not compute. |

---

## 2. Decisions

Format per decision: **Context** (the issue) - **Desired outcome** - **Approaches** - **Recommendation / choice** - **Status**.

### D-001 - Rule editor: information architecture & affected-tags display

- **Context.** The converged inline editor lays 6 fields in a 2-column grid then shows matched tags as a pill cloud. Round-2 (28 May, pin 4 with screenshot) re-flagged that even the proposed sectioned-vertical-inline approach left two problems unresolved: the expand/collapse pattern itself causes layout shift, and a single-column editor inside a row is width-constrained.
- **Desired outcome.** Clear top-to-bottom process, scannable preview, **no expand/collapse, no layout shift**, full width for the editor.
- **Approaches.**
  - **A. Sectioned vertical flow inside an inline expand-row.** Initial recommendation; resolves the IA + pills problems but leaves the expand/collapse concern.
  - **B. Master-detail.** Rule list as a master pane (left), sectioned editor as a detail pane (right). Selection in the master drives the detail. No layout shift, no expand/collapse, full width, consistent pattern across edit and create.
  - **C. Modal/dedicated page.** Same as B's editor but in a separate context; reintroduces the context-switch the reviewer wanted to avoid.
- **Decision.** **B - master-detail**, with the sectioned vertical flow (Identity / Match / Then / Preview) and the affected-tag list (tag - count - visibility dot, not pills) inside the detail pane. The Match section uses sentence-builder phrasing ("When a tag's name matches the regex `[input]`") to keep the language human-readable.
- **Status.** Implemented in `ui-design_v0.1.0_converged.html` section 3 (2026-05-28 round-2). Source code translation to `src/ui/ruleEditor.ts` deferred until you confirm the design from the round-2 review.

### D-002 - Rule editor: inline vs. wizard split → CLOSED (wizard dropped)

- **Context.** Earlier rounds explored a wizard for first-time rule creation.
- **Decision (round-4).** **Wizard dropped.** Round-3 pin 17 made the case: the rule editor IA is already learnable enough that a separate wizard is unnecessary complexity. Creation and editing now share one surface (card view -> edit mode, see D-010). The `Type` selector (regex / frequency / list) becomes the first row of the editor, with plain-language descriptions, so the first-time experience is guided without a separate flow.
- **Status.** Closed - superseded by D-010.

### D-003 - Preview vs. dry-run naming

- **Context.** Reviewer asked if "dry-run" is just "preview" (pin 16). Initial decision (2026-05-28 morning) was a split: "Preview mode" in UI, internal key stays `dryRun`. Revisited the same day after a DDD-grounded challenge: Ubiquitous Language says the team should speak one name across domain, UI, and code; the split was the translation tax DDD warns against. Migration cost is small pre-public-release.
- **Decision (revised, 2026-05-28).** Rename end-to-end: `previewMode` everywhere (internal key, types, observer, settings, UI, commands, docs). Schema bumped v1 -> v2; legacy `dryRun` migrates automatically on load. Command id `toggle-dry-run` -> `toggle-preview-mode` (BRAT hotkey rebind required for early testers).
- **Status.** Implemented (2026-05-28). 118/118 tests pass with 3 new v1 -> v2 migration tests.

### D-004 - Merge/alias is display-only

- **Context.** Reviewer confirmed merging must not modify files (pin 31).
- **Decision.** Merge/alias folds rows in the display only; never writes note content. Actual renames are delegated to Tag Wrangler. `TagMeta.aliases` already exists. v0.3 (B006).
- **Status.** Decided (2026-05-28).

### D-005 - Built-in presets are toggleable, not editable

- **Context.** Reviewer suggested the orphan rule be a "toggle-able, uneditable preset" (pin 23/255b7f).
- **Decision.** All 5 built-ins are `builtin: true` - toggleable but not editable or deletable. To change one, the user copies it into a custom rule. v0.1 ships exactly 5 (spec 5.1).
- **Status.** Decided (already implemented).

### D-006 - Tag list is row-based, not drag-drop

- **Context.** Reviewer judged drag-drop compound composition too complex for v1 and preferred row-based scanning with click-sort (pin 22/0b0e9d).
- **Decision.** v0.1 tag list and rule list are row-based and click-sortable. Compound/NOT logic and any drag-drop arrive with the compound builder (B001/B002, v0.2).
- **Status.** Decided (2026-05-28).

### D-007 - Persistent state banner for non-default plugin state

- **Context.** Round-2 pin 2 surfaced an ambiguity: panic disable is both an *action* (cleanup) and a result *state* (plugin off). The "disable" word implies a toggle; the description says "instantly removes," reading like an action. Without a persistent indicator, a user who runs panic disable and walks away has no obvious "you are here" signal. Same concern for preview mode - it's an easy state to forget you're in.
- **Desired outcome.** State -> visible-state link. Whenever Tag Curator is in a non-default state (Preview mode on, or plugin disabled), every Tag Curator surface shows it.
- **Approaches.**
  - **A. Status bar only.** Cheapest; users already glance there. Risk: passive, easy to miss.
  - **B. Top-docked state banner** in Settings, Tag list, and Rule editor whenever the state is non-default. Two variants: "Preview mode is on" (amber) and "Tag Curator is off" (muted). Each carries an inline action ("Turn off preview" / "Turn on") so resolving the state is one click.
  - **C. Always-on indicator** (always shown, even in default). Noisy.
- **Decision.** **B**. Implemented as `.state-banner` (CSS) in the converged HTML, with a `preview` variant active above the General panel as the demo. The Tag list section notes the same banner appears there.
- **Status.** Designed (2026-05-28); source-code wiring deferred.

### D-008 - Welcome modal: redesigned (round-2 feedback)

- **Context.** Round-2 pins 5-8 surfaced four problems with the welcome modal: (5) "Got it, enable" implied the plugin wasn't enabled yet (it is on first-run), and "Preview first (dry-run)" used the dropped nomenclature; (6) integration rows used wrapped paragraphs with disjointed left alignment; (7) "Two presets will run" was a buried one-liner despite being important and changeable; (8) the three contract cards were centered chunks that looked awkward.
- **Desired outcome.** Modal that mirrors actual state ("you're enabled, choose how to start"), surfaces presets prominently and editably, presents integrations as scannable per-plugin cards, and renders the safety promises without ugly center-aligned chunks.
- **Decision.** Reworked end-to-end:
  - Header eyebrow says "Tag Curator is now enabled" + h3 "Choose how to start" + sub "Before any tag is curated, here is what you can expect."
  - Safety promises: a single highlighted strip with three left-aligned check rows (no centered cards).
  - Two presets: stacked cards with toggles + description + pattern. User can untick a preset before committing.
  - Integrations: per-plugin cards with name + state pill (Enabled / Installed / Not installed) + bulleted "what changes" items. No wrapped paragraphs.
  - Footer: primary "Start curating" + secondary "Start in preview mode" + an inline explainer sentence ("Preview mode flags matched tags so you can see what would be hidden, without anything actually disappearing.").
- **Status.** Implemented in `ui-design_v0.1.0_converged.html` section 4 (2026-05-28 round-2).

---

## 3. Outstanding questions

Each: **context** - **current best answer** - **what is needed to close**.

### Q-001 - Should v0.1 include a dedicated settings search?

- **Context.** Reviewer called the inline-settings-search pattern "greatly useful / helpful" (pin 2174fa). The converged pass declined it and only used the pattern in the tag-list filter.
- **Current best answer.** Low cost; mirrors Obsidian's own settings UX. The counter-argument (too much chrome at v0.1 section count) is weak now that Settings has 5+ tabs.
- **To close.** Decide yes/no for v0.1. Recommendation leans **yes** - a thin search bar above the Settings tab content. Needs reviewer call.

### Q-002 - How should the grouped-by-rule tag view behave with multi-rule tags?

- **Context.** Reviewer flagged grouped-by-rule is "funky if a tag is in multiple rules" (pin 9). We answered the resolution model but never designed the grouped view.
- **Current best answer.** Show each tag under its *effective* (winning) rule only, with a "+N more rules" affordance linking to the conflict resolver (B008).
- **To close.** Decide whether grouped-by-rule is a v0.1 view mode or deferred with the conflict resolver. If v0.1, design the group header (rule name, hidden count, disable button) and the multi-rule affordance.

### Q-003 - Welcome-modal integration detection: how much for v0.1?

- **Context.** Reviewer asked whether the modal should detect integrable plugins and explain each (pin 28). Which plugins? (Tag Wrangler, Notebook Navigator named; "what others?").
- **Current best answer.** Detect via `app.plugins.enabledPlugins`. Known integration targets in `Scope`: `tag-wrangler-menu`, `notebook-navigator`. Spec 6 also lists Colored Tags Wrangler, Tasks/Dataview/Bases, Templater/QuickAdd.
- **To close.** Decide whether v0.1 ships real detection (B004) or a static list. Confirm the full set of plugins worth calling out.

### D-009 - Rule priority: architected, hidden in UI for v0.1 (closed Q-006)

- **Context.** Round-3 pin 11 asked whether prioritization should be architected in but not visually functional. Round-3 follow-up: **"Option B confirmed. architect it, with documentation, but remove from UI."**
- **Decision.** Engine still uses `Rule.priority: number`. UI hides it: master/cards drop the `P60` chip; the rule editor drops the Priority row. New custom rules default to `priority: 50`; built-in presets keep their existing values (80-100). v0.2 will light up a visible UI (likely C: drag-to-reorder) without engine migration. Document the default in the rule-attribution tooltip so power users see it.
- **Status.** Designed in section 3 of the converged HTML (round-4). Source change deferred until UI lands.

### D-010 - Rule editor: card view + right-docked preview (supersedes D-001's master-detail)

- **Context.** Round-3 pin 12: "I think it makes sense to show the preview in a right docked, scrollable panel. Perhaps this experience should not have the custom rules left-docked and instead there should be a card view that clicks into 'edit mode'." Round-3 pin 17 separately questioned the wizard: "Perhaps this could be simplified by not having a more formal wizard, but just with the IA/UX of defining custom rules, where 'Type' is a callout or dropdown selection."
- **Decision.** Replace the left-docked master pane with a **card view** of rules. Each card shows the rule name, an inline enable/disable toggle, the `Type` (regex / frequency / list), and an "N tags affected" chip. Clicking a card enters **edit mode** in the same surface (cards swap to the editor). A **right-docked scrollable preview panel** is persistent across both views, showing live-affected tags (vault-wide in card view; filtered to the selected rule in edit mode). Edit mode uses the same IA as creation - **the wizard is dropped**. The first row of the editor is a `Type` dropdown that switches the visible match input (regex pattern field, frequency operator + value, or list editor).
- **Status.** Designed in section 3 (round-4). Supersedes D-001's master-detail decision. Wizard removed; D-002 closed as obsolete.

### D-011 - Tag List is both a Settings tab AND a sidebar leaf (closed Q-007)

- **Context.** Round-3 pin 21 asked whether Tag List should be a Settings tab. Round-4 follow-up pushed back on my "doubling up two surfaces" reasoning: "How does it double up two surfaces? How does the user get to the primary design / 2. tag list view otherwise?"
- **Re-examined.** The "doubling" concern doesn't hold up. The Tag List is **one component** rendered into different host containers. State lives on the plugin (the in-memory tag map, filter, selection), not on the view. Multiple views show the same data; updates broadcast through plugin events.
- **Decision.** Tag List ships as both: (1) a sidebar leaf (`open-tag-list` command + status-bar click target, unchanged), (2) a **Settings tab between General and Presets**. Both render the same component; state is the plugin's source of truth. Settings entry is the primary discovery path (users go there to interact with Tag Curator anyway); the leaf survives switching to other Obsidian panes.
- **Status.** Designed in section 1 of the converged HTML (round-5: add the Tag List tab between General and Presets).

### Q-008 - File-extension: match type or file-filter on a rule?

- **Context.** Round-3 pin 15. Round-4 follow-up: "It seems like this could be a match rule, not a match type. Thoughts."
- **Re-examined.** The reviewer's instinct sharpens the call. A "match type" is a *how-to-match-the-tag* primitive (regex/frequency/list). A file-extension constraint is *which-files-to-consider* - a different axis. Bundling them into a single match type forces every file-extension rule to also pick a tag-matching strategy in the same dropdown, which is conceptually muddled.
- **Decision lean.** **B - file-filter on a rule** (a parallel concept to match type). Engine shape: `Rule.fileFilter?: { extensions?: string[] }`. When present, only tags discovered in files matching the filter contribute to evaluation. Composes with any match type. Example: "regex matches `^draft`, only in `.canvas` files."
- **Status.** Open for v0.2 (B011 in backlog). v0.1 does not include this. Reverses round-3 leaning toward "match type."

### Q-006 - Rule priority: keep architected, hide from UI for v0.1? → CLOSED, see D-009

### Q-005 - Rule precedence: lowest-priority-wins was a bug → fixed

- **Context.** `RuleEngine.evaluateTag` / `getRuleAttribution` sorted matching rules priority-descending (highest first), then took the **last** match as `effective`. "Last in a highest-first list" = the **lowest-priority** matching rule wins. A `priority 100` rule was being overridden by a `priority 50` rule on the same tag - the opposite of what "priority" implies. Surfaced while answering review pin 9 (multi-rule tags).
- **Decision.** Fix (a): highest-priority match wins. `evaluateTag` returns on the first match in the priority-desc list; `getRuleAttribution` sets `effective = allMatches[0]`. Matches user intuition; no rename needed.
- **Status.** Fixed (2026-05-28). Tests in `tests/ruleEngine.test.ts` updated and a regression-style assertion locks the new semantics. 118/118 pass.

### Q-004 - Pagination vs. pure virtualization for the tag list?

- **Context.** Reviewer wanted select-all to distinguish "all on this page" vs "all in this list" *if pagination is used* (pin 6), and raised performance at thousands of tags (pin 7).
- **Current best answer.** Virtualized infinite scroll (no pages) with "select all matches" vs "select all loaded". Avoids page math.
- **To close.** Confirm virtualization over pagination, so the select-all copy can be finalized.

---

## Changelog

- **2026-05-28** - Created. Captured v0.1 scope, decisions D-001..D-006, questions Q-001..Q-004 from the 31-option UI review and the inline-editor feedback.
- **2026-05-28 (evening)** - Added Q-005 (rule-precedence bug). Then revised D-003 to a full end-to-end rename (`dryRun` -> `previewMode`, schema v1 -> v2 migration) on DDD/Ubiquitous-Language grounds. Fixed Q-005 (highest-priority match wins). Both shipped together: source + tests + docs updated; 118/118 tests pass; lint, tsc, build all green.
- **2026-05-28 (round-2 review)** - Reviewer pushed back on the converged UI design with 9 comments. Resulted in: D-001 evolved from sectioned-inline to master-detail (rule list + sectioned editor pane). D-007 added (persistent state banner for non-default state). D-008 added (welcome modal redesign: state-aware header, left-aligned safety promises, toggleable preset cards, per-plugin integration cards with state pills + bullets, primary/secondary CTAs with preview-mode explainer). Source: `ui-design_v0.1.0_converged.html`.
