/**
 * Curation Workspace view (D-012).
 *
 * The primary surface for Tag Curator: a dedicated leaf where you see, edit,
 * preview, and act on tags. Settings holds set-once config and launches this
 * workspace. This view renders the shared host-agnostic core (TagListModel +
 * TagActions) that the rule engine and observers already route through, so the
 * workspace and the live tag pane stay in lockstep.
 *
 * Phase 2 ships the shell only: a state banner above a minimal table (tag,
 * count, visibility) proving the leaf renders live data. Phase 3 replaces the
 * minimal table with the virtualized sortable table, inline editor, and
 * per-row actions.
 */
import { ItemView, WorkspaceLeaf } from 'obsidian';
import TagCuratorPlugin from '../../main';
import { StateBanner } from '../stateBanner';
import { TagListModel, TagListDataSource } from '../tagList/tagListModel';
import { TagActions, TagActionsHost } from '../tagList/tagActions';

export const CURATION_VIEW_TYPE = 'tag-curator-workspace';

export interface CurationWorkspaceOptions {
  /** When true, the table opens pre-filtered to currently non-shown tags. */
  hiddenOnly?: boolean;
}

export class CurationWorkspaceView extends ItemView {
  plugin: TagCuratorPlugin;
  private container: HTMLElement;
  private banner: StateBanner | null = null;

  private model: TagListModel;
  private actions: TagActions;

  // DOM hook for the live-refreshing table body.
  private tbodyEl: HTMLElement | null = null;

  // Settings onChange currently has no off(); guard the handler after close.
  private detached = false;

  constructor(leaf: WorkspaceLeaf, plugin: TagCuratorPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.container = this.containerEl.children[1] as HTMLElement;

    const dataSource: TagListDataSource = {
      getSettings: () => this.plugin.settingsManager.get(),
      getMeta: () => this.plugin.tagMetaManager.all(),
    };
    this.model = new TagListModel(dataSource);

    const host: TagActionsHost = {
      isPluginEnabled: (id) => {
        const plugins = (this.app as unknown as {
          plugins?: { enabledPlugins?: Set<string> };
        }).plugins;
        return Boolean(plugins?.enabledPlugins?.has(id));
      },
      executeCommand: (id) => {
        const commands = (this.app as unknown as {
          commands?: { executeCommandById?: (id: string) => boolean };
        }).commands;
        return Boolean(commands?.executeCommandById?.(id));
      },
    };
    this.actions = new TagActions(host);
    void this.actions; // wired now; per-row/bulk actions land in Phase 3.
  }

  getViewType(): string {
    return CURATION_VIEW_TYPE;
  }
  getDisplayText(): string {
    return 'Curation Workspace';
  }
  getIcon(): string {
    return 'tags';
  }

  async onOpen(): Promise<void> {
    this.buildUI();
    this.refresh();
    this.plugin.settingsManager.onChange(() => this.refresh());
    this.registerEvent(
      this.plugin.tagMetaManager.on('changed', () => this.refresh()),
    );
  }

  async onClose(): Promise<void> {
    this.detached = true;
    this.banner?.destroy();
    this.banner = null;
  }

  /** Pre-filter the table to currently non-shown tags (status-bar intent). */
  setHiddenOnly(v: boolean): void {
    this.model.setFilter(v ? 'hidden' : 'all');
    this.refresh();
  }

  // -----------------------------------------------------------------
  // UI construction
  // -----------------------------------------------------------------

  private buildUI(): void {
    this.container.empty();
    this.container.addClass('tag-curator-workspace');

    // Persistent state banner above the content (D-007).
    this.banner = new StateBanner(this.container, this.plugin);

    const header = this.container.createDiv({ cls: 'tcw-header' });
    header.createEl('h2', { text: 'Curation Workspace' });

    const tableWrap = this.container.createDiv({ cls: 'tcw-table-wrap' });
    const table = tableWrap.createEl('table', { cls: 'tcw-table' });
    const thead = table.createEl('thead');
    const headRow = thead.createEl('tr');
    headRow.createEl('th', { text: 'Tag' });
    headRow.createEl('th', { text: 'Count' });
    headRow.createEl('th', { text: 'Visible?' });
    this.tbodyEl = table.createEl('tbody');
  }

  // -----------------------------------------------------------------
  // Data refresh
  // -----------------------------------------------------------------

  private refresh(): void {
    if (this.detached || !this.tbodyEl) return;
    const rows = this.model.rows();

    this.tbodyEl.empty();
    if (rows.length === 0) {
      const emptyRow = this.tbodyEl.createEl('tr');
      const cell = emptyRow.createEl('td');
      cell.colSpan = 3;
      cell.setText('No tags yet. Start tagging notes to populate this list.');
      cell.addClass('tcw-empty');
      return;
    }

    for (const row of rows) {
      const tr = this.tbodyEl.createEl('tr');
      if (row.visibility === 'hidden') tr.addClass('tcw-row-hidden');
      if (row.visibility === 'flagged') tr.addClass('tcw-row-flagged');
      tr.createEl('td', { text: '#' + row.meta.tag });
      tr.createEl('td', { text: String(row.meta.count) });
      tr.createEl('td', {
        cls: 'tcw-vis tcw-vis-' + row.visibility,
        text: row.visibility,
      });
    }
  }
}
