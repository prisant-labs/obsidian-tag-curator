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
- [ ] Last-match-wins strategy works (last matching rule determines visibility)

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

1. Run `npm run lint` - verify no errors, max 24 warnings acceptable
2. Run `npm run build` - verify successful build
3. Test on both small and medium vaults
4. Verify GitHub Actions CI/CD passes
5. Check that all presets work as documented
6. Verify "Tag list view" command works
7. Test custom rule creation end-to-end
8. Confirm no console errors
9. Update CHANGELOG.md with new features/fixes
10. Update manifest.json version if needed

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
