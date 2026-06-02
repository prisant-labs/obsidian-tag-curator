/**
 * Settings tab (D-008, D-007, D-009, D-011, D-010).
 *
 * Top-tab layout. The Tag list tab (D-011) hosts the same component as the
 * sidebar leaf; the Custom rules tab hosts the card-view RuleEditor (D-010).
 *
 * The persistent state banner (D-007) sits above whichever panel is active.
 */
import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import TagCuratorPlugin from '../main';
import { PRESETS, resolveActiveRules } from '../engine/presets';
import { RuleEditor } from './ruleEditor';
import { StateBanner } from './stateBanner';
import { Mode } from '../types';
import { detectNotebookNavigator, MIN_API_VERSION } from '../integrations/notebookNavigator';

type TabId = 'general' | 'scopes' | 'rules' | 'advanced' | 'help';

interface TabDescriptor {
  id: TabId;
  label: string;
  badge?: string;
  badgeKind?: 'count' | 'soon';
  deferred?: boolean;
  render: (panel: HTMLElement) => void;
}

export class TagCuratorSettingTab extends PluginSettingTab {
  plugin: TagCuratorPlugin;
  private activeTab: TabId = 'general';
  private banner: StateBanner | null = null;
  private tabBar: HTMLElement | null = null;
  private panelHost: HTMLElement | null = null;

  constructor(app: App, plugin: TagCuratorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('tag-curator-settings');

    // Persistent state banner above everything (D-007).
    if (this.banner) {
      this.banner.destroy();
      this.banner = null;
    }
    this.banner = new StateBanner(containerEl, this.plugin);

    // Tab bar.
    this.tabBar = containerEl.createDiv({ cls: 'tag-curator-top-tabs' });
    this.panelHost = containerEl.createDiv({
      cls: 'tag-curator-panel-host',
    });

    const tabs = this.buildTabDescriptors();
    for (const tab of tabs) {
      const tabEl = this.tabBar.createDiv({ cls: 'tcst-tab' });
      if (tab.id === this.activeTab) tabEl.addClass('active');
      tabEl.createSpan({ text: tab.label });
      if (tab.badge) {
        const badge = tabEl.createSpan({ cls: 'tcst-badge', text: tab.badge });
        if (tab.badgeKind === 'soon') badge.addClass('tcst-badge-soon');
      }
      tabEl.addEventListener('click', () => {
        this.activeTab = tab.id;
        this.display();
      });
    }

    const active = tabs.find((t) => t.id === this.activeTab) ?? tabs[0];
    const panel = this.panelHost.createDiv({ cls: 'tcst-panel' });
    active.render(panel);
  }

  hide(): void {
    if (this.banner) {
      this.banner.destroy();
      this.banner = null;
    }
  }

  // -----------------------------------------------------------------
  // Tab descriptors
  // -----------------------------------------------------------------

  private buildTabDescriptors(): TabDescriptor[] {
    const s = this.plugin.settingsManager.get();
    const customCount = s.customRules.length;

    return [
      { id: 'general', label: 'General', render: (p) => this.renderGeneral(p) },
      {
        id: 'scopes',
        label: 'Scopes & integrations',
        render: (p) => this.renderScopes(p),
      },
      {
        id: 'rules',
        label: 'Rules',
        badge: String(PRESETS.length + customCount),
        badgeKind: 'count',
        render: (p) => this.renderRules(p),
      },
      { id: 'advanced', label: 'Advanced', render: (p) => this.renderAdvanced(p) },
      { id: 'help', label: 'Help', render: (p) => this.renderHelp(p) },
    ];
  }

  // -----------------------------------------------------------------
  // General
  // -----------------------------------------------------------------

  private renderGeneral(panel: HTMLElement): void {
    const s = this.plugin.settingsManager.get();
    const meta = this.plugin.tagMetaManager.all();
    const ruleCount = resolveActiveRules(s).length;
    const hiddenCount = this.plugin.curatedCount();
    let orphanCount = 0;
    for (const m of meta.values()) {
      if (m.count <= 1) orphanCount += 1;
    }

    // Launcher (D-012): Settings launches the workspace; it lives here, not its own tab.
    new Setting(panel)
      .setName('Tag Curator')
      .setDesc(
        'See, edit, preview, and act on tags in a dockable panel. Open it here, or beside the tag pane for live side-by-side preview.',
      )
      .addButton((b) =>
        b
          .setButtonText('Open Tag Curator')
          .setCta()
          .onClick(() => {
            void this.plugin.openCurationWorkspace();
          }),
      )
      .addButton((b) =>
        b.setButtonText('Open beside the tag pane').onClick(() => {
          void this.plugin.openBesideTagPane();
        }),
      );

    // Stats header.
    const stats = panel.createDiv({ cls: 'tcst-stats' });
    this.renderStatCard(stats, 'Total tags', meta.size);
    this.renderStatCard(stats, 'Hidden now', hiddenCount, 'accent');
    this.renderStatCard(stats, 'Active rules', ruleCount);
    this.renderStatCard(stats, 'Orphans', orphanCount);

    new Setting(panel)
      .setName('Enable Tag Curator')
      .setDesc(
        'Master switch. When off, every tag shows normally and no DOM is touched.',
      )
      .addToggle((t) =>
        t.setValue(s.enabled).onChange(async (v) => {
          await this.plugin.settingsManager.setEnabled(v);
        }),
      );

    new Setting(panel)
      .setName('Preview mode')
      .setDesc(
        "Instead of hiding matched tags, flag them so you can see exactly what a rule would hide before committing.",
      )
      .addToggle((t) =>
        t.setValue(s.previewMode).onChange(async (v) => {
          await this.plugin.settingsManager.setPreviewMode(v);
        }),
      );

    new Setting(panel).setName('If something looks wrong').setHeading();
    new Setting(panel)
      .setName('Run panic disable')
      .setDesc(
        'One-shot action that instantly removes every DOM effect (un-hides all tags), turns the plugin off, and runs cleanup. Works even if these settings fail to load. Fully reversible: nothing in your notes is touched. The result is a "Tag Curator is off" state - shown as a persistent banner above every Tag Curator surface until you re-enable.',
      )
      .addButton((b) =>
        b
          .setButtonText('Run panic disable')
          .setWarning()
          .onClick(() => this.runPanicDisable()),
      );
  }

  private renderStatCard(
    parent: HTMLElement,
    label: string,
    value: number | string,
    accent?: 'accent',
  ): void {
    const card = parent.createDiv({ cls: 'tcst-stat-card' });
    card.createDiv({ cls: 'tcst-stat-label', text: label });
    const v = card.createDiv({ cls: 'tcst-stat-value' });
    if (accent) v.addClass('tcst-stat-accent');
    v.setText(typeof value === 'number' ? value.toLocaleString() : value);
  }

  private async runPanicDisable(): Promise<void> {
    this.plugin.tagPaneObserver.setEnabled(false);
    await this.plugin.settingsManager.setEnabled(false);
    new Notice('Tag Curator: panic disable activated. All DOM effects removed.');
    this.display();
  }

  // -----------------------------------------------------------------
  // Scopes (D-014) - per-scope kill-switch toggles
  // -----------------------------------------------------------------

  private renderScopes(panel: HTMLElement): void {
    panel.createEl('p', {
      cls: 'tcst-section-sub',
      text:
        'A scope is a place your tags appear. Tag Curator can hide or flag tags in each one, independently and reversibly - toggling a scope takes effect immediately, no restart.',
    });

    new Setting(panel).setName('Obsidian surfaces').setHeading();

    new Setting(panel)
      .setName('Tag pane')
      .setDesc("Hide and flag curated tags in Obsidian's native tag pane.")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settingsManager.isScopeEnabled('tag-pane'))
          .onChange(async (v) => {
            await this.plugin.settingsManager.setScopeEnabled('tag-pane', v);
          }),
      );

    new Setting(panel)
      .setName('Properties panel')
      .setDesc('Curate frontmatter tags shown in the Properties panel.')
      .addToggle((t) =>
        t
          .setValue(this.plugin.settingsManager.isScopeEnabled('properties'))
          .onChange(async (v) => {
            await this.plugin.settingsManager.setScopeEnabled('properties', v);
          }),
      );

    new Setting(panel)
      .setName('Autocomplete')
      .setDesc('Hide curated tags from the editor tag suggestion list.')
      .addToggle((t) =>
        t
          .setValue(this.plugin.settingsManager.isScopeEnabled('autocomplete'))
          .onChange(async (v) => {
            await this.plugin.settingsManager.setScopeEnabled('autocomplete', v);
          }),
      );

    new Setting(panel).setName('Plugin integrations').setHeading();

    // Notebook Navigator - a plugin surface Tag Curator can curate; gated on detection.
    const nnHandle = detectNotebookNavigator(this.app);
    const nnDisabled = nnHandle.status !== 'ready';
    let nnDesc = 'Curate the Notebook Navigator tag tree (runtime-interop only).';
    if (nnHandle.status !== 'ready' && nnHandle.status !== 'absent') {
      nnDesc += ' Requires Notebook Navigator ' + MIN_API_VERSION + ' or newer.';
    }
    const nn = new Setting(panel)
      .setName('Notebook Navigator')
      .setDesc(nnDesc)
      .addToggle((t) => {
        t
          .setValue(this.plugin.settingsManager.isScopeEnabled('notebook-navigator'))
          .setDisabled(nnDisabled)
          .onChange(async (v) => {
            await this.plugin.settingsManager.setScopeEnabled('notebook-navigator', v);
          });
      });
    if (nnHandle.status === 'ready') {
      this.statusPill(nn, 'active', 'Active');
    } else if (nnHandle.status === 'absent') {
      this.statusPill(nn, 'muted', 'Not installed');
      this.actionLink(nn, 'Install', () => this.openPluginSettings('community-plugins'));
    } else {
      this.statusPill(nn, 'warn', 'Update needed');
      this.actionLink(nn, 'Update plugin', () =>
        this.openPluginSettings('community-plugins'),
      );
    }

    // Optional capability integrations (no scope toggle; detected at runtime).
    this.renderCapabilityIntegration(
      panel,
      'tag-wrangler',
      'Tag Wrangler',
      'Delegate tag renaming; "Send to Tag Wrangler" appears in the panel when it is enabled.',
    );
    this.renderCapabilityIntegration(
      panel,
      'obsidian-style-settings',
      'Style Settings',
      'Restyle the flag color, background, and bold weight from a GUI. Built-in defaults apply otherwise.',
    );
  }

  // -----------------------------------------------------------------
  // Integration status helpers (status pill + action link)
  // -----------------------------------------------------------------

  private renderCapabilityIntegration(
    panel: HTMLElement,
    pluginId: string,
    name: string,
    desc: string,
  ): void {
    const state = this.pluginState(pluginId);
    const s = new Setting(panel).setName(name).setDesc(desc);
    if (state === 'enabled') {
      this.statusPill(s, 'active', 'Active');
      this.actionLink(s, 'Open settings', () => this.openPluginSettings(pluginId));
    } else if (state === 'installed') {
      this.statusPill(s, 'warn', 'Disabled');
      this.actionLink(s, 'Enable', () => this.openPluginSettings('community-plugins'));
    } else {
      this.statusPill(s, 'muted', 'Not installed');
      this.actionLink(s, 'Install', () => this.openPluginSettings('community-plugins'));
    }
  }

  private pluginState(pluginId: string): 'enabled' | 'installed' | 'missing' {
    const plugins = (
      this.app as unknown as {
        plugins?: {
          enabledPlugins?: Set<string>;
          manifests?: Record<string, unknown>;
        };
      }
    ).plugins;
    if (!plugins) return 'missing';
    if (plugins.enabledPlugins?.has(pluginId)) return 'enabled';
    if (plugins.manifests && pluginId in plugins.manifests) return 'installed';
    return 'missing';
  }

  private statusPill(
    setting: Setting,
    kind: 'active' | 'warn' | 'muted',
    text: string,
  ): void {
    const pill = setting.nameEl.createSpan({ cls: 'tc-pill', text });
    pill.addClass(
      kind === 'active'
        ? 'tc-pill-active'
        : kind === 'warn'
          ? 'tc-pill-warn'
          : 'tc-pill-muted',
    );
  }

  private actionLink(setting: Setting, label: string, onClick: () => void): void {
    const link = setting.nameEl.createEl('a', {
      cls: 'tc-action-link',
      text: label,
    });
    link.addEventListener('click', (e) => {
      e.preventDefault();
      onClick();
    });
  }

  private openPluginSettings(tabId: string): void {
    const setting = (
      this.app as unknown as {
        setting?: { open?: () => void; openTabById?: (id: string) => void };
      }
    ).setting;
    setting?.open?.();
    setting?.openTabById?.(tabId);
  }

  // -----------------------------------------------------------------
  // Rules (Presets + Custom rules)
  // -----------------------------------------------------------------

  private renderRules(panel: HTMLElement): void {
    new Setting(panel).setName('Presets').setHeading();
    this.renderPresets(panel);
    new Setting(panel).setName('Custom rules').setHeading();
    this.renderCustomRules(panel);
  }

  // -----------------------------------------------------------------
  // Presets (with affected counts + More details expander)
  // -----------------------------------------------------------------

  private renderPresets(panel: HTMLElement): void {
    panel.createEl('p', {
      cls: 'tcst-section-sub',
      text:
        'Built-in presets are toggleable but not editable - to change one, copy it into a custom rule.',
    });

    const enabled = new Set(this.plugin.settingsManager.get().enabledPresets);

    for (const preset of PRESETS) {
      const card = panel.createDiv({ cls: 'tcst-preset' });
      const isOn = enabled.has(preset.id);
      const body = card.createDiv({ cls: 'tcst-preset-body' });
      const head = body.createDiv({ cls: 'tcst-preset-head' });
      head.createDiv({ cls: 'tcst-preset-nm', text: preset.name });
      head.createSpan({ cls: 'tcst-pill', text: 'built-in' });
      body.createDiv({ cls: 'tcst-preset-dsc', text: preset.description });

      const affected = this.countAffectedTags(preset.rule.match);
      const meta = body.createDiv({ cls: 'tcst-preset-meta' });
      // The affected-count is a link that opens the panel filtered to this preset.
      const affectedEl = meta.createEl('a', { cls: 'tcst-affected' });
      const paintAffected = (on: boolean): void => {
        affectedEl.toggleClass('tcst-affected-zero', !on);
        affectedEl.setText(
          on ? `${affected} tags affected` : `would hide ${affected} tags`,
        );
      };
      paintAffected(isOn);
      affectedEl.addEventListener('click', (e) => {
        e.preventDefault();
        void this.plugin.openCurationWorkspace({ ruleId: preset.id });
      });

      const moreToggle = meta.createSpan({
        cls: 'tcst-more-link',
        text: 'More details',
      });
      const details = body.createDiv({ cls: 'tcst-preset-details' });
      details.style.display = 'none';
      this.renderPresetDetails(details, preset);
      moreToggle.addEventListener('click', () => {
        const open = details.style.display !== 'none';
        details.style.display = open ? 'none' : '';
        moreToggle.setText(open ? 'More details' : 'Hide details');
      });

      // Toggle on the left; flipping it updates the affected-count label live.
      const toggle = this.renderInlineToggle(card, isOn, async (next) => {
        await this.plugin.settingsManager.setPresetEnabled(preset.id, next);
        paintAffected(next);
      });
      card.prepend(toggle);
    }
  }

  private renderPresetDetails(
    parent: HTMLElement,
    preset: (typeof PRESETS)[number],
  ): void {
    const dl = parent.createDiv({ cls: 'tcst-preset-dl' });
    const matchType = preset.rule.match.type;
    let matchSummary = `type: ${matchType}`;
    if (matchType === 'regex' && preset.rule.match.pattern) {
      matchSummary = `regex /${preset.rule.match.pattern}/`;
    } else if (matchType === 'frequency') {
      matchSummary = `frequency ${preset.rule.match.operator ?? '='} ${
        preset.rule.match.value ?? 0
      }`;
    }
    dl.createSpan({ cls: 'tcst-dl-label', text: 'Match:' });
    const m = dl.createSpan({ cls: 'tcst-dl-value' });
    m.createEl('code', { text: matchSummary });
    dl.createSpan({ cls: 'tcst-dl-label', text: 'Action:' });
    dl.createSpan({ cls: 'tcst-dl-value', text: preset.rule.action });
    dl.createSpan({ cls: 'tcst-dl-label', text: 'Scope:' });
    dl.createSpan({ cls: 'tcst-dl-value', text: preset.rule.scopes.join(', ') });
    if (preset.rule.notes) {
      dl.createSpan({ cls: 'tcst-dl-label', text: 'Notes:' });
      dl.createSpan({ cls: 'tcst-dl-value', text: preset.rule.notes });
    }
  }

  private countAffectedTags(match: {
    type: string;
    pattern?: string;
    operator?: string;
    value?: number;
    list?: string[];
  }): number {
    let count = 0;
    const meta = this.plugin.tagMetaManager.all();
    if (match.type === 'regex' && match.pattern) {
      try {
        const re = new RegExp(match.pattern);
        for (const [tag] of meta) if (re.test(tag)) count += 1;
      } catch {
        /* invalid regex - report 0 */
      }
    } else if (match.type === 'frequency') {
      const op = match.operator ?? '=';
      const threshold = match.value ?? 0;
      for (const [, m] of meta) {
        const c = m.count;
        if (
          (op === '=' && c === threshold) ||
          (op === '<' && c < threshold) ||
          (op === '<=' && c <= threshold) ||
          (op === '>' && c > threshold) ||
          (op === '>=' && c >= threshold)
        ) {
          count += 1;
        }
      }
    } else if (match.type === 'list' && match.list) {
      const set = new Set(match.list);
      for (const [tag] of meta) if (set.has(tag)) count += 1;
    }
    return count;
  }

  private renderInlineToggle(
    parent: HTMLElement,
    initial: boolean,
    onChange: (next: boolean) => Promise<void> | void,
  ): HTMLElement {
    const toggle = parent.createDiv({ cls: 'tcst-toggle' });
    toggle.toggleClass('on', initial);
    toggle.addEventListener('click', () => {
      const next = !toggle.hasClass('on');
      toggle.toggleClass('on', next);
      void onChange(next);
    });
    return toggle;
  }

  // -----------------------------------------------------------------
  // Custom rules - card view + right-docked preview (D-010)
  // -----------------------------------------------------------------

  private renderCustomRules(panel: HTMLElement): void {
    // The RuleEditor manages its own DOM (workspace shell + preview dock)
    // and subscribes to settings changes for live updates. Each display()
    // call constructs a fresh editor inside the new panel.
    new RuleEditor(panel, this.plugin);
  }

  // -----------------------------------------------------------------
  // Help (Commands + FAQ + About)
  // -----------------------------------------------------------------

  private renderHelp(panel: HTMLElement): void {
    new Setting(panel).setName('Commands').setHeading();
    panel.createEl('p', {
      cls: 'tcst-section-sub',
      text:
        'All commands appear in Obsidian\'s palette (Cmd/Ctrl+P) prefixed "Tag Curator:". Bind hotkeys in Obsidian\'s hotkey settings - no defaults shipped.',
    });

    const cmds: Array<[string, string]> = [
      ['Toggle enable', 'Master kill switch on/off.'],
      [
        'Panic disable (remove all DOM effects now)',
        'Remove all DOM effects now & disable.',
      ],
      ['Toggle preview mode', 'Flip Preview mode.'],
      [
        'Open the panel',
        'Open / reveal the panel in the right sidebar. Same as clicking the status bar (which opens it pre-filtered to hidden tags) or the ribbon icon.',
      ],
      [
        'Open beside the tag pane',
        'Open / reveal the panel split next to the native tag pane for live side-by-side editing. Also available from the General settings button.',
      ],
      ['Rescan vault tags', 'Rebuild the tag sidecar across all notes.'],
    ];
    for (const [name, desc] of cmds) {
      new Setting(panel).setName(name).setDesc(desc);
    }

    new Setting(panel).setName('FAQ').setHeading();
    const faqs: Array<[string, string]> = [
      [
        'Does Tag Curator change my notes?',
        'No. It is display-only - it hides or flags tags in the UI and never edits note content. Disabling or uninstalling it restores every tag.',
      ],
      [
        'Where did a tag go?',
        'A preset, rule, or per-tag override is hiding it. Open the panel and use "why is this hidden?" on its row, or run Panic disable to clear all effects at once.',
      ],
      [
        'Does it work on mobile?',
        'The display scopes are DOM-based and work on mobile; the status bar is desktop-only (Obsidian does not render one on mobile).',
      ],
    ];
    for (const [q, a] of faqs) {
      new Setting(panel).setName(q).setDesc(a);
    }

    new Setting(panel).setName('About').setHeading();
    new Setting(panel)
      .setName('Tag Curator ' + this.plugin.manifest.version)
      .setDesc('Display-only, file-safe, fully reversible tag curation.')
      .addButton((b) =>
        b.setButtonText('GitHub').onClick(() => {
          window.open('https://github.com/jprisant/obsidian-tag-curator');
        }),
      )
      .addButton((b) =>
        b.setButtonText('Report an issue').onClick(() => {
          window.open('https://github.com/jprisant/obsidian-tag-curator/issues/new');
        }),
      )
      .addButton((b) =>
        b.setButtonText('Sponsor').onClick(() => {
          window.open('https://github.com/sponsors/jprisant');
        }),
      );
  }

  // -----------------------------------------------------------------
  // Advanced
  // -----------------------------------------------------------------

  private renderAdvanced(panel: HTMLElement): void {
    const s = this.plugin.settingsManager.get();

    new Setting(panel).setName('Index maintenance').setHeading();

    new Setting(panel)
      .setName('Reindex vault tags')
      .setDesc(
        'Re-scan every markdown file and rebuild the tag sidecar (tags.json). Run after restoring a vault from backup, syncing across devices, or if the tag list looks out of date.',
      )
      .addButton((b) =>
        b
          .setButtonText('Reindex now')
          .setCta()
          .onClick(() => this.reindexVault()),
      );

    new Setting(panel)
      .setName('Last full reindex')
      .setDesc('Tag count from the most recent full scan.')
      .addText((t) => {
        t.setValue(`${this.plugin.tagMetaManager.all().size} tags`).setDisabled(
          true,
        );
      });

    new Setting(panel).setName('Performance').setHeading();
    new Setting(panel)
      .setName('Sidecar save debounce (ms)')
      .setDesc('How long to batch tag-index writes. Default 5000.')
      .addText((t) => {
        t.setValue(String(s.sidecarDebounceMs)).onChange(async (v) => {
          const ms = Math.max(500, Math.round(Number(v) || 5000));
          await this.plugin.settingsManager.update({ sidecarDebounceMs: ms });
        });
      });

    new Setting(panel).setName('Troubleshooting').setHeading();
    new Setting(panel)
      .setName('Debug logging')
      .setDesc('Verbose console output for troubleshooting.')
      .addToggle((t) =>
        t.setValue(s.debugLog).onChange(async (v) => {
          await this.plugin.settingsManager.update({ debugLog: v });
        }),
      );

    new Setting(panel).setName('Mode (advanced)').setHeading();
    new Setting(panel)
      .setName('Mode')
      .setDesc(
        'How Tag Curator filters tags. v0.1 ships Default; allow-only and inbox land in v0.2.',
      )
      .addDropdown((d) => {
        d.addOption('default', 'Default (hide matched)')
          .addOption('allow-only', 'Allow-only (v0.2)')
          .addOption('inbox', 'Inbox (v0.2)')
          .setValue(s.mode)
          .onChange(async (v) => {
            await this.plugin.settingsManager.update({ mode: v as Mode });
          });
      });
  }

  private async reindexVault(): Promise<void> {
    new Notice('Tag Curator: rescanning vault tags...');
    await this.plugin.tagMetaManager.scanAll();
    this.plugin.tagPaneObserver.setMetadata(this.plugin.tagMetaManager.all());
    new Notice('Tag Curator: rescan complete');
    this.display();
  }

}
