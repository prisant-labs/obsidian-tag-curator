/**
 * Core rule evaluation engine
 */

import {
  AttributedMatch,
  MatchCriteria,
  MatchResult,
  Rule,
  RuleAttribution,
  TagMeta,
  TagOverride,
} from '../types';
import { TagMatcher } from './matchers';

/**
 * Build an AttributedMatch that represents a per-tag override (D-015) rather
 * than a rule. Carries the overrideReason discriminator so callers can tell the
 * effective reason is an always-show / always-hide pin, while still returning
 * the existing RuleAttribution shape every consumer already handles.
 */
function attributeOverride(value: TagOverride): AttributedMatch {
  const showing = value === 'show';
  return {
    ruleId: '__override__',
    ruleName: showing ? 'Always show' : 'Always hide',
    // An always-show pin keeps the tag visible (show-only semantics); an
    // always-hide pin hides it.
    action: showing ? 'show-only' : 'hide',
    scopes: [],
    priority: Number.POSITIVE_INFINITY,
    builtin: false,
    reason: showing ? 'pinned to always show' : 'pinned to always hide',
    overrideReason: showing ? 'always-show' : 'always-hide',
  };
}

function describeReason(criteria: MatchCriteria, tagMeta: TagMeta | undefined): string {
  switch (criteria.type) {
    case 'regex':
      return `matches /${criteria.pattern ?? ''}/`;
    case 'frequency': {
      const op = criteria.operator ?? '=';
      const threshold = criteria.value ?? 0;
      const count = tagMeta?.count ?? 0;
      return `count ${count} ${op} ${threshold}`;
    }
    case 'list':
      return 'exact match in list';
    default:
      return 'matched';
  }
}

function attribute(rule: Rule, tagMeta: TagMeta | undefined): AttributedMatch {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    action: rule.action,
    scopes: rule.scopes,
    priority: rule.priority,
    builtin: rule.builtin ?? false,
    reason: describeReason(rule.match, tagMeta),
  };
}

export class RuleEngine {
  /**
   * Evaluate enabled rules against a tag and return the winning match.
   * Rules are evaluated in priority order (highest first); the highest-priority
   * matching rule wins. Returns null when nothing matches.
   */
  static evaluateTag(
    tag: string,
    tagMeta: TagMeta | undefined,
    rules: Rule[]
  ): MatchResult | null {
    const sortedRules = [...rules]
      .filter(r => r.enabled)
      .sort((a, b) => b.priority - a.priority);

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

  /**
   * Get all rules that would match a tag
   */
  static getAllMatches(
    tag: string,
    tagMeta: TagMeta | undefined,
    rules: Rule[]
  ): MatchResult[] {
    const matches: MatchResult[] = [];

    for (const rule of rules.filter(r => r.enabled)) {
      if (TagMatcher.matches(tag, tagMeta, rule.match)) {
        matches.push({
          matched: true,
          ruleId: rule.id,
          ruleName: rule.name,
        });
      }
    }

    return matches;
  }

  /**
   * Test a tag string against a rule without needing full metadata
   */
  static testTag(tag: string, rule: Rule): boolean {
    return TagMatcher.matches(tag, undefined, rule.match);
  }

  /**
   * Diagnostic helper for "why is this tag affected?" UIs.
   * Returns the winning rule (highest-priority match) plus the full chain of
   * matching enabled rules, ordered priority-descending, with human-readable
   * reasons.
   */
  static getRuleAttribution(
    tag: string,
    tagMeta: TagMeta | undefined,
    rules: Rule[],
  ): RuleAttribution {
    const sortedRules = [...rules]
      .filter((r) => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    const allMatches: AttributedMatch[] = [];
    for (const rule of sortedRules) {
      if (TagMatcher.matches(tag, tagMeta, rule.match)) {
        allMatches.push(attribute(rule, tagMeta));
      }
    }

    const effective = allMatches.length > 0 ? allMatches[0] : null;
    return { tag, effective, allMatches };
  }

  /**
   * Resolve a tag's visibility with overrides taking precedence over rules
   * (D-015). Precedence:
   *   1. overrides[tag] === 'show' -> always shown (safety net; beats every rule)
   *   2. overrides[tag] === 'hide' -> always hidden (beats every rule except an
   *      always-show on the same tag, which cannot co-occur)
   *   3. otherwise fall through to getRuleAttribution (rules + presets)
   *
   * Returns a RuleAttribution so TagListModel and ObserverBase consume one shape.
   * When an override applies, the effective match carries an overrideReason and
   * is the sole entry in allMatches: the override is THE effective reason, so it
   * supersedes (does not merely outrank) any matching rule.
   */
  static resolveVisibility(
    tag: string,
    tagMeta: TagMeta | undefined,
    rules: Rule[],
    overrides: Record<string, TagOverride>,
  ): RuleAttribution {
    const override = overrides[tag];
    if (override) {
      const effective = attributeOverride(override);
      return { tag, effective, allMatches: [effective] };
    }
    return RuleEngine.getRuleAttribution(tag, tagMeta, rules);
  }

  /**
   * Central predicate: returns true when a tag is effectively curated (hidden
   * or flagged in preview mode). A tag is curated when its effective
   * resolveVisibility match is non-null AND is not an always-show override
   * (which keeps the tag visible as the safety net and beats every rule).
   *
   * This is the single source of truth used by countCurated, TagListModel, and
   * ObserverBase. Centralizing here ensures all three surfaces stay in sync
   * without duplicating the condition.
   */
  static isEffectivelyHidden(effective: AttributedMatch | null): boolean {
    return effective !== null && effective.overrideReason !== 'always-show';
  }

  /**
   * Count the tags the engine curates (would hide) over a metadata map, scope-
   * independent. A tag counts when isEffectivelyHidden returns true for its
   * resolveVisibility result. This is the hidden count in normal mode and the
   * flagged count in preview mode (the matched SET is the same; preview only
   * changes how those tags are decorated). Pure: no DOM, no dependence on
   * which surfaces are toggled on.
   */
  static countCurated(
    meta: Map<string, TagMeta>,
    rules: Rule[],
    overrides: Record<string, TagOverride>,
  ): number {
    let count = 0;
    for (const tagMeta of meta.values()) {
      const { effective } = RuleEngine.resolveVisibility(
        tagMeta.tag,
        tagMeta,
        rules,
        overrides,
      );
      if (RuleEngine.isEffectivelyHidden(effective)) {
        count += 1;
      }
    }
    return count;
  }
}
