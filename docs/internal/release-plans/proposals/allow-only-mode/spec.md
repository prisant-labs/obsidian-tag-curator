# Allow-Only Mode - Specification

| Field | Value |
|---|---|
| Status | **Draft / Unreleased** |
| GitHub issue | [#4](https://github.com/jprisant/obsidian-tag-curator/issues/4) |
| Target | v0.2 |
| Authors | Tag Curator team |
| Last updated | 2026-05-28 |

---

## 1. Vision

v0.1 ships **default mode**: rules name tags to **hide**, and unmatched tags stay visible.

Allow-only mode inverts that polarity for users with a curated taxonomy: **only tags that match at least one allow rule are shown**, and everything else is hidden by default. This treats unknown tags as drafts that need explicit acceptance into the taxonomy.

This is the smallest of the three proposed v0.2 features in terms of code, and possibly the largest in terms of UX shift for the right persona.

---

## 2. Use cases

| User says... | Allow-only solves it by... |
|---|---|
| "I want my tag pane to show only my curated 30 tags, not the 200 accidentals" | Configure 30 allow rules (or 1 allow rule with a list of 30 tags). Everything else hides. |
| "I'm treating new tags as drafts until I review them" | Allow-only + the v0.3 inbox panel together let the user triage new tags before they pollute the pane. |
| "I switch between writing mode (focused) and curation mode (everything visible)" | Profile + allow-only: writing mode = allow-only with 5 tags; curation mode = default with everything visible. |

---

## 3. Out of scope

- Per-rule mode override (rule-level "this rule is allow, this one is hide"). Mode is a plugin-level setting; rules can be configured for either polarity if the user changes mode.
- Inbox triage UI (the v0.3 panel; this proposal handles the engine half).
- Suggested taxonomy from past behavior (v0.4+).

---

## 4. Engine impact

Single-branch change in `src/engine/ruleEngine.ts`. The mode setting already exists in v0.1 (`Mode = 'default' | 'allow-only' | 'inbox'`). In allow-only mode, the evaluator treats every enabled rule as "this tag is permitted" and the absence of a match as "hide this tag."

```typescript
static evaluateTag(
  tag: string,
  tagMeta: TagMeta | undefined,
  rules: Rule[],
  mode: Mode,           // <-- new parameter, default 'default'
): MatchResult | null {
  const sortedRules = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => b.priority - a.priority);

  if (mode === 'allow-only') {
    // Find any matching rule. If matched: allow (no action). If unmatched: hide.
    const matched = sortedRules.find((rule) => TagMatcher.matches(tag, tagMeta, rule.match));
    if (matched) return null; // null = no effect (tag stays visible)
    return {
      matched: true,
      ruleId: '__allow-only-implicit',
      ruleName: 'Allow-only: unmatched tag',
    };
  }

  // Default mode (existing v0.1 behavior; Q-005 highest-priority wins)
  for (const rule of sortedRules) {
    if (TagMatcher.matches(tag, tagMeta, rule.match)) {
      return { matched: true, ruleId: rule.id, ruleName: rule.name };
    }
  }
  return null;
}
```

`getRuleAttribution` gets a parallel branch: in allow-only, the synthetic "unmatched tag" rule is attributed as the effective one with reason "not in any allow rule's match set."

---

## 5. UX surfaces

### 5.1 Settings > General: Mode dropdown

Already present in v0.1 with two options disabled. v0.2 enables Allow-only:

```
Mode
[Default (hide matched)        ▼]
  Default (hide matched)         (current behavior)
  Allow-only (show matched only) (v0.2)
  Inbox (v0.3, disabled)
```

A help icon next to the dropdown reveals a tooltip explaining the polarity flip with examples.

### 5.2 State banner variant

A third state-banner variant joins Preview and Off:

```
Allow-only mode is on. Only tags matching at least one rule are visible; all other tags are hidden. [Turn off allow-only]
```

The variant uses the same `state-banner` pattern with a new color (info-blue, distinct from amber-preview and muted-off). Banner action toggles `mode` back to `'default'`.

If both Preview AND Allow-only are on, the banner shows allow-only (it's the more impactful state) with a sub-line: "Preview mode is also on; matched tags are flagged, others are hidden."

### 5.3 Tag list view

When allow-only is on, every row's `Visible?` column shows:

- `shown` for tags matching an allow rule
- `hidden` for tags NOT matching (with rule attribution "Allow-only: unmatched tag")

The filter chips get a new option: **Hidden (allow-only)** which shows only tags that allow-only is hiding (the "unaccepted" set).

### 5.4 Rule editor

The Rule editor's right-docked preview shows mode-aware stats:

```
Preview · filtered to "My curated taxonomy"
  Unique tags: 30
  Total instances: 412
  -----
  ai, project, journal, meeting, ...
```

In default mode this still represents "what this rule hides." In allow-only mode it represents "what this rule allows." The preview header notes which mode is active.

### 5.5 Welcome modal

The first-run welcome modal does NOT prompt for allow-only. Users discover it through the Mode dropdown. v0.2.1 could add a third CTA "Start with strict curation (allow-only)" if user feedback warrants it.

### 5.6 Status bar

In allow-only mode, the copy shifts:

| State | Status bar text |
|---|---|
| default + enabled | `Tag Curator: 38 tags hidden` |
| default + preview | `Tag Curator (preview): 38 flagged` |
| **allow-only + enabled** | `Tag Curator (allow-only): 162 unaccepted` |
| **allow-only + preview** | `Tag Curator (allow-only, preview): 162 unaccepted (flagged)` |
| disabled | `Tag Curator: off` |

Click target unchanged (opens tag list filtered to hidden).

---

## 6. Migration

No schema change. The `mode` field already exists on settings; v0.1 stores `'default'` for everyone. v0.2 only changes the evaluator's branch behavior when `mode === 'allow-only'`.

Schema version stays v3 (or whatever is current at v0.2 release time). The other v0.2 proposals (aliases, scope expansion) bump schema; allow-only is a no-op there.

---

## 7. Edge cases

1. **No enabled rules + allow-only mode.** Every tag is unmatched, every tag is hidden. The state banner clearly says "0 rules allow tags; everything is hidden. [Add an allow rule] [Switch to default mode]."
2. **All tags match.** Allow-only mode silently has no visible effect. The status bar still reads `(allow-only): 0 unaccepted` so the user knows the mode is active.
3. **A rule's action is `hide` in allow-only mode.** The action is ignored. In allow-only, **matching** = allow. Users editing rules in this mode see a hint in the rule editor: "In allow-only mode, this rule's action is treated as 'allow'."
4. **Preview mode + allow-only mode.** Both can be on. Unmatched tags are flagged (not hidden) while preview is on. The state banner shows allow-only's variant with a sub-line about preview.
5. **Built-in preset rules in allow-only mode.** Presets like `Hide hex codes` describe a regex that catches noise. In allow-only mode, that regex now **permits** hex codes. Users almost always want to toggle off presets when switching to allow-only mode; the mode-switch dialog includes a hint about this.

---

## 8. Mode-switch dialog

Switching mode in Settings > General is a meaningful change, not a casual toggle. When the user switches **default -> allow-only**, a confirmation modal appears:

```
Switch to allow-only mode?

In allow-only mode:
  - Only tags matching at least one enabled rule are shown.
  - All other tags are hidden.

You currently have 3 enabled rules. They will permit ~38 tags. The other 162 will be hidden.

Hint: in allow-only mode, your noise-hiding presets like "Hide hex
codes" act backwards (they would PERMIT hex codes). Consider:
  - Toggle those presets off, OR
  - Switch back to default mode where they belong.

[Cancel]                            [Switch to allow-only]
```

Symmetric dialog for **allow-only -> default**.

This is a low-friction speed-bump, not a heavy gate: a single confirmation click commits the change.

---

## 9. Acceptance criteria

A v0.2 release containing this feature must:

- Settings > General mode dropdown allows the user to switch between Default and Allow-only (Inbox still disabled).
- Switching mode shows the confirmation dialog described in §8.
- State banner has a third variant (allow-only, info-blue) with `Turn off allow-only` action.
- Tag list view's `Visible?` column reflects allow-only attribution; `Hidden (allow-only)` filter chip added.
- Status bar copy reflects the new state combinations.
- Rule editor hints that actions are interpreted as "allow" in this mode.
- 4 new tests in `tests/ruleEngine.test.ts`: allow-only with no rules, with all matches, with mix, with disabled rules.
- 2 new state-banner tests verifying the third variant and the precedence (allow-only > preview > off).

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| User flips mode and is confused by the inversion | Confirmation dialog with concrete impact numbers; hint about preset interpretation. |
| Allow-only + preset noise-rules creates confusion | Documented in dialog + a callout in the Rule editor when a preset is enabled in allow-only mode. |
| State banner real-estate when allow-only + preview both on | Single banner, two-line layout: allow-only as primary, preview as secondary line. |
| Mobile UX for mode dropdown | Same dropdown component; tested in cell 4 of the BRAT matrix. |

---

## 11. References

- v0.1 spec §5.2 (Modes - allow-only described, deferred)
- v0.1 spec §9 (Roadmap: allow-only in v0.2)
- D-007 in `scope-and-decisions.md` (state banner pattern; this proposal adds a variant)
- Q-005 in `scope-and-decisions.md` (rule precedence; same behavior in default mode)
- GitHub issue [#4](https://github.com/jprisant/obsidian-tag-curator/issues/4)
