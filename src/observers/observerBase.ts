import { App, Plugin } from 'obsidian';
import { Rule, TagMeta } from '../types';
import { RuleEngine } from '../engine/ruleEngine';

/**
 * Shared lifecycle for DOM observers that decorate tag rows in some host surface
 * (Obsidian's core tag pane, Notebook Navigator's tag tree, and so on).
 *
 * The base owns the generic machinery: a registry of observed containers, the
 * MutationObserver wiring, a requestAnimationFrame-coalesced apply loop, the
 * shared rules / metadata / previewMode / enabled state, and clear/unload.
 * Subclasses supply only the surface-specific pieces:
 *   - init(): discover containers (and any reattachment triggers) and call
 *     observeContainer() for each.
 *   - findRows(root): locate the tag rows and read each row's raw tag text.
 *   - applyDecoration(el, ruleId, mode): mark a row hidden or flagged.
 *   - clearDecoration(el): remove any decoration from a row.
 *   - findDecorated(root): the rows currently decorated (used to clear).
 */
export interface ObservedRow {
  el: HTMLElement;
  tag: string;
}

export type DecorationMode = 'hidden' | 'flagged';

export abstract class ObserverBase {
  protected app: App;
  protected plugin: Plugin;
  protected containers = new Set<HTMLElement>();
  private observers = new WeakMap<HTMLElement, MutationObserver>();
  protected rules: Rule[] = [];
  protected metadata = new Map<string, TagMeta>();
  protected previewMode = false;
  protected enabled = true;
  private rafQueued = false;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
  }

  /** Discover containers and wire any reattachment triggers. */
  abstract init(): void;

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

  /**
   * Start observing a container, decorate it once, and register cleanup.
   * Idempotent: observing the same container twice is a no-op.
   */
  protected observeContainer(containerEl: HTMLElement): void {
    if (this.observers.has(containerEl)) return;
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

  /** Coalesce repeated apply requests into a single animation frame. */
  protected scheduleApply(): void {
    if (this.rafQueued) return;
    this.rafQueued = true;
    requestAnimationFrame(() => {
      this.rafQueued = false;
      for (const container of this.containers) this.apply(container);
    });
  }

  protected apply(root: HTMLElement): void {
    if (!this.enabled) {
      this.clearWithin(root);
      return;
    }
    for (const { el, tag } of this.findRows(root)) {
      if (!tag) continue;
      const normalized = tag.startsWith('#') ? tag.slice(1) : tag;
      const meta = this.metadata.get(normalized);
      const result = RuleEngine.evaluateTag(normalized, meta, this.rules);
      if (result && !this.previewMode) {
        this.applyDecoration(el, result.ruleId, 'hidden');
      } else if (result && this.previewMode) {
        this.applyDecoration(el, result.ruleId, 'flagged');
      } else {
        this.clearDecoration(el);
      }
    }
  }

  protected clearWithin(root: HTMLElement): void {
    for (const el of this.findDecorated(root)) this.clearDecoration(el);
  }

  clearAll(): void {
    for (const container of this.containers) this.clearWithin(container);
  }

  unload(): void {
    this.clearAll();
    this.containers.clear();
  }

  // --- Surface-specific hooks, implemented by each subclass ---

  protected abstract findRows(root: HTMLElement): ObservedRow[];
  protected abstract applyDecoration(
    el: HTMLElement,
    ruleId: string,
    mode: DecorationMode,
  ): void;
  protected abstract clearDecoration(el: HTMLElement): void;
  protected abstract findDecorated(root: HTMLElement): HTMLElement[];
}
