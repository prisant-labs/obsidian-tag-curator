/**
 * Core rule evaluation engine
 */

import { Rule, TagMeta, MatchResult } from '../types';
import { TagMatcher } from './matchers';

export class RuleEngine {
  /**
   * Evaluate all rules against a tag and return matching rules
   * Rules are evaluated in priority order (highest first)
   * Last match wins
   */
  static evaluateTag(
    tag: string,
    tagMeta: TagMeta | undefined,
    rules: Rule[]
  ): MatchResult | null {
    // Sort by priority descending (highest priority first)
    const sortedRules = [...rules]
      .filter(r => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    let lastMatch: MatchResult | null = null;

    for (const rule of sortedRules) {
      if (TagMatcher.matches(tag, tagMeta, rule.match)) {
        lastMatch = {
          matched: true,
          ruleId: rule.id,
          ruleName: rule.name,
        };
      }
    }

    return lastMatch;
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
}
