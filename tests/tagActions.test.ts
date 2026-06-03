import { describe, expect, it } from 'vitest';
import { TagActions, TagActionsHost } from '../src/ui/tagList/tagActions';

function host(overrides: Partial<TagActionsHost> = {}): TagActionsHost {
  return {
    isPluginEnabled: () => true,
    executeCommand: () => true,
    setOverride: () => {},
    setReviewedBulk: () => {},
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
  it('setVisibility hide pins each tag to hide via the override store', async () => {
    const calls: Array<[string, string | null]> = [];
    const actions = new TagActions(
      host({ setOverride: (tag, value) => void calls.push([tag, value]) }),
    );
    expect(await actions.setVisibility(['a'], 'hide')).toEqual({ applied: 1, deferred: 0 });
    expect(calls).toEqual([['a', 'hide']]);
  });

  it('setVisibility show pins each tag to show via the override store', async () => {
    const calls: Array<[string, string | null]> = [];
    const actions = new TagActions(
      host({ setOverride: (tag, value) => void calls.push([tag, value]) }),
    );
    expect(await actions.setVisibility(['a'], 'show')).toEqual({ applied: 1, deferred: 0 });
    expect(calls).toEqual([['a', 'show']]);
  });

  it('setVisibility clear removes the pin via the override store', async () => {
    const calls: Array<[string, string | null]> = [];
    const actions = new TagActions(
      host({ setOverride: (tag, value) => void calls.push([tag, value]) }),
    );
    expect(await actions.setVisibility(['a'], 'clear')).toEqual({ applied: 1, deferred: 0 });
    expect(calls).toEqual([['a', null]]);
  });

  it('setVisibility applies the override once per tag and counts every tag', async () => {
    const calls: Array<[string, string | null]> = [];
    const actions = new TagActions(
      host({ setOverride: (tag, value) => void calls.push([tag, value]) }),
    );
    expect(await actions.setVisibility(['a', 'b'], 'hide')).toEqual({ applied: 2, deferred: 0 });
    expect(calls).toEqual([
      ['a', 'hide'],
      ['b', 'hide'],
    ]);
  });

  it('applyBulk routes send-to-tag-wrangler to a dispatch count', async () => {
    const actions = new TagActions(host());
    expect(await actions.applyBulk(['a', 'b'], 'send-to-tag-wrangler')).toBe(2);
  });

  it('applyBulk routes hide to a real hide override result', async () => {
    const calls: Array<[string, string | null]> = [];
    const actions = new TagActions(
      host({ setOverride: (tag, value) => void calls.push([tag, value]) }),
    );
    expect(await actions.applyBulk(['a'], 'hide')).toEqual({ applied: 1, deferred: 0 });
    expect(calls).toEqual([['a', 'hide']]);
  });

  it('applyBulk routes unhide to a show override result', async () => {
    const calls: Array<[string, string | null]> = [];
    const actions = new TagActions(
      host({ setOverride: (tag, value) => void calls.push([tag, value]) }),
    );
    expect(await actions.applyBulk(['a'], 'unhide')).toEqual({ applied: 1, deferred: 0 });
    expect(calls).toEqual([['a', 'show']]);
  });
});

describe('TagActions markReviewed', () => {
  it('markReviewed calls setReviewedBulk once with the full array and returns applied count', async () => {
    const calls: Array<[string[], boolean]> = [];
    const actions = new TagActions(
      host({ setReviewedBulk: (tags, value) => void calls.push([tags, value]) }),
    );
    expect(await actions.markReviewed(['a', 'b'], true)).toEqual({ applied: 2, deferred: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([['a', 'b'], true]);
  });

  it('markReviewed with false calls setReviewedBulk once with false', async () => {
    const calls: Array<[string[], boolean]> = [];
    const actions = new TagActions(
      host({ setReviewedBulk: (tags, value) => void calls.push([tags, value]) }),
    );
    expect(await actions.markReviewed(['a'], false)).toEqual({ applied: 1, deferred: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([['a'], false]);
  });

  it('applyBulk routes mark-reviewed to setReviewedBulk with true in one call', async () => {
    const calls: Array<[string[], boolean]> = [];
    const actions = new TagActions(
      host({ setReviewedBulk: (tags, value) => void calls.push([tags, value]) }),
    );
    expect(await actions.applyBulk(['a', 'b'], 'mark-reviewed')).toEqual({ applied: 2, deferred: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([['a', 'b'], true]);
  });

  it('applyBulk routes mark-unreviewed to setReviewedBulk with false in one call', async () => {
    const calls: Array<[string[], boolean]> = [];
    const actions = new TagActions(
      host({ setReviewedBulk: (tags, value) => void calls.push([tags, value]) }),
    );
    expect(await actions.applyBulk(['a'], 'mark-unreviewed')).toEqual({ applied: 1, deferred: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([['a'], false]);
  });
});
