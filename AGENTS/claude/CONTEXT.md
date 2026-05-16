# Context - claude

## Project Overview

**Project:** obsidian-tag-curator
**Description:** Vault-wide tag visibility and curation engine for Obsidian (display-only, file-safe, fully reversible)
**Last Updated:** 2026-05-15

## Key Files

- `README.md` - Project overview (user-facing)
- `CHANGELOG.md` - Version history
- `TESTING.md` - Testing guide, includes v0.1.0 six-cell smoke matrix and tagging runbook
- `manifest.json` / `versions.json` - Obsidian plugin manifest; `minAppVersion: 1.9.10`
- `docs/internal/release-plans/plan_v0.1.0.md` - Source of truth for v0.1.0 execution (18 tasks across 5 phases)
- `docs/internal/discovery/` - Spec, implementation plan, project overview, UI mockups
- `AGENTS/session-log/` - Per-session work logs
- `.eslintrc.cjs` - Lint config; `ignorePatterns` lists Phase C files queued for rewrite

## Conventions

- **Commits:** conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`, `ci:`, `docs:`, `test:`)
- **Branch:** `release/v0.1.0` for v0.1.0 work; main is the merge target
- **No em-dashes or en-dashes** (per global CLAUDE.md, enforced by hook)
- **No telemetry, no network calls, local-first**
- **Engine API-first, UI thin** - the observer + engine layer expose enough for the UI to be a pure render

## Current State (2026-05-15)

**v0.1.0 release branch:** `release/v0.1.0`, 18 commits ahead of `main`.

**Done:**
- Phase A foundation: types, settings storage with v0->v1 migration, tag-metadata sidecar (`tags.json`), multi-pane observer with ARIA + class-based hiding, iOS-safe regex engine, presets corrected
- Phase B infrastructure: `manifest.json` 1.9.10, `release.yml` workflow, ESLint config, README + CHANGELOG, lifecycle wiring with `registerEvent` + `onExternalSettingsChange`, panic disable
- Path A: legacy UI files translated to new API surface (compile-clean, not rebuilt yet)
- Parallel-track work (2026-05-15 21:17 session):
  - Vitest harness + 79 unit tests across matchers, ruleEngine, presets, safeRegex, tagUtils, settings
  - `RuleEngine.getRuleAttribution` helper for the "why is this tag hidden?" diagnostic
  - Bug fix: v0->v1 schemaVersion was never persisted (caught by tests)
  - `TESTING.md`: v0.1.0 six-cell smoke matrix + tagging runbook

**Not done (Phase C, blocked on UI screenshots):**
- Settings tab rewrite (Task 11) - currently translated, still ignored by ESLint
- Tag list view rebuild (Task 10) - currently translated, still ignored by ESLint
- Rule editor rewrite (Task 13) - still ignored by ESLint
- Styles polish (Task 12) - waits for rebuilt DOM
- Six-cell smoke sweep (Task 18) - waits for Phase C
- Tag `0.1.0` and push - waits for smoke sweep

## Next Steps

1. Push `release/v0.1.0` if not already (currently 5 commits ahead of origin)
2. Wait for user's UI screenshot collection to inform Phase C
3. Execute Phase C in order: Task 11 (settings tab) -> Task 10 (tag list, consume `getRuleAttribution`) -> Task 13 (rule editor) -> Task 12 (styles)
4. Remove the three ESLint ignore entries as each Phase C task lands
5. Run the six-cell smoke matrix in `TESTING.md`
6. Tag and push per the runbook (`git checkout main && git merge --no-ff release/v0.1.0 -m "release: v0.1.0" && git tag 0.1.0`, confirm with user before push)

## Engine API for UI consumers

The Phase C UI rewrite should be a thin renderer over these engine entrypoints:

- `resolveActiveRules(settings)` - returns enabled rules sorted by priority desc
- `RuleEngine.evaluateTag(tag, meta, rules)` - returns `MatchResult | null` (the winning rule)
- `RuleEngine.getRuleAttribution(tag, meta, rules)` - returns `RuleAttribution` with `effective` + `allMatches`; each `AttributedMatch` has `reason` text ready to render
- `RuleEngine.testTag(tag, rule)` - test one rule against one tag, no meta required (use for live preview in rule editor)
- `RuleEngine.getAllMatches(tag, meta, rules)` - every matching rule, input order (rarely what you want; prefer `getRuleAttribution`)

The observer exposes `countHidden()`, `countFlagged()`, and `ruleForElement(el)` for status-bar and tag-list rendering. Do not re-derive these client-side.
