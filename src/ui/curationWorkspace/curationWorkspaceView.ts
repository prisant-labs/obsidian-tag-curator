/**
 * Curation Workspace view (D-012).
 *
 * The dockable tag surface: a leaf where you see, browse, and act on tags. It
 * hosts the shared host-agnostic core (TagListModel + TagActions) that the rule
 * engine and observers route through, so the pane and the live tag pane stay in
 * lockstep.
 *
 * Rules are NOT edited here (item 1): rule management lives in Settings, reached
 * via the header gear (item 2). The pane is tags-only, with a View / Manage
 * toggle - View browses (tag names open a tag search), Manage curates (full
 * per-row + bulk).
 */
import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import TagCuratorPlugin from '../../main';
import { StateBanner } from '../stateBanner';
import { TagListModel } from '../tagList/tagListModel';
import { TagActions } from '../tagList/tagActions';
import { makeTagTableDeps } from '../tagList/tagTableDeps';
import { TagTable } from './tagTable';
import { TagListDiagnosticsHost } from './tagTableHost';

export const CURATION_VIEW_TYPE = 'tag-curator-workspace';

export interface CurationWorkspaceOptions {
  /** When true, the table opens pre-filtered to currently non-shown tags. */
  hiddenOnly?: boolean;
  /** When set, the table opens pre-filtered to a single rule or preset id. */
  ruleId?: string;
}

export class CurationWorkspaceView extends ItemView {
  plugin: TagCuratorPlugin;
  private container: HTMLElement;
  private banner: StateBanner | null = null;

  private model: TagListModel;
  private actions: TagActions;

  // View/Manage mode for the tag table in this pane. Opens calm (View).
  private paneMode: 'view' | 'manage' = 'view';
  private viewButtons = new Map<'view' | 'manage', HTMLElement>();
  // Host element the table mounts into.
  private contentHost: HTMLElement | null = null;

  private table: TagTable | null = null;
  private tableHost: TagListDiagnosticsHost;

  private unsubscribeSettings: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: TagCuratorPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.container = this.containerEl.children[1] as HTMLElement;

    const deps = makeTagTableDeps(this.plugin, this.app, () => this.refresh(), 'pane');
    this.model = deps.model;
    this.actions = deps.actions;
    this.tableHost = deps.host;
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
    this.banner?.destroy();
    this.banner = null;
  }

  /** Pre-filter the table to currently non-shown tags (status-bar intent). */
  setHiddenOnly(v: boolean): void {
    this.model.setFilter(v ? 'hidden' : 'all');
    // Clear any rule filter from a prior deep-link so the hidden view shows ALL
    // hidden tags, not a narrowed rule subset (F-3).
    this.model.setRuleFilter(null);
    this.refresh();
  }

  /** Pre-filter the table to a single rule or preset (deep-link intent). */
  setRuleFilter(ruleId: string): void {
    this.setPaneMode('manage');
    this.model.setFilter('all');
    this.model.setRuleFilter(ruleId);
    this.refresh();
  }

  // -----------------------------------------------------------------
  // UI construction
  // -----------------------------------------------------------------

  private buildUI(): void {
    this.table?.destroy();
    this.table = null;
    this.banner?.destroy();
    this.banner = null;
    this.viewButtons.clear();

    this.container.empty();
    this.container.addClass('tag-curator-workspace');

    // Persistent state banner above the content (D-007).
    this.banner = new StateBanner(this.container, this.plugin);

    const header = this.container.createDiv({ cls: 'tcw-header' });
    header.createEl('h2', { text: 'Tag Curator' });

    // Right-hand header group: the View/Manage switch, then a gear that opens
    // Settings (where rules and everything else live - items 1 + 2).
    const right = header.createDiv({ cls: 'tcw-header-right' });

    const viewSeg = right.createDiv({ cls: 'tcw-viewswitch' });
    viewSeg.setAttribute('role', 'tablist');
    this.addViewButton(viewSeg, 'view', 'View');
    this.addViewButton(viewSeg, 'manage', 'Manage');

    const gear = right.createEl('button', { cls: 'tcw-gear' });
    gear.setAttribute('aria-label', 'Open Tag Curator settings');
    gear.setAttribute('title', 'Open Tag Curator settings');
    setIcon(gear, 'settings');
    gear.addEventListener('click', () => this.openPluginSettings());

    this.contentHost = this.container.createDiv({ cls: 'tcw-content' });
    this.mountTable();
  }

  private addViewButton(
    parent: HTMLElement,
    mode: 'view' | 'manage',
    label: string,
  ): void {
    const btn = parent.createEl('button', {
      cls: 'tcw-viewswitch-btn',
      text: label,
    });
    btn.setAttribute('role', 'tab');
    btn.toggleClass('active', this.paneMode === mode);
    btn.setAttribute('aria-selected', String(this.paneMode === mode));
    btn.addEventListener('click', () => this.setPaneMode(mode));
    this.viewButtons.set(mode, btn);
  }

  /** Switch the tag table between View and Manage pane modes. */
  private setPaneMode(mode: 'view' | 'manage'): void {
    if (mode === this.paneMode) return;
    this.paneMode = mode;
    for (const [m, btn] of this.viewButtons) {
      btn.toggleClass('active', m === mode);
      btn.setAttribute('aria-selected', String(m === mode));
    }
    this.table?.setMode(mode);
  }

  private mountTable(): void {
    const host = this.contentHost;
    if (!host) return;
    this.table?.destroy();
    this.table = null;
    host.empty();
    this.table = new TagTable(host, this.model, this.actions, this.tableHost, {
      initialMode: this.paneMode,
      surface: 'pane',
    });
  }

  /** Open the plugin's own settings tab (the header gear, item 2). */
  private openPluginSettings(): void {
    const setting = (
      this.app as unknown as {
        setting?: { open?: () => void; openTabById?: (id: string) => void };
      }
    ).setting;
    setting?.open?.();
    setting?.openTabById?.(this.plugin.manifest.id);
  }

  // -----------------------------------------------------------------
  // Data refresh
  // -----------------------------------------------------------------

  private refresh(): void {
    this.table?.refresh();
  }
}
