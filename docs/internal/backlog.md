# Backlog

| ID | Title | Type | Status | GH | Release |
|----|-------|------|--------|----|---------|
| B001 | Compound criteria builder (AND/OR/NOT criterion tree) | Feature | Deferred | - | v0.2 |
| B002 | Drag-drop rule composition canvas | Feature | Deferred | - | v0.2 |
| B003 | Density toggle (compact / comfortable / spacious) for tag list rows | Enhancement | Deferred | - | v0.2 |
| B004 | Plugin-integration detection in welcome modal (Tag Wrangler, Notebook Navigator, etc.) | Feature | Deferred | - | v0.2 |
| B005 | Rule library / preset gallery (import packs, then enable) | Feature | Deferred | - | v0.3 |
| B006 | Merge & alias workflow (display-only fold, rename delegated to Tag Wrangler) | Feature | Deferred | - | v0.3 |
| B007 | Tag analytics dashboard (growth/decay/orphan trends from TagMeta) | Feature | Deferred | - | v0.3 |
| B008 | Conflict resolver view (inline priority editing for multi-rule tags) | Feature | Deferred | - | v0.2 |
| B009 | Tag detail sheet (full per-tag metadata + attribution + occurrences) | Feature | Deferred | - | v0.2 |
| B010 | Hierarchy cascade toggle (rule applies to child tags, with in-use detection) | Feature | Deferred | - | v0.2 |
| B011 | File-extension match type (filter rules to tags in specific file types: `.canvas`, `.excalidraw`, etc.) | Feature | Deferred | - | v0.2 |
| B012 | Drag-to-reorder rules in the card view (visible priority lights up) | Enhancement | Deferred | - | v0.2 |

## Notes

- B001/B002 deferred from v0.1 UI review: drag-drop + nested logic judged too complex for v1; row-based, click-sortable lists preferred for scanning. Revisit once the v0.1 single-criterion contract is stable.
- B007 (analytics dashboard) was explicitly liked in review but defers to v0.3 to avoid feature creep; all data derives from existing `TagMeta.firstSeen/lastSeen/count`.
- B006 confirmed display-only: folding alias rows never modifies note content; the actual rename is delegated to Tag Wrangler.
