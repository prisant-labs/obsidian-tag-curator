import { Plugin } from 'obsidian';
import {
  DEFAULT_SETTINGS,
  Rule,
  SCHEMA_VERSION,
  TagCuratorSettings,
} from '../types';

type LegacyV0Settings = Partial<TagCuratorSettings> & {
  rules?: Rule[];
  enabledRules?: string[];
  tagMetadata?: unknown;
};

export class SettingsManager {
  private plugin: Plugin;
  private settings: TagCuratorSettings = { ...DEFAULT_SETTINGS };
  private listeners: Array<() => void> = [];

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  async load(): Promise<void> {
    const raw = ((await this.plugin.loadData()) ?? {}) as LegacyV0Settings;
    const incomingVersion = (raw.schemaVersion ?? 0) as number;
    this.settings = this.migrate(raw);
    if (incomingVersion !== SCHEMA_VERSION) {
      await this.persist();
    }
  }

  private migrate(raw: LegacyV0Settings): TagCuratorSettings {
    const inferred = (raw.schemaVersion ?? 0) as number;
    const nested = (raw as { settings?: Partial<TagCuratorSettings> }).settings;
    const base: Partial<TagCuratorSettings> = nested ?? raw;
    const merged: TagCuratorSettings = {
      ...DEFAULT_SETTINGS,
      ...base,
      schemaVersion: SCHEMA_VERSION,
      customRules: Array.isArray(raw.rules)
        ? raw.rules
        : Array.isArray(base.customRules)
          ? base.customRules
          : [],
    };
    if (inferred < 1) {
      const enabledIds = new Set(raw.enabledRules ?? []);
      merged.customRules = merged.customRules.map((r) => ({
        ...r,
        enabled: r.enabled ?? enabledIds.has(r.id),
      }));
    }
    return merged;
  }

  private async persist(): Promise<void> {
    await this.plugin.saveData(this.settings);
    for (const cb of this.listeners) cb();
  }

  get(): TagCuratorSettings {
    return this.settings;
  }

  async update(partial: Partial<TagCuratorSettings>): Promise<void> {
    this.settings = { ...this.settings, ...partial };
    await this.persist();
  }

  async setPresetEnabled(presetId: string, enabled: boolean): Promise<void> {
    const set = new Set(this.settings.enabledPresets);
    if (enabled) set.add(presetId);
    else set.delete(presetId);
    this.settings.enabledPresets = Array.from(set);
    await this.persist();
  }

  async addCustomRule(rule: Rule): Promise<void> {
    this.settings.customRules = [...this.settings.customRules, rule];
    await this.persist();
  }

  async updateCustomRule(ruleId: string, partial: Partial<Rule>): Promise<void> {
    this.settings.customRules = this.settings.customRules.map((r) =>
      r.id === ruleId ? { ...r, ...partial } : r,
    );
    await this.persist();
  }

  async deleteCustomRule(ruleId: string): Promise<void> {
    this.settings.customRules = this.settings.customRules.filter(
      (r) => r.id !== ruleId,
    );
    await this.persist();
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.settings.enabled = enabled;
    await this.persist();
  }

  async setDryRun(dryRun: boolean): Promise<void> {
    this.settings.dryRun = dryRun;
    await this.persist();
  }

  onChange(cb: () => void): void {
    this.listeners.push(cb);
  }

  async reload(): Promise<void> {
    await this.load();
  }
}
