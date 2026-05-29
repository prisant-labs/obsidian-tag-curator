# Allow-Only Mode - Implementation Plan

| Field | Value |
|---|---|
| Status | **Draft / Unreleased** |
| GitHub issue | [#4](https://github.com/jprisant/obsidian-tag-curator/issues/4) |
| Companion docs | `spec.md`, `ui.html` |
| Estimated effort | 2 to 3 working days |
| Owner | TBD |

---

## Goal

Light up allow-only mode end-to-end: engine branch, state banner variant, mode-switch dialog, UI affordances. Smallest of the three v0.2 features by code, biggest UX shift for the curated-taxonomy persona.

---

## Phased build order

| Phase | Title | Files | Tests | Days |
|---|---|---|---|---|
| 1 | Engine + tests | `src/engine/ruleEngine.ts`, `tests/ruleEngine.test.ts` | 4 new mode-aware tests | 0.5 |
| 2 | State banner variant | `src/ui/stateBanner.ts`, `styles.css` | 2 new tests | 0.5 |
| 3 | Mode-switch dialog | `src/ui/settingsTab.ts`, `src/ui/modeSwitchModal.ts` (new) | manual | 0.5 |
| 4 | Tag list view + status bar | `src/ui/tagListView.ts`, `src/main.ts` | smoke | 0.5 |
| 5 | Rule editor mode hint | `src/ui/ruleEditor.ts` | smoke | 0.25 |
| 6 | Docs + CHANGELOG | spec, README, CHANGELOG | none | 0.25 |
| 7 | BRAT smoke | TESTING.md additions; matrix | matrix | 0.5 |

---

## Phase 1: Engine + tests (~0.5 day)

### 1.1 Pass mode into evaluator

Update `src/engine/ruleEngine.ts` to accept `mode: Mode` in `evaluateTag` and `getRuleAttribution`:

```typescript
import { Mode } from '../types';

static evaluateTag(
  tag: string,
  tagMeta: TagMeta | undefined,
  rules: Rule[],
  mode: Mode = 'default',
): MatchResult | null {
  const sortedRules = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => b.priority - a.priority);

  if (mode === 'allow-only') {
    const anyMatch = sortedRules.find((rule) =>
      TagMatcher.matches(tag, tagMeta, rule.match)
    );
    if (anyMatch) return null;
    return {
      matched: true,
      ruleId: '__allow-only-implicit',
      ruleName: 'Allow-only: unmatched tag',
    };
  }

  for (const rule of sortedRules) {
    if (TagMatcher.matches(tag, tagMeta, rule.match)) {
      return {
        matched: true,
        ruleId: rule.id,
        ruleName: rule.name,
      };
    }
  }
  return null;
}
```

Update every caller in `src/main.ts`, `src/observers/tagPaneObserver.ts`, `src/ui/tagListView.ts`, `src/ui/settingsTab.ts`, `src/ui/ruleEditor.ts` to pass `settings.mode` through.

### 1.2 Update getRuleAttribution

```typescript
static getRuleAttribution(tag, tagMeta, rules, mode: Mode = 'default'): RuleAttribution {
  // ... same sort ...
  if (mode === 'allow-only') {
    const anyMatch = sortedRules.find((rule) => TagMatcher.matches(tag, tagMeta, rule.match));
    if (anyMatch) {
      return { tag, effective: null, allMatches: [] };
    }
    return {
      tag,
      effective: {
        ruleId: '__allow-only-implicit',
        ruleName: 'Allow-only: unmatched tag',
        action: 'hide',
        scopes: ['tag-pane'],
        priority: 0,
        builtin: false,
        reason: 'no enabled rule allows this tag',
      },
      allMatches: [],
    };
  }
  // ... existing default branch ...
}
```

### 1.3 Tests

`tests/ruleEngine.test.ts` - add a new describe block:

```typescript
describe('RuleEngine.evaluateTag - allow-only mode', () => {
  it('hides every tag when no rules are enabled', () => { ... });
  it('hides tags not matching any enabled rule', () => { ... });
  it('shows tags matching at least one enabled rule', () => { ... });
  it('respects disabled rules (does not count them as allow)', () => { ... });
  it('attribution.effective points to the synthetic implicit rule for unmatched tags', () => { ... });
});
```

---

## Phase 2: State banner variant (~0.5 day)

### 2.1 New variant in stateBanner.ts

Update `src/ui/stateBanner.ts` to handle a third variant. Banner precedence: `allow-only` > `preview` > `off` > none.

```typescript
private render(): void {
  if (!this.root) return;
  const s = this.plugin.settingsManager.get();
  let variant: 'preview' | 'off' | 'allow-only' | null = null;
  if (!s.enabled) variant = 'off';
  else if (s.mode === 'allow-only') variant = 'allow-only';
  else if (s.previewMode) variant = 'preview';

  // ... render with the appropriate copy + action ...
}
```

For allow-only:

```typescript
if (variant === 'allow-only') {
  msg.createEl('strong', { text: 'Allow-only mode is on. ' });
  msg.appendText('Only tags matching at least one enabled rule are visible; all other tags are hidden.');
  if (s.previewMode) {
    const sub = this.root.createDiv({ cls: 'sb-sub' });
    sub.setText('Preview mode is also on; unmatched tags are flagged, not hidden.');
  }
  action.setText('Turn off allow-only');
  action.addEventListener('click', () => {
    void this.plugin.settingsManager.update({ mode: 'default' });
  });
}
```

### 2.2 CSS

Add a third banner variant:

```css
.tag-curator-state-banner[data-variant="allow-only"] {
  background: rgba(96, 165, 250, 0.08);
}
.tag-curator-state-banner[data-variant="allow-only"] .sb-ic {
  background: #60a5fa;
  color: var(--background-primary);
}
.tag-curator-state-banner[data-variant="allow-only"] .sb-msg {
  color: #93c5fd;
}
.tag-curator-state-banner .sb-sub {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 4px;
  width: 100%;
}
```

### 2.3 Tests

Extend banner test suite (new file or extend `tests/stateBanner.test.ts` if it exists in v0.2 by then):

- variant === 'allow-only' renders the right copy + action
- precedence: allow-only renders even when preview is also on; sub-line appears

---

## Phase 3: Mode-switch dialog (~0.5 day)

### 3.1 New file

Create `src/ui/modeSwitchModal.ts`:

```typescript
import { App, Modal } from 'obsidian';
import TagCuratorPlugin from '../main';

export class ModeSwitchModal extends Modal {
  constructor(
    app: App,
    private plugin: TagCuratorPlugin,
    private fromMode: 'default' | 'allow-only',
    private toMode: 'default' | 'allow-only',
    private onConfirm: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    // Render the dialog described in spec §8.
    // Calculate enabled rule count and projected impact (count of allowed tags).
    // Two buttons: Cancel, Switch to {toMode}.
  }
}
```

### 3.2 Settings tab integration

In `src/ui/settingsTab.ts`, the Mode dropdown's `onChange` is gated by the modal:

```typescript
.addDropdown((d) => {
  d.addOption('default', 'Default (hide matched)')
    .addOption('allow-only', 'Allow-only (show matched only)')
    .addOption('inbox', 'Inbox (v0.3)')
    .setValue(s.mode)
    .onChange((v) => {
      const next = v as Mode;
      if (next === 'inbox') return; // not implemented
      if (next === s.mode) return;
      new ModeSwitchModal(this.app, this.plugin, s.mode, next, async () => {
        await this.plugin.settingsManager.update({ mode: next });
        this.display();
      }).open();
    });
});
```

---

## Phase 4: Tag list view + status bar (~0.5 day)

### 4.1 Tag list view

`src/ui/tagListView.ts`:

- Pass `settings.mode` into `getRuleAttribution`.
- Add a new filter chip when mode === 'allow-only': **Hidden (allow-only)**.
- The `Visible?` column for unmatched tags shows `hidden` with rule attribution `Allow-only: unmatched tag`.

### 4.2 Status bar

`src/main.ts` `refreshStatusBar`:

```typescript
private refreshStatusBar(): void {
  if (!this.statusBarEl) return;
  const s = this.settingsManager.get();
  if (!s.enabled) { this.statusBarEl.setText('Tag Curator: off'); return; }

  const hidden = this.tagPaneObserver.countHidden();
  const flagged = this.tagPaneObserver.countFlagged();

  if (s.mode === 'allow-only') {
    const suffix = s.previewMode
      ? ` (allow-only, preview): ${flagged} unaccepted (flagged)`
      : ` (allow-only): ${hidden} unaccepted`;
    this.statusBarEl.setText('Tag Curator' + suffix);
    return;
  }

  if (s.previewMode) {
    this.statusBarEl.setText(`Tag Curator (preview): ${flagged} flagged`);
    return;
  }
  this.statusBarEl.setText(
    hidden === 1 ? 'Tag Curator: 1 tag hidden' : `Tag Curator: ${hidden} tags hidden`
  );
}
```

---

## Phase 5: Rule editor mode hint (~0.25 day)

In `src/ui/ruleEditor.ts` edit mode, add a context hint when `mode === 'allow-only'`:

```
[Mode: allow-only] In this mode, this rule's action is treated as "allow."
The Then section's Action dropdown is informational.
```

The hint appears as a small callout above the Then section. The Action dropdown is left enabled but disabled-looking (greyed) with a tooltip explaining the behavior.

---

## Phase 6: Docs + CHANGELOG (~0.25 day)

- Spec `§5.2` Modes: remove the "Allow-only: deferred" annotation; describe v0.2 behavior + the mode-switch dialog.
- README "Modes" section: add Allow-only as a shipped option.
- CHANGELOG: v0.2 entry.
- `scope-and-decisions.md`: add a D-ID for the banner precedence decision (allow-only > preview > off).

---

## Phase 7: BRAT smoke (~0.5 day)

Extend `TESTING.md` with section "18. Allow-only mode":

- Switching from default to allow-only opens the confirmation dialog.
- Confirming the switch applies allow-only behavior + the state banner appears.
- Tag list view's `Visible?` column shows `hidden` for unmatched tags.
- Status bar copy changes to `(allow-only): N unaccepted`.
- Preview + allow-only simultaneously: banner sub-line appears.
- Switching back to default opens the symmetric dialog + restores default behavior.
- Mobile (cell 4): mode dropdown is usable.

Walk the 6-cell BRAT matrix.

---

## Risks & open questions

1. **Where does the implicit rule attribution show up.** The synthetic `__allow-only-implicit` rule appears in the Rule column of the tag list. Users may wonder what "Allow-only: unmatched tag" means; we rely on the state banner + the mode-switch dialog to set context.
2. **Backwards compat for users with allow-only saved in `data.json` (unlikely)**. Settings already accepts the type; no migration needed.
3. **Welcome modal copy**. Current copy says "Tag Curator hides matched tags." In allow-only this is wrong. Defer adding a third CTA to v0.2.1; users discover the mode via Settings.

---

## Rollout

After Phase 7:

1. Merge `release/v0.2.0-allow-only` -> `release/v0.2.0`.
2. Final v0.2.0 release is gated on all three v0.2 features (aliases + scope expansion + allow-only).
3. CHANGELOG and README updated as part of release prep.

This proposal is the simplest of the three; it ships independently in any release that picks it up.
