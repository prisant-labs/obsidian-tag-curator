# TODO - claude

## Active

*Nothing currently in progress.*

## Up Next (blocked on user's UI screenshots)

- [ ] Phase C Task 11: Rewrite `src/ui/settingsTab.ts` (Setting().setHeading, sentence-case, sections, dry-run toggle wiring)
- [ ] Phase C Task 10: Rewrite `src/ui/tagListView.ts` (filter chips, diagnostic column consuming `getRuleAttribution`, hidden-only mode, `setHiddenOnly()` method)
- [ ] Phase C Task 13: Rewrite `src/ui/ruleEditor.ts` (action/scope selectors, regex safety feedback, live preview)
- [ ] Phase C Task 12: Polish `styles.css` against the rebuilt DOM
- [ ] Remove the three ESLint ignore entries in `.eslintrc.cjs` as each Phase C task lands; keep `npm run lint` at 0 warnings
- [ ] Add a real screenshot to `README.md` (currently has a `<!-- screenshot placeholder -->` comment)
- [ ] Run the six-cell smoke matrix in `TESTING.md`
- [ ] Tag `0.1.0` and push per runbook (confirm with user before `git push origin 0.1.0`)

## Deferred to v0.2+

- [ ] Lifecycle / command tests for `main.ts` (App / Notice / addCommand mocking + scenario coverage)
- [ ] Push `main` (currently has the prior session log not yet pushed to origin/main)

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
