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
import { RuleEditor } from '../ruleEditor';
import { TagTable } from './tagTable';
import { TagListDiagnosticsHost } from './tagTableHost';

export const CURATION_VIEW_TYPE = 'tag-curator-workspace';

/** Which surface the workspace content area is showing. */
type WorkspaceMode = 'tags' | 'rules';

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

  // Active content surface. Defaults to the tag table; the header segmented
  // control switches to the inline rule editor (Phase 3B-2, D-010 + D-012).
  private mode: WorkspaceMode = 'tags';
  // Host element the active component mounts into. Cleared and repopulated on
  // every mode switch so only one component owns the DOM at a time. Named
  // contentHost (not contentEl) to avoid shadowing ItemView.contentEl.
  private contentHost: HTMLElement | null = null;
  // Segmented-control buttons, keyed by mode, for active-state styling.
  private modeButtons = new Map<WorkspaceMode, HTMLElement>();

  // The virtualized tag table (Phase 3B-1). Built when "Tags" mode mounts,
  // repainted by refresh, torn down when leaving the mode or closing the leaf.
  private table: TagTable | null = null;
  // The inline rule editor (Phase 3B-2). The SAME component the settings
  // Custom-rules tab uses; mounted when "Rules" mode is active, torn down
  // otherwise. Reused verbatim, never duplicated.
  private editor: RuleEditor | null = null;
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
    return 'Tag Curator';
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
    this.editor?.destroy();
    this.editor = null;
    this.banner?.destroy();
    this.banner = null;
  }

  /** Pre-filter the table to currently non-shown tags (status-bar intent). */
  setHiddenOnly(v: boolean): void {
    // This intent targets the tag table; ensure it is the active surface.
    if (this.mode !== 'tags') this.setMode('tags');
    this.model.setFilter(v ? 'hidden' : 'all');
    this.refresh();
  }

  // -----------------------------------------------------------------
  // UI construction
  // -----------------------------------------------------------------

  private buildUI(): void {
    // Destroy any existing components and banner before rebuilding so repeated
    // open/close cycles do not accumulate DOM nodes or scroll listeners.
    this.table?.destroy();
    this.table = null;
    this.editor?.destroy();
    this.editor = null;
    this.banner?.destroy();
    this.banner = null;
    this.modeButtons.clear();

    this.container.empty();
    this.container.addClass('tag-curator-workspace');

    // Persistent state banner above the content (D-007). Stays above both the
    // Tags and Rules surfaces.
    this.banner = new StateBanner(this.container, this.plugin);

    const header = this.container.createDiv({ cls: 'tcw-header' });
    header.createEl('h2', { text: 'Tag Curator' });

    // Segmented control: switch the content area between the tag table and the
    // inline rule editor without leaving the leaf (D-010 + D-012).
    const seg = header.createDiv({ cls: 'tcw-modeswitch' });
    seg.setAttribute('role', 'tablist');
    this.addModeButton(seg, 'tags', 'Tags');
    this.addModeButton(seg, 'rules', 'Rules');

    // Single host the active component mounts into. Mode switches clear this
    // element and mount the relevant component; the inactive one is destroyed.
    this.contentHost = this.container.createDiv({ cls: 'tcw-content' });

    this.mountActiveMode();
  }

  private addModeButton(
    parent: HTMLElement,
    mode: WorkspaceMode,
    label: string,
  ): void {
    const btn = parent.createEl('button', {
      cls: 'tcw-modeswitch-btn',
      text: label,
    });
    btn.setAttribute('role', 'tab');
    btn.toggleClass('active', this.mode === mode);
    btn.setAttribute('aria-selected', String(this.mode === mode));
    btn.addEventListener('click', () => this.setMode(mode));
    this.modeButtons.set(mode, btn);
  }

  /** Switch the active surface, tearing down the inactive component cleanly. */
  private setMode(mode: WorkspaceMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    for (const [m, btn] of this.modeButtons) {
      btn.toggleClass('active', m === mode);
      btn.setAttribute('aria-selected', String(m === mode));
    }
    this.mountActiveMode();
  }

  /**
   * Mount the component for the current mode into the content host and destroy
   * the other one. Only one component owns the DOM at a time, so there are no
   * leaked listeners or duplicate nodes across switches.
   */
  private mountActiveMode(): void {
    const host = this.contentHost;
    if (!host) return;

    // Tear down whichever component is not the active mode, then clear the host.
    if (this.mode === 'tags') {
      this.editor?.destroy();
      this.editor = null;
    } else {
      this.table?.destroy();
      this.table = null;
    }
    host.empty();

    if (this.mode === 'tags') {
      // The virtualized sortable tag table. Owns its own toolbar (chips +
      // search + sort), bulk bar, and rows.
      this.table = new TagTable(host, this.model, this.actions, this.tableHost);
      this.table.refresh();
    } else {
      // The EXISTING card-view rule editor (right-docked preview included),
      // constructed exactly as the settings Custom-rules tab does: a plain
      // host element plus the plugin. It persists via the same settingsManager
      // rule mutators and lives entirely inside this leaf.
      this.editor = new RuleEditor(host, this.plugin);
    }
  }

  // -----------------------------------------------------------------
  // Data refresh
  // -----------------------------------------------------------------

  private refresh(): void {
    // Only the tag table needs explicit repaint on settings/meta changes. The
    // rule editor subscribes to settingsManager.onChange itself and self-renders.
    this.table?.refresh();
  }
}
