# UI Options Review Log - 2026-05-28

Review of `ui-options_v0.1.0.html` (the 31-option exploration), captured from the crit session on 28 May 2026. Each entry pairs the reviewer's comment with the response and an honest status of whether the follow-up design (`ui-design_v0.1.0_converged.html`) actually honored it.

**Reviewer:** jprisant
**Source file:** `docs/internal/release-plans/plan_v0.1.0/ui-options_v0.1.0.html` (unmodified, by request)
**Follow-up file:** `docs/internal/release-plans/plan_v0.1.0/ui-design_v0.1.0_converged.html`

## Status legend

- **Honored** - reflected in the converged design as asked.
- **Answered** - a question; answered, no design change required.
- **Partial** - acknowledged but the execution did not fully deliver; needs more work.
- **Deferred** - agreed, but parked to v0.2/v0.3 (see backlog + scope-and-decisions.md).
- **Cut** - agreed to drop.

## Meta instruction

> **Pin 1:** "Do not modify this html file. I want to point out the things I like for you to assimilate it into a new html file that iterates updated designs."

**Response:** Left the original untouched; built a new converged file. **Status: Honored.**

## Entries (by pin)

| Pin | Surface | Reviewer comment | Response | Status |
|-----|---------|------------------|----------|--------|
| 2 | Settings | "I like having tabs" | Top-tabs are the Settings shell. | Honored |
| 3 | Settings | "I like ... general stats at the top of the general tab" | 4-card stats header on General. | Honored |
| 4 | Settings | Panic disable: "great idea ... needs to be clear what this does" | Added a warning callout explaining it removes all DOM effects, disables, is reversible. | Honored |
| 5 | Settings | "I like build-in presets a lot. In the spec doc, create a list of the most important presets" | Added 5-preset table to spec 5.1 (+ 3 deferred). | Honored |
| 6 | Tag list | Opts 3/4 need multi-select incl. select-all (page vs full list when paginated) | Checkboxes + select-all menu (this page / all matches). | Honored |
| 7 | Rule editor | "curious about ... performance reality ... thousands of tags" | Row-based + virtualized; sort/filter on in-memory map. | Honored |
| 8 | Diagnostics | "I don't fully understand this" (status bar variants) | Clarified: shows hidden count, click opens hidden filter. Rendered a status bar. | Answered |
| 9 | Tag list | Grouped-by-rule "would be funky if a tag is in multiple rules?" | Explained effective-rule (last-match-wins) + allMatches. **But I did not actually design the grouped view** - only the flat list. | Partial |
| 10 | Tag list | "definitely need bulk action functionality" | Bulk-actions bar. | Honored |
| 11 | Tag list | Tag detail sheet: "could get hefty and require a lot of clicks" | Deferred to v0.2 (B009); v0.1 shows data inline in the row. | Deferred |
| 13 | Tag list | "I assume there is no data for this? ... DB or file last-modified/created?" | The plugin's own `tags.json` sidecar; first-seen = first index, not file date. | Answered |
| 14 | Rule editor | Inline editor "could get a bit clunky vs. some of your prior approaches" | Claimed single-expand mitigation. **New feedback (image, 28 May): the inline field IA is poor and pills are hard to eyeball. Not honored - needs redesign.** | Partial |
| 15 | Rule editor | "A thoughtful wizard would be incredible" | Added a wizard as variant B / new-rule path - **but only a stub, not a thoughtful flow.** | Partial |
| 16 | Diagnostics | "Is dry-run essentially preview mode ... preview probably makes more sense" | Renamed UI label to "Preview mode" (internal `dryRun` unchanged). | Honored |
| 17 | Diagnostics | Tag-pane row badge: paired with dry-run | Not foregrounded in v0.1 primary; row-level diagnostic lives in tag list. | Deferred |
| 18 | Diagnostics | Context menu "pattern is becoming more common ... greatly useful" | Noted native `Menu` pattern; not in v0.1 primary. | Deferred |
| (15-opt) | Diagnostics | Hover tooltip "creative, but ... not as scalable" | Dropped as a primary surface. | Cut |
| (16-opt) | Diagnostics | Context menu "could potentially be a pattern ... not sure" | Native menu, v0.2 candidate. | Deferred |
| 19 | Onboarding | First-run welcome modal: "This is great" | Kept as section 4. | Honored |
| 20 | Commands | "In the specs, make sure to include each command palette option and the functionality" | Added 6-command table to spec 5.10 + Commands tab. | Honored |
| 20-A | Diagnostics | "Is there ... built-in regex library obsidian offers ... so it doesn't have to be bundled?" | No library bundled; native JS `RegExp` via `compileSafeRegex` (guards lookbehind). | Answered |
| 21 | Commands | Density toggle: "Nice to have, not v1. Add to backlog." | Backlog B003, v0.2. | Deferred |
| 22 | Adv. composition | Compound builder: drag-drop "difficult ... not good for v1"; prefer row-based; "Excluded by NOT clause would be confusing" | Deferred B001/B002; tag list is row-based; NOT logic only with compound builder later. | Deferred |
| 23 | Adv. composition | Impact preview: "should ... be one of the toggle-able, uneditable presets. Should there be exclusions?" | Orphan rule already IS a builtin toggleable preset; exclusions need NOT logic (compound builder, v0.2). | Answered / Deferred |
| 24 | Adv. composition | Conflict resolver: "functionality and UI would be quite complex?" | Deferred B008; reuses `allMatches`; only shown when conflicts exist. | Deferred |
| 26 | Lifecycle | Hierarchy cascade: "Can we detect ... if any of these are in use?" | Yes - per-tag `count` > 0. Deferred B010 with a hierarchy index. | Answered / Deferred |
| 27 | Onboarding | "first-run will require ... index all tags? ... piggyback obsidian or build our own?" | Piggybacks `metadataCache` for discovery; only date/count history is our sidecar. | Answered |
| 28 | Onboarding | "Should this detect popular plugins ... bespoke integration ... how the integration works?" | Modal shows detected integrations; full detection logic = B004. | Partial |
| 29 | Potential | Rule library/gallery: "install then enabled?" | Yes, two-step. Deferred B005, v0.3. | Answered / Deferred |
| 30 | Potential | Analytics dashboard: "I really like having this!" | Kept as "liked"; deferred v0.3 (B007) only to avoid feature creep; data already exists. | Deferred (liked) |
| 31 | Potential | Merge/alias: "merging ... is more of a visual thing ... doesn't modify files, right?" | Confirmed display-only; rename delegated to Tag Wrangler. B006, v0.3. | Answered / Deferred |
| (2174fa) | Settings | Inline settings search: "becoming more common ... greatly useful / helpful" | Carried the pattern into the tag-list filter; **declined a dedicated settings search. Given the strong endorsement, this deserves reconsideration.** | Partial |

## Honest self-assessment

The converged pass did well on structural likes (tabs, stats, presets, bulk actions, preview rename, welcome modal) and on answering the technical questions. It fell short on the items that needed real design thinking rather than a bucket:

1. **Rule editor inline IA (pin 14)** - the biggest miss. The 2-column field grid has no logical top-to-bottom process, and the affected-tags pill cloud is hard to scan. Tracked as an open decision in `scope-and-decisions.md`.
2. **Wizard (pin 15)** - shipped as a stub, not the "thoughtful wizard" requested.
3. **Grouped-by-rule view (pin 9)** - answered the multi-rule question but never designed the view itself.
4. **Settings search (pin 2174fa)** - dismissed despite a clear endorsement.

These are now open items with context, approaches, and recommendations in the master doc.
