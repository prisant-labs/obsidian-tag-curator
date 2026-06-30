import { describe, expect, it } from 'vitest';
import {
  UnsafeRegexError,
  compileSafeRegex,
  validateSafeRegex,
} from '../src/util/safeRegex';

describe('compileSafeRegex', () => {
  it('compiles a simple pattern', () => {
    const re = compileSafeRegex('^foo$');
    expect(re.test('foo')).toBe(true);
    expect(re.test('bar')).toBe(false);
  });

  it('rejects positive lookbehind', () => {
    expect(() => compileSafeRegex('(?<=a)b')).toThrow(UnsafeRegexError);
  });

  it('rejects negative lookbehind', () => {
    expect(() => compileSafeRegex('(?<!a)b')).toThrow(UnsafeRegexError);
  });

  it('allows lookahead (which is iOS-safe)', () => {
    expect(() => compileSafeRegex('a(?=b)')).not.toThrow();
    expect(() => compileSafeRegex('a(?!b)')).not.toThrow();
  });

  it('throws on syntactically invalid pattern', () => {
    expect(() => compileSafeRegex('[unterminated')).toThrow();
  });
});

describe('compileSafeRegex catastrophic backtracking (P2-06)', () => {
  it('rejects the classic nested-quantifier pattern', () => {
    expect(() => compileSafeRegex('^(a+)+$')).toThrow(UnsafeRegexError);
  });

  it('rejects (.*)* style nesting', () => {
    expect(() => compileSafeRegex('(.*)*')).toThrow(UnsafeRegexError);
  });

  it('rejects deeply nested quantified groups', () => {
    expect(() => compileSafeRegex('((a+))+')).toThrow(UnsafeRegexError);
  });

  it('rejects a brace-quantified nested group', () => {
    expect(() => compileSafeRegex('(a+){2,}')).toThrow(UnsafeRegexError);
  });

  it('rejects a nested quantifier inside a lookahead', () => {
    expect(() => compileSafeRegex('(?=(a+)+)')).toThrow(UnsafeRegexError);
  });

  it('allows ordinary quantified groups without nesting', () => {
    expect(() => compileSafeRegex('(ab)+')).not.toThrow();
    expect(() => compileSafeRegex('(a|b)+')).not.toThrow();
    expect(() => compileSafeRegex('^[A-Za-z0-9]+$')).not.toThrow();
    expect(() => compileSafeRegex('(foo)+(bar)*')).not.toThrow();
  });

  it('allows a single quantifier inside a non-quantified group', () => {
    expect(() => compileSafeRegex('(a+)')).not.toThrow();
  });

  it('allows a bounded outer quantifier on a bounded inner group', () => {
    expect(() => compileSafeRegex('(a{2}){3}')).not.toThrow();
  });

  it('rejects an excessively long pattern', () => {
    expect(() => compileSafeRegex('a'.repeat(201))).toThrow(UnsafeRegexError);
  });
});

describe('validateSafeRegex', () => {
  it('returns ok for safe pattern', () => {
    expect(validateSafeRegex('^[A-Z]+$')).toEqual({ ok: true });
  });

  it('returns reason for lookbehind', () => {
    const result = validateSafeRegex('(?<=x)y');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/lookbehind/i);
    }
  });

  it('returns reason for invalid syntax', () => {
    const result = validateSafeRegex('(unbalanced');
    expect(result.ok).toBe(false);
  });

  it('returns a backtracking reason for nested quantifiers', () => {
    const result = validateSafeRegex('(a+)+');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/backtrack/i);
    }
  });
});
