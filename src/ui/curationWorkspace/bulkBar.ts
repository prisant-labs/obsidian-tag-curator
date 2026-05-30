/**
 * Contextual bulk-action bar (Phase 3B-1, Step 3).
 *
 * Mirrors the Advanced Tables toolbar pattern: invisible when nothing is
 * selected, appearing only once the model holds a selection. Buttons route
 * through TagActions.applyBulk (Hide / Unhide) and TagActions.sendToTagWrangler.
 *
 * NOTE: There is no Flag bulk action. TagActions.BulkAction is
 * 'hide' | 'unhide' | 'send-to-tag-wrangler' and the override store (D-015)
 * only holds 'show' | 'hide'; "flagged" is a derived display state of Preview
 * mode, not a per-tag pin you can bulk-apply. So this bar omits Flag by design;
 * if a flag override is ever added to the model/actions, add the button here.
 *
 * Tag Wrangler is gated (D-016): disabled with an explanatory tooltip when the
 * tag-wrangler plugin is not enabled.
 */
import { setIcon } from 'obsidian';
import { TagListModel } from '../tagList/tagListModel';
import { TagActions } from '../tagList/tagActions';
import { TagListDiagnosticsHost } from './tagTableHost';

export class BulkBar {
  private root: HTMLElement;
  private countEl: HTMLElement;

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

    const twEnabled = this.host.isPluginEnabled('tag-wrangler');
    const twBtn = this.addButton('Send to Tag Wrangler', 'pencil', () =>
      this.runBulk('send-to-tag-wrangler'),
    );
    if (!twEnabled) {
      twBtn.disabled = true;
      twBtn.setAttribute(
        'aria-label',
        'Install Tag Wrangler to enable rename',
      );
      twBtn.setAttribute('title', 'Install Tag Wrangler to enable rename');
    }

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
    btn.addEventListener('click', () => void onClick());
    return btn;
  }

  private async runBulk(
    action: 'hide' | 'unhide' | 'send-to-tag-wrangler',
  ): Promise<void> {
    const tags = [...this.model.selection];
    if (tags.length === 0) return;
    await this.actions.applyBulk(tags, action);
    // Selection is consumed; clear it so the bar collapses after the action.
    this.model.clearSelection();
    this.host.requestRefresh();
  }

  /** Reflect the current selection size; hide the bar when empty. */
  update(): void {
    const count = this.model.selection.size;
    if (count === 0) {
      this.root.style.display = 'none';
      return;
    }
    this.root.style.display = '';
    this.countEl.setText(`${count} selected`);
  }
}
