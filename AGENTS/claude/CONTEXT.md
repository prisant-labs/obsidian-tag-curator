# Context - claude

## Project Overview

**Project:** obsidian-tag-curator
**Description:** Vault-wide tag visibility and curation engine for Obsidian (display-only, file-safe, fully reversible)
**Last Updated:** 2026-05-28

## Single Source of Truth Pointers

When in doubt about scope, decisions, or what is shipping, consult these in order:

1. `docs/internal/scope-and-decisions.md` - **master decision tracker** (D-001 through D-011, Q-001 through Q-008, in-scope vs future tables)
2. `docs/internal/release-plans/plan_v0.1.0.md` - "Status as of 2026-05-28" section at the top
3. `docs/internal/release-plans/plan_v0.1.0/ui-design_v0.1.0_converged.html` - locked v0.1 UI design (7-round crit-reviewed)
4. `docs/internal/release-plans/plan_v0.1.0/release-notes_v0.1.0_draft.md` - prepared GitHub release body
5. `docs/internal/release-plans/proposals/` - draft specs + plans + UI for v0.2 features (3 bundles)
6. GitHub project [#2](https://github.com/users/jprisant/projects/2) + 16 issues - work tracking

If a discovery doc (`docs/internal/discovery/`) disagrees with the above, the above wins. Every discovery doc carries a v0.1 status callout pointing here.

## Key Files

- `README.md` - user-facing overview with v0.1.0 highlights
- `CHANGELOG.md` - version history (v0.1.0 entry includes Q-005 fix and `dryRun` -> `previewMode` rename)
- `TESTING.md` - QA matrix matching the locked v0.1 design + BRAT 6-cell smoke matrix
- `manifest.json` / `versions.json` - Obsidian plugin manifest; `minAppVersion: 1.9.10`
- `.github/workflows/release.yml` - tag-push trigger; uploads main.js + manifest.json + styles.css + versions.json
- `AGENTS/session-log/` - per-session work logs (deep log for 2026-05-28 is current)

## Conventions

- **Commits:** conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`, `ci:`, `docs:`, `test:`)
- **Branch:** `release/v0.1.0` for v0.1.0 work; `main` is the merge target
- **No em-dashes or en-dashes** (per global CLAUDE.md, enforced by hook)
- **No telemetry, no network calls, local-first**
- **Engine API-first, UI thin** - observer + engine expose enough that the UI is a pure render layer
- **Domain-Driven Ubiquitous Language** - one name across code, UI, and docs (D-003 was the corrective decision when this slipped)
- **Honor specific feedback** - when a reviewer flags a specific UX critique, redesign the surface, don't bucket the critique (memory: `honor-feedback-specifically`)

## Current State (2026-05-28, post-session)

**Branch:** `release/v0.1.0`, tip `fbee7a6`, **ship-ready pending BRAT human verification**.

### Engine + storage + tests (complete)

- 3 match types: `regex`, `frequency`, `list` (`src/types.ts` + `src/engine/matchers.ts`)
- 5 built-in toggleable presets (`src/engine/presets.ts`)
- Rule engine returns the **highest-priority** matching enabled rule (Q-005 fixed)
- `previewMode` setting (renamed from `dryRun` per D-003); schema v1 -> v2 migration with auto-port
- `seenWelcomeModal` setting; schema v2 -> v3 migration; defaults `false`
- Tag metadata sidecar (`tags.json`) with `firstSeen`, `lastSeen`, `count`, `sources`, `aliases` (alias field present but inert in v0.1)
- Multi-pane tag-pane observer with class-based hiding, ARIA preservation, `registerEvent` lifecycle
- 6 commands wired in `main.ts`
- 122/122 tests pass across 8 suites; tsc + lint + build all green

### UI surfaces (locked design implemented)

| Surface | File | Notes |
|---|---|---|
| State banner (D-007) | `src/ui/stateBanner.ts` | Persistent above every Tag Curator surface in non-default state |
| Welcome modal (D-008) | `src/ui/welcomeModal.ts` | First-run, gated by `seenWelcomeModal` |
| Settings tab | `src/ui/settingsTab.ts` | Top-tab layout: General / Tag list / Presets / Custom rules / Commands / Advanced + Profiles[v0.2] + Aliases[v0.3] |
| Tag list view (D-011) | `src/ui/tagListView.ts` | Same component, two hosts: sidebar leaf + Settings tab |
| Rule editor (D-010) | `src/ui/ruleEditor.ts` | Card view + right-docked preview, no wizard, priority hidden |
| Status bar | `src/main.ts` | Reflects current state; click opens hidden-only tag list |
| Panic disable | `src/ui/panicDisable.ts` | Action + state, surfaces banner on completion |
| Styles | `styles.css` | ~28 KB; uses Obsidian CSS variables for theme compatibility |

### Decisions log (D-001 through D-011)

In `docs/internal/scope-and-decisions.md`. Architectural ones:

- D-001 -> D-010: rule editor evolved through three layouts; settled on card view + right-docked preview
- D-002: wizard dropped (closed)
- D-003: `dryRun` -> `previewMode` end-to-end (DDD)
- D-007: persistent state banner pattern
- D-008: welcome modal locked structure
- D-009: priority architected, hidden from UI for v0.1
- D-011: Tag list = one component, two hosts (sidebar leaf + Settings tab)

Open questions: Q-001 (settings search), Q-002 (grouped-by-rule view), Q-003 (welcome integration detection scope), Q-004 (pagination vs virtualization). Closed: Q-005 (precedence bug), Q-006 (priority UI), Q-007 (Tag list tab), Q-008 (file-extension axis).

### v0.2 work parked

- 16 GitHub issues (#1-#4 + #6-#17) in project [#2](https://github.com/users/jprisant/projects/2)
- Milestones: 14 in v0.2.0, 2 in v0.3.0
- `proposal` label on the 5 issues with full spec + plan + UI bundles
- 3 proposal bundles in `docs/internal/release-plans/proposals/`:
  - `aliases-display-merge/` (B006, recommended for promotion from v0.3 to v0.2; highest user value)
  - `scope-expansion/` (#1 + #2 + #3; graph + autocomplete + properties chip)
  - `allow-only-mode/` (#4)

## Outstanding before tagging v0.1.0

1. **BRAT install in a real Obsidian vault** and walk the smoke matrix. **Human-required**; tester guide at `docs/internal/release-plans/plan_v0.1.0/brat-tester-guide.md`.
2. **Fix any bugs surfaced.**
3. **Pre-release tag rehearsal** (`v0.1.0-rc1`) to verify `release.yml` fires correctly before the real tag.
4. **Merge `release/v0.1.0` -> `main`**, tag `0.1.0`, push.

## Engine API for v0.2 implementers

The Phase 1-4 UI consumes these entrypoints; v0.2 work should preserve the contract:

- `resolveActiveRules(settings)` - enabled rules sorted by priority descending
- `RuleEngine.evaluateTag(tag, meta, rules)` - returns `MatchResult | null` (the highest-priority winning rule, Q-005)
- `RuleEngine.getRuleAttribution(tag, meta, rules)` - returns `RuleAttribution` with `effective: AttributedMatch | null` + `allMatches: AttributedMatch[]` ordered priority-desc; each match has a `reason` string ready to render
- `RuleEngine.testTag(tag, rule)` - test one rule against one tag (used by the live regex-validity status in the rule editor)
- `RuleEngine.getAllMatches(tag, meta, rules)` - every matching rule in input order; rarely what you want
- Observer exposes `countHidden()`, `countFlagged()`, `ruleForElement(el)` for status-bar and tag-list rendering. Do not re-derive client-side.

## Schema migration log

- v0: legacy `rules` array, no `customRules`
- v1: `customRules` array, `enabled` flag rolled in
- v2: `previewMode` (renamed from `dryRun`; auto-migrates the old value)
- v3: `seenWelcomeModal` (defaults `false` so existing testers see the modal once)

Migrations are one-way; downgrade is guarded against future-version data via the `< SCHEMA_VERSION` persist gate.

## Memories (claude-mem)

Notable cross-conversation memories pinned in `C:\Users\jpris\.claude\projects\E--Projects-github-jprisant-obsidian-tag-curator\memory\`:

- `honor-feedback-specifically.md` - feedback-honoring discipline learned in round 2 of crit review
- `master-scope-decisions-doc.md` - the source-of-truth pattern (this file is the implementation)
