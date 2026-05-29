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
} from '../types';
import { TagMatcher } from './matchers';

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
}
