# Tag Curator v1 Vision Bundle

A self-contained proposal for a feature-rich, best-in-class Tag Curator **v1**,
built on top of the existing tested engine and the locked v0.1 design. It is a
**proposal**: nothing here changes the shipping plan until you say "go".

## The thesis in one line

> **v1 moves the active curation loop out of the Settings modal and into a
> Curation Workspace leaf that docks beside the tag pane, so you see every change
> land in real time. Settings keeps only set-once configuration.**

That single move answers the pain you flagged - the cost of switching between
Obsidian's full-screen Settings modal and the core UI it occludes - and it is
cheap to build because the engine, the observer base, and the shared tag-UI core
are already done and tested.

## How to read this bundle

1. **Start here**, then read `01_vision-and-ux-thesis.md` (the argument + the
   canonical milestone map and v1.0 cutline).
2. Read `04_roadmap_human.md` for the journey, the day-in-the-life, the risks,
   and the four decisions that are yours to make.
3. Skim `02_decisions_v1.md` (the proposed decisions D-012..D-017) and
   `03_architecture_v1.md` (how it is built) if you want the depth.
4. Open the three mockups in `ui-ideas/` in a browser (each has a dark/light
   toggle) to see it.

## How to say "go"

When you are ready, say **"go"** and point an agent at
**`05_roadmap_agent.md`**. That file is the execution plan: on "go" the agent
promotes the proposed decisions into the master `scope-and-decisions.md`, then
builds v1.0 phase by phase under the project's verification gate
("npm run lint && npm run typecheck && npm test && npm run build" after each
task), committing at task boundaries and STOPPING before any push, tag, or
remote action.

The two roadmaps describe the **same** scope and milestones; they differ only in
audience. `04` is for a human deciding *whether and why*; `05` is for an agent
executing *what and how*.

## File map

| File | What it is | For |
|---|---|---|
| `00_README.md` | This index + the "go" protocol | Everyone |
| `01_vision-and-ux-thesis.md` | The spine: thesis, principles, the CANONICAL milestone map (Section 7) and v1.0 cutline (Section 8), open decisions | Everyone (read first) |
| `02_decisions_v1.md` | Proposed decisions D-012..D-017 in the project's decision format | Reviewer + agent (Phase 0 promotes these) |
| `03_architecture_v1.md` | Technical design: component map (Mermaid), Curation Workspace, scope architecture, override resolution, v3->v4 migration, performance, testing | Engineers + agent |
| `04_roadmap_human.md` | The human roadmap: milestone journey (Mermaid), per-feature narratives, day-in-the-life, risks, success metrics, your decisions | Reviewer |
| `05_roadmap_agent.md` | The agent execution plan - **the "go" entrypoint**: 13 phases, TDD-ordered, exact file paths, acceptance criteria, commit messages, STOP gates, Definition of Done | Executing agent |
| `06_getting-started.md` | User-facing getting-started guide for the shipped v1 experience | End users |
| `07_ci-and-release.md` | CI/release design + rationale (before/after action versions, the Node-24 deadline, the tag-vs-manifest guard) | Maintainer + agent |
| `ci/build.yml`, `ci/release.yml`, `ci/README.md` | Ready-to-adopt workflow files (proposal; not yet in `.github/workflows/`) | Agent (Phase 11 adopts) |
| `ui-ideas/ui_curation-workspace.html` | The hero mockup: the Curation Workspace docked beside the native tag pane, showing the live side-by-side loop | Reviewer |
| `ui-ideas/ui_v1-settings-and-scopes.html` | Thin Settings + the new Scopes section with per-scope kill switches | Reviewer |
| `ui-ideas/ui_v1-onboarding.html` | Welcome modal (de-overclaimed copy) + state-banner variants + status-bar states | Reviewer |

## The v1.0 cutline at a glance (canonical detail in `01` Section 8)

**In v1.0 "Curation, in context":** the Curation Workspace leaf; the
open-beside-the-tag-pane split; four independently kill-switchable scopes (tag
pane, Notebook Navigator, Properties, autocomplete); per-tag overrides
(always-show / always-hide); thin Settings + a Scopes section; trust-layer
polish; Style Settings + Tag Wrangler integration; a compatibility doc.

**Deferred:** aliases / display-merge, stale + near-duplicate detection, inbox
mode, and graph scope go to **v1.1 "Curation intelligence"**; profiles,
export/import + community packs, and compound criteria go to **v1.2 "Share and
scale"**; Bases scope, a SQLite backend, localization, and directory submission
are **v2.0+ "Reach"**.

## Relationship to the existing docs

- The master decision log (`docs/internal/scope-and-decisions.md`, D-001..D-011)
  is unchanged until "go". This bundle's decisions (D-012..D-017) continue that
  numbering and are promoted into the master in Phase 0.
- The locked v0.1 design (`release-plans/plan_v0.1.0/ui-design_v0.1.0_converged.html`)
  is the visual language these mockups reuse (same tokens, same components).
- The in-flight Notebook Navigator work on `feat/nn-compat-phase1` becomes v1.0
  scope item 3; `05_roadmap_agent.md` Phase 5 completes it.

## Status

Proposal, authored 2026-05-30. Awaiting review. Say "go" to execute
`05_roadmap_agent.md`.
