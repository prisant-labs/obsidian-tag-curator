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
import { resolveActiveRules } from '../../engine/presets';
import { StateBanner } from '../stateBanner';
import { TagListModel, TagListDataSource } from '../tagList/tagListModel';
import { TagActions, TagActionsHost } from '../tagList/tagActions';
import { TagTable } from './tagTable';
import { TagListDiagnosticsHost } from './tagTableHost';

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

  // The virtualized tag table (Phase 3B-1). Built in buildUI, repainted by refresh.
  private table: TagTable | null = null;
  // Host surface the table uses for diagnostics + refresh.
  private tableHost: TagListDiagnosticsHost;

  // Unsubscribe handle returned by settingsManager.onChange; called in onClose.
  private unsubscribeSettings: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: TagCuratorPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.container = this.containerEl.children[1] as HTMLElement;

    const dataSource: TagListDataSource = {
      getSettings: () => this.plugin.settingsManager.get(),
      getMeta: () => this.plugin.tagMetaManager.all(),
    };
    this.model = new TagListModel(dataSource);

    const isPluginEnabled = (id: string): boolean => {
      const plugins = (this.app as unknown as {
        plugins?: { enabledPlugins?: Set<string> };
      }).plugins;
      return Boolean(plugins?.enabledPlugins?.has(id));
    };

    const host: TagActionsHost = {
      isPluginEnabled,
      executeCommand: (id) => {
        const commands = (this.app as unknown as {
          commands?: { executeCommandById?: (id: string) => boolean };
        }).commands;
        return Boolean(commands?.executeCommandById?.(id));
      },
      setOverride: (tag, value) => this.plugin.settingsManager.setOverride(tag, value),
    };
    this.actions = new TagActions(host);

    this.tableHost = {
      getSettings: () => this.plugin.settingsManager.get(),
      getMeta: () => this.plugin.tagMetaManager.all(),
      getActiveRules: () => resolveActiveRules(this.plugin.settingsManager.get()),
      isPluginEnabled,
      requestRefresh: () => this.refresh(),
    };
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
    this.unsubscribeSettings = this.plugin.settingsManager.onChange(() => this.refresh());
    this.registerEvent(
      this.plugin.tagMetaManager.on('changed', () => this.refresh()),
    );
  }

  async onClose(): Promise<void> {
    this.unsubscribeSettings?.();
    this.unsubscribeSettings = null;
    this.table?.destroy();
    this.table = null;
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
    // Destroy any existing table and banner before rebuilding so repeated
    // open/close cycles do not accumulate DOM nodes or scroll listeners.
    this.table?.destroy();
    this.table = null;
    this.banner?.destroy();
    this.banner = null;

    this.container.empty();
    this.container.addClass('tag-curator-workspace');

    // Persistent state banner above the content (D-007).
    this.banner = new StateBanner(this.container, this.plugin);

    const header = this.container.createDiv({ cls: 'tcw-header' });
    header.createEl('h2', { text: 'Curation Workspace' });

    // The virtualized sortable tag table renders below the banner + header.
    // It owns its own toolbar (chips + search + sort), bulk bar, and rows.
    this.table = new TagTable(this.container, this.model, this.actions, this.tableHost);
  }

  // -----------------------------------------------------------------
  // Data refresh
  // -----------------------------------------------------------------

  private refresh(): void {
    this.table?.refresh();
  }
}
