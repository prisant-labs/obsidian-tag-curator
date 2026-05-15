/**
 * Settings UI tab
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import TagCuratorPlugin from '../main';
import { PRESETS } from '../engine/presets';
import { RuleEditorModal } from './ruleEditor';

export class TagCuratorSettingTab extends PluginSettingTab {
  plugin: TagCuratorPlugin;

  constructor(app: App, plugin: TagCuratorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    // Header
    containerEl.createEl('h2', { text: 'Tag Curator Settings' });

    // General Settings
    this.displayGeneralSettings(containerEl);

    // Presets
    this.displayPresets(containerEl);

    // Custom Rules
    this.displayCustomRules(containerEl);

    // About
    this.displayAbout(containerEl);
  }

  private displayGeneralSettings(containerEl: HTMLElement) {
    containerEl.createEl('h3', { text: 'General' });

    const settings = this.plugin.settingsManager.get();

    new Setting(containerEl)
      .setName('Mode')
      .setDesc('How Tag Curator filters tags')
      .addDropdown(dropdown => {
        dropdown
          .addOption('default', 'Default (hide matched)')
          .addOption('allow-only', 'Allow-only (whitelist)')
          .addOption('inbox', 'Inbox (review mode)')
          .setValue(settings.mode)
          .onChange(async value => {
            await this.plugin.settingsManager.update({
              mode: value as any,
            });
          });
      });

    new Setting(containerEl)
      .setName('Debug logging')
      .setDesc('Write rule evaluation logs to plugin folder')
      .addToggle(toggle => {
        toggle
          .setValue(settings.debugLog)
          .onChange(async value => {
            await this.plugin.settingsManager.update({ debugLog: value });
          });
      });

    new Setting(containerEl)
      .setName('Dry run mode')
      .setDesc('Show what rules would hide without actually hiding')
      .addToggle(toggle => {
        toggle
          .setValue(settings.dryRun)
          .onChange(async value => {
            await this.plugin.settingsManager.update({ dryRun: value });
          });
      });
  }

  private displayPresets(containerEl: HTMLElement) {
    containerEl.createEl('h3', { text: 'Built-in Presets' });

    const settings = this.plugin.settingsManager.get();

    for (const preset of PRESETS) {
      const isEnabled = settings.enabledPresets.includes(preset.id);

      new Setting(containerEl)
        .setName(preset.name)
        .setDesc(preset.description)
        .addToggle(toggle => {
          toggle
            .setValue(isEnabled)
            .onChange(async value => {
              await this.plugin.settingsManager.setPresetEnabled(preset.id, value);
            });
        });
    }
  }

  private displayCustomRules(containerEl: HTMLElement) {
    containerEl.createEl('h3', { text: 'Custom Rules' });

    const settings = this.plugin.settingsManager.get();

    new Setting(containerEl)
      .setName('Create new rule')
      .setDesc('Add a custom rule to your configuration')
      .addButton(button => {
        button
          .setButtonText('+ New Rule')
          .onClick(() => {
            const modal = new RuleEditorModal(this.app, this.plugin, undefined, async (rule) => {
              await this.plugin.settingsManager.addCustomRule(rule);
              this.display(); // Refresh the settings display
            });
            modal.open();
          });
      });

    // List existing custom rules
    const customRules = settings.customRules;

    if (customRules.length > 0) {
      containerEl.createEl('h4', { text: 'Your Rules' });

      for (const rule of customRules) {
        const isEnabled = rule.enabled;

        new Setting(containerEl)
          .setName(rule.name)
          .setDesc(`${rule.match.type} - ${rule.notes || 'No description'}`)
          .addToggle(toggle => {
            toggle
              .setValue(isEnabled)
              .onChange(async value => {
                await this.plugin.settingsManager.updateCustomRule(rule.id, { enabled: value });
              });
          })
          .addButton(button =>
            button
              .setButtonText('Edit')
              .onClick(() => {
                const modal = new RuleEditorModal(this.app, this.plugin, rule, async (updated) => {
                  await this.plugin.settingsManager.updateCustomRule(rule.id, updated);
                  this.display(); // Refresh
                });
                modal.open();
              })
          )
          .addButton(button =>
            button
              .setButtonText('Delete')
              .setWarning()
              .onClick(async () => {
                await this.plugin.settingsManager.deleteCustomRule(rule.id);
                this.display(); // Refresh
              })
          );
      }
    }
  }

  private displayAbout(containerEl: HTMLElement) {
    containerEl.createEl('h3', { text: 'About' });

    const aboutDiv = containerEl.createDiv({ cls: 'tag-curator-about' });
    aboutDiv.createEl('p', {
      text: 'Tag Curator: A vault-wide tag visibility and curation engine for Obsidian',
    });
    aboutDiv.createEl('p', {
      text: 'Version 0.1.0 - Display-only, file-safe, fully reversible',
    });
    aboutDiv.createEl('p', {
      text: 'Uninstall to immediately restore all hidden tags. No files are modified.',
    });

    const linksDiv = aboutDiv.createDiv({ cls: 'tag-curator-links' });
    linksDiv.createEl('a', {
      text: 'GitHub',
      href: 'https://github.com/jprisant/obsidian-tag-curator',
      attr: { target: '_blank' },
    });
  }
}
