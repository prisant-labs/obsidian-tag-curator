/**
 * Settings tab (D-008, D-007, D-009, D-011, D-010).
 *
 * Top-tab layout. The Tag list tab (D-011) hosts the same component as the
 * sidebar leaf; the Custom rules tab will be replaced with the card-view
 * editor in Phase 4 - for now it keeps using RuleEditorModal so v0.1
 * capability is preserved while the design is being built.
 *
 * The persistent state banner (D-007) sits above whichever panel is active.
 */
import { App, Notice, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import TagCuratorPlugin from '../main';
import { PRESETS, resolveActiveRules } from '../engine/presets';
import { RuleEditor } from './ruleEditor';
import { StateBanner } from './stateBanner';
import { TAG_LIST_VIEW_TYPE } from './tagListView';
import { Mode } from '../types';

type TabId =
  | 'general'
  | 'taglist'
  | 'presets'
  | 'rules'
  | 'commands'
  | 'advanced'
  | 'profiles'
  | 'aliases';

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
    const tagCount = this.plugin.tagMetaManager.all().size;
    const ruleCount = resolveActiveRules(s).length;
    const customCount = s.customRules.length;

    return [
      {
        id: 'general',
        label: 'General',
        render: (p) => this.renderGeneral(p),
      },
      {
        id: 'taglist',
        label: 'Tag list',
        badge: tagCount.toLocaleString(),
        badgeKind: 'count',
        render: (p) => this.renderTagListTab(p),
      },
      {
        id: 'presets',
        label: 'Presets',
        badge: String(PRESETS.length),
        badgeKind: 'count',
        render: (p) => this.renderPresets(p),
      },
      {
        id: 'rules',
        label: 'Custom rules',
        badge: String(customCount),
        badgeKind: 'count',
        render: (p) => this.renderCustomRules(p),
      },
      {
        id: 'commands',
        label: 'Commands',
        render: (p) => this.renderCommands(p),
      },
      {
        id: 'advanced',
        label: 'Advanced',
        render: (p) => this.renderAdvanced(p),
      },
      {
        id: 'profiles',
        label: 'Profiles',
        badge: 'v0.2',
        badgeKind: 'soon',
        deferred: true,
        render: (p) => this.renderDeferred(p, 'Profiles', 'v0.2'),
      },
      {
        id: 'aliases',
        label: 'Aliases',
        badge: 'v0.3',
        badgeKind: 'soon',
        deferred: true,
        render: (p) => this.renderDeferred(p, 'Aliases', 'v0.3'),
      },
    ];
    void ruleCount;
  }

  // -----------------------------------------------------------------
  // General
  // -----------------------------------------------------------------

  private renderGeneral(panel: HTMLElement): void {
    const s = this.plugin.settingsManager.get();
    const meta = this.plugin.tagMetaManager.all();
    const ruleCount = resolveActiveRules(s).length;
    const hiddenCount = this.plugin.tagPaneObserver.countHidden();
    let orphanCount = 0;
    for (const m of meta.values()) {
      if (m.count <= 1) orphanCount += 1;
    }

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
  // Tag list tab (D-011) - hosts the sidebar leaf component
  // -----------------------------------------------------------------

  private renderTagListTab(panel: HTMLElement): void {
    const info = panel.createDiv({ cls: 'tcst-info-callout' });
    const ic = info.createDiv({ cls: 'tcst-info-ic', text: 'i' });
    void ic;
    const body = info.createDiv();
    body.createSpan({
      text:
        'The Tag list view is the same component as the sidebar leaf and the dedicated tab here (D-011). The richer card-and-table UI from the v0.1 design lands with the Tag list view rewrite in Phase 3 of the implementation. For now, open the leaf to interact with the live tag list.',
    });

    new Setting(panel)
      .setName('Open tag list view')
      .setDesc(
        'Opens the Tag list in the right sidebar. Same as the command Tag Curator: Open tag list view.',
      )
      .addButton((b) =>
        b
          .setButtonText('Open tag list')
          .setCta()
          .onClick(() => this.openTagListLeaf()),
      );

    new Setting(panel)
      .setName('Open tag list (hidden only)')
      .setDesc(
        'Opens the Tag list pre-filtered to tags currently hidden by a rule.',
      )
      .addButton((b) =>
        b.setButtonText('Show hidden').onClick(() => this.openTagListLeaf(true)),
      );
  }

  private async openTagListLeaf(hiddenOnly = false): Promise<void> {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(TAG_LIST_VIEW_TYPE);
    let leaf: WorkspaceLeaf | null = leaves[0] ?? null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type: TAG_LIST_VIEW_TYPE });
    }
    workspace.revealLeaf(leaf);
    if (hiddenOnly) {
      const view = leaf.view;
      if (view && 'setHiddenOnly' in view) {
        (view as { setHiddenOnly: (v: boolean) => void }).setHiddenOnly(true);
      }
    }
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
      this.renderInlineToggle(card, enabled.has(preset.id), async (next) => {
        await this.plugin.settingsManager.setPresetEnabled(preset.id, next);
      });
      const body = card.createDiv({ cls: 'tcst-preset-body' });
      const head = body.createDiv({ cls: 'tcst-preset-head' });
      head.createDiv({ cls: 'tcst-preset-nm', text: preset.name });
      const pill = head.createSpan({ cls: 'tcst-pill', text: 'built-in' });
      void pill;
      body.createDiv({ cls: 'tcst-preset-dsc', text: preset.description });

      const affected = this.countAffectedTags(preset.rule.match);
      const meta = body.createDiv({ cls: 'tcst-preset-meta' });
      if (enabled.has(preset.id)) {
        meta.createSpan({
          cls: 'tcst-affected',
          text: `${affected} tags affected`,
        });
      } else {
        meta.createSpan({
          cls: 'tcst-affected tcst-affected-zero',
          text: 'off',
        });
      }

      const moreToggle = meta.createSpan({
        cls: 'tcst-more-link',
        text: 'More details',
      });
      const details = body.createDiv({ cls: 'tcst-preset-details' });
      details.style.display = 'none';
      this.renderPresetDetails(details, preset);
      moreToggle.addEventListener('click', () => {
        const isOpen = details.style.display !== 'none';
        details.style.display = isOpen ? 'none' : '';
        moreToggle.setText(isOpen ? 'More details' : 'Hide details');
      });
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
  // Commands
  // -----------------------------------------------------------------

  private renderCommands(panel: HTMLElement): void {
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
      ['Open tag list view', 'Open / reveal the tag list in the right sidebar.'],
      [
        'Open tag list (hidden tags only)',
        'Pre-filtered to currently-hidden tags. Same as clicking the status bar.',
      ],
      ['Rescan vault tags', 'Rebuild the tag sidecar across all notes.'],
    ];
    for (const [name, desc] of cmds) {
      new Setting(panel).setName(name).setDesc(desc);
    }
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

  // -----------------------------------------------------------------
  // Deferred placeholders
  // -----------------------------------------------------------------

  private renderDeferred(panel: HTMLElement, title: string, target: string): void {
    const info = panel.createDiv({ cls: 'tcst-info-callout' });
    info.createDiv({ cls: 'tcst-info-ic', text: 'i' });
    const body = info.createDiv();
    body.createEl('strong', { text: `${title} arrive in ${target}. ` });
    body.appendText(
      'The data model is already in place; the UI surface is part of the next planned release.',
    );
  }
}
