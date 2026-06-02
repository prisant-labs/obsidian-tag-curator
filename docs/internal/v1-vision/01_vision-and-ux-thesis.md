---
title: Tag Curator v1 - Vision and UX Thesis
status: proposal (awaiting review, then "go")
author: claude (opus-4.8), ultracode session
date: 2026-05-30
supersedes: nothing (parallel proposal bundle; promotes into scope-and-decisions.md on "go")
canonical-for:
  - the v1 milestone map (Section 7)
  - the v1.0 feature cutline (Section 8)
  - the ubiquitous-language additions (Section 5.1)
companion-docs:
  - 02_decisions_v1.md (proposed D-012..D-017)
  - 03_architecture_v1.md (how)
  - 04_roadmap_human.md (the journey, for people)
  - 05_roadmap_agent.md (the execution plan, for agents) <- the "go" entrypoint
  - 06_getting-started.md (user onboarding)
  - 07_ci-and-release.md (+ ci/ workflow files)
  - ui-ideas/*.html (visual mockups)
---

# Tag Curator v1: Vision and UX Thesis

> This is the **spine** of the v1 proposal bundle. Every other document in
> `docs/internal/v1-vision/` agrees with the milestone map (Section 7) and the
> v1.0 cutline (Section 8) recorded here. If a downstream doc disagrees with
> this one, this one wins until a decision in `02_decisions_v1.md` says
> otherwise.

## 0. How to use this bundle (the "go" protocol)

This bundle is a **proposal**. Nothing here mutates the shipping plan
(`scope-and-decisions.md`, `plan_v0.1.0.md`) until you approve it. The intended
flow:

1. You read this bundle (start here, then `04_roadmap_human.md`).
2. You say **"go"** and point at `05_roadmap_agent.md`.
3. On "go", an agent: promotes the proposed decisions (D-012..D-017) into the
   master `scope-and-decisions.md`, then executes `05_roadmap_agent.md`
   phase by phase with the project's existing verification gates
   (`npm run lint && npm run typecheck && npm test && npm run build`).

The two roadmaps describe the **same** scope and the **same** milestones. They
differ only in audience: `04` is written for a human deciding *whether and why*;
`05` is written for an agent executing *what and how*, with file paths,
acceptance criteria, and commit boundaries.

## 1. One-sentence thesis

> **Tag Curator v1 moves the active curation loop out of the Settings modal and
> into a workspace leaf that lives beside the tag pane, so you see every change
> land in real time. Settings keeps only set-once configuration.**

Everything below is the argument for that sentence and the scope it implies.

## 2. Where we are (honest current state)

Tag Curator already has a strong, tested foundation:

- **Engine (done).** Three match types (regex / frequency / list), highest-priority-wins
  resolution (Q-005), `RuleEngine.getRuleAttribution` for "why is this hidden?"
  diagnostics, 5 toggleable presets.
- **Storage (done).** Settings with schema-versioned migrations (v0..v3), a tag
  metadata sidecar (`tags.json`: firstSeen / lastSeen / count / sources).
- **Observer pattern (done + extracted).** `ObserverBase` generalizes the scoped
  `MutationObserver` lifecycle; `TagPaneObserver` is the first consumer.
- **Shared UI core (merged).** `TagListModel` (rows, visibility, filter chips,
  search, sort, selection) + `TagActions` (Tag Wrangler delegation, typed
  per-tag override result) - host-agnostic, headless-tested.
- **Trust surfaces (built).** Welcome modal, persistent state banner, panic
  disable, status bar.
- **NN compatibility (in flight).** Detection + version gating + a hand-written
  local API type shipped on `feat/nn-compat-phase1`; the NN DOM decorator is the
  next step.
- **Tests + CI.** 154 tests across 12 files; `build.yml` runs lint + typecheck +
  test + build on PR.

The **gaps** are not in the engine. They are:

1. **Surface architecture.** The interactive surfaces (rule editor, tag list)
   live in the Settings modal. The one functional tag-list leaf exists, but the
   curation *loop* (edit a rule, see the effect) still routes through Settings.
2. **Scope coverage.** Only the native tag pane is wired. Tags also show up in
   Notebook Navigator, the Properties panel, and editor autocomplete.
3. **The override primitive.** There is no persisted "always show / always hide
   this one tag" - so the per-row actions in the tag list cannot be real yet.
4. **Ecosystem polish.** Style Settings registration and Tag Wrangler menu
   composition are specced but not built.

## 3. The core problem, and the UX defect on top of it

### 3.1 The product problem (unchanged from the spec)

Obsidian treats every `#token` as a first-class tag. Large, heterogeneous
vaults accumulate a long tail of accidental tags: hex codes from web clippings,
URL anchors, Templater fragments, single-use experiments, capitalization
variants, typos. The tag pane and graph stop being useful navigation tools.
Tag Curator filters, classifies, and surfaces tags across Obsidian's UI without
ever touching note content.

### 3.2 The UX defect this vision targets

The current architecture has a specific, diagnosable flaw, and it is the one you
flagged: **the pain of switching between the Settings UI and the core UI.**

In Obsidian, **Settings is a full-screen modal.** It draws over the entire
workspace. The tag pane (the thing you are curating) is *behind* it. So the
real-world curation loop today is:

```
open Settings  ->  Custom rules  ->  write a rule
   ->  (tag pane is hidden behind the modal; you can't see the effect)
   ->  close Settings to look
   ->  "hmm, that hid one too many"
   ->  reopen Settings  ->  adjust  ->  close  ->  look  ->  ...
```

Preview mode (flag-instead-of-hide) softens the *risk* of this loop but not the
*friction*: you still cannot watch the tag pane while you are in Settings.

This is not a Tag Curator-specific mistake; it is the single most common
architectural error in Obsidian plugin UX. The plugins users love most avoid it
the same way: they put their interactive surface in a **workspace leaf**, which
is a first-class, dockable, splittable pane that coexists with everything else.
Search results, Backlinks, Outline, the Tag pane itself, Kanban boards, Canvas,
Excalidraw drawings, Dataview tables - all leaves, never buried in Settings.

## 4. The thesis in full: "Curation in context"

### 4.1 The move

Promote a **Curation Workspace** to be Tag Curator's primary surface. It is an
Obsidian `ItemView` (a workspace leaf) containing everything the active curation
loop needs:

- The **tag table** - every tag, with count, first/last seen, source, per-scope
  visibility state, the affecting rule, alias, and description; sortable,
  filterable (chips: Hidden, Flagged, Orphans, Frontmatter, Inline, Unreviewed,
  By rule), searchable, and virtualized for large vaults.
- The **inline rule editor** - card view of rules; click a card to edit in
  place; create from a `+ New rule` card. No separate wizard (D-002 closed). The
  editor never leaves the leaf.
- A **live preview** - as you type a rule, the affected-tags list updates, *and*
  - this is the point - so does the real tag pane next to it.
- **Bulk actions** - select N tags, then hide / unhide / flag / alias / add
  description / send to Tag Wrangler.
- **Diagnostics inline** - "why is this hidden?" on any row, backed by
  `getRuleAttribution`.

### 4.2 Why a leaf, specifically

A leaf is dockable and **splittable**. The headline interaction becomes:

```
[ Curation Workspace ]  |  [ native Tag pane ]
  edit a rule here       |    watch tags hide/flag here, live
```

One command - **"Open Curation Workspace beside the tag pane"** - arranges this
split for the user (open our leaf, reveal the tag pane, place them side by side).
The open-tweak-close-observe-reopen loop collapses into a single continuous
glance. That is the entire UX win, and it is only possible because the surface
is a leaf rather than a modal.

### 4.3 What Settings becomes

Settings stops being where you *do* curation and becomes where you *configure*
it once:

- Master enable + Preview mode + panic disable (the safety row).
- **Default scopes** - which display surfaces Tag Curator acts on (tag pane, NN,
  properties, autocomplete), each independently toggleable.
- **Integrations** - Style Settings note, Tag Wrangler menu toggle, NN sync
  options.
- **Advanced** - sidecar debounce, debug logging, reindex, troubleshooting.
- A single prominent **"Open Curation Workspace"** button (and the
  beside-the-tag-pane variant).

This also dissolves the awkward v0.1 reality where the Settings "Tag list" tab
had to ship as a stub because an `ItemView` cannot mount inside a
`PluginSettingTab` (D-011 revision). We stop fighting that constraint: the leaf
is the home, and Settings *launches* it.

### 4.4 Mental model summary

| Surface | Role | When you use it |
|---|---|---|
| **Curation Workspace** (leaf) | The active loop: see, edit, preview, act | Every time you curate |
| **Tag pane / NN / Properties / Autocomplete** (scopes) | Where curation *shows up* | Always, passively |
| **Settings** (modal) | Set-once configuration | Rarely, to change defaults |
| **Status bar** (item) | Ambient state + entry point | Glanceable; click to open hidden view |
| **Welcome modal** (transient) | First-run trust contract | Once |
| **State banner** (in every surface) | "you are in a non-default state" | When Preview is on or plugin is off |

## 5. Design principles for v1

The spec's eight principles (files-are-sacred, reversible, composable,
data-layer-respect, progressive-disclosure, performance-first, local-first,
state-visibility) all carry forward unchanged. v1 adds three that follow from the
thesis:

9. **Locality of action.** The surface where you change something shows you the
   result of that change without a context switch. If an action's effect is
   invisible from where you took it, the design is wrong.
10. **The leaf is home; Settings is config.** Interactive, iterative work lives
    in a workspace leaf. Settings holds only choices you make once and forget.
11. **Scopes are independent and reversible per scope.** Each display surface
    Tag Curator touches is an opt-in/opt-out unit with its own kill switch, so a
    misbehaving scope never forces the user to disable the whole plugin.

### 5.1 Ubiquitous-language additions (DDD, per D-003 discipline)

One name across domain, UI, and code:

- **Curation Workspace** - the primary `ItemView` leaf. Not "tag list view,"
  not "main UI." (Code: `CurationWorkspaceView`, `CURATION_VIEW_TYPE`.)
- **Scope** - a display surface Tag Curator acts on (tag pane, NN, properties,
  autocomplete). Already in the type union; v1 makes it a first-class user-facing
  concept ("Scopes" section in Settings).
- **Override** - a persisted per-tag decision that beats every rule: always-show
  or always-hide. (Code: `overrides` store; the spec's "always show override.")
- **The curation loop** - the see -> edit -> preview -> act cycle the workspace
  exists to make frictionless.

## 6. The v1 feature vision (the whole picture)

This is the full ambition, before cutlines. Section 7 assigns each to a
milestone; Section 8 fixes the v1.0 line.

- **A. Curation Workspace** (leaf): table + inline editor + live preview + bulk
  actions + diagnostics, built on the merged `TagListModel`/`TagActions` core.
- **B. Side-by-side preview**: "Open beside the tag pane" split command; live
  reaction.
- **C. Scope coverage**: tag pane (have) + Notebook Navigator (in flight) +
  Properties panel + autocomplete suppression.
- **D. Per-tag overrides**: always-show / always-hide, persisted, migration-safe;
  always-show is the safety override the spec promises.
- **E. Thin Settings**: set-once config; "Scopes" section; launch buttons.
- **F. Trust layer** (have, polish): welcome modal (de-overclaimed copy), state
  banner, panic disable, status bar.
- **G. Ecosystem**: Style Settings variable registration; Tag Wrangler menu
  composition; documented compatibility with Dataview / Tasks / Bases.
- **H. Aliases / display-merge**: collapse capitalization and synonym variants
  under a canonical, display-only; "rewrite via Tag Wrangler" delegation.
- **I. Curation intelligence**: stale match type (age), near-duplicate match
  type (similarity), the stale preset, a suggested-merges panel.
- **J. Inbox mode**: new tags land in a review queue until accepted / hidden /
  merged.
- **K. Graph view scope**: hide/flag tag nodes in global and local graph.
- **L. Profiles**: switchable rule-sets ("Writing", "Curation", "Demo"); NN
  profile sync.
- **M. Export / import + community rule packs**: share rule-sets across vaults
  and with the community.
- **N. Compound criteria**: AND/OR/NOT rule trees; drag-to-reorder priority UI.

## 7. The milestone map (CANONICAL)

> Downstream docs treat this table as frozen. Changing it means editing this
> section and re-running the affected docs.

| Milestone | Theme | Features (from Section 6) | Headline |
|---|---|---|---|
| **v1.0** | **Curation, in context** | A, B, C, D, E, F, G | The Curation Workspace + the scopes that make "where tags live" feel complete + the trust and ecosystem layer. |
| **v1.1** | **Curation intelligence** | H, I, J, K | Aliases/merge, stale + near-duplicate detection, suggested merges, inbox mode, graph scope. |
| **v1.2** | **Share and scale** | L, M, N | Profiles, export/import + community packs, compound criteria + drag-to-reorder. |
| **v2.0+** | **Reach** | Bases scope; SQLite backend for 50k+ vaults; localization; Colored Tags Wrangler delegate; community-directory submission; (speculative) AI-suggested rules. | Out of this bundle's scope; listed so nothing is lost. |

Rationale for the ordering:

- **v1.0 is the thesis plus completeness plus trust.** It is meaningfully more
  than today's tag-pane-only v0.1, but every piece is grounded: the engine is
  done, the workspace sits on the merged core, the scopes follow the proven
  `ObserverBase` pattern, NN is already in flight, and the ecosystem work is
  cheap (Style Settings is ~80 lines of CSS; the Tag Wrangler menu is ~30 lines).
- **v1.1 is intelligence.** Aliases (the highest-value deferred feature per every
  prior doc, B006) and the similarity/age match types need modest engine
  extension and a new panel, so they come *after* the surface is solid - the
  workspace is exactly where suggested-merges and inbox triage want to live.
- **v1.2 is power and portability.** Profiles, sharing, and compound rules are
  multipliers on an already-great experience, not prerequisites for one. The
  workspace makes single-criterion rules pleasant enough that compound logic can
  wait without hurting v1.0.

## 8. The v1.0 cutline (CANONICAL)

### 8.1 In v1.0

| # | Item | Why it is in v1.0 | Grounding |
|---|---|---|---|
| 1 | Curation Workspace leaf (table + inline editor + live preview + bulk + diagnostics) | The thesis. The whole release hangs on this. | Built on merged `TagListModel`/`TagActions`; editor designed in D-010. |
| 2 | "Open beside the tag pane" split command | Delivers the side-by-side loop that *is* the UX win. | Obsidian `WorkspaceLeaf` split API. |
| 3 | Scope: Notebook Navigator tag tree | Highest-traffic third-party tag surface; already in flight. | `feat/nn-compat-phase1` Phases 1-2 done. |
| 4 | Scope: Properties panel (frontmatter tags) | A primary place tags render; cheap with `ObserverBase`. | New observer on the proven base. |
| 5 | Scope: Autocomplete suppression | Stops users re-creating a tag they just hid. | New observer; default-on, kill-switchable. |
| 6 | Per-tag overrides (always-show / always-hide) | Makes the workspace's per-row actions real; always-show is the promised safety net. | New `overrides` store + schema v3->v4 migration (B009). |
| 7 | Thin Settings + "Scopes" section + launch buttons | Removes the Settings-as-workbench anti-pattern. | Refactor `settingsTab.ts`. |
| 8 | Trust layer polish (welcome copy de-overclaim, banner, panic, status bar) | Trust is the adoption gate; copy currently overclaims for v0.1. | Session-log note 2026-05-30. |
| 9 | Style Settings registration | Themes/power users restyle without code; near-free. | ~80 lines CSS comments. |
| 10 | Tag Wrangler menu composition + bulk delegation | The rename delegation point; bulk action already specced. | Spec 6.1.1; ecosystem research Part 5. |
| 11 | Compatibility doc (Dataview/Tasks/Bases unaffected) | The display-only contract is the trust story; say it explicitly. | Ecosystem research Part 2. |

### 8.2 Deferred out of v1.0 (with the reason)

| Item | Target | Why not v1.0 |
|---|---|---|
| Aliases / display-merge (H) | v1.1 | Needs an alias-resolution pass in the observer pipeline and a merge UI; high value but additive to a finished surface. |
| Stale + near-duplicate match types, suggested merges (I) | v1.1 | Engine extension (`age`, `similarity`) + a new panel; the panel wants the workspace to exist first. |
| Inbox mode (J) | v1.1 | A mode with its own review queue; best built once overrides and the workspace are solid. |
| Graph view scope (K) | v1.1 | Higher DOM-observer risk (canvas/SVG); not load-bearing for the thesis. |
| Profiles (L) | v1.2 | A multiplier, not a prerequisite; benefits from a stable rule model. |
| Export / import + community packs (M) | v1.2 | Needs a trust/index model; ship the great single-vault experience first. |
| Compound criteria + drag-to-reorder (N) | v1.2 | Engine model change (`MatchCriteria` -> `MatchNode`) + migration; single-criterion rules are pleasant enough in the workspace to wait. |

### 8.3 The discipline behind the cutline

This bundle is ambitious on purpose - you asked for feature-rich - but it holds
the line the existing `scope-and-decisions.md` holds: each item is in v1.0
*because* it is grounded in already-built infrastructure or cheap, well-understood
work, and each deferral has a one-line reason. YAGNI still applies; "feature-rich"
is not "everything at once."

## 9. What "great" looks like (success criteria)

- **The loop is frictionless.** A user can open the workspace beside the tag
  pane, write a rule, and watch the tag pane react without ever opening Settings.
- **Tags are tamed everywhere they appear.** Hiding a tag hides it in the tag
  pane, NN, properties, and autocomplete - the four places it shows up.
- **Nothing is ever lost.** Status bar, the workspace's Hidden chip, per-row
  "why hidden?", and one-click override mean "where did my tag go?" never
  happens. Uninstalling restores everything instantly.
- **Trust lands in 30 seconds.** The welcome modal's first claim is file-safety,
  and it is true: zero note-content writes, ever.
- **It is fast on a real vault.** 10k notes / 1,500 tags / 30 rules: idle
  near-zero CPU, initial sweep < 200 ms, table scroll smooth via virtualization.
- **It is a good ecosystem citizen.** Dataview/Tasks/Bases see unfiltered tags;
  Tag Wrangler is the rename surface; Style Settings can restyle it; NN coexists.

## 10. Risks and mitigations (summary; full treatment in 04_roadmap_human.md)

| Risk | Mitigation |
|---|---|
| Autocomplete / properties DOM paths are undocumented and change across Obsidian versions | Ship each scope behind a per-scope kill switch (D-014); `ObserverBase` isolates breakage to one scope; smoke-test on `minAppVersion`. |
| NN is GPL-3.0; Tag Curator is Apache-2.0 | Runtime-interop only - observe/mutate NN's DOM and call its public API; never copy NN source (established 2026-05-30). |
| Override store migration could corrupt settings | Atomic write-temp-then-rename (already in place); one-way guarded migration; tests for v3->v4. |
| Scope creep balloons v1.0 | The Section 8 cutline is canonical; aliases/intelligence are explicitly v1.1. |
| Live side-by-side relies on the user arranging panes | Provide the one-click "open beside" command; degrade gracefully to Preview mode if they prefer a single pane. |

## 11. Open decisions for the human reviewer

These are the calls where your answer changes the build. Defaults are
recommended; "go" without comment accepts the recommendations.

1. **v1.0 scope size.** Recommendation: ship all 11 items in 8.1. Acceptable
   trim if you want a faster v1.0: move autocomplete (item 5) and/or properties
   (item 4) to v1.1, leaving tag pane + NN as the v1.0 scopes. The workspace +
   overrides + NN alone still delivers the thesis.
2. **Aliases timing.** Recommendation: v1.1. If aliases matter more to you than
   extra scopes, we can swap aliases into v1.0 and push autocomplete to v1.1.
3. **Workspace default location.** Recommendation: opens in the **right sidebar**
   by default (familiar, coexists with the tag pane there), with the
   "open beside the tag pane" command for the power split. Alternative: open in
   the main editor area.
4. **Naming.** Recommendation: "Curation Workspace." Alternatives considered:
   "Tag Studio," "Curation Board," "Tag Curator panel." The thesis docs use
   "Curation Workspace" throughout; a rename is a find-replace if you prefer one.

## 12. Pointers

- The **why and the journey**, for people: `04_roadmap_human.md`.
- The **what and how**, for an agent to execute on "go": `05_roadmap_agent.md`.
- The **technical design**: `03_architecture_v1.md`.
- The **proposed decisions** (D-012..D-017): `02_decisions_v1.md`.
- The **visuals**: `ui-ideas/ui_curation-workspace.html` (the hero),
  `ui-ideas/ui_v1-settings-thin.html`, `ui-ideas/ui_v1-onboarding-and-scopes.html`.
- **User onboarding**: `06_getting-started.md`.
- **CI/release**: `07_ci-and-release.md` + `ci/`.
