import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Regression guard for a CSS gap that shipped through rc.1-7: TagPaneObserver
 * decorates `.tag-pane-tag` rows with `.tag-curator-hidden` (and
 * `.tag-curator-flagged` in preview mode), but styles.css carried hide rules
 * only for the NN, Properties, and Autocomplete scopes. The core tag-pane
 * class was inert, so the primary scope never hid on any platform. These rules
 * must exist or the tag pane silently no-ops.
 */
const css = readFileSync(resolve(process.cwd(), 'styles.css'), 'utf8');

describe('core tag-pane scope CSS', () => {
  it('collapses rows decorated with .tag-curator-hidden', () => {
    expect(css).toMatch(
      /\.tag-pane-tag\.tag-curator-hidden\b[^{]*\{[^}]*display:\s*none/,
    );
  });

  it('has a flag style for .tag-curator-flagged rows', () => {
    expect(css).toMatch(/\.tag-pane-tag\.tag-curator-flagged\b/);
  });
});
