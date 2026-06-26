import { describe, expect, it } from 'vitest';
import { openBesideTagPane } from '../src/ui/curationWorkspace/openBeside';

const VIEW = 'tag-curator-workspace';

function fakeLeaf() {
  return { setViewState: async () => {} };
}

function fakeWorkspace(tagLeaf: unknown) {
  const calls = { createLeafBySplit: 0, revealLeaf: 0 };
  const ws = {
    getLeavesOfType: (type: string) => (type === 'tag' && tagLeaf ? [tagLeaf] : []),
    getLeftLeaf: () => null,
    createLeafBySplit: () => {
      calls.createLeafBySplit++;
      return fakeLeaf();
    },
    revealLeaf: () => {
      calls.revealLeaf++;
    },
  };
  return { ws, calls };
}

describe('openBesideTagPane', () => {
  it('opens the pane full-width on mobile, without splitting', async () => {
    const { ws, calls } = fakeWorkspace(fakeLeaf());
    let plainOpens = 0;
    await openBesideTagPane({
      workspace: ws as never,
      isMobile: true,
      curationViewType: VIEW,
      openPane: async () => {
        plainOpens++;
      },
      notify: () => {},
    });
    expect(calls.createLeafBySplit).toBe(0);
    expect(plainOpens).toBe(1);
  });

  it('splits beside the tag pane on desktop', async () => {
    const { ws, calls } = fakeWorkspace(fakeLeaf());
    let plainOpens = 0;
    await openBesideTagPane({
      workspace: ws as never,
      isMobile: false,
      curationViewType: VIEW,
      openPane: async () => {
        plainOpens++;
      },
      notify: () => {},
    });
    expect(calls.createLeafBySplit).toBe(1);
    expect(plainOpens).toBe(0);
  });
});
