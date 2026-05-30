import { describe, expect, it } from 'vitest';
import { TagActions, TagActionsHost } from '../src/ui/tagList/tagActions';

function host(overrides: Partial<TagActionsHost> = {}): TagActionsHost {
  return {
    isPluginEnabled: () => true,
    executeCommand: () => true,
    setOverride: () => {},
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
  it('setVisibility hide pins each tag to hide via the override store', () => {
    const calls: Array<[string, string | null]> = [];
    const actions = new TagActions(
      host({ setOverride: (tag, value) => void calls.push([tag, value]) }),
    );
    expect(actions.setVisibility(['a'], 'hide')).toEqual({ applied: 1, deferred: 0 });
    expect(calls).toEqual([['a', 'hide']]);
  });

  it('setVisibility show pins each tag to show via the override store', () => {
    const calls: Array<[string, string | null]> = [];
    const actions = new TagActions(
      host({ setOverride: (tag, value) => void calls.push([tag, value]) }),
    );
    expect(actions.setVisibility(['a'], 'show')).toEqual({ applied: 1, deferred: 0 });
    expect(calls).toEqual([['a', 'show']]);
  });

  it('setVisibility clear removes the pin via the override store', () => {
    const calls: Array<[string, string | null]> = [];
    const actions = new TagActions(
      host({ setOverride: (tag, value) => void calls.push([tag, value]) }),
    );
    expect(actions.setVisibility(['a'], 'clear')).toEqual({ applied: 1, deferred: 0 });
    expect(calls).toEqual([['a', null]]);
  });

  it('setVisibility applies the override once per tag and counts every tag', () => {
    const calls: Array<[string, string | null]> = [];
    const actions = new TagActions(
      host({ setOverride: (tag, value) => void calls.push([tag, value]) }),
    );
    expect(actions.setVisibility(['a', 'b'], 'hide')).toEqual({ applied: 2, deferred: 0 });
    expect(calls).toEqual([
      ['a', 'hide'],
      ['b', 'hide'],
    ]);
  });

  it('applyBulk routes send-to-tag-wrangler to a dispatch count', () => {
    const actions = new TagActions(host());
    expect(actions.applyBulk(['a', 'b'], 'send-to-tag-wrangler')).toBe(2);
  });

  it('applyBulk routes hide to a real hide override result', () => {
    const calls: Array<[string, string | null]> = [];
    const actions = new TagActions(
      host({ setOverride: (tag, value) => void calls.push([tag, value]) }),
    );
    expect(actions.applyBulk(['a'], 'hide')).toEqual({ applied: 1, deferred: 0 });
    expect(calls).toEqual([['a', 'hide']]);
  });

  it('applyBulk routes unhide to a show override result', () => {
    const calls: Array<[string, string | null]> = [];
    const actions = new TagActions(
      host({ setOverride: (tag, value) => void calls.push([tag, value]) }),
    );
    expect(actions.applyBulk(['a'], 'unhide')).toEqual({ applied: 1, deferred: 0 });
    expect(calls).toEqual([['a', 'show']]);
  });
});
