---
title: Tag Curator v1 - Proposed Decisions (D-012..D-017)
status: proposal (awaiting review; promotes into scope-and-decisions.md on "go")
author: claude (opus-4.8), ultracode session
date: 2026-05-30
format: Context - Desired outcome - Approaches - Decision - Status (matches scope-and-decisions.md Section 2)
---

# v1 Proposed Decisions

These extend the master decision log (`docs/internal/scope-and-decisions.md`,
D-001..D-011). They are **proposed**: on "go" they are copied into the master
doc with status flipped from `Proposed` to `Accepted` and dated. Each one names
the master decision it builds on so the lineage stays intact.

The format matches the master: **Context** (the issue), **Desired outcome**,
**Approaches**, **Decision / choice**, **Status**.

---

## D-012 - The Curation Workspace is the primary surface (extends D-011)

- **Context.** D-011 settled the tag list as "one component, two hosts" (sidebar
  leaf + Settings tab), then the 2026-05-29 revision conceded that an `ItemView`
  cannot mount inside a `PluginSettingTab`, so the Settings "Tag list" tab
  shipped as a stub. The deeper issue is the one the reviewer surfaced for v1:
  Obsidian's Settings is a full-screen modal, so any iterative curation done in
  Settings hides the very tag pane the user is curating. Curation is an
  iterative loop, not a set-once configuration.
- **Desired outcome.** A single, coherent home for the curation loop that
  coexists on screen with the tag pane, with no modal occlusion and no
  open-tweak-close-reopen cycle. Stop fighting the `ItemView`-in-Settings
  constraint.
- **Approaches.**
  - **A. Keep dual-host; make the Settings tab a real surface.** Blocked by the
    framework: `ItemView` cannot mount in `PluginSettingTab`. Would require
    re-implementing the table a second time inside Settings - duplication and the
    modal-occlusion problem remains.
  - **B. Workspace leaf as primary; Settings becomes a launcher.** Promote a
    `CurationWorkspaceView` (`ItemView`) that holds the table + inline editor +
    live preview + bulk actions + diagnostics, built on the merged
    `TagListModel`/`TagActions` core. The Settings "Tag list" tab is replaced by
    an "Open Curation Workspace" button + a thin status readout. Curation is a
    leaf; configuration is Settings.
  - **C. Modal-based workbench (a big Tag Curator modal).** Reintroduces exactly
    the occlusion problem - a modal still covers the tag pane.
- **Decision.** **B.** The Curation Workspace leaf is Tag Curator's primary
  surface. Settings launches it and holds set-once config (Section 4.3 of the
  vision doc). This supersedes D-011's dual-host intent: there is one functional
  surface (the leaf), and Settings references it rather than duplicating it.
- **Status.** Proposed (2026-05-30). Supersedes the D-011 "two hosts render the
  same data" goal; preserves the merged shared core, which is exactly what the
  leaf renders.

---

## D-013 - Side-by-side live preview is the default mental model (extends D-003, D-007)

- **Context.** Preview mode (flag-instead-of-hide, renamed from dry-run in D-003)
  reduces the *risk* of editing rules blind, but not the *friction*: the user
  still cannot see the tag pane while editing in Settings. With the workspace now
  a leaf (D-012), the leaf can be docked beside the native tag pane.
- **Desired outcome.** Editing a rule and seeing its effect should be one
  continuous glance, not a context switch.
- **Approaches.**
  - **A. Rely on the user to arrange panes themselves.** Works, but most users
    will not discover it.
  - **B. Ship an "Open Curation Workspace beside the tag pane" command** that
    opens the leaf, reveals the native tag pane, and arranges them as a split.
    The workspace's own preview list and the live tag pane update together as the
    user types a rule.
  - **C. Embed a mini tag-pane mirror inside the workspace.** Duplicates Obsidian
    state, fragile, and unnecessary once the split exists.
- **Decision.** **B.** Provide the one-click split command and make it the
  recommended path in onboarding and docs. Preview mode remains available for
  single-pane users and for committing a rule cautiously. The state banner
  (D-007) continues to show when Preview is on.
- **Status.** Proposed (2026-05-30).

---

## D-014 - v1.0 ships four independently-gated scopes (extends spec 4.1, 7.2)

- **Context.** The spec lists ~12 candidate scopes. v0.1 wired only the tag pane.
  Tags actually render to users in a small set of high-traffic surfaces: the tag
  pane, Notebook Navigator's tag tree, the Properties panel, and editor
  autocomplete. The autocomplete and properties DOM paths are undocumented and
  can shift across Obsidian releases.
- **Desired outcome.** Cover the surfaces where tags actually appear, without a
  single flaky surface forcing the user to disable the whole plugin.
- **Approaches.**
  - **A. One scope at a time across releases.** Safe but slow; v1.0 would not
    feel "feature-rich."
  - **B. Four scopes in v1.0, each an independent observer on `ObserverBase`,
    each with its own per-scope kill switch in Settings -> Scopes.** Risky scopes
    (autocomplete, properties) ship default-on but can be toggled off without
    touching the others. Breakage is isolated to one observer.
  - **C. All ~12 scopes.** Most are low-traffic (quick switcher, hover preview,
    backlinks) and several (graph, bases) are higher-risk; this is v1.1+/v2.
- **Decision.** **B.** v1.0 scopes: tag pane, Notebook Navigator, Properties,
  Autocomplete. Each is an `ObserverBase` subclass; each is independently
  toggleable; the Settings "Scopes" section is the control surface (Section 4.3,
  principle 11). Graph view is v1.1; Bases and the rest are v2+.
- **Status.** Proposed (2026-05-30). NN scope already in flight on
  `feat/nn-compat-phase1`.

---

## D-015 - Per-tag overrides ship in v1.0 with a v3->v4 migration (closes B009 for v1.0)

- **Context.** The spec promises an "always show override" safety net and the tag
  list's per-row "show this tag" action, but there is no persisted store for a
  per-tag decision. `TagActions` already returns a typed "b009-deferred" result
  for per-tag hide/unhide, acknowledging the gap. Without overrides, the
  workspace's per-row actions are inert.
- **Desired outcome.** A user can pin a single tag to always-show (beating every
  rule, the safety net) or always-hide (without authoring a rule), and it
  persists.
- **Approaches.**
  - **A. Encode overrides as auto-generated list-match rules.** Pollutes the
    rule set, conflates two concepts, and complicates attribution.
  - **B. A dedicated `overrides` store: `Record<tag, 'show' | 'hide'>` in
    settings, resolved with strict precedence (always-show beats every rule;
    always-hide beats every rule except always-show).** Schema bumps v3->v4 with
    a one-way guarded migration defaulting `overrides` to `{}`.
  - **C. Store overrides in the `tags.json` sidecar.** Mixes user intent (a
    decision) with derived metadata (counts/dates); the sidecar is rebuildable
    from the cache, so a decision there could be lost on rebuild.
- **Decision.** **B.** Overrides are first-class settings, resolved ahead of
  rules in the engine: `resolveVisibility(tag)` checks overrides first, then
  rule attribution. Always-show is the spec's safety override. Migration v3->v4
  adds `overrides: {}`; tests cover the migration and the precedence.
- **Status.** Proposed (2026-05-30). Promotes B009 from "fast-follow" into v1.0
  because the workspace's per-row actions depend on it.

---

## D-016 - Ecosystem integrations are optional enhancements, never dependencies (extends spec 3, 6)

- **Context.** v1.0 adds Style Settings registration and Tag Wrangler menu
  composition. Both are popular but not universally installed.
- **Desired outcome.** Tag Curator works fully standalone; installed companions
  make it better, never required.
- **Approaches.**
  - **A. Soft-depend (require at runtime when present, degrade when absent).**
    The correct pattern.
  - **B. Hard-depend (e.g., require Tag Wrangler for rename).** Violates the
    standalone promise and the spec's "composable, not monolithic" principle.
- **Decision.** **A.** Style Settings: ship the `/* @settings */` block in
  `styles.css`; the variables/classes have built-in defaults so nothing breaks
  if Style Settings is absent. Tag Wrangler: detect via
  `app.plugins.enabledPlugins`; compose menu items when present; fall back to Tag
  Curator's own context menu + the bulk "Send to Tag Wrangler" action (disabled
  with an explanatory tooltip when absent). NN: detect + version-gate (already
  built); absent = silent no-op.
- **Status.** Proposed (2026-05-30). Style Settings + Tag Wrangler are net-new
  v1.0 work; NN gating already implemented.

---

## D-017 - Aliases / display-merge is v1.1, not v1.0 (sequencing call for B006)

- **Context.** Aliases (collapse `#AI`/`#Ai`/`#ai` under a canonical, display-only)
  is repeatedly flagged as the highest-value deferred feature (B006, D-004). The
  question for this bundle is whether it belongs in the "feature-rich v1.0" or
  the first follow-up.
- **Desired outcome.** Ship aliases where it lands best technically and
  product-wise, without bloating the v1.0 critical path.
- **Approaches.**
  - **A. Aliases in v1.0.** Maximizes v1.0 value but adds an alias-resolution
    pass to every scope observer *and* a merge UI, on top of an already-large
    v1.0 (workspace + 4 scopes + overrides + ecosystem).
  - **B. Aliases as the v1.1 headline.** The workspace (v1.0) is exactly the
    surface where alias management and suggested-merges want to live; building
    aliases on a finished surface is cleaner, and v1.1 then has a strong theme
    ("curation intelligence") pairing aliases with near-duplicate detection.
  - **C. Split: alias *resolution* (engine) in v1.0, alias *UI* in v1.1.** Adds
    inert engine surface area to v1.0 with no user-visible payoff.
- **Decision.** **B.** Aliases is the v1.1 headline, paired with the
  similarity/age match types and suggested-merges. The vision doc's Section 11
  open-decision #2 offers the swap (aliases into v1.0, autocomplete out) if the
  reviewer weights aliases above scope breadth.
- **Status.** Proposed (2026-05-30). Reversible at review time via open-decision
  #2.

---

## Cross-references into the existing log

- Builds on / supersedes: **D-011** (dual-host) -> D-012; **D-003** (preview
  naming) and **D-007** (state banner) -> D-013; spec 4.1/7.2 -> D-014; **B009**
  -> D-015; spec 3/6 -> D-016; **B006/D-004** -> D-017.
- Unchanged and carried forward: D-005 (presets toggleable), D-006 (row-based),
  D-008 (welcome modal structure - copy de-overclaim is a v1.0 task, not a new
  decision), D-009 (priority hidden in UI; v1.2 surfaces drag-to-reorder, item N),
  D-010 (rule editor = card view + right-docked preview; this is exactly the
  editor embedded in the Curation Workspace).
