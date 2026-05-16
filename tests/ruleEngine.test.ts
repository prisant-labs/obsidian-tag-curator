import { describe, expect, it } from 'vitest';
import { RuleEngine } from '../src/engine/ruleEngine';
import { Rule } from '../src/types';

function rule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'r',
    name: 'r',
    enabled: true,
    priority: 50,
    match: { type: 'list', list: ['t'] },
    action: 'hide',
    scopes: ['tag-pane'],
    ...overrides,
  };
}

describe('RuleEngine.evaluateTag', () => {
  it('returns null when no rule matches', () => {
    const result = RuleEngine.evaluateTag('miss', undefined, [
      rule({ id: 'a', match: { type: 'list', list: ['other'] } }),
    ]);
    expect(result).toBeNull();
  });

  it('skips disabled rules', () => {
    const result = RuleEngine.evaluateTag('t', undefined, [
      rule({ id: 'a', enabled: false }),
    ]);
    expect(result).toBeNull();
  });

  it('returns the matching rule when one matches', () => {
    const result = RuleEngine.evaluateTag('t', undefined, [rule({ id: 'a', name: 'A' })]);
    expect(result).toEqual({ matched: true, ruleId: 'a', ruleName: 'A' });
  });

  it('applies last-match-wins among multiple matches in priority order', () => {
    // Sorted desc by priority, then iterated; lastMatch is the LAST one to match in the loop
    // = the LOWEST priority among matching rules.
    const rules: Rule[] = [
      rule({ id: 'high', name: 'high', priority: 100 }),
      rule({ id: 'mid', name: 'mid', priority: 50 }),
      rule({ id: 'low', name: 'low', priority: 10 }),
    ];
    const result = RuleEngine.evaluateTag('t', undefined, rules);
    expect(result).toEqual({ matched: true, ruleId: 'low', ruleName: 'low' });
  });

  it('does not consider disabled rules even when they have highest priority', () => {
    const rules: Rule[] = [
      rule({ id: 'top', name: 'top', priority: 999, enabled: false }),
      rule({ id: 'mid', name: 'mid', priority: 50 }),
    ];
    const result = RuleEngine.evaluateTag('t', undefined, rules);
    expect(result?.ruleId).toBe('mid');
  });

  it('does not mutate input rules array', () => {
    const rules: Rule[] = [
      rule({ id: 'a', priority: 1 }),
      rule({ id: 'b', priority: 2 }),
    ];
    const before = rules.map((r) => r.id);
    RuleEngine.evaluateTag('t', undefined, rules);
    expect(rules.map((r) => r.id)).toEqual(before);
  });
});

describe('RuleEngine.getAllMatches', () => {
  it('returns every matching enabled rule in iteration order', () => {
    const rules: Rule[] = [
      rule({ id: 'a' }),
      rule({ id: 'b' }),
      rule({ id: 'c', match: { type: 'list', list: ['other'] } }),
    ];
    const matches = RuleEngine.getAllMatches('t', undefined, rules);
    expect(matches.map((m) => m.ruleId)).toEqual(['a', 'b']);
  });

  it('returns empty when nothing matches', () => {
    const matches = RuleEngine.getAllMatches('miss', undefined, [rule()]);
    expect(matches).toEqual([]);
  });
});

describe('RuleEngine.testTag', () => {
  it('matches without metadata', () => {
    expect(RuleEngine.testTag('t', rule())).toBe(true);
  });

  it('frequency rule returns false when no metadata is supplied', () => {
    const r = rule({ match: { type: 'frequency', operator: '<=', value: 1 } });
    expect(RuleEngine.testTag('t', r)).toBe(false);
  });
});
