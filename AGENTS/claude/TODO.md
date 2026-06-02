# TODO - claude

## Active

*Nothing currently in progress.*

## Up Next (blocked on user's UI screenshots + option picks from 31-section menu)

- [ ] User: review `docs/internal/release-plans/plan_v0.1.0/ui-options_v0.1.0.html` and pick options across the 9 functional areas
- [ ] User: filter picks through the orange "engine extension" flag (Opts 22, 25, 27, 31 require data model changes - defer to v0.2)
- [ ] Phase C Task 11: Rewrite `src/ui/settingsTab.ts` (Setting().setHeading, sentence-case, sections, dry-run toggle wiring) - per user's settings tab pick
- [ ] Phase C Task 10: Rewrite `src/ui/tagListView.ts` consuming `RuleEngine.getRuleAttribution` - per user's tag list pick
- [ ] Phase C Task 13: Rewrite `src/ui/ruleEditor.ts` consuming `safeRegex.validateSafeRegex` - per user's rule editor pick
- [ ] Phase C Task 12: Polish `styles.css` against the rebuilt DOM
- [ ] Remove the three ESLint ignore entries in `.eslintrc.cjs` as each Phase C task lands; keep `npm run lint` at 0 warnings
- [ ] Add a real screenshot to `README.md` (currently has a `<!-- screenshot placeholder -->` comment)
- [ ] Run the six-cell smoke matrix in `TESTING.md` (consider adding Minimal-theme cell per ecosystem-research.md)
- [ ] Tag `0.1.0` and push per runbook (confirm with user before `git push origin 0.1.0`)

## Deferred to v0.2+

- [ ] Style Settings integration (~50 lines CSS comments; 6 variables to expose - see ecosystem-research.md Part 4)
- [ ] Tag Wrangler menu composition (~30 lines + verify exact `tag-context` event name from source)
- [ ] Iconize coexistence test + "show icons for curated tags" setting
- [ ] Wizard rule creation UI (Option 13 from ui-options doc)
- [ ] Hover diagnostic tooltip (Option 15 - reuses `getRuleAttribution`)
- [ ] Examples library / common-patterns picker in rule editor
- [ ] QuickAdd command surface (declarative, ~10 lines)
- [ ] Lifecycle / command tests for `main.ts` (App / Notice / addCommand mocking)
- [ ] Push `main` (currently has the prior session log not yet pushed to origin/main)

## Deferred to v0.2+ requiring engine extension

- [ ] Compound criteria (Option 22): `MatchCriteria` -> `MatchNode` tree with AND/OR/NOT
- [ ] Multi-action palette (Option 25): implement flag/show-only/group/delegate-color/sort-to-bottom actions
- [ ] Co-occurrence rules (Option 27): per-tag co-occurrence data with lazy compute + cache
- [ ] Merge & alias workflow (Option 31): display-side alias collapse pass in observer (v0.3 scope per spec)

## Done

- [x] Initialize project structure (2026-05-04)
- [x] Author `docs/internal/release-plans/plan_v0.1.0.md` (2026-05-15 prior session)
- [x] Phase A foundation: types, settings, tagMeta, observer, engine, presets (2026-05-15 prior session)
- [x] Phase B infrastructure: manifest, release workflow, ESLint, README/CHANGELOG, lifecycle, panic disable (2026-05-15 prior session)
- [x] Path A: translate legacy UI files to new API surface (2026-05-15 prior session)
- [x] Vitest harness + `obsidian` module stub (2026-05-15 this session)
- [x] 79 unit tests across matchers / ruleEngine / presets / safeRegex / tagUtils / settings (2026-05-15)
- [x] Bug fix: v0->v1 schemaVersion now persists on first load (2026-05-15)
- [x] `RuleEngine.getRuleAttribution` engine helper for diagnostic UI (2026-05-15)
- [x] `TESTING.md` v0.1.0 six-cell smoke matrix + tagging runbook (2026-05-15)
- [x] Verified Tasks 7 (observer dry-run) and 9 (status bar click) already done in source (2026-05-15)
- [x] Self-review fix: schemaVersion guard now uses `<` so future-version files are not downgraded (2026-05-15)
- [x] `tsc --noEmit` typecheck CI gate added between lint and test (2026-05-15)
- [x] 17 happy-dom tests for `tagPaneObserver` covering hide / dry-run / ARIA / multi-pane / counts / clearAll (2026-05-15)
- [x] 18 tests for `tagMetaManager` covering load / scan / index / remove / rename / debounced persist / unload (2026-05-15)
- [x] Bug fix: `indexFile` now records BOTH inline and frontmatter sources when a tag appears in both (2026-05-15)
- [x] UI options doc expanded to 21 sections; Option 2 swapped from sidebar nav to top tabs (2026-05-15)
- [x] Ecosystem research doc covering UX patterns, 27-plugin compatibility matrix, Style Settings + Tag Wrangler integration deep dives (2026-05-16)
- [x] UI options doc expanded to 31 sections with engine-extension flag system for scope-gating (2026-05-16)
