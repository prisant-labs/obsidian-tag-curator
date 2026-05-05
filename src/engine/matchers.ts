/**
 * Tag matching logic for rules
 */

import { MatchCriteria, TagMeta } from '../types';

export class TagMatcher {
  /**
   * Test if a tag matches a given criteria
   */
  static matches(tag: string, tagMeta: TagMeta | undefined, criteria: MatchCriteria): boolean {
    switch (criteria.type) {
      case 'regex':
        return this.matchRegex(tag, criteria.pattern || '');

      case 'frequency':
        if (!tagMeta) return false;
        return this.matchFrequency(tagMeta.count, criteria.operator, criteria.value as number);

      case 'list':
        return this.matchList(tag, criteria.list || []);

      default:
        return false;
    }
  }

  private static matchRegex(tag: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern);
      return regex.test(tag);
    } catch (e) {
      console.error(`Invalid regex pattern: ${pattern}`, e);
      return false;
    }
  }

  private static matchFrequency(
    count: number,
    operator: string | undefined,
    value: number
  ): boolean {
    switch (operator) {
      case '<':
        return count < value;
      case '<=':
        return count <= value;
      case '>':
        return count > value;
      case '>=':
        return count >= value;
      case '=':
        return count === value;
      default:
        return false;
    }
  }

  private static matchList(tag: string, list: string[]): boolean {
    return list.includes(tag);
  }
}
