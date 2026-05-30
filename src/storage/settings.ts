import { Plugin } from 'obsidian';
import {
  DEFAULT_SETTINGS,
  Rule,
  SCHEMA_VERSION,
  TagCuratorSettings,
  TagOverride,
} from '../types';

type LegacyV0Settings = Partial<TagCuratorSettings> & {
  rules?: Rule[];
  enabledRules?: string[];
  tagMetadata?: unknown;
  // Pre-v2 name for previewMode. Carried so the v1 -> v2 migration can map it.
  dryRun?: boolean;
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
    // Only persist when migrating UP. Reading a future-version file with an
    // older plugin must not overwrite the on-disk data with downgraded shape.
    if (incomingVersion < SCHEMA_VERSION) {
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
    if (inferred < 2) {
      // Renamed dryRun -> previewMode. Carry the old value forward verbatim.
      if (typeof raw.dryRun === 'boolean') {
        merged.previewMode = raw.dryRun;
      }
    }
    if (inferred < 3) {
      // Added seenWelcomeModal (D-008). Existing installs (BRAT testers) see the
      // modal once on next load - intentional, so they get the new contract framing.
      if (typeof merged.seenWelcomeModal !== 'boolean') {
        merged.seenWelcomeModal = false;
      }
    }
    if (inferred < 4) {
      // Added per-tag overrides (D-015). Default to an empty map; existing
      // installs have no pinned tags until the user creates them.
      if (!merged.overrides || typeof merged.overrides !== 'object' || Array.isArray(merged.overrides)) {
        merged.overrides = {};
      }
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

  async setPreviewMode(previewMode: boolean): Promise<void> {
    this.settings.previewMode = previewMode;
    await this.persist();
  }

  async setSeenWelcomeModal(seen: boolean): Promise<void> {
    this.settings.seenWelcomeModal = seen;
    await this.persist();
  }

  /**
   * Pin a tag to always-show / always-hide (D-015), or clear the pin when value
   * is null. Tag keys carry no leading '#'. Resolved ahead of rules by the
   * engine; see RuleEngine.resolveVisibility.
   */
  async setOverride(tag: string, value: TagOverride | null): Promise<void> {
    const next = { ...this.settings.overrides };
    if (value === null) delete next[tag];
    else next[tag] = value;
    this.settings.overrides = next;
    await this.persist();
  }

  onChange(cb: () => void): void {
    this.listeners.push(cb);
  }

  async reload(): Promise<void> {
    await this.load();
  }
}
