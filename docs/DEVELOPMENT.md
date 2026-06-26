# Development Guide

This document explains the architecture, module structure, and development patterns used in Tag Curator.

## Project Structure

```
src/
  engine/          # Core rule matching and evaluation logic
    matchers.ts    # Tag matching implementations (regex, frequency, list-based)
    ruleEngine.ts  # Rule priority evaluation and decision-making
    presets.ts     # Built-in rule definitions
  observers/       # DOM and vault observation
    tagPaneObserver.ts # Tag pane monitoring and filtering
  storage/         # Data persistence and state management
    settings.ts    # Plugin settings (enable/disable, mode selection)
    tagMeta.ts     # Tag metadata tracking (count, sources, dates)
  ui/              # User interface components
    settingsTab.ts # Settings panel UI
    ruleEditor.ts  # Modal for creating/editing custom rules
    tagListView.ts # Sortable tag table view
  types.ts         # TypeScript interfaces and types
  main.ts          # Plugin initialization and lifecycle
styles.css         # Styling for UI components
```

## Core Concepts

### Rule Evaluation

Tags are evaluated against active rules using a **highest-priority-match-wins** strategy:

1. Enabled rules are sorted by `priority` descending (highest first).
2. Each rule tests if its criteria match the tag.
3. The **first** matching rule (= the highest-priority match) determines visibility.
4. If no rules match, the default behavior applies.

> An earlier implementation sorted priority-descending but then kept the **last** match in the loop, which inverted the semantics to lowest-priority-wins. That was a silent bug; it was fixed 2026-05-28.
>
> For v0.1 the priority value is **hidden from the UI** (D-009): new custom rules default to `priority: 50`; built-in presets keep their values (80-100). v0.2 will surface a drag-to-reorder card list (B012).

### Three Match Types

- **Regex**: Match against tag name using regular expressions
- **Frequency**: Match based on tag usage count (1, 2, 5+, etc.)
- **List**: Explicit whitelist/blacklist of specific tags

### DOM-Based Filtering

Tag Curator filters tags at the DOM level:

1. Obsidian renders the tag pane
2. TagPaneObserver monitors for tag elements
3. Matched tags are hidden via `display: none` CSS
4. Note content and metadata are never modified

This approach ensures full reversibility: uninstalling the plugin immediately restores all tags.

## Adding New Features

### Adding a New Match Type

1. Define the interface in `types.ts`:
   ```typescript
   interface YourCriteria {
     type: 'your-type';
     // ... criteria fields
   }
   ```

2. Implement the matcher in `engine/matchers.ts`:
   ```typescript
   export function matchYourType(tag: string, criteria: YourCriteria): boolean {
     // Your matching logic
   }
   ```

3. Update `ruleEngine.ts` to handle the new type in the evaluation switch statement

4. Add UI in `ui/ruleEditor.ts` for creating/editing rules of this type

### Adding a New Scope (e.g., Graph View)

v0.2 will expand filtering to new UI areas:

1. Create a new observer in `observers/` (e.g., `graphViewObserver.ts`)
2. Implement the same mutation/event monitoring pattern as `tagPaneObserver.ts`
3. Register the observer in `main.ts` plugin lifecycle
4. Test extensively to ensure no performance impact

### Adding a New Action (e.g., Flag, Group)

1. Extend the `RuleAction` type in `types.ts`
2. Implement the action logic in `tagPaneObserver.ts` (for current scope)
3. Add UI controls in `ui/settingsTab.ts` and `ui/ruleEditor.ts`
4. Update rule evaluation to apply the new action

## Development Patterns

### Debounced Persistence

Tag metadata is saved to disk with debouncing:

```typescript
private debounceMetadataChange(): void {
  if (this.saveTimeout) clearTimeout(this.saveTimeout);
  this.saveTimeout = setTimeout(() => this.saveMetadata(), 5000);
}
```

This prevents excessive disk writes while editing.

### Reactive Updates

Settings and metadata changes trigger UI updates:

```typescript
// Notify subscribers of changes
this.onMetadataChanged?.();
```

Components listen for changes and re-render as needed.

### Type Safety

All rule data is strongly typed in `types.ts`. ESLint with TypeScript strict mode ensures type safety.

## Testing Your Changes

1. Build the plugin: `npm run build`
2. Copy `main.js` and `manifest.json` to a test vault's `.obsidian/plugins/obsidian-tag-curator/`
3. Reload plugins in Obsidian
4. Test your changes in the test vault
5. Check browser console for errors (Ctrl+Shift+I in development builds)

## Debugging

Enable debug logging in settings to see rule evaluation traces in the console.

## Code Quality

- **ESLint**: Run `npm run lint` to check for code quality issues
- **Conventional Commits**: Use `feat:`, `fix:`, `docs:`, etc. in commit messages
- **TypeScript Strict Mode**: All code must pass type checking

## Next Steps for v0.2

See [README.md](README.md#roadmap) for the v0.2 feature list. Key areas:

- **Graph View Scope**: Expand filtering to the graph view
- **Autocomplete Scope**: Filter tags in note creation autocomplete
- **Tag Metadata Panels**: Show recently created, orphan, and stale tags
- **Allow-only Mode**: Invert logic (show only matched tags)

## Questions?

Open an issue or discussion on GitHub with your questions or ideas.
