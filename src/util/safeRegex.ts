const LOOKBEHIND_RE = /\(\?<[=!]/;

/**
 * Upper bound on user-authored pattern length. Tag-matching patterns are short
 * (a few dozen characters even when elaborate); a very long pattern is either a
 * mistake or an attempt to maximise backtracking, so we reject it outright. This
 * is a coarse defence-in-depth layer behind the structural check below.
 */
const MAX_PATTERN_LENGTH = 200;

export class UnsafeRegexError extends Error {}

/**
 * Read a regex quantifier at position `i`, if one is there. Returns whether the
 * quantifier is UNBOUNDED (`+`, `*`, or `{n,}` with no upper bound) - the kind
 * that drives exponential backtracking - and the index just past it. `?` and
 * bounded `{n}` / `{n,m}` are quantifiers but not unbounded, so they cannot
 * nest into catastrophe.
 */
function readQuantifier(p: string, i: number): { unbounded: boolean; end: number } | null {
  const ch = p[i];
  if (ch === '+' || ch === '*') return { unbounded: true, end: i + 1 };
  if (ch === '?') return { unbounded: false, end: i + 1 };
  if (ch === '{') {
    const m = /^\{(\d*)(,(\d*))?\}/.exec(p.slice(i));
    if (!m) return null;
    const hasComma = m[2] !== undefined;
    const upper = m[3];
    // {n,} (open-ended) is unbounded; {n} and {n,m} are bounded.
    const unbounded = hasComma && (upper === undefined || upper === '');
    return { unbounded, end: i + m[0].length };
  }
  return null;
}

/**
 * Detect nested unbounded quantifiers - the classic catastrophic-backtracking
 * signature (`(a+)+`, `(.*)*`, `(\d+){2,}`, `((a+))+`, ...). Walks the pattern
 * tracking group nesting: a group flagged as containing an unbounded quantifier,
 * when itself quantified unboundedly, is the explosion. Character classes and
 * escapes are skipped so quantifier characters inside them are not miscounted.
 *
 * This catches the dominant ReDoS class. It does NOT model alternation-overlap
 * patterns such as `(a|ab)+`; those are far rarer in tag matching and the length
 * cap plus the editor's visible validation remain as backstops.
 */
function hasNestedQuantifier(pattern: string): boolean {
  const stack: { innerUnbounded: boolean }[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\') {
      i++; // skip the escaped character
      continue;
    }
    if (ch === '[') {
      // Skip the whole character class; quantifier chars inside are literal.
      i++;
      while (i < pattern.length && pattern[i] !== ']') {
        if (pattern[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (ch === '(') {
      stack.push({ innerUnbounded: false });
      continue;
    }
    if (ch === ')') {
      const group = stack.pop() ?? { innerUnbounded: false };
      let contributesUnbounded = group.innerUnbounded;
      const q = readQuantifier(pattern, i + 1);
      if (q) {
        i = q.end - 1; // consume the quantifier
        if (q.unbounded && group.innerUnbounded) return true; // (...unbounded...)+
        if (q.unbounded) contributesUnbounded = true;
      }
      // An unbounded quantifier lexically inside this group is also inside the
      // enclosing group, so propagate it upward.
      if (contributesUnbounded && stack.length) {
        stack[stack.length - 1].innerUnbounded = true;
      }
      continue;
    }
    // A bare quantifier applied to a literal or class marks the current group.
    const q = readQuantifier(pattern, i);
    if (q) {
      i = q.end - 1;
      if (q.unbounded && stack.length) stack[stack.length - 1].innerUnbounded = true;
    }
  }
  return false;
}

export function compileSafeRegex(pattern: string): RegExp {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new UnsafeRegexError(
      `Pattern is too long (max ${MAX_PATTERN_LENGTH} characters).`,
    );
  }
  if (LOOKBEHIND_RE.test(pattern)) {
    throw new UnsafeRegexError(
      'Lookbehind assertions are not supported (iOS < 16.4 will crash).',
    );
  }
  if (hasNestedQuantifier(pattern)) {
    throw new UnsafeRegexError(
      'Nested quantifiers can cause catastrophic backtracking and freeze ' +
        'Obsidian. Rewrite without a repeated group inside a repeated group ' +
        '(for example (a+)+ or (.*)* ).',
    );
  }
  return new RegExp(pattern);
}

export function validateSafeRegex(pattern: string): { ok: true } | { ok: false; reason: string } {
  try {
    compileSafeRegex(pattern);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
