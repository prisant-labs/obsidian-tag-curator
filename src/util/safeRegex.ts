const LOOKBEHIND_RE = /\(\?<[=!]/;

export class UnsafeRegexError extends Error {}

export function compileSafeRegex(pattern: string): RegExp {
  if (LOOKBEHIND_RE.test(pattern)) {
    throw new UnsafeRegexError(
      'Lookbehind assertions are not supported (iOS < 16.4 will crash).',
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
