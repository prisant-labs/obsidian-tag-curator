import { describe, expect, it } from 'vitest';
import { TagActions, TagActionsHost } from '../src/ui/tagList/tagActions';

function host(overrides: Partial<TagActionsHost> = {}): TagActionsHost {
  return {
    isPluginEnabled: () => true,
    executeCommand: () => true,
    ...overrides,
  };
}

describe('TagActions.sendToTagWrangler', () => {
  it('returns 0 and dispatches nothing when Tag Wrangler is absent', () => {
    let calls = 0;
    const actions = new TagActions(
      host({
        isPluginEnabled: () => false,
        executeCommand: () => {
          calls += 1;
          return true;
        },
      }),
    );
    expect(actions.sendToTagWrangler(['a', 'b'])).toBe(0);
    expect(calls).toBe(0);
  });

  it('dispatches the rename command once per tag and counts successes', () => {
    const ids: string[] = [];
    const actions = new TagActions(
      host({
        executeCommand: (id) => {
          ids.push(id);
          return true;
        },
      }),
    );
    expect(actions.sendToTagWrangler(['a', 'b', 'c'])).toBe(3);
    expect(ids).toEqual([
      'tag-wrangler:rename-tag',
      'tag-wrangler:rename-tag',
      'tag-wrangler:rename-tag',
    ]);
  });
});

describe('TagActions visibility and bulk', () => {
  it('setVisibility defers all tags with a b009 reason until the override store ships', () => {
    const actions = new TagActions(host());
    expect(actions.setVisibility(['a', 'b'], 'hide')).toEqual({
      applied: 0,
      deferred: 2,
      reason: 'b009',
    });
  });

  it('applyBulk routes send-to-tag-wrangler to a dispatch count', () => {
    const actions = new TagActions(host());
    expect(actions.applyBulk(['a', 'b'], 'send-to-tag-wrangler')).toBe(2);
  });

  it('applyBulk routes hide/unhide to a deferred VisibilityResult', () => {
    const actions = new TagActions(host());
    expect(actions.applyBulk(['a'], 'hide')).toEqual({ applied: 0, deferred: 1, reason: 'b009' });
  });
});
