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

  it('the highest-priority matching rule wins', () => {
    // Rules sorted priority-desc, then first match wins. Higher priority number
    // = more important. Lower-priority rules never override a higher-priority match.
    const rules: Rule[] = [
      rule({ id: 'high', name: 'high', priority: 100 }),
      rule({ id: 'mid', name: 'mid', priority: 50 }),
      rule({ id: 'low', name: 'low', priority: 10 }),
    ];
    const result = RuleEngine.evaluateTag('t', undefined, rules);
    expect(result).toEqual({ matched: true, ruleId: 'high', ruleName: 'high' });
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

describe('RuleEngine.getRuleAttribution', () => {
  it('returns empty attribution when nothing matches', () => {
    const result = RuleEngine.getRuleAttribution('miss', undefined, [
      rule({ id: 'a', match: { type: 'list', list: ['other'] } }),
    ]);
    expect(result).toEqual({ tag: 'miss', effective: null, allMatches: [] });
  });

  it('effective rule is the highest-priority match; allMatches ordered priority-desc', () => {
    const rules: Rule[] = [
      rule({ id: 'high', name: 'high', priority: 100 }),
      rule({ id: 'mid', name: 'mid', priority: 50 }),
      rule({ id: 'low', name: 'low', priority: 10 }),
    ];
    const result = RuleEngine.getRuleAttribution('t', undefined, rules);
    expect(result.effective?.ruleId).toBe('high');
    expect(result.allMatches.map((m) => m.ruleId)).toEqual(['high', 'mid', 'low']);
  });

  it('skips disabled rules in both the chain and the effective slot', () => {
    const rules: Rule[] = [
      rule({ id: 'on', priority: 100 }),
      rule({ id: 'off', priority: 50, enabled: false }),
    ];
    const result = RuleEngine.getRuleAttribution('t', undefined, rules);
    expect(result.allMatches.map((m) => m.ruleId)).toEqual(['on']);
    expect(result.effective?.ruleId).toBe('on');
  });

  it('describes a regex reason with the pattern', () => {
    const r = rule({ id: 'rx', match: { type: 'regex', pattern: '^foo$' } });
    const result = RuleEngine.getRuleAttribution('foo', undefined, [r]);
    expect(result.effective?.reason).toBe('matches /^foo$/');
  });

  it('describes a frequency reason with the count and operator', () => {
    const r = rule({ id: 'fr', match: { type: 'frequency', operator: '<=', value: 1 } });
    const meta = {
      tag: 't',
      firstSeen: 0,
      lastSeen: 0,
      count: 1,
      sources: ['inline' as const],
    };
    const result = RuleEngine.getRuleAttribution('t', meta, [r]);
    expect(result.effective?.reason).toBe('count 1 <= 1');
  });

  it('describes a list reason', () => {
    const r = rule({ id: 'ls', match: { type: 'list', list: ['t'] } });
    const result = RuleEngine.getRuleAttribution('t', undefined, [r]);
    expect(result.effective?.reason).toBe('exact match in list');
  });

  it('includes action, scopes, priority, and builtin in attribution', () => {
    const r = rule({
      id: 'a',
      action: 'hide',
      scopes: ['tag-pane'],
      priority: 42,
      builtin: true,
    });
    const result = RuleEngine.getRuleAttribution('t', undefined, [r]);
    expect(result.effective).toMatchObject({
      ruleId: 'a',
      action: 'hide',
      scopes: ['tag-pane'],
      priority: 42,
      builtin: true,
    });
  });

  it('treats missing builtin flag as false', () => {
    const r = rule({ id: 'custom' });
    delete (r as { builtin?: boolean }).builtin;
    const result = RuleEngine.getRuleAttribution('t', undefined, [r]);
    expect(result.effective?.builtin).toBe(false);
  });

  it('does not mutate the input rules array', () => {
    const rules: Rule[] = [
      rule({ id: 'a', priority: 1 }),
      rule({ id: 'b', priority: 2 }),
    ];
    const before = rules.map((r) => r.id);
    RuleEngine.getRuleAttribution('t', undefined, rules);
    expect(rules.map((r) => r.id)).toEqual(before);
  });
});
