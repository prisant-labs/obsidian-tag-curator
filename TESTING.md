# Testing Guide

This document explains how to test Tag Curator locally and what to verify before releases.

## Local Testing Setup

### Prerequisites

- Obsidian (latest stable version)
- A test vault (separate from your main vault)
- Node.js 18+ and npm

### Build and Install

1. Clone the repository: `git clone https://github.com/jprisant/obsidian-tag-curator.git`
2. Install dependencies: `npm ci`
3. Build the plugin: `npm run build`
4. Copy artifacts to test vault:
   ```bash
   mkdir -p /path/to/test-vault/.obsidian/plugins/obsidian-tag-curator
   cp main.js manifest.json /path/to/test-vault/.obsidian/plugins/obsidian-tag-curator/
   ```
5. Reload plugins in Obsidian settings (toggle off and on)
6. Enable Tag Curator in Obsidian settings

## Testing Checklist

### Core Functionality

- [ ] Plugin loads without errors
- [ ] Settings tab appears under "Plugins"
- [ ] All 5 preset rules are toggleable
- [ ] Rule enable/disable immediately affects tag pane
- [ ] Tag pane updates when rules are toggled
- [ ] "Open tag list view" command works
- [ ] Tag list view shows all tags with counts
- [ ] Tag list view is searchable and sortable

### Preset Rules

Test each preset rule with real vault data:

- [ ] **Hide hex color codes** - Removes tags like #FF00AA, #abc123
- [ ] **Hide URL anchors** - Removes tags like #section-1, #top
- [ ] **Hide single-character tags** - Removes tags like #a, #x
- [ ] **Hide orphan tags** - Removes tags with count = 1
- [ ] **Hide pure numeric tags** - Removes tags like #123, #4567

### Custom Rules

- [ ] Can create a new custom rule (+ New Rule button)
- [ ] Regex match type works (test with pattern `^temp-|^draft-`)
- [ ] Frequency match type works (test with <= 2)
- [ ] List match type works (test with 3-4 explicit tags)
- [ ] Rule test field shows "Would match!" correctly
- [ ] Rules can be edited (pencil icon)
- [ ] Rules can be deleted (trash icon)
- [ ] Disabled rules don't affect tag visibility
- [ ] Multiple rules can exist together
- [ ] Highest-priority-match-wins strategy works (the highest-priority enabled rule matching a tag determines visibility; create two rules at priority 100 and 50 that both match the same tag and verify the priority-100 rule attributes as the effective rule; Q-005)

### UI/UX

- [ ] Settings tab loads quickly
- [ ] No console errors (Ctrl+Shift+I)
- [ ] Tag pane updates smoothly when rules change
- [ ] No lag when toggling presets
- [ ] Modal dialogs open/close smoothly
- [ ] Text inputs are responsive
- [ ] Buttons are clearly clickable
- [ ] Rule examples are helpful

### Edge Cases

- [ ] Plugin works with 0 tags (empty vault)
- [ ] Plugin works with 1000+ tags (large vault)
- [ ] Regex patterns with special characters work
- [ ] Empty rule list (all rules disabled) shows all tags
- [ ] Toggling presets on/off doesn't error
- [ ] Switching between modes in settings works
- [ ] Debug logging can be toggled on/off

### File Safety

- [ ] No note files are modified
- [ ] No `.obsidian/` metadata is modified
- [ ] Uninstalling plugin restores all tags immediately
- [ ] Re-installing plugin shows same rules (if config persisted)

### Performance

- [ ] Tag pane loads quickly with 100+ tags
- [ ] No noticeable lag when typing in note
- [ ] No CPU spike when vault has 1000+ notes
- [ ] No memory leak over extended use (check Obsidian memory usage)

## Testing Different Vault Sizes

Create test vaults to verify performance:

### Small Vault
- 10-20 notes
- 20-30 tags
- Expected: Plugin loads instantly, tag pane responsive

### Medium Vault
- 100-500 notes
- 200-500 tags
- Expected: No perceptible lag, smooth UI

### Large Vault
- 1000+ notes
- 500-1000+ tags
- Expected: Tag pane may take 1-2 seconds to render, but no freezing

## Debugging

### Enable Debug Logging

1. Open Tag Curator settings
2. Check "Debug logging" checkbox
3. Open browser console (Ctrl+Shift+I)
4. Look for rule evaluation traces

### Common Issues

**Tags still showing after enabling a rule?**
- Check rule is actually enabled (toggle should be ON)
- Open tag list view and verify tag status shows "Hidden"
- Use rule test field to verify pattern matches
- Check browser console for errors

**Rule not matching as expected?**
- Use "Test Tag" field in rule editor
- For regex rules, test in https://regex101.com separately
- Check that tag name matches exactly (case-sensitive)

**Performance issues?**
- Disable unused presets and rules
- Simplify regex patterns
- Check how many tags match each rule
- Monitor CPU usage in Obsidian

## Pre-Release Testing

Before creating a release:

1. Run `npm run lint` - must pass with zero warnings (`--max-warnings 0`)
2. Run `npm test` - all unit tests must pass
3. Run `npm run build` - verify successful build
4. Walk the v0.1.0 smoke matrix below (six cells)
5. Verify GitHub Actions CI/CD passes
6. Confirm no console errors during smoke runs
7. Update CHANGELOG.md with new features/fixes
8. Update manifest.json + versions.json version if needed

## v0.1.0 Smoke Test (BRAT pre-release)

Per `docs/internal/release-plans/plan_v0.1.0.md` Task 18, walk the six cells below before tagging. Implementation plan §7.5 specifies a 24-cell sweep for the v0.3+ community-plugin-directory submission; six cells is the v0.1 BRAT release threshold.

| # | Vault size | Platform | Theme | Companion plugins |
|---|---|---|---|---|
| 1 | Small (10-20 notes) | Win11 desktop | Default dark | None |
| 2 | Small (10-20 notes) | Win11 desktop | Default light | None |
| 3 | Medium (200+ notes) | macOS or Linux | Default dark | Tag Wrangler enabled |
| 4 | Medium (200+ notes) | iOS (Obsidian Mobile) | Default | None |
| 5 | Large (~10k notes synthetic) | Win11 desktop | Default dark | None |
| 6 | Empty vault (0 notes) | Win11 desktop | Default | None |

For each cell, verify all ten:

1. Plugin loads with zero console errors.
2. All five presets toggle without errors.
3. "Hide hex color codes" preset hides at least one `#FFAA00`-style tag created in a test note.
4. Status bar updates as rules are toggled (count reflects current hidden total).
5. "Tag Curator: Open tag list view" command opens, sorts, and search-filters.
6. Clicking the status bar opens the tag list (Phase C will add the auto-filter to hidden-only).
7. "Tag Curator: Panic disable" removes all hidden styling immediately and persists `enabled: false`.
8. "Tag Curator: Toggle enable" cycles cleanly on and off.
9. After plugin disable from Community Plugins, every tag is visible again.
10. After re-enable, hidden tags return as expected without a reload.

If any cell fails, fix and re-run that cell before tagging. Use the "Common Issues" section above to triage.

### Tagging the release

After all six cells pass:

```bash
git status --short                          # must be empty
git checkout main
git merge --no-ff release/v0.1.0 -m "release: v0.1.0"
git tag 0.1.0
```

Do not push the tag automatically. Confirm with the user before:

```bash
git push origin main
git push origin 0.1.0
```

The tag push triggers `.github/workflows/release.yml`, which uploads `manifest.json`, `main.js`, `styles.css`, and `versions.json` to the GitHub release.

## Reporting Issues

If you find issues during testing:

1. Note the exact steps to reproduce
2. Include vault size (number of notes/tags)
3. Share browser console errors
4. Describe expected vs actual behavior
5. Open a GitHub Issue with this information

## Testing on Different Systems

Test on both:
- Windows with Obsidian
- macOS with Obsidian
- Linux with Obsidian (if available)

Verify that tag pane and rules work identically across platforms.
