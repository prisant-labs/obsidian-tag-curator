/**
 * Contextual bulk-action bar (Phase 3B-1, Step 3).
 *
 * Mirrors the Advanced Tables toolbar pattern: invisible when nothing is
 * selected, appearing only once the model holds a selection. Buttons route
 * through TagActions.applyBulk (Hide / Unhide) and TagActions.sendToTagWrangler.
 *
 * NOTE: There is no Flag bulk action. "flagged" is a derived display state of
 * Preview mode, not a per-tag pin you can bulk-apply, and the override store
 * (D-015) only holds 'show' | 'hide'. So this bar omits Flag by design; if a
 * flag override is ever added to the model/actions (see BulkAction), add the
 * button here.
 *
 * Tag Wrangler is gated (D-016): disabled with an explanatory tooltip when the
 * tag-wrangler plugin is not enabled.
 */
import { setIcon } from 'obsidian';
import { TagListModel } from '../tagList/tagListModel';
import { TagActions, BulkAction } from '../tagList/tagActions';
import { TagListDiagnosticsHost } from './tagTableHost';

export class BulkBar {
  private root: HTMLElement;
  private countEl: HTMLElement;
  // Stored so update() can reflect the live Tag Wrangler state each call.
  private twBtn: HTMLButtonElement;
  // Stored click handlers so destroy() can remove them.
  private readonly clickHandlers: Array<{ el: HTMLElement; fn: EventListener }> = [];

  constructor(
    parent: HTMLElement,
    private model: TagListModel,
    private actions: TagActions,
    private host: TagListDiagnosticsHost,
  ) {
    this.root = parent.createDiv({ cls: 'tct-bulk-bar' });
    this.countEl = this.root.createSpan({ cls: 'tct-bulk-count' });
    this.root.createDiv({ cls: 'tct-bulk-spacer' });

    this.addButton('Hide', 'eye-off', () => this.runBulk('hide'));
    this.addButton('Unhide', 'eye', () => this.runBulk('unhide'));
    this.addButton('Mark reviewed', 'check', () => this.runBulk('mark-reviewed'));

    // Tag Wrangler gate is intentionally NOT evaluated here; update() checks
    // isPluginEnabled() on every call so the button reflects current state.
    this.twBtn = this.addButton('Send to Tag Wrangler', 'pencil', () =>
      this.runBulk('send-to-tag-wrangler'),
    );

    this.addButton('Clear', 'x', () => {
      this.model.clearSelection();
      this.host.requestRefresh();
    });

    this.update();
  }

  private addButton(
    label: string,
    icon: string,
    onClick: () => void | Promise<void>,
  ): HTMLButtonElement {
    const btn = this.root.createEl('button', { cls: 'tct-bulk-btn' });
    const ic = btn.createSpan({ cls: 'tct-bulk-btn-ic' });
    setIcon(ic, icon);
    btn.createSpan({ text: label });
    const fn: EventListener = () => void onClick();
    btn.addEventListener('click', fn);
    this.clickHandlers.push({ el: btn, fn });
    return btn;
  }

  private async runBulk(action: BulkAction): Promise<void> {
    const tags = [...this.model.selection];
    if (tags.length === 0) return;
    await this.actions.applyBulk(tags, action);
    // Selection is consumed; clear it so the bar collapses after the action.
    this.model.clearSelection();
    this.host.requestRefresh();
  }

  /** Reflect the current selection size and live plugin state; hide when empty. */
  update(): void {
    const count = this.model.selection.size;
    if (count === 0) {
      this.root.addClass('tc-hidden');
      return;
    }
    this.root.removeClass('tc-hidden');
    this.countEl.setText(`${count} selected`);

    // Re-evaluate Tag Wrangler availability on every update so the button
    // reflects the current plugin state if it was toggled while the bar is open.
    const twEnabled = this.host.isPluginEnabled('tag-wrangler');
    this.twBtn.disabled = !twEnabled;
    if (twEnabled) {
      this.twBtn.removeAttribute('aria-label');
      this.twBtn.removeAttribute('title');
    } else {
      this.twBtn.setAttribute('aria-label', 'Install Tag Wrangler to enable rename');
      this.twBtn.setAttribute('title', 'Install Tag Wrangler to enable rename');
    }
  }

  /** Remove all event listeners and detach the bar from the DOM. */
  destroy(): void {
    for (const { el, fn } of this.clickHandlers) {
      el.removeEventListener('click', fn);
    }
    this.clickHandlers.length = 0;
    this.root.remove();
  }
}
