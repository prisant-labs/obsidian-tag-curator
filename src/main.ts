import { Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { SettingsManager } from './storage/settings';
import { TagMetaManager } from './storage/tagMeta';
import { ObserverBase } from './observers/observerBase';
import { TagPaneObserver } from './observers/tagPaneObserver';
import { NotebookNavigatorObserver } from './observers/notebookNavigatorObserver';
import { PropertiesObserver } from './observers/propertiesObserver';
import { AutocompleteObserver } from './observers/autocompleteObserver';
import {
  detectNotebookNavigator,
  subscribeReapply,
  MIN_API_VERSION,
} from './integrations/notebookNavigator';
import { TagCuratorSettingTab } from './ui/settingsTab';
import {
  CurationWorkspaceView,
  CURATION_VIEW_TYPE,
  CurationWorkspaceOptions,
} from './ui/curationWorkspace/curationWorkspaceView';
import { resolveActiveRules } from './engine/presets';
import { RuleEngine } from './engine/ruleEngine';
import { panicCleanup } from './ui/panicDisable';
import { WelcomeModal } from './ui/welcomeModal';

/** Scope key for the native tag pane surface; matches the Scope union in types.ts. */
const TAG_PANE_SCOPE = 'tag-pane';
/** Scope key for the Notebook Navigator surface; matches the Scope union in types.ts. */
const NN_SCOPE = 'notebook-navigator';
/** Scope key for the core Properties panel surface; matches the Scope union in types.ts. */
const PROPERTIES_SCOPE = 'properties';
/** Scope key for the editor tag-autocomplete surface; matches the Scope union in types.ts. */
const AUTOCOMPLETE_SCOPE = 'autocomplete';

export default class TagCuratorPlugin extends Plugin {
  settingsManager!: SettingsManager;
  tagMetaManager!: TagMetaManager;
  tagPaneObserver!: TagPaneObserver;
  // The NN observer is constructed at load whenever NN is detected 'ready'
  // (Phase 5B); it stays null when NN is absent or too-old. The per-scope kill
  // switch is expressed purely via setEnabled (see applyNnScopeEnabled), so a
  // 'ready' observer can flip on/off without re-detecting or reconstructing.
  private nnObserver: NotebookNavigatorObserver | null = null;
  // The Properties observer needs NO detection - Properties is core Obsidian -
  // so it is always constructed. Its per-scope kill switch is expressed purely
  // via setEnabled (see applyScopeEnabled), gating the effective enabled state
  // on the global enable AND scopeEnabled['properties'].
  private propertiesObserver!: PropertiesObserver;
  // The autocomplete observer needs NO detection - the editor tag-suggest popup
  // is core Obsidian - so it is always constructed (Phase 7). Its per-scope kill
  // switch is expressed purely via setEnabled (see applyScopeEnabled), gating the
  // effective enabled state on the global enable AND scopeEnabled['autocomplete'].
  private autocompleteObserver!: AutocompleteObserver;
  // All live observers, so shared state (rules / metadata / preview / enabled /
  // overrides) fans out to every surface with one pass. The tag-pane observer is
  // also held in its own field because it remains the status-bar count source.
  private observers: ObserverBase[] = [];
  // Disposer for the NN reapply subscription; called on unload / panic / teardown.
  private nnUnsubscribe: (() => void) | null = null;
  private ribbonEl: HTMLElement | null = null;
  private statusBarEl: HTMLElement | null = null;

  async onload(): Promise<void> {
    this.settingsManager = new SettingsManager(this);
    await this.settingsManager.load();
    const settings = this.settingsManager.get();

    this.tagMetaManager = new TagMetaManager(this.app, this);
    this.tagMetaManager.setDebounceMs(settings.sidecarDebounceMs);
    await this.tagMetaManager.load();

    this.tagPaneObserver = new TagPaneObserver(this.app, this);
    this.observers.push(this.tagPaneObserver);
    this.seedObserver(this.tagPaneObserver, settings);
    if (!this.settingsManager.isScopeEnabled(TAG_PANE_SCOPE)) {
      this.tagPaneObserver.setEnabled(false);
    }
    this.tagPaneObserver.init();

    // Notebook Navigator scope (Phase 5B). Detection-gated: absent = silent
    // no-op, too-old = one-time notice + skip, ready + scope enabled = wire it.
    this.setupNotebookNavigator(settings);

    // Properties scope (Phase 6). Properties is core Obsidian, so unlike NN this
    // needs NO detection: always construct, seed, and init. The per-scope kill
    // switch gates the effective enabled on top of the global enable that
    // seedObserver applied.
    this.propertiesObserver = new PropertiesObserver(this.app, this);
    this.observers.push(this.propertiesObserver);
    this.seedObserver(this.propertiesObserver, settings);
    if (!this.settingsManager.isScopeEnabled(PROPERTIES_SCOPE)) {
      this.propertiesObserver.setEnabled(false);
    }
    this.propertiesObserver.init();

    // Autocomplete scope (Phase 7). The editor tag-suggest popup is core
    // Obsidian, so like Properties this needs NO detection: always construct,
    // seed, and init. The per-scope kill switch gates the effective enabled on
    // top of the global enable that seedObserver applied. The observer watches a
    // stable root (document.body) for the transient suggestion popup appearing.
    this.autocompleteObserver = new AutocompleteObserver(this.app, this);
    this.observers.push(this.autocompleteObserver);
    this.seedObserver(this.autocompleteObserver, settings);
    if (!this.settingsManager.isScopeEnabled(AUTOCOMPLETE_SCOPE)) {
      this.autocompleteObserver.setEnabled(false);
    }
    this.autocompleteObserver.init();

    // The legacy "Vault tags" TagListView (D-012) was retired pre-1.0: the
    // Curation Workspace pane plus the Curate Tags settings tab are the single
    // tag-surface family, so the old leaf no longer registers or opens.
    this.registerView(
      CURATION_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new CurationWorkspaceView(leaf, this),
    );

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
      const rules = resolveActiveRules(next);
      for (const obs of this.observers) {
        obs.setRules(rules);
        obs.setOverrides(next.overrides);
        obs.setPreviewMode(next.previewMode);
      }
      // All scopes' effective enabled is the global enable AND their per-scope
      // kill switch, so toggling a scope off clears its decoration.
      this.applyScopeEnabled(TAG_PANE_SCOPE, this.tagPaneObserver, next.enabled);
      this.applyScopeEnabled(NN_SCOPE, this.nnObserver, next.enabled);
      this.applyScopeEnabled(PROPERTIES_SCOPE, this.propertiesObserver, next.enabled);
      this.applyScopeEnabled(AUTOCOMPLETE_SCOPE, this.autocompleteObserver, next.enabled);
      this.refreshStatusBar();
    });

    this.registerEvent(
      this.tagMetaManager.on('changed', () => {
        this.pushMetadata();
        this.refreshStatusBar();
      }),
    );

    this.registerEvent(
      this.app.metadataCache.on('changed', (file) => this.tagMetaManager.indexFile(file)),
    );
    this.registerEvent(
      this.app.metadataCache.on('resolved', () => {
        this.pushMetadata();
        for (const obs of this.observers) obs.attachAll();
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
      name: 'Open the panel',
      callback: () => {
        if (!this.settingsManager.get().paneEnabled) {
          new Notice('Enable the Tag Curator Pane in Settings -> General to dock it.');
          return;
        }
        void this.openCurationWorkspace();
      },
    });
    this.addCommand({
      id: 'open-curation-workspace-beside-tag-pane',
      name: 'Open beside the tag pane',
      callback: () => {
        if (!this.settingsManager.get().paneEnabled) {
          new Notice('Enable the Tag Curator Pane in Settings -> General to dock it.');
          return;
        }
        void this.openBesideTagPane();
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
      this.pushMetadata();
      this.refreshStatusBar();
      this.maybeShowWelcomeModal();
    });

    this.refreshStatusBar();
    this.applyPaneEnabled();
  }

  /** Add or remove the ribbon icon and close open panes based on paneEnabled. */
  applyPaneEnabled(): void {
    const on = this.settingsManager.get().paneEnabled;
    if (on && !this.ribbonEl) {
      this.ribbonEl = this.addRibbonIcon('tags', 'Open Tag Curator', () => {
        void this.openCurationWorkspace();
      });
    } else if (!on && this.ribbonEl) {
      this.ribbonEl.remove();
      this.ribbonEl = null;
    }
    if (!on) {
      for (const leaf of this.app.workspace.getLeavesOfType(CURATION_VIEW_TYPE)) {
        leaf.detach();
      }
    }
  }

  /**
   * Feed the initial shared state to a newly constructed observer (Phase 5B).
   * Both the tag-pane observer and the NN observer get the exact same inputs;
   * keeping this in one place means a future scope (properties, autocomplete)
   * is wired identically.
   */
  private seedObserver(observer: ObserverBase, settings: ReturnType<SettingsManager['get']>): void {
    observer.setRules(resolveActiveRules(settings));
    observer.setMetadata(this.tagMetaManager.all());
    observer.setOverrides(settings.overrides);
    observer.setPreviewMode(settings.previewMode);
    observer.setEnabled(settings.enabled);
  }

  /** Fan the current tag metadata out to every live observer. */
  private pushMetadata(): void {
    const meta = this.tagMetaManager.all();
    for (const obs of this.observers) obs.setMetadata(meta);
  }

  /**
   * Detection-gated Notebook Navigator wiring (Phase 5B).
   *   - absent: silent no-op.
   *   - too-old: show ONE notice (gated on seenNnTooOldNotice) and skip; the NN
   *     scope stays off.
   *   - ready: if the per-scope kill switch is on, construct + seed + wire the
   *     observer and subscribe its reapply hook so NN's own re-renders (the tree
   *     is virtualized) re-trigger decoration. If the kill switch is off we still
   *     construct it but leave it disabled, so flipping the switch on later only
   *     needs setEnabled (no re-detection).
   */
  private setupNotebookNavigator(settings: ReturnType<SettingsManager['get']>): void {
    const handle = detectNotebookNavigator(this.app);
    if (handle.status === 'absent') return;
    if (handle.status === 'too-old') {
      if (!settings.seenNnTooOldNotice) {
        new Notice(
          `Tag Curator: Notebook Navigator integration needs NN ${MIN_API_VERSION} or newer; the NN scope is off.`,
        );
        void this.settingsManager.setSeenNnTooOldNotice(true);
      }
      return;
    }
    // status === 'ready'. handle.api is non-null here.
    const api = handle.api;
    if (!api) return;
    const observer = new NotebookNavigatorObserver(this.app, this);
    this.nnObserver = observer;
    this.observers.push(observer);
    this.seedObserver(observer, settings);
    // The per-scope kill switch gates the effective enabled state on top of the
    // global enable that seedObserver already applied.
    if (!this.settingsManager.isScopeEnabled(NN_SCOPE)) {
      observer.setEnabled(false);
    }
    observer.init();
    // NN's tree is virtualized: scrolled-out rows lose their DOM node and return
    // undecorated. Reattach + reapply when NN signals a tree change.
    this.nnUnsubscribe = subscribeReapply(api, () => {
      this.nnObserver?.attachAll();
    });
    this.register(() => this.teardownNnSubscription());
  }

  /**
   * Apply a scope's effective enabled state to its observer: live only when the
   * global enable AND the per-scope kill switch are both on (Phase 5B,
   * generalized in Phase 6). Called from the settings onChange /
   * onExternalSettingsChange handlers so toggling a kill switch off clears that
   * scope's decoration, and toggling it back on re-decorates. A null observer
   * (e.g. NN not detected) is a no-op. Phase 7 (autocomplete) reuses this as-is.
   */
  private applyScopeEnabled(
    scope: string,
    observer: ObserverBase | null,
    globalEnabled: boolean,
  ): void {
    if (!observer) return;
    const scopeOn = this.settingsManager.isScopeEnabled(scope);
    observer.setEnabled(globalEnabled && scopeOn);
  }

  private teardownNnSubscription(): void {
    this.nnUnsubscribe?.();
    this.nnUnsubscribe = null;
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
    const rules = resolveActiveRules(next);
    for (const obs of this.observers) {
      obs.setRules(rules);
      obs.setOverrides(next.overrides);
      obs.setPreviewMode(next.previewMode);
    }
    this.applyScopeEnabled(TAG_PANE_SCOPE, this.tagPaneObserver, next.enabled);
    this.applyScopeEnabled(NN_SCOPE, this.nnObserver, next.enabled);
    this.applyScopeEnabled(PROPERTIES_SCOPE, this.propertiesObserver, next.enabled);
    this.applyScopeEnabled(AUTOCOMPLETE_SCOPE, this.autocompleteObserver, next.enabled);
    this.refreshStatusBar();
  }

  onunload(): void {
    this.teardownNnSubscription();
    for (const obs of this.observers) obs.unload();
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

  /**
   * The hard reset behind both the "Panic disable" command and the General-tab
   * button (1-2). Unlike the plain master toggle (which relies on the reactive
   * observer path), this directly disables every observer so each clears its own
   * decoration, brute-force sweeps the document for any straggler in all four
   * namespaces (so an orphaned node no observer tracks is still un-hidden), then
   * flips the enable off. Works even if a scope's observer is wedged or settings
   * failed to load. Public so the Settings button calls the SAME routine the
   * command does, instead of a weaker duplicate.
   */
  panicDisable(): void {
    for (const obs of this.observers) obs.setEnabled(false);
    panicCleanup(document);
    void this.settingsManager.setEnabled(false);
    new Notice('Tag Curator: panic disable activated. All DOM effects removed.');
  }

  private async rescanTags(): Promise<void> {
    new Notice('Tag Curator: rescanning vault tags...');
    await this.tagMetaManager.scanAll();
    this.pushMetadata();
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
    if (opts?.ruleId) {
      const view = leaf.view;
      if (view && 'setRuleFilter' in view) {
        (view as { setRuleFilter: (id: string) => void }).setRuleFilter(opts.ruleId);
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

  /**
   * Count the tags the engine curates (would hide), independent of any scope's
   * DOM. Mirrors how TagListModel and ObserverBase decide a tag is hidden: its
   * effective match is non-null AND is not an always-show override (which keeps
   * the tag visible as the safety net). The SAME set is the "hidden" count in
   * normal mode and the "flagged" count in preview mode, so the status bar is
   * correct whether or not individual scopes (tag-pane, NN, properties,
   * autocomplete) are toggled. Pure given settings + tag metadata; no DOM.
   */
  private countCurated(settings: ReturnType<SettingsManager['get']>): number {
    return RuleEngine.countCurated(
      this.tagMetaManager.all(),
      resolveActiveRules(settings),
      settings.overrides,
    );
  }

  /**
   * Public accessor for the scope-independent engine count, used by the
   * Settings "Hidden now" stat card (and any future surface that needs the same
   * number). Always equals the status-bar count.
   */
  curatedCount(): number {
    return this.countCurated(this.settingsManager.get());
  }

  private refreshStatusBar(): void {
    if (!this.statusBarEl) return;
    const settings = this.settingsManager.get();
    if (!settings.enabled) {
      this.statusBarEl.setText('Tag Curator: off');
      return;
    }
    // Count from the engine over tag metadata, not from one scope's DOM, so
    // toggling the tag-pane scope off no longer zeroes the count.
    const curated = this.countCurated(settings);
    if (settings.previewMode) {
      this.statusBarEl.setText(`Tag Curator (preview): ${curated} flagged`);
      return;
    }
    this.statusBarEl.setText(
      curated === 1 ? 'Tag Curator: 1 tag hidden' : `Tag Curator: ${curated} tags hidden`,
    );
  }
}
