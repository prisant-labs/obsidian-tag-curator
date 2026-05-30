import { describe, expect, it } from 'vitest';
import { TagListModel, TagListDataSource } from '../src/ui/tagList/tagListModel';
import { DEFAULT_SETTINGS, TagCuratorSettings, TagMeta, Rule } from '../src/types';

function meta(tag: string, overrides: Partial<TagMeta> = {}): TagMeta {
  return { tag, firstSeen: 0, lastSeen: 0, count: 1, sources: ['inline'], ...overrides };
}

function hideRule(tag: string): Rule {
  return {
    id: 'h-' + tag,
    name: 'hide ' + tag,
    enabled: true,
    priority: 50,
    match: { type: 'list', list: [tag] },
    action: 'hide',
    scopes: ['tag-pane'],
  };
}

function source(
  metas: TagMeta[],
  settings: Partial<TagCuratorSettings> = {},
): TagListDataSource {
  const map = new Map(metas.map((m) => [m.tag, m]));
  const s: TagCuratorSettings = { ...DEFAULT_SETTINGS, enabledPresets: [], ...settings };
  return { getSettings: () => s, getMeta: () => map };
}

describe('TagListModel.allRows', () => {
  it('marks an unmatched tag shown and a rule-matched tag hidden', () => {
    const model = new TagListModel(
      source([meta('keep'), meta('drop')], { customRules: [hideRule('drop')] }),
    );
    const rows = model.allRows();
    expect(rows.find((r) => r.meta.tag === 'keep')!.visibility).toBe('shown');
    expect(rows.find((r) => r.meta.tag === 'drop')!.visibility).toBe('hidden');
  });

  it('marks a matched tag flagged (not hidden) when preview mode is on', () => {
    const model = new TagListModel(
      source([meta('drop')], { customRules: [hideRule('drop')], previewMode: true }),
    );
    expect(model.allRows()[0].visibility).toBe('flagged');
  });

  it('attaches every matching rule name to the row', () => {
    const model = new TagListModel(
      source([meta('drop')], { customRules: [hideRule('drop')] }),
    );
    expect(model.allRows()[0].matches.map((m) => m.ruleName)).toContain('hide drop');
  });

  it('an always-show override un-hides a rule-matched tag', () => {
    const model = new TagListModel(
      source([meta('drop')], {
        customRules: [hideRule('drop')],
        overrides: { drop: 'show' },
      }),
    );
    expect(model.allRows()[0].visibility).toBe('shown');
  });

  it('an always-hide override hides an unmatched tag', () => {
    const model = new TagListModel(
      source([meta('keep')], { overrides: { keep: 'hide' } }),
    );
    expect(model.allRows()[0].visibility).toBe('hidden');
  });

  it('an always-hide override flags (not hides) an unmatched tag in preview mode', () => {
    const model = new TagListModel(
      source([meta('keep')], { overrides: { keep: 'hide' }, previewMode: true }),
    );
    expect(model.allRows()[0].visibility).toBe('flagged');
  });
});

describe('TagListModel filtering and search', () => {
  it('hidden chip keeps only non-shown rows', () => {
    const model = new TagListModel(
      source([meta('keep'), meta('drop')], { customRules: [hideRule('drop')] }),
    );
    model.setFilter('hidden');
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['drop']);
  });

  it('orphans chip keeps only count <= 1', () => {
    const model = new TagListModel(
      source([meta('rare', { count: 1 }), meta('common', { count: 9 })]),
    );
    model.setFilter('orphans');
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['rare']);
  });

  it('frontmatter chip keeps only frontmatter-only tags', () => {
    const model = new TagListModel(
      source([
        meta('fm', { sources: ['frontmatter'] }),
        meta('both', { sources: ['frontmatter', 'inline'] }),
      ]),
    );
    model.setFilter('frontmatter');
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['fm']);
  });

  it('unreviewed chip keeps only rows without reviewed=true', () => {
    const model = new TagListModel(
      source([meta('new'), meta('done', { reviewed: true })]),
    );
    model.setFilter('unreviewed');
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['new']);
  });

  it('flagged chip keeps only rows whose visibility is flagged', () => {
    const model = new TagListModel(
      source([meta('keep'), meta('drop')], {
        customRules: [hideRule('drop')],
        previewMode: true,
      }),
    );
    model.setFilter('flagged');
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['drop']);
  });

  it('inline chip keeps only inline-only rows (not frontmatter)', () => {
    const model = new TagListModel(
      source([
        meta('inl', { sources: ['inline'] }),
        meta('fm', { sources: ['frontmatter'] }),
        meta('both', { sources: ['frontmatter', 'inline'] }),
      ]),
    );
    model.setFilter('inline');
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['inl']);
  });

  it('setRuleFilter keeps only rows matched by that rule id; null clears it', () => {
    const model = new TagListModel(
      source([meta('a'), meta('b'), meta('c')], {
        customRules: [hideRule('a'), hideRule('b')],
      }),
    );
    model.setRuleFilter('h-a');
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['a']);
    model.setRuleFilter(null);
    expect(model.rows().map((r) => r.meta.tag).sort()).toEqual(['a', 'b', 'c']);
  });

  it('search is a case-insensitive substring on the tag name', () => {
    const model = new TagListModel(source([meta('Project'), meta('area')]));
    model.setSearch('PROJ');
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['Project']);
  });
});

describe('TagListModel sorting', () => {
  it('sorts by count descending by default', () => {
    const model = new TagListModel(
      source([meta('a', { count: 2 }), meta('b', { count: 9 })]),
    );
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['b', 'a']);
  });

  it('setSort toggles direction when the same key is set again', () => {
    const model = new TagListModel(
      source([meta('a', { count: 2 }), meta('b', { count: 9 })]),
    );
    model.setSort('count');
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['a', 'b']);
  });

  it('sorts by name ascending', () => {
    const model = new TagListModel(source([meta('zebra'), meta('apple')]));
    model.setSort('name', false);
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['apple', 'zebra']);
  });
});

describe('TagListModel selection and lookup', () => {
  it('toggleSelect adds then removes a tag', () => {
    const model = new TagListModel(source([meta('a')]));
    model.toggleSelect('a');
    expect([...model.selection]).toEqual(['a']);
    model.toggleSelect('a');
    expect([...model.selection]).toEqual([]);
  });

  it('clearSelection empties the set', () => {
    const model = new TagListModel(source([meta('a'), meta('b')]));
    model.toggleSelect('a');
    model.toggleSelect('b');
    model.clearSelection();
    expect(model.selection.size).toBe(0);
  });

  it('rowFor returns the row for a tag or undefined', () => {
    const model = new TagListModel(source([meta('a')]));
    expect(model.rowFor('a')!.meta.tag).toBe('a');
    expect(model.rowFor('missing')).toBeUndefined();
  });
});
