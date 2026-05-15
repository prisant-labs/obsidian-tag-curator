import { Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { SettingsManager } from './storage/settings';
import { TagMetaManager } from './storage/tagMeta';
import { TagPaneObserver } from './observers/tagPaneObserver';
import { TagCuratorSettingTab } from './ui/settingsTab';
import { TagListView, TAG_LIST_VIEW_TYPE } from './ui/tagListView';
import { resolveActiveRules } from './engine/presets';
import { panicCleanup } from './ui/panicDisable';

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
    this.tagPaneObserver.setDryRun(settings.dryRun);
    this.tagPaneObserver.setEnabled(settings.enabled);
    this.tagPaneObserver.init();

    this.registerView(TAG_LIST_VIEW_TYPE, (leaf: WorkspaceLeaf) => new TagListView(leaf, this));

    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass('tag-curator-status');
    this.statusBarEl.addEventListener('click', () => {
      void this.openTagListWithHiddenFilter();
    });

    this.addSettingTab(new TagCuratorSettingTab(this.app, this));

    this.settingsManager.onChange(() => {
      const next = this.settingsManager.get();
      this.tagMetaManager.setDebounceMs(next.sidecarDebounceMs);
      this.tagPaneObserver.setRules(resolveActiveRules(next));
      this.tagPaneObserver.setDryRun(next.dryRun);
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
      id: 'toggle-dry-run',
      name: 'Toggle dry-run mode',
      callback: () => {
        void this.toggleDryRun();
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
    });

    this.refreshStatusBar();
  }

  async onExternalSettingsChange(): Promise<void> {
    await this.settingsManager.reload();
    const next = this.settingsManager.get();
    this.tagPaneObserver.setRules(resolveActiveRules(next));
    this.tagPaneObserver.setDryRun(next.dryRun);
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

  private async toggleDryRun(): Promise<void> {
    const current = this.settingsManager.get().dryRun;
    await this.settingsManager.setDryRun(!current);
    new Notice(`Dry-run ${!current ? 'on' : 'off'}`);
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
    if (settings.dryRun) {
      this.statusBarEl.setText(`Tag Curator (dry-run): ${flagged} flagged`);
      return;
    }
    this.statusBarEl.setText(
      hidden === 1 ? 'Tag Curator: 1 tag hidden' : `Tag Curator: ${hidden} tags hidden`,
    );
  }
}
