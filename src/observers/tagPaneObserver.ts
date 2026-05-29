import { App, Plugin, View, WorkspaceLeaf } from 'obsidian';
import { Rule, TagMeta } from '../types';
import { RuleEngine } from '../engine/ruleEngine';

const HIDDEN_CLASS = 'tag-curator-hidden';
const FLAG_CLASS = 'tag-curator-flagged';
const TAG_ATTR = 'data-tag-curator-rule';
const TAG_VIEW_TYPE = 'tag';

interface Filterable extends View {
  containerEl: HTMLElement;
}

export class TagPaneObserver {
  private app: App;
  private plugin: Plugin;
  private observers = new WeakMap<HTMLElement, MutationObserver>();
  private containers = new Set<HTMLElement>();
  private rules: Rule[] = [];
  private metadata = new Map<string, TagMeta>();
  private previewMode = false;
  private enabled = true;
  private rafQueued = false;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
  }

  init(): void {
    this.app.workspace.onLayoutReady(() => this.attachAll());
    this.plugin.registerEvent(
      this.app.workspace.on('layout-change', () => this.attachAll()),
    );
  }

  setRules(rules: Rule[]): void {
    this.rules = rules;
    this.scheduleApply();
  }

  setMetadata(metadata: Map<string, TagMeta>): void {
    this.metadata = metadata;
    this.scheduleApply();
  }

  setPreviewMode(previewMode: boolean): void {
    this.previewMode = previewMode;
    this.scheduleApply();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clearAll();
    else this.scheduleApply();
  }

  countHidden(): number {
    let count = 0;
    for (const container of this.containers) {
      count += container.querySelectorAll(`.${HIDDEN_CLASS}`).length;
    }
    return count;
  }

  countFlagged(): number {
    let count = 0;
    for (const container of this.containers) {
      count += container.querySelectorAll(`.${FLAG_CLASS}`).length;
    }
    return count;
  }

  ruleForElement(el: HTMLElement): string | null {
    return el.getAttribute(TAG_ATTR);
  }

  attachAll(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(TAG_VIEW_TYPE)) {
      this.attachLeaf(leaf);
    }
  }

  private attachLeaf(leaf: WorkspaceLeaf): void {
    const maybeDeferred = leaf as WorkspaceLeaf & {
      isDeferred?: boolean;
      loadIfDeferred?: () => void;
    };
    if (maybeDeferred.isDeferred) maybeDeferred.loadIfDeferred?.();
    const view = leaf.view as Filterable;
    const containerEl = view?.containerEl;
    if (!containerEl || this.observers.has(containerEl)) return;
    const obs = new MutationObserver(() => this.scheduleApply());
    obs.observe(containerEl, { childList: true, subtree: true });
    this.observers.set(containerEl, obs);
    this.containers.add(containerEl);
    this.plugin.register(() => {
      obs.disconnect();
      this.containers.delete(containerEl);
    });
    this.apply(containerEl);
  }

  private scheduleApply(): void {
    if (this.rafQueued) return;
    this.rafQueued = true;
    requestAnimationFrame(() => {
      this.rafQueued = false;
      for (const container of this.containers) this.apply(container);
    });
  }

  private apply(root: HTMLElement): void {
    if (!this.enabled) {
      this.clearWithin(root);
      return;
    }
    const rows = root.querySelectorAll<HTMLElement>('.tag-pane-tag');
    for (const row of Array.from(rows)) {
      const textEl = row.querySelector('.tag-pane-tag-text') ?? row;
      const tag = (textEl.textContent ?? '').trim();
      if (!tag) continue;
      const normalized = tag.startsWith('#') ? tag.slice(1) : tag;
      const meta = this.metadata.get(normalized);
      const result = RuleEngine.evaluateTag(normalized, meta, this.rules);
      if (result && !this.previewMode) {
        row.classList.add(HIDDEN_CLASS);
        row.classList.remove(FLAG_CLASS);
        row.setAttribute('aria-hidden', 'true');
        row.setAttribute(TAG_ATTR, result.ruleId);
      } else if (result && this.previewMode) {
        row.classList.add(FLAG_CLASS);
        row.classList.remove(HIDDEN_CLASS);
        row.removeAttribute('aria-hidden');
        row.setAttribute(TAG_ATTR, result.ruleId);
      } else {
        row.classList.remove(HIDDEN_CLASS);
        row.classList.remove(FLAG_CLASS);
        row.removeAttribute('aria-hidden');
        row.removeAttribute(TAG_ATTR);
      }
    }
  }

  private clearWithin(root: HTMLElement): void {
    const rows = root.querySelectorAll<HTMLElement>(`.${HIDDEN_CLASS}, .${FLAG_CLASS}`);
    for (const row of Array.from(rows)) {
      row.classList.remove(HIDDEN_CLASS);
      row.classList.remove(FLAG_CLASS);
      row.removeAttribute('aria-hidden');
      row.removeAttribute(TAG_ATTR);
    }
  }

  clearAll(): void {
    for (const container of this.containers) this.clearWithin(container);
  }

  unload(): void {
    this.clearAll();
    this.containers.clear();
  }
}
