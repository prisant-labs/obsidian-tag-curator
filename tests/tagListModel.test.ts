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
