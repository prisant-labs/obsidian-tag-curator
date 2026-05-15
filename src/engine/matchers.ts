import { MatchCriteria, TagMeta } from '../types';
import { compileSafeRegex } from '../util/safeRegex';

const REGEX_CACHE = new Map<string, RegExp | null>();

function regexFor(pattern: string): RegExp | null {
  if (REGEX_CACHE.has(pattern)) return REGEX_CACHE.get(pattern) ?? null;
  try {
    const compiled = compileSafeRegex(pattern);
    REGEX_CACHE.set(pattern, compiled);
    return compiled;
  } catch (e) {
    console.warn('[tag-curator] invalid regex', pattern, e);
    REGEX_CACHE.set(pattern, null);
    return null;
  }
}

export class TagMatcher {
  static matches(tag: string, meta: TagMeta | undefined, criteria: MatchCriteria): boolean {
    switch (criteria.type) {
      case 'regex':
        return this.matchRegex(tag, criteria.pattern ?? '');
      case 'frequency':
        if (!meta) return false;
        return this.matchFrequency(meta.count, criteria.operator, criteria.value ?? 0);
      case 'list':
        return (criteria.list ?? []).includes(tag);
      default:
        return false;
    }
  }

  private static matchRegex(tag: string, pattern: string): boolean {
    if (!pattern) return false;
    const re = regexFor(pattern);
    return re ? re.test(tag) : false;
  }

  private static matchFrequency(count: number, op: MatchCriteria['operator'], value: number): boolean {
    switch (op) {
      case '<': return count < value;
      case '<=': return count <= value;
      case '>': return count > value;
      case '>=': return count >= value;
      case '=': return count === value;
      default: return false;
    }
  }
}
