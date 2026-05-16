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
});
