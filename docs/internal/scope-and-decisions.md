# Tag Curator - Scope & Decisions (Master)

Living document. The single place to see **what is in scope vs. deferred**, **what is still undecided**, and **the decisions we have made** (with enough context to revisit them later). Updated as conversations produce new scope calls, questions, or decisions.

- **Last updated:** 2026-05-30
- **Companion docs:** spec (`discovery/tag-curator-spec_opus-4.7_2026-04-30.md`), release plan (`release-plans/plan_v0.1.0.md`), backlog (`backlog.md`), UI review log (`release-plans/plan_v0.1.0/ui-review-log_2026-05-28.md`), **proposals (unreleased)** (`release-plans/proposals/`), v1 vision bundle (`docs/internal/v1-vision/`).

## How to maintain this doc

- When a feature is committed or cut, move it between Section 1 tables and note the date.
- When a real decision is made, add it to Section 2 with context, desired outcome, approaches considered, and the recommendation/choice.
- When a question is raised that we cannot close yet, add it to Section 3. Close it by recording the answer and linking the resulting decision.
- Keep backlog IDs (Bxxx) in sync with `backlog.md`.

---

## 1. In scope vs. future

### 1.1 In scope

#### v0.1.0 items (shipped)

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

#### v1.0 additions (theme: Curation, in context)

Items from `docs/internal/v1-vision/01_vision-and-ux-thesis.md` Section 8.1. Each row notes why it is in v1.0.

| # | Item | Why in v1.0 | Grounding |
|---|------|-------------|-----------|
| 1 | Curation Workspace leaf (table + inline editor + live preview + bulk + diagnostics) | The thesis: the whole release hangs on moving the curation loop out of Settings and into a side-by-side leaf. | Built on merged `TagListModel`/`TagActions` core; editor designed in D-010. D-012. |
| 2 | "Open beside the tag pane" split command | Delivers the side-by-side loop that is the UX win - editing a rule and watching the tag pane react in one glance. | Obsidian `WorkspaceLeaf` split API. D-013. |
| 3 | Scope: Notebook Navigator tag tree | Highest-traffic third-party tag surface; already in flight on `feat/nn-compat-phase1`. | `ObserverBase` subclass; NN detection + version gating built (Phases 1-2 done). D-014. |
| 4 | Scope: Properties panel (frontmatter tags) | A primary place tags render for users; inexpensive with `ObserverBase`. | New observer on the proven base; independently kill-switchable. D-014. |
| 5 | Scope: Autocomplete suppression | Stops users re-creating a tag they just hid; closes a trust hole. | New observer; default-on, per-scope kill switch. D-014. |
| 6 | Per-tag overrides (always-show / always-hide) | Makes the workspace per-row actions real; always-show is the spec's promised safety net. | New `overrides` store + schema v3->v4 migration; closes B009. D-015. |
| 7 | Thin Settings + "Scopes" section + launch buttons | Removes the Settings-as-workbench anti-pattern; Settings becomes config + launcher. | Refactor `settingsTab.ts`. D-012. |
| 8 | Trust layer polish (welcome copy de-overclaim, banner, panic, status bar) | Trust is the adoption gate; current copy overclaims for v0.1. | Session-log note 2026-05-30. D-016. |
| 9 | Style Settings registration | Themes and power users restyle without code; near-free (~80 lines CSS comments). | Ship `/* @settings */` block in `styles.css`; built-in defaults apply when absent. D-016. |
| 10 | Tag Wrangler menu composition + bulk delegation | Rename delegation point; bulk "Send to Tag Wrangler" action already specced. | Spec 6.1.1; detect via `app.plugins.enabledPlugins`; degrades to own context menu when absent. D-016. |
| 11 | Compatibility doc (Dataview/Tasks/Bases unaffected) | The display-only contract is the trust story; must be stated explicitly for ecosystem users. | Ecosystem research Part 2; NN coexistence established. D-016. |

### 1.2 Future - deferred

Targets updated 2026-05-30 to reflect the v1.x milestone map from `01_vision-and-ux-thesis.md` Section 7-8. Legacy backlog IDs (Bxxx) preserved; milestones reconciled to the spine.

| ID | Item | Target | Why deferred |
|----|------|--------|--------------|
| B001 | Compound criteria builder (AND/OR/NOT tree) | v1.2 | Engine model change (`MatchCriteria` -> `MatchNode`) + migration; single-criterion rules are pleasant enough in the workspace to wait. (was v0.2) |
| B002 | Drag-drop rule composition canvas | v1.2 | Ships with compound criteria; row-based scanning preferred until then. (was v0.2) |
| B003 | Density toggle (compact/comfortable/spacious) | v1.1 | Nice-to-have polish; fits alongside the intelligence release. (was v0.2) |
| B004 | Plugin-integration detection in welcome modal | v1.0 | Static list ships in v1.0 trust polish (item 8 above); real detection logic can follow. (was v0.2) |
| B005 | Rule library / preset gallery | v1.2 | Needs index + trust model; ship file-import first. (was v0.3) |
| B006 | Merge & alias workflow (display-only) | v1.1 | Aliases is the v1.1 headline paired with near-duplicate detection; the workspace (v1.0) is the surface where alias management lives. D-017. (was v0.3) |
| B007 | Tag analytics dashboard | v1.2 | Liked; deferred to avoid feature creep; data exists. (was v0.3) |
| B008 | Conflict resolver (inline priority editing) | v1.1 | Complex; only useful when rule conflicts exist at scale; workspace makes conflicts visible first. (was v0.2) |
| B009 | Per-tag overrides (always-show / always-hide) | **v1.0** | Promoted to v1.0 - workspace per-row actions depend on it; closes the B009 gap. D-015. (was v0.2 "tag detail sheet") |
| B010 | Hierarchy cascade (with in-use detection) | v1.1 | Needs hierarchy index for performance; natural companion to aliases. (was v0.2) |
| B011 | File-extension filter on a rule | v1.1 | A parallel concept to match type (`Rule.fileFilter`); v0.1 does not include it (Q-008 open). |
| - | Stale + near-duplicate match types + suggested merges | v1.1 | Engine extension (`age`, `similarity`) + a new panel; panel wants the workspace to exist first. |
| - | Inbox mode | v1.1 | Mode with its own review queue; best built once overrides and the workspace are solid. |
| - | Graph view scope | v1.1 | Higher DOM-observer risk (canvas/SVG); not load-bearing for the v1.0 thesis. |
| - | Profiles | v1.2 | Multiplier, not a prerequisite; benefits from a stable rule model. |
| - | Export / import + community packs | v1.2 | Needs trust/index model; ship the great single-vault experience first. |

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

### D-011 - Tag List is both a Settings tab AND a sidebar leaf (closed Q-007; revised 2026-05-29)

- **Context.** Round-3 pin 21 asked whether Tag List should be a Settings tab. Round-4 follow-up pushed back on my "doubling up two surfaces" reasoning: "How does it double up two surfaces? How does the user get to the primary design / 2. tag list view otherwise?"
- **Re-examined.** The "doubling" concern doesn't hold up. The Tag List is **one component** rendered into different host containers. State lives on the plugin (the in-memory tag map, filter, selection), not on the view. Multiple views show the same data; updates broadcast through plugin events.
- **Decision.** Tag List ships as both: (1) a sidebar leaf (`open-tag-list` command + status-bar click target, unchanged), (2) a **Settings tab between General and Presets**. Both render the same component; state is the plugin's source of truth. Settings entry is the primary discovery path (users go there to interact with Tag Curator anyway); the leaf survives switching to other Obsidian panes.
- **Status.** Designed in section 1 of the converged HTML (round-5: add the Tag List tab between General and Presets).
- **Revision (2026-05-29).** The "both render the **same component**" clause is superseded. In v0.1 only the sidebar leaf got the functional component; `settingsTab.renderTagListTab` shipped as a stub (info callout + two buttons) because an `ItemView` cannot mount inside a `PluginSettingTab`. The dual-host redesign keeps the dual-host and state-sync intent but **differentiates the surfaces via a shared host-agnostic core** (`TagListModel` + `TagActions`) feeding two render components: `TagViewer` (sidebar - lightweight view mode + light-manage toggle, click-to-search) and `TagTable` (settings - full table). Data still lives on the plugin; each host keeps its own view state (sort/filter/search/selection). Shared core built, tested, and merged 2026-05-29 (Phase A). Render components (Phase B) are UI-gated on `ui_tag-list-dual-host.html`; functional per-tag hide/unhide is gated on B009. Source: `proposals/tag-list-dual-host/spec_tag-list-dual-host.md`.

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

### D-012 - The Curation Workspace is the primary surface (supersedes D-011 dual-host goal)

- **Context.** D-011 settled the tag list as "one component, two hosts" (sidebar leaf + Settings tab), then the 2026-05-29 revision conceded that an `ItemView` cannot mount inside a `PluginSettingTab`, so the Settings "Tag list" tab shipped as a stub. The deeper issue: Obsidian's Settings is a full-screen modal, so any iterative curation done in Settings hides the very tag pane the user is curating. Curation is an iterative loop, not a set-once configuration.
- **Desired outcome.** A single, coherent home for the curation loop that coexists on screen with the tag pane, with no modal occlusion and no open-tweak-close-reopen cycle. Stop fighting the `ItemView`-in-Settings constraint.
- **Approaches.**
  - **A. Keep dual-host; make the Settings tab a real surface.** Blocked by the framework: `ItemView` cannot mount in `PluginSettingTab`. Would require re-implementing the table a second time inside Settings - duplication, and the modal-occlusion problem remains.
  - **B. Workspace leaf as primary; Settings becomes a launcher.** Promote a `CurationWorkspaceView` (`ItemView`) that holds the table + inline editor + live preview + bulk actions + diagnostics, built on the merged `TagListModel`/`TagActions` core. The Settings "Tag list" tab is replaced by an "Open Curation Workspace" button + a thin status readout. Curation is a leaf; configuration is Settings.
  - **C. Modal-based workbench (a big Tag Curator modal).** Reintroduces exactly the occlusion problem - a modal still covers the tag pane.
- **Decision.** **B.** The Curation Workspace leaf is Tag Curator's primary surface. Settings launches it and holds set-once config (Section 4.3 of the vision doc). This supersedes D-011's dual-host intent: there is one functional surface (the leaf), and Settings references it rather than duplicating it. The merged shared core (`TagListModel`/`TagActions`) is exactly what the leaf renders.
- **Status.** Accepted (2026-05-30). Supersedes the D-011 "two hosts render the same data" goal; preserves the merged shared core.

### D-013 - Side-by-side live preview is the default mental model (extends D-003, D-007)

- **Context.** Preview mode (flag-instead-of-hide, renamed from dry-run in D-003) reduces the risk of editing rules blind, but not the friction: the user still cannot see the tag pane while editing in Settings. With the workspace now a leaf (D-012), the leaf can be docked beside the native tag pane.
- **Desired outcome.** Editing a rule and seeing its effect should be one continuous glance, not a context switch.
- **Approaches.**
  - **A. Rely on the user to arrange panes themselves.** Works, but most users will not discover it.
  - **B. Ship an "Open Curation Workspace beside the tag pane" command** that opens the leaf, reveals the native tag pane, and arranges them as a split. The workspace's own preview list and the live tag pane update together as the user types a rule.
  - **C. Embed a mini tag-pane mirror inside the workspace.** Duplicates Obsidian state, fragile, and unnecessary once the split exists.
- **Decision.** **B.** Provide the one-click split command and make it the recommended path in onboarding and docs. Preview mode remains available for single-pane users and for committing a rule cautiously. The state banner (D-007) continues to show when Preview is on.
- **Status.** Accepted (2026-05-30).

### D-014 - v1.0 ships four independently-gated scopes (extends spec 4.1, 7.2)

- **Context.** The spec lists ~12 candidate scopes. v0.1 wired only the tag pane. Tags actually render to users in a small set of high-traffic surfaces: the tag pane, Notebook Navigator's tag tree, the Properties panel, and editor autocomplete. The autocomplete and properties DOM paths are undocumented and can shift across Obsidian releases.
- **Desired outcome.** Cover the surfaces where tags actually appear, without a single flaky surface forcing the user to disable the whole plugin.
- **Approaches.**
  - **A. One scope at a time across releases.** Safe but slow; v1.0 would not feel feature-rich.
  - **B. Four scopes in v1.0, each an independent observer on `ObserverBase`, each with its own per-scope kill switch in Settings -> Scopes.** Risky scopes (autocomplete, properties) ship default-on but can be toggled off without touching the others. Breakage is isolated to one observer.
  - **C. All ~12 scopes.** Most are low-traffic (quick switcher, hover preview, backlinks) and several (graph, bases) are higher-risk; this is v1.1+/v2.
- **Decision.** **B.** v1.0 scopes: tag pane, Notebook Navigator, Properties, Autocomplete. Each is an `ObserverBase` subclass; each is independently toggleable; the Settings "Scopes" section is the control surface. Graph view is v1.1; Bases and the rest are v2+.
- **Status.** Accepted (2026-05-30). NN scope already in flight on `feat/nn-compat-phase1`.

### D-015 - Per-tag overrides ship in v1.0 with a v3->v4 migration (closes B009 for v1.0)

- **Context.** The spec promises an "always show override" safety net and the tag list's per-row "show this tag" action, but there is no persisted store for a per-tag decision. `TagActions` already returns a typed "b009-deferred" result for per-tag hide/unhide, acknowledging the gap. Without overrides, the workspace's per-row actions are inert.
- **Desired outcome.** A user can pin a single tag to always-show (beating every rule, the safety net) or always-hide (without authoring a rule), and it persists.
- **Approaches.**
  - **A. Encode overrides as auto-generated list-match rules.** Pollutes the rule set, conflates two concepts, and complicates attribution.
  - **B. A dedicated `overrides` store: `Record<tag, 'show' | 'hide'>` in settings, resolved with strict precedence (always-show beats every rule; always-hide beats every rule except always-show).** Schema bumps v3->v4 with a one-way guarded migration defaulting `overrides` to `{}`.
  - **C. Store overrides in the `tags.json` sidecar.** Mixes user intent (a decision) with derived metadata (counts/dates); the sidecar is rebuildable from the cache, so a decision there could be lost on rebuild.
- **Decision.** **B.** Overrides are first-class settings, resolved ahead of rules in the engine: `resolveVisibility(tag)` checks overrides first, then rule attribution. Always-show is the spec's safety override. Migration v3->v4 adds `overrides: {}`; tests cover the migration and the precedence. Promotes B009 from "fast-follow" into v1.0 because the workspace's per-row actions depend on it.
- **Status.** Accepted (2026-05-30). Closes B009 for v1.0.

### D-016 - Ecosystem integrations are optional enhancements, never dependencies (extends spec 3, 6)

- **Context.** v1.0 adds Style Settings registration and Tag Wrangler menu composition. Both are popular but not universally installed.
- **Desired outcome.** Tag Curator works fully standalone; installed companions make it better, never required.
- **Approaches.**
  - **A. Soft-depend (require at runtime when present, degrade when absent).** The correct pattern.
  - **B. Hard-depend (e.g., require Tag Wrangler for rename).** Violates the standalone promise and the spec's "composable, not monolithic" principle.
- **Decision.** **A.** Style Settings: ship the `/* @settings */` block in `styles.css`; the variables/classes have built-in defaults so nothing breaks if Style Settings is absent. Tag Wrangler: detect via `app.plugins.enabledPlugins`; compose menu items when present; fall back to Tag Curator's own context menu + the bulk "Send to Tag Wrangler" action (disabled with an explanatory tooltip when absent). NN: detect + version-gate (already built); absent = silent no-op.
- **Status.** Accepted (2026-05-30). Style Settings + Tag Wrangler are net-new v1.0 work; NN gating already implemented.

### D-017 - Aliases / display-merge is v1.1, not v1.0 (sequences B006)

- **Context.** Aliases (collapse `#AI`/`#Ai`/`#ai` under a canonical, display-only) is repeatedly flagged as the highest-value deferred feature (B006, D-004). The question for the v1 bundle is whether it belongs in the "feature-rich v1.0" or the first follow-up.
- **Desired outcome.** Ship aliases where it lands best technically and product-wise, without bloating the v1.0 critical path.
- **Approaches.**
  - **A. Aliases in v1.0.** Maximizes v1.0 value but adds an alias-resolution pass to every scope observer and a merge UI, on top of an already-large v1.0 (workspace + 4 scopes + overrides + ecosystem).
  - **B. Aliases as the v1.1 headline.** The workspace (v1.0) is exactly the surface where alias management and suggested-merges want to live; building aliases on a finished surface is cleaner, and v1.1 then has a strong theme ("curation intelligence") pairing aliases with near-duplicate detection.
  - **C. Split: alias resolution (engine) in v1.0, alias UI in v1.1.** Adds inert engine surface area to v1.0 with no user-visible payoff.
- **Decision.** **B.** Aliases is the v1.1 headline, paired with the similarity/age match types and suggested-merges. The vision doc's Section 11 open-decision #2 offers the swap (aliases into v1.0, autocomplete out) if the reviewer weights aliases above scope breadth. Reversible at review time.
- **Status.** Accepted (2026-05-30). Sequences B006 to v1.1.

---

## Changelog

- **2026-05-28** - Created. Captured v0.1 scope, decisions D-001..D-006, questions Q-001..Q-004 from the 31-option UI review and the inline-editor feedback.
- **2026-05-28 (evening)** - Added Q-005 (rule-precedence bug). Then revised D-003 to a full end-to-end rename (`dryRun` -> `previewMode`, schema v1 -> v2 migration) on DDD/Ubiquitous-Language grounds. Fixed Q-005 (highest-priority match wins). Both shipped together: source + tests + docs updated; 118/118 tests pass; lint, tsc, build all green.
- **2026-05-28 (round-2 review)** - Reviewer pushed back on the converged UI design with 9 comments. Resulted in: D-001 evolved from sectioned-inline to master-detail (rule list + sectioned editor pane). D-007 added (persistent state banner for non-default state). D-008 added (welcome modal redesign: state-aware header, left-aligned safety promises, toggleable preset cards, per-plugin integration cards with state pills + bullets, primary/secondary CTAs with preview-mode explainer). Source: `ui-design_v0.1.0_converged.html`.
- **2026-05-29** - Post-v0.1 work. Revised D-011: the dual-host Tag List moves from "same component in both hosts" to a shared host-agnostic core (`TagListModel` + `TagActions`) feeding differentiated render components (`TagViewer` sidebar, `TagTable` settings); this also fixes the v0.1 settings-tab stub. Phase A (the shared core) built, tested (19 new tests, 141 total green), and merged. New proposal bundle `proposals/tag-list-dual-host/` (spec + shared-core plan). Notebook Navigator compatibility research completed: `proposals/notebook-navigator-compat/findings_nn-integration-seam.md` (runtime-interop seam: MutationObserver DOM decorator for hiding + NN public API for flagging; GPL constraint, no source copying).
- **2026-05-30** - Promoted D-012..D-017 (v1 vision bundle) to Accepted; re-cut Section 1 to the v1.0 cutline. v1.0 theme: Curation, in context.
