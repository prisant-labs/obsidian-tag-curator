// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Plugin } from 'obsidian';
import { AutocompleteObserver } from '../src/observers/autocompleteObserver';
import { Rule, TagMeta } from '../src/types';

// Tag-Curator-namespaced decoration for the autocomplete scope. Distinct from
// tag-pane (tag-curator-*), NN (tc-nn-*), and Properties (tc-prop-*).
const HIDDEN_CLASS = 'tc-ac-hidden';
const FLAG_CLASS = 'tc-ac-flagged';
const RULE_ATTR = 'data-tc-ac-rule';

function rule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'r',
    name: 'r',
    enabled: true,
    priority: 50,
    match: { type: 'list', list: ['draft'] },
    action: 'hide',
    scopes: ['autocomplete'],
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

/**
 * One TAG suggestion item as the core editor tag autocomplete renders it: a
 * div.suggestion-item whose visible text (in .suggestion-content) carries the
 * leading '#'. The leading '#' is the conservative signal the observer uses to
 * recognize a tag suggestion vs a file / heading / link suggestion.
 */
function makeTagItem(tagText: string): HTMLElement {
  const item = document.createElement('div');
  item.className = 'suggestion-item mod-complex';
  const content = document.createElement('div');
  content.className = 'suggestion-content';
  content.textContent = tagText;
  item.appendChild(content);
  return item;
}

/**
 * A non-tag suggestion item (e.g. a file link or heading): same .suggestion-item
 * shape, but its text does NOT start with '#'. Must NEVER be decorated.
 */
function makeNonTagItem(text: string): HTMLElement {
  const item = document.createElement('div');
  item.className = 'suggestion-item mod-complex';
  const content = document.createElement('div');
  content.className = 'suggestion-content';
  content.textContent = text;
  item.appendChild(content);
  return item;
}

/**
 * The transient suggestion popup the editor portals to document.body: a
 * div.suggestion-container wrapping a .suggestion list of .suggestion-item rows.
 * Items are passed as pre-built elements so a test can mix tag and non-tag items.
 */
function makeSuggestionContainer(items: HTMLElement[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'suggestion-container';
  const list = document.createElement('div');
  list.className = 'suggestion';
  for (const it of items) list.appendChild(it);
  container.appendChild(list);
  return container;
}

interface FakeWorkspace {
  onLayoutReady: (cb: () => void) => void;
  on: (event: string, cb: () => void) => { event: string; cb: () => void };
  getLeavesOfType: () => never[];
}

/**
 * The autocomplete popup is not addressable by a leaf view type; the observer
 * watches a stable root (document.body) for the transient .suggestion-container
 * appearing. The fake workspace only needs onLayoutReady / on to exist.
 */
function makeApp(): { workspace: FakeWorkspace } {
  const workspace: FakeWorkspace = {
    onLayoutReady: (cb) => cb(),
    on: (event, cb) => ({ event, cb }),
    getLeavesOfType: () => [],
  };
  return { workspace };
}

function itemFor(root: ParentNode, tagText: string): HTMLElement {
  const items = Array.from(
    root.querySelectorAll<HTMLElement>('.suggestion-item'),
  );
  return items.find(
    (i) =>
      (i.querySelector('.suggestion-content')?.textContent ?? i.textContent ?? '').trim() ===
      tagText,
  ) as HTMLElement;
}

function flushRaf(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

// happy-dom does not run a real animation-frame loop fast enough for the tests;
// drive rAF synchronously via a microtask so flushRaf resolves deterministically.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    queueMicrotask(() => cb(performance.now()));
    return 0 as unknown as number;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('AutocompleteObserver basic suppression', () => {
  it('suppresses a tag suggestion that matches a hide rule and leaves the shown one untouched', async () => {
    const container = makeSuggestionContainer([
      makeTagItem('#draft'),
      makeTagItem('#keep'),
    ]);
    document.body.appendChild(container);
    const obs = new AutocompleteObserver(makeApp() as never, new Plugin());
    obs.setRules([rule()]);
    obs.init();
    await flushRaf();

    expect(itemFor(container, '#draft').classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(itemFor(container, '#keep').classList.contains(HIDDEN_CLASS)).toBe(false);
  });

  it('sets the data-tc-ac-rule marker and aria-hidden on suppressed items', async () => {
    const container = makeSuggestionContainer([makeTagItem('#draft')]);
    document.body.appendChild(container);
    const obs = new AutocompleteObserver(makeApp() as never, new Plugin());
    obs.setRules([rule({ id: 'hide-draft' })]);
    obs.init();
    await flushRaf();

    const item = itemFor(container, '#draft');
    expect(item.getAttribute(RULE_ATTR)).toBe('hide-draft');
    expect(item.getAttribute('aria-hidden')).toBe('true');
  });

  it('feeds tag metadata to frequency rules', async () => {
    const container = makeSuggestionContainer([makeTagItem('#orphan')]);
    document.body.appendChild(container);
    const obs = new AutocompleteObserver(makeApp() as never, new Plugin());
    obs.setRules([
      rule({ id: 'orphan-rule', match: { type: 'frequency', operator: '<=', value: 1 } }),
    ]);
    obs.setMetadata(new Map([['orphan', meta('orphan', 1)]]));
    obs.init();
    await flushRaf();

    expect(itemFor(container, '#orphan').classList.contains(HIDDEN_CLASS)).toBe(true);
  });
});

describe('AutocompleteObserver only touches tag suggestions', () => {
  it('never decorates a non-tag suggestion item even when its text equals a hidden tag name', async () => {
    const container = makeSuggestionContainer([
      makeTagItem('#draft'),
      // A file/heading suggestion whose text equals a hidden tag name (no '#').
      makeNonTagItem('draft'),
    ]);
    document.body.appendChild(container);
    const obs = new AutocompleteObserver(makeApp() as never, new Plugin());
    obs.setRules([rule()]);
    obs.init();
    await flushRaf();

    const nonTag = itemFor(container, 'draft');
    expect(nonTag.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(nonTag.hasAttribute(RULE_ATTR)).toBe(false);

    // The genuine tag suggestion of the same name IS suppressed.
    expect(itemFor(container, '#draft').classList.contains(HIDDEN_CLASS)).toBe(true);
  });
});

describe('AutocompleteObserver case-sensitivity contract', () => {
  it('suppresses a tag suggestion whose case matches the rule list exactly', async () => {
    const container = makeSuggestionContainer([makeTagItem('#AI')]);
    document.body.appendChild(container);
    const obs = new AutocompleteObserver(makeApp() as never, new Plugin());
    obs.setRules([rule({ match: { type: 'list', list: ['AI'] } })]);
    obs.init();
    await flushRaf();

    expect(itemFor(container, '#AI').classList.contains(HIDDEN_CLASS)).toBe(true);
  });

  it('does NOT suppress a tag suggestion when its case differs from the rule list', async () => {
    const container = makeSuggestionContainer([makeTagItem('#AI')]);
    document.body.appendChild(container);
    const obs = new AutocompleteObserver(makeApp() as never, new Plugin());
    obs.setRules([rule({ match: { type: 'list', list: ['ai'] } })]);
    obs.init();
    await flushRaf();

    expect(itemFor(container, '#AI').classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(itemFor(container, '#AI').hasAttribute(RULE_ATTR)).toBe(false);
  });
});

describe('AutocompleteObserver override across surfaces', () => {
  it('always-show override keeps the suggestion visible even when a hide rule matches', async () => {
    const container = makeSuggestionContainer([makeTagItem('#AI')]);
    document.body.appendChild(container);
    const obs = new AutocompleteObserver(makeApp() as never, new Plugin());
    obs.setRules([rule({ match: { type: 'list', list: ['AI'] } })]);
    obs.setOverrides({ AI: 'show' });
    obs.init();
    await flushRaf();

    const item = itemFor(container, '#AI');
    expect(item.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(item.classList.contains(FLAG_CLASS)).toBe(false);
    expect(item.hasAttribute(RULE_ATTR)).toBe(false);
  });
});

describe('AutocompleteObserver idempotency', () => {
  it('re-running apply does not double-decorate', async () => {
    const container = makeSuggestionContainer([makeTagItem('#draft')]);
    document.body.appendChild(container);
    const obs = new AutocompleteObserver(makeApp() as never, new Plugin());
    obs.setRules([rule()]);
    obs.init();
    await flushRaf();
    obs.setRules([rule()]);
    await flushRaf();

    expect(container.querySelectorAll(`.${HIDDEN_CLASS}`).length).toBe(1);
  });
});

describe('AutocompleteObserver preview mode', () => {
  it('flags instead of hides when previewMode is on', async () => {
    const container = makeSuggestionContainer([makeTagItem('#draft')]);
    document.body.appendChild(container);
    const obs = new AutocompleteObserver(makeApp() as never, new Plugin());
    obs.setRules([rule()]);
    obs.setPreviewMode(true);
    obs.init();
    await flushRaf();

    const item = itemFor(container, '#draft');
    expect(item.classList.contains(FLAG_CLASS)).toBe(true);
    expect(item.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(item.hasAttribute('aria-hidden')).toBe(false);
    expect(item.getAttribute(RULE_ATTR)).toBe('r');
  });
});

describe('AutocompleteObserver transient popup', () => {
  it('re-decorates a fresh popup that appears after init (transient-popup path)', async () => {
    // No container present at init time - the editor has not yet shown a popup.
    const obs = new AutocompleteObserver(makeApp() as never, new Plugin());
    obs.setRules([rule()]);
    obs.init();
    await flushRaf();

    // Later, a keystroke produces a brand-new popup, appended to the body. The
    // body observer must catch it and decorate the matching tag item.
    const fresh = makeSuggestionContainer([makeTagItem('#draft'), makeTagItem('#keep')]);
    document.body.appendChild(fresh);
    await flushRaf();
    // The body MutationObserver fires asynchronously; flush a second frame so the
    // scheduled apply pass runs against the freshly attached container.
    await flushRaf();

    expect(itemFor(fresh, '#draft').classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(itemFor(fresh, '#keep').classList.contains(HIDDEN_CLASS)).toBe(false);
  });

  it('decorates a popup that already exists in the body at init time', async () => {
    const container = makeSuggestionContainer([makeTagItem('#draft')]);
    document.body.appendChild(container);
    const obs = new AutocompleteObserver(makeApp() as never, new Plugin());
    obs.setRules([rule()]);
    obs.init();
    await flushRaf();

    expect(itemFor(container, '#draft').classList.contains(HIDDEN_CLASS)).toBe(true);
  });
});

describe('AutocompleteObserver defensive selectors', () => {
  it('finds no rows (and never throws) when no suggestion popup is present', async () => {
    const obs = new AutocompleteObserver(makeApp() as never, new Plugin());
    obs.setRules([rule()]);
    expect(() => obs.init()).not.toThrow();
    await flushRaf();
    expect(document.querySelectorAll(`.${HIDDEN_CLASS}`).length).toBe(0);
  });
});

describe('AutocompleteObserver clear-on-unload / setEnabled', () => {
  it('setEnabled(false) strips all tc-ac-* decoration', async () => {
    const container = makeSuggestionContainer([makeTagItem('#draft')]);
    document.body.appendChild(container);
    const obs = new AutocompleteObserver(makeApp() as never, new Plugin());
    obs.setRules([rule()]);
    obs.init();
    await flushRaf();

    obs.setEnabled(false);

    const item = itemFor(container, '#draft');
    expect(item.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(item.hasAttribute('aria-hidden')).toBe(false);
    expect(item.hasAttribute(RULE_ATTR)).toBe(false);
  });

  it('unload removes every tc-ac-* class and marker, leaving the base suggestion-item class', async () => {
    const container = makeSuggestionContainer([
      makeTagItem('#draft'),
      makeTagItem('#keep'),
    ]);
    document.body.appendChild(container);
    const obs = new AutocompleteObserver(makeApp() as never, new Plugin());
    obs.setRules([rule()]);
    obs.init();
    await flushRaf();

    obs.unload();

    const item = itemFor(container, '#draft');
    expect(item.classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(item.classList.contains(FLAG_CLASS)).toBe(false);
    expect(item.hasAttribute(RULE_ATTR)).toBe(false);
    // The base suggestion-item class is untouched.
    expect(item.classList.contains('suggestion-item')).toBe(true);
  });
});
