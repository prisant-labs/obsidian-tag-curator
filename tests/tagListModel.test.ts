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

  it('search is a case-insensitive substring on the tag name', () => {
    const model = new TagListModel(source([meta('Project'), meta('area')]));
    model.setSearch('PROJ');
    expect(model.rows().map((r) => r.meta.tag)).toEqual(['Project']);
  });
});
