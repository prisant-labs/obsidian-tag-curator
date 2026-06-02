import { View, WorkspaceLeaf } from 'obsidian';
import { DecorationMode, ObservedRow, ObserverBase } from './observerBase';

const HIDDEN_CLASS = 'tag-curator-hidden';
const FLAG_CLASS = 'tag-curator-flagged';
const TAG_ATTR = 'data-tag-curator-rule';
const TAG_VIEW_TYPE = 'tag';

interface Filterable extends View {
  containerEl: HTMLElement;
}

/**
 * Decorates Obsidian's core tag pane (`.tag-pane-tag` rows). The shared
 * lifecycle lives in ObserverBase; this subclass supplies only the tag-pane
 * specifics: how to discover panes, how to read a row's tag, and how to mark a
 * row hidden or flagged.
 */
export class TagPaneObserver extends ObserverBase {
  init(): void {
    this.app.workspace.onLayoutReady(() => this.attachAll());
    this.plugin.registerEvent(
      this.app.workspace.on('layout-change', () => this.attachAll()),
    );
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
    if (!containerEl) return;
    this.observeContainer(containerEl);
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

  protected findRows(root: HTMLElement): ObservedRow[] {
    const rows = root.querySelectorAll<HTMLElement>('.tag-pane-tag');
    return Array.from(rows).map((row) => {
      const textEl = row.querySelector('.tag-pane-tag-text') ?? row;
      return { el: row, tag: (textEl.textContent ?? '').trim() };
    });
  }

  protected applyDecoration(
    el: HTMLElement,
    ruleId: string,
    mode: DecorationMode,
  ): void {
    if (mode === 'hidden') {
      el.classList.add(HIDDEN_CLASS);
      el.classList.remove(FLAG_CLASS);
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute(TAG_ATTR, ruleId);
    } else {
      el.classList.add(FLAG_CLASS);
      el.classList.remove(HIDDEN_CLASS);
      el.removeAttribute('aria-hidden');
      el.setAttribute(TAG_ATTR, ruleId);
    }
  }

  protected clearDecoration(el: HTMLElement): void {
    el.classList.remove(HIDDEN_CLASS);
    el.classList.remove(FLAG_CLASS);
    el.removeAttribute('aria-hidden');
    el.removeAttribute(TAG_ATTR);
  }

  protected findDecorated(root: HTMLElement): HTMLElement[] {
    return Array.from(
      root.querySelectorAll<HTMLElement>(`.${HIDDEN_CLASS}, .${FLAG_CLASS}`),
    );
  }
}
