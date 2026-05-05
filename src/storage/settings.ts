/**
 * Settings storage and management
 */

import { Plugin } from 'obsidian';
import { TagCuratorSettings, Rule, DEFAULT_SETTINGS } from '../types';
import { PRESETS } from '../engine/presets';

export class SettingsManager {
  private plugin: Plugin;
  private settings: TagCuratorSettings = DEFAULT_SETTINGS;
  private rules: Rule[] = [];
  private onSettingsChanged: (() => void) | null = null;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Load settings from disk
   */
  async load() {
    const saved = await this.plugin.loadData();
    if (saved) {
      this.settings = { ...DEFAULT_SETTINGS, ...saved.settings };
      this.rules = saved.rules || [];
    }
  }

  /**
   * Save settings to disk
   */
  async save() {
    await this.plugin.saveData({
      settings: this.settings,
      rules: this.rules,
    });

    if (this.onSettingsChanged) {
      this.onSettingsChanged();
    }
  }

  /**
   * Get current settings
   */
  getSettings(): TagCuratorSettings {
    return this.settings;
  }

  /**
   * Update settings
   */
  async updateSettings(partial: Partial<TagCuratorSettings>) {
    this.settings = { ...this.settings, ...partial };
    await this.save();
  }

  /**
   * Get all active rules (both presets and custom)
   */
  getActiveRules(): Rule[] {
    const rules: Rule[] = [];

    // Add enabled presets
    for (const presetId of this.settings.enabledPresets) {
      const preset = PRESETS.find(p => p.id === presetId);
      if (preset) {
        rules.push(preset.rule);
      }
    }

    // Add custom enabled rules
    rules.push(...this.rules.filter(r => this.settings.enabledRules.includes(r.id)));

    return rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get all rules (including disabled ones)
   */
  getAllRules(): Rule[] {
    return [
      ...PRESETS.map(p => p.rule),
      ...this.rules,
    ];
  }

  /**
   * Add a custom rule
   */
  async addRule(rule: Rule) {
    this.rules.push(rule);
    this.settings.enabledRules.push(rule.id);
    await this.save();
  }

  /**
   * Update a custom rule
   */
  async updateRule(ruleId: string, partial: Partial<Rule>) {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      Object.assign(rule, partial);
      await this.save();
    }
  }

  /**
   * Delete a custom rule
   */
  async deleteRule(ruleId: string) {
    this.rules = this.rules.filter(r => r.id !== ruleId);
    this.settings.enabledRules = this.settings.enabledRules.filter(id => id !== ruleId);
    await this.save();
  }

  /**
   * Toggle a rule's enabled state
   */
  async toggleRule(ruleId: string, enabled: boolean) {
    if (enabled && !this.settings.enabledRules.includes(ruleId)) {
      this.settings.enabledRules.push(ruleId);
    } else if (!enabled && this.settings.enabledRules.includes(ruleId)) {
      this.settings.enabledRules = this.settings.enabledRules.filter(id => id !== ruleId);
    }
    await this.save();
  }

  /**
   * Toggle preset enabled state
   */
  async togglePreset(presetId: string, enabled: boolean) {
    if (enabled && !this.settings.enabledPresets.includes(presetId)) {
      this.settings.enabledPresets.push(presetId);
    } else if (!enabled && this.settings.enabledPresets.includes(presetId)) {
      this.settings.enabledPresets = this.settings.enabledPresets.filter(id => id !== presetId);
    }
    await this.save();
  }

  /**
   * Register a callback for when settings change
   */
  onChanged(callback: () => void) {
    this.onSettingsChanged = callback;
  }
}
