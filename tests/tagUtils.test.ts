import { describe, expect, it } from 'vitest';
import { stripHash, tagsFromCache, withHash } from '../src/util/tagUtils';

describe('stripHash', () => {
  it('removes a leading hash', () => {
    expect(stripHash('#proj')).toBe('proj');
  });

  it('returns the input unchanged when there is no hash', () => {
    expect(stripHash('proj')).toBe('proj');
  });

  it('only strips the first hash', () => {
    expect(stripHash('##nested')).toBe('#nested');
  });
});

describe('withHash', () => {
  it('adds a hash when missing', () => {
    expect(withHash('proj')).toBe('#proj');
  });

  it('leaves existing hash alone', () => {
    expect(withHash('#proj')).toBe('#proj');
  });
});

describe('tagsFromCache', () => {
  it('returns [] when cache is null', () => {
    expect(tagsFromCache(null)).toEqual([]);
  });

  it('extracts inline tags from cache.tags and strips hashes', () => {
    const out = tagsFromCache({ tags: [{ tag: '#one' }, { tag: '#two' }] });
    expect(out).toEqual(['one', 'two']);
  });

  it('extracts frontmatter tags as a string list', () => {
    const out = tagsFromCache({ frontmatter: { tags: ['a', 'b'] } });
    expect(out).toEqual(['a', 'b']);
  });

  it('extracts frontmatter tag as a single string', () => {
    const out = tagsFromCache({ frontmatter: { tags: 'solo' } });
    expect(out).toEqual(['solo']);
  });

  it('combines inline and frontmatter tags', () => {
    const out = tagsFromCache({
      tags: [{ tag: '#inline' }],
      frontmatter: { tags: ['fm1', 'fm2'] },
    });
    expect(out).toEqual(['inline', 'fm1', 'fm2']);
  });
});
