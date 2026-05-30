import { Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { SettingsManager } from './storage/settings';
import { TagMetaManager } from './storage/tagMeta';
import { TagPaneObserver } from './observers/tagPaneObserver';
import { TagCuratorSettingTab } from './ui/settingsTab';
import { TagListView, TAG_LIST_VIEW_TYPE } from './ui/tagListView';
import {
  CurationWorkspaceView,
  CURATION_VIEW_TYPE,
  CurationWorkspaceOptions,
} from './ui/curationWorkspace/curationWorkspaceView';
import { resolveActiveRules } from './engine/presets';
import { panicCleanup } from './ui/panicDisable';
import { WelcomeModal } from './ui/welcomeModal';

export default class TagCuratorPlugin extends Plugin {
  settingsManager!: SettingsManager;
  tagMetaManager!: TagMetaManager;
  tagPaneObserver!: TagPaneObserver;
  private statusBarEl: HTMLElement | null = null;

  async onload(): Promise<void> {
    this.settingsManager = new SettingsManager(this);
    await this.settingsManager.load();
    const settings = this.settingsManager.get();

    this.tagMetaManager = new TagMetaManager(this.app, this);
    this.tagMetaManager.setDebounceMs(settings.sidecarDebounceMs);
    await this.tagMetaManager.load();

    this.tagPaneObserver = new TagPaneObserver(this.app, this);
    this.tagPaneObserver.setRules(resolveActiveRules(settings));
    this.tagPaneObserver.setMetadata(this.tagMetaManager.all());
    this.tagPaneObserver.setOverrides(settings.overrides);
    this.tagPaneObserver.setPreviewMode(settings.previewMode);
    this.tagPaneObserver.setEnabled(settings.enabled);
    this.tagPaneObserver.init();

    // TagListView is superseded by CurationWorkspaceView per D-012 but kept
    // registered for one release so existing commands and saved layouts do not
    // break. Slated for removal in v1.1.
    this.registerView(TAG_LIST_VIEW_TYPE, (leaf: WorkspaceLeaf) => new TagListView(leaf, this));
    this.registerView(
      CURATION_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new CurationWorkspaceView(leaf, this),
    );

    this.addRibbonIcon('tags', 'Open Curation Workspace', () => {
      void this.openCurationWorkspace();
    });

    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass('tag-curator-status');
    this.statusBarEl.addEventListener('click', () => {
      // The workspace replaces the tag-list leaf as the home surface; preserve
      // the hidden-filter intent of the status-bar click.
      void this.openCurationWorkspace({ hiddenOnly: true });
    });

    this.addSettingTab(new TagCuratorSettingTab(this.app, this));

    this.settingsManager.onChange(() => {
      const next = this.settingsManager.get();
      this.tagMetaManager.setDebounceMs(next.sidecarDebounceMs);
      this.tagPaneObserver.setRules(resolveActiveRules(next));
      this.tagPaneObserver.setOverrides(next.overrides);
      this.tagPaneObserver.setPreviewMode(next.previewMode);
      this.tagPaneObserver.setEnabled(next.enabled);
      this.refreshStatusBar();
    });

    this.registerEvent(
      this.tagMetaManager.on('changed', () => {
        this.tagPaneObserver.setMetadata(this.tagMetaManager.all());
        this.refreshStatusBar();
      }),
    );

    this.registerEvent(
      this.app.metadataCache.on('changed', (file) => this.tagMetaManager.indexFile(file)),
    );
    this.registerEvent(
      this.app.metadataCache.on('resolved', () => {
        this.tagPaneObserver.setMetadata(this.tagMetaManager.all());
        this.tagPaneObserver.attachAll();
        this.refreshStatusBar();
      }),
    );
    this.registerEvent(
      this.app.metadataCache.on('deleted', (file) => this.tagMetaManager.removeFile(file.path)),
    );
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if (file instanceof TFile) this.tagMetaManager.renameFile(oldPath, file.path);
      }),
    );

    this.addCommand({
      id: 'toggle-enable',
      name: 'Toggle enable',
      callback: () => {
        void this.toggleEnable();
      },
    });
    this.addCommand({
      id: 'panic-disable',
      name: 'Panic disable (remove all DOM effects now)',
      callback: () => this.panicDisable(),
    });
    this.addCommand({
      id: 'toggle-preview-mode',
      name: 'Toggle preview mode',
      callback: () => {
        void this.togglePreviewMode();
      },
    });
    this.addCommand({
      id: 'open-curation-workspace',
      name: 'Open Curation Workspace',
      callback: () => {
        void this.openCurationWorkspace();
      },
    });
    this.addCommand({
      id: 'open-curation-workspace-beside-tag-pane',
      name: 'Open Curation Workspace beside the tag pane',
      callback: () => {
        void this.openBesideTagPane();
      },
    });
    this.addCommand({
      id: 'open-tag-list',
      name: 'Open tag list view',
      callback: () => {
        void this.openTagList();
      },
    });
    this.addCommand({
      id: 'open-tag-list-hidden',
      name: 'Open tag list (hidden tags only)',
      callback: () => {
        void this.openTagListWithHiddenFilter();
      },
    });
    this.addCommand({
      id: 'rescan-tags',
      name: 'Rescan vault tags',
      callback: () => {
        void this.rescanTags();
      },
    });

    void this.tagMetaManager.scanAll().then(() => {
      this.tagPaneObserver.setMetadata(this.tagMetaManager.all());
      this.refreshStatusBar();
      this.maybeShowWelcomeModal();
    });

    this.refreshStatusBar();
  }

  /**
   * First-run welcome modal gate (D-008). Fires once when the plugin enables
   * for the first time on this vault. The post-scan timing means the user
   * sees a populated tag list immediately after dismissing the modal.
   */
  private maybeShowWelcomeModal(): void {
    const settings = this.settingsManager.get();
    if (settings.seenWelcomeModal) return;
    if (!settings.enabled) return;
    new WelcomeModal(this.app, this, () => {
      // Modal already persisted seenWelcomeModal and any preview-mode flip;
      // we just refresh derived UI surfaces.
      this.refreshStatusBar();
    }).open();
  }

  async onExternalSettingsChange(): Promise<void> {
    await this.settingsManager.reload();
    const next = this.settingsManager.get();
    this.tagPaneObserver.setRules(resolveActiveRules(next));
    this.tagPaneObserver.setOverrides(next.overrides);
    this.tagPaneObserver.setPreviewMode(next.previewMode);
    this.tagPaneObserver.setEnabled(next.enabled);
    this.refreshStatusBar();
  }

  onunload(): void {
    this.tagPaneObserver?.unload();
    this.tagMetaManager?.unload();
    panicCleanup(document);
  }

  private async toggleEnable(): Promise<void> {
    const current = this.settingsManager.get().enabled;
    await this.settingsManager.setEnabled(!current);
    new Notice(`Tag Curator ${!current ? 'enabled' : 'disabled'}`);
  }

  private async togglePreviewMode(): Promise<void> {
    const current = this.settingsManager.get().previewMode;
    await this.settingsManager.setPreviewMode(!current);
    new Notice(`Preview mode ${!current ? 'on' : 'off'}`);
  }

  private panicDisable(): void {
    this.tagPaneObserver.setEnabled(false);
    panicCleanup(document);
    void this.settingsManager.setEnabled(false);
    new Notice('Tag Curator: panic disable activated. All DOM effects removed.');
  }

  private async rescanTags(): Promise<void> {
    new Notice('Tag Curator: rescanning vault tags...');
    await this.tagMetaManager.scanAll();
    this.tagPaneObserver.setMetadata(this.tagMetaManager.all());
    this.refreshStatusBar();
    new Notice('Tag Curator: rescan complete');
  }

  async openCurationWorkspace(opts?: CurationWorkspaceOptions): Promise<void> {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(CURATION_VIEW_TYPE);
    let leaf: WorkspaceLeaf | null = leaves[0] ?? null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type: CURATION_VIEW_TYPE });
    }
    workspace.revealLeaf(leaf);
    if (opts?.hiddenOnly) {
      const view = leaf.view;
      if (view && 'setHiddenOnly' in view) {
        (view as { setHiddenOnly: (v: boolean) => void }).setHiddenOnly(true);
      }
    }
  }

  /**
   * Open (or reveal) the Curation Workspace split next to the native tag pane
   * so editing a rule and watching the tag pane react is one continuous glance.
   * Implements D-013.
   *
   * Strategy:
   * 1. Locate or create the native tag pane ('tag' view type).
   * 2. If a Curation Workspace leaf already exists, reveal it; otherwise create
   *    one via createLeafBySplit on the tag pane leaf so it docks beside it.
   * 3. Graceful fallback: if the split API cannot produce a leaf (guard against
   *    null from getLeftLeaf when the sidebar has no room), fall back to the
   *    plain openCurationWorkspace() and show a Notice.
   */
  async openBesideTagPane(): Promise<void> {
    const { workspace } = this.app;

    // --- Step 1: ensure the native tag pane exists ---
    let tagLeaves = workspace.getLeavesOfType('tag');
    let tagLeaf: WorkspaceLeaf | null = tagLeaves[0] ?? null;
    if (!tagLeaf) {
      // Open a new tag pane in the left sidebar.
      tagLeaf = workspace.getLeftLeaf(false);
      if (tagLeaf) {
        await tagLeaf.setViewState({ type: 'tag', active: true });
        workspace.revealLeaf(tagLeaf);
        // Re-fetch to get the now-populated leaf reference.
        tagLeaves = workspace.getLeavesOfType('tag');
        tagLeaf = tagLeaves[0] ?? tagLeaf;
      }
    }

    // --- Step 2: reuse an existing workspace leaf if one is already open ---
    const existingWorkspaceLeaves = workspace.getLeavesOfType(CURATION_VIEW_TYPE);
    if (existingWorkspaceLeaves.length > 0) {
      const existing = existingWorkspaceLeaves[0];
      workspace.revealLeaf(existing);
      return;
    }

    // --- Step 3: create a split leaf next to the tag pane ---
    if (tagLeaf) {
      // createLeafBySplit returns WorkspaceLeaf (non-null per obsidian.d.ts).
      // direction 'vertical' places the new leaf to the right of the tag leaf.
      const splitLeaf = workspace.createLeafBySplit(tagLeaf, 'vertical', false);
      await splitLeaf.setViewState({ type: CURATION_VIEW_TYPE, active: true });
      workspace.revealLeaf(splitLeaf);
      return;
    }

    // --- Fallback: no tag pane and no split available ---
    new Notice('Tag Curator: could not open beside the tag pane - opening in sidebar instead.');
    await this.openCurationWorkspace();
  }

  private async openTagList(): Promise<void> {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(TAG_LIST_VIEW_TYPE);
    let leaf: WorkspaceLeaf | null = leaves[0] ?? null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type: TAG_LIST_VIEW_TYPE });
    }
    workspace.revealLeaf(leaf);
  }

  private async openTagListWithHiddenFilter(): Promise<void> {
    await this.openTagList();
    const leaves = this.app.workspace.getLeavesOfType(TAG_LIST_VIEW_TYPE);
    const view = leaves[0]?.view;
    if (view && 'setHiddenOnly' in view) {
      (view as { setHiddenOnly: (v: boolean) => void }).setHiddenOnly(true);
    }
  }

  private refreshStatusBar(): void {
    if (!this.statusBarEl) return;
    const hidden = this.tagPaneObserver.countHidden();
    const flagged = this.tagPaneObserver.countFlagged();
    const settings = this.settingsManager.get();
    if (!settings.enabled) {
      this.statusBarEl.setText('Tag Curator: off');
      return;
    }
    if (settings.previewMode) {
      this.statusBarEl.setText(`Tag Curator (preview): ${flagged} flagged`);
      return;
    }
    this.statusBarEl.setText(
      hidden === 1 ? 'Tag Curator: 1 tag hidden' : `Tag Curator: ${hidden} tags hidden`,
    );
  }
}
