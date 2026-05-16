// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Plugin, View, WorkspaceLeaf } from 'obsidian';
import { TagPaneObserver } from '../src/observers/tagPaneObserver';
import { Rule, TagMeta } from '../src/types';

const HIDDEN_CLASS = 'tag-curator-hidden';
const FLAG_CLASS = 'tag-curator-flagged';
const TAG_ATTR = 'data-tag-curator-rule';
const TAG_VIEW_TYPE = 'tag';

function rule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'r',
    name: 'r',
    enabled: true,
    priority: 50,
    match: { type: 'list', list: ['t'] },
    action: 'hide',
    scopes: ['tag-pane'],
    ...overrides,
  };
}

function meta(tag: string, count: number): TagMeta {
  return {
    tag,
    firstSeen: 0,
    lastSeen: 0,
    count,
    sources: ['inline'],
  };
}

function makeTagRow(tag: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'tag-pane-tag';
  const text = document.createElement('span');
  text.className = 'tag-pane-tag-text';
  text.textContent = tag;
  row.appendChild(text);
  return row;
}

function makeTagPane(tags: string[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'tag-pane';
  for (const t of tags) container.appendChild(makeTagRow(t));
  return container;
}

interface FakeWorkspace {
  onLayoutReady: (cb: () => void) => void;
  on: (event: string, cb: () => void) => { event: string; cb: () => void };
  getLeavesOfType: (type: string) => WorkspaceLeaf[];
}

function makeApp(containers: HTMLElement[]): { app: { workspace: FakeWorkspace }; leaves: WorkspaceLeaf[] } {
  const leaves: WorkspaceLeaf[] = containers.map((c) => new WorkspaceLeaf(new View(c)));
  const workspace: FakeWorkspace = {
    onLayoutReady: (cb) => cb(),
    on: (event, cb) => ({ event, cb }),
    getLeavesOfType: (type) => (type === TAG_VIEW_TYPE ? leaves : []),
  };
  return { app: { workspace }, leaves };
}

function flushRaf(): Promise<void> {
  // The observer uses requestAnimationFrame to coalesce apply() calls. Resolve
  // a microtask first so any pending scheduleApply has run, then advance rAF.
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

beforeEach(() => {
  // Provide a deterministic requestAnimationFrame that runs the callback on a
  // microtask. JSDOM has its own implementation but the timing is unreliable
  // across versions.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    queueMicrotask(() => cb(performance.now()));
    return 0 as unknown as number;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('TagPaneObserver.attachAll', () => {
  it('attaches to a single tag pane and applies hide class', async () => {
    const container = makeTagPane(['t', 'other']);
    document.body.appendChild(container);
    const { app } = makeApp([container]);
    const plugin = new Plugin();

    const obs = new TagPaneObserver(app as unknown as Parameters<typeof TagPaneObserver.prototype['init']> extends never ? never : never, plugin);
    obs.setRules([rule()]);
    obs.attachAll();
    await flushRaf();

    const rows = container.querySelectorAll('.tag-pane-tag');
    expect(rows[0].classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(rows[1].classList.contains(HIDDEN_CLASS)).toBe(false);
  });

  it('attaches to multiple tag panes', async () => {
    const a = makeTagPane(['t']);
    const b = makeTagPane(['t']);
    document.body.appendChild(a);
    document.body.appendChild(b);
    const { app } = makeApp([a, b]);
    const plugin = new Plugin();

    const obs = new TagPaneObserver(app as never, plugin);
    obs.setRules([rule()]);
    obs.attachAll();
    await flushRaf();

    expect(a.querySelector('.tag-pane-tag')?.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(b.querySelector('.tag-pane-tag')?.classList.contains(HIDDEN_CLASS)).toBe(true);
  });

  it('is idempotent (attaching twice does not double-observe)', async () => {
    const container = makeTagPane(['t']);
    document.body.appendChild(container);
    const { app } = makeApp([container]);
    const plugin = new Plugin();

    const obs = new TagPaneObserver(app as never, plugin);
    obs.setRules([rule()]);
    obs.attachAll();
    obs.attachAll();
    await flushRaf();

    expect(plugin.registeredCleanups.length).toBe(1);
  });
});

describe('TagPaneObserver.apply', () => {
  it('sets aria-hidden and data-tag-curator-rule on hidden rows', async () => {
    const container = makeTagPane(['t']);
    document.body.appendChild(container);
    const { app } = makeApp([container]);
    const obs = new TagPaneObserver(app as never, new Plugin());
    obs.setRules([rule({ id: 'orphans' })]);
    obs.attachAll();
    await flushRaf();

    const row = container.querySelector('.tag-pane-tag') as HTMLElement;
    expect(row.getAttribute('aria-hidden')).toBe('true');
    expect(row.getAttribute(TAG_ATTR)).toBe('orphans');
  });

  it('clears classes and attributes when a rule stops matching', async () => {
    const container = makeTagPane(['t']);
    document.body.appendChild(container);
    const { app } = makeApp([container]);
    const obs = new TagPaneObserver(app as never, new Plugin());
    obs.setRules([rule()]);
    obs.attachAll();
    await flushRaf();

    obs.setRules([]); // no rules now
    await flushRaf();

    const row = container.querySelector('.tag-pane-tag') as HTMLElement;
    expect(row.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(row.hasAttribute('aria-hidden')).toBe(false);
    expect(row.hasAttribute(TAG_ATTR)).toBe(false);
  });

  it('strips a leading hash when matching against tag text', async () => {
    const container = makeTagPane(['#t']); // tag-pane often renders with leading #
    document.body.appendChild(container);
    const { app } = makeApp([container]);
    const obs = new TagPaneObserver(app as never, new Plugin());
    obs.setRules([rule()]); // matches list ['t'] (without hash)
    obs.attachAll();
    await flushRaf();

    const row = container.querySelector('.tag-pane-tag') as HTMLElement;
    expect(row.classList.contains(HIDDEN_CLASS)).toBe(true);
  });

  it('feeds tag metadata to frequency rules', async () => {
    const container = makeTagPane(['orphan']);
    document.body.appendChild(container);
    const { app } = makeApp([container]);
    const obs = new TagPaneObserver(app as never, new Plugin());

    const orphanRule = rule({
      id: 'orphan-rule',
      match: { type: 'frequency', operator: '<=', value: 1 },
    });
    obs.setRules([orphanRule]);
    obs.setMetadata(new Map([['orphan', meta('orphan', 1)]]));
    obs.attachAll();
    await flushRaf();

    const row = container.querySelector('.tag-pane-tag') as HTMLElement;
    expect(row.classList.contains(HIDDEN_CLASS)).toBe(true);
  });

  it('skips rows with empty tag text', async () => {
    const container = document.createElement('div');
    const row = document.createElement('div');
    row.className = 'tag-pane-tag';
    const text = document.createElement('span');
    text.className = 'tag-pane-tag-text';
    text.textContent = '   ';
    row.appendChild(text);
    container.appendChild(row);
    document.body.appendChild(container);

    const { app } = makeApp([container]);
    const obs = new TagPaneObserver(app as never, new Plugin());
    obs.setRules([rule()]);
    obs.attachAll();
    await flushRaf();

    expect(row.classList.contains(HIDDEN_CLASS)).toBe(false);
  });
});

describe('TagPaneObserver dry-run', () => {
  it('adds FLAG_CLASS instead of HIDDEN_CLASS when dryRun is true', async () => {
    const container = makeTagPane(['t']);
    document.body.appendChild(container);
    const { app } = makeApp([container]);
    const obs = new TagPaneObserver(app as never, new Plugin());
    obs.setRules([rule()]);
    obs.setDryRun(true);
    obs.attachAll();
    await flushRaf();

    const row = container.querySelector('.tag-pane-tag') as HTMLElement;
    expect(row.classList.contains(FLAG_CLASS)).toBe(true);
    expect(row.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(row.hasAttribute('aria-hidden')).toBe(false);
    expect(row.getAttribute(TAG_ATTR)).toBe('r');
  });

  it('swaps from FLAG to HIDDEN when dryRun is turned off', async () => {
    const container = makeTagPane(['t']);
    document.body.appendChild(container);
    const { app } = makeApp([container]);
    const obs = new TagPaneObserver(app as never, new Plugin());
    obs.setRules([rule()]);
    obs.setDryRun(true);
    obs.attachAll();
    await flushRaf();

    obs.setDryRun(false);
    await flushRaf();

    const row = container.querySelector('.tag-pane-tag') as HTMLElement;
    expect(row.classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(row.classList.contains(FLAG_CLASS)).toBe(false);
    expect(row.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('TagPaneObserver.setEnabled', () => {
  it('false strips all hide/flag classes and attributes', async () => {
    const container = makeTagPane(['t']);
    document.body.appendChild(container);
    const { app } = makeApp([container]);
    const obs = new TagPaneObserver(app as never, new Plugin());
    obs.setRules([rule()]);
    obs.attachAll();
    await flushRaf();

    obs.setEnabled(false);

    const row = container.querySelector('.tag-pane-tag') as HTMLElement;
    expect(row.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(row.hasAttribute('aria-hidden')).toBe(false);
    expect(row.hasAttribute(TAG_ATTR)).toBe(false);
  });

  it('true re-applies after a disable', async () => {
    const container = makeTagPane(['t']);
    document.body.appendChild(container);
    const { app } = makeApp([container]);
    const obs = new TagPaneObserver(app as never, new Plugin());
    obs.setRules([rule()]);
    obs.attachAll();
    await flushRaf();
    obs.setEnabled(false);
    obs.setEnabled(true);
    await flushRaf();

    const row = container.querySelector('.tag-pane-tag') as HTMLElement;
    expect(row.classList.contains(HIDDEN_CLASS)).toBe(true);
  });
});

describe('TagPaneObserver counts and lookups', () => {
  it('countHidden reflects hidden rows across panes', async () => {
    const a = makeTagPane(['t', 'other']);
    const b = makeTagPane(['t']);
    document.body.appendChild(a);
    document.body.appendChild(b);
    const { app } = makeApp([a, b]);
    const obs = new TagPaneObserver(app as never, new Plugin());
    obs.setRules([rule()]);
    obs.attachAll();
    await flushRaf();

    expect(obs.countHidden()).toBe(2);
  });

  it('countFlagged reflects flagged rows in dry-run', async () => {
    const a = makeTagPane(['t', 't', 'other']);
    document.body.appendChild(a);
    const { app } = makeApp([a]);
    const obs = new TagPaneObserver(app as never, new Plugin());
    obs.setRules([rule()]);
    obs.setDryRun(true);
    obs.attachAll();
    await flushRaf();

    expect(obs.countFlagged()).toBe(2);
    expect(obs.countHidden()).toBe(0);
  });

  it('ruleForElement returns the ruleId set on the row', async () => {
    const container = makeTagPane(['t']);
    document.body.appendChild(container);
    const { app } = makeApp([container]);
    const obs = new TagPaneObserver(app as never, new Plugin());
    obs.setRules([rule({ id: 'my-rule' })]);
    obs.attachAll();
    await flushRaf();

    const row = container.querySelector('.tag-pane-tag') as HTMLElement;
    expect(obs.ruleForElement(row)).toBe('my-rule');
  });
});

describe('TagPaneObserver.clearAll / unload', () => {
  it('clearAll removes hide/flag from every attached container', async () => {
    const a = makeTagPane(['t']);
    const b = makeTagPane(['t']);
    document.body.appendChild(a);
    document.body.appendChild(b);
    const { app } = makeApp([a, b]);
    const obs = new TagPaneObserver(app as never, new Plugin());
    obs.setRules([rule()]);
    obs.attachAll();
    await flushRaf();

    obs.clearAll();
    expect(a.querySelector('.tag-pane-tag')?.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(b.querySelector('.tag-pane-tag')?.classList.contains(HIDDEN_CLASS)).toBe(false);
  });

  it('unload clears DOM and forgets containers', async () => {
    const container = makeTagPane(['t']);
    document.body.appendChild(container);
    const { app } = makeApp([container]);
    const obs = new TagPaneObserver(app as never, new Plugin());
    obs.setRules([rule()]);
    obs.attachAll();
    await flushRaf();

    obs.unload();
    expect(container.querySelector('.tag-pane-tag')?.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(obs.countHidden()).toBe(0);
  });
});
