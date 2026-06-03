import { Plugin } from 'obsidian';
import {
  DEFAULT_SETTINGS,
  Rule,
  SCHEMA_VERSION,
  TableColumnPrefs,
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
    if (inferred < 5) {
      // Added per-scope enable + the one-time NN-too-old notice (Phase 5B). The
      // spread above already fills these from DEFAULT_SETTINGS when absent; this
      // guard only repairs a present-but-malformed value (e.g. an array written by
      // a hand-edited data.json), defaulting the four v1.0 scopes ON.
      if (
        !merged.scopeEnabled ||
        typeof merged.scopeEnabled !== 'object' ||
        Array.isArray(merged.scopeEnabled)
      ) {
        merged.scopeEnabled = { ...DEFAULT_SETTINGS.scopeEnabled };
      }
      if (typeof merged.seenNnTooOldNotice !== 'boolean') {
        merged.seenNnTooOldNotice = false;
      }
    }
    if (inferred < 6) {
      if (typeof merged.paneEnabled !== 'boolean') {
        merged.paneEnabled = true;
      }
    }
    if (inferred < 7) {
      // Added persisted tag-table column prefs (2-5). The spread above already
      // fills this from DEFAULT_SETTINGS when absent; this guard only repairs a
      // present-but-malformed value (e.g. a hand-edited data.json), defaulting
      // all three optional columns ON.
      if (
        !merged.tableColumns ||
        typeof merged.tableColumns !== 'object' ||
        Array.isArray(merged.tableColumns)
      ) {
        merged.tableColumns = { ...DEFAULT_SETTINGS.tableColumns };
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

  async setSeenNnTooOldNotice(seen: boolean): Promise<void> {
    this.settings.seenNnTooOldNotice = seen;
    await this.persist();
  }

  async setPaneEnabled(paneEnabled: boolean): Promise<void> {
    this.settings.paneEnabled = paneEnabled;
    await this.persist();
  }

  /**
   * Persist the tag-table column visibility prefs (2-5). Replaces the whole map
   * so the single onChange fan-out repaints every table surface at once.
   */
  async setTableColumns(columns: TableColumnPrefs): Promise<void> {
    this.settings.tableColumns = { ...columns };
    await this.persist();
  }

  /**
   * Whether a given scope is globally live (Phase 5B). Reads the per-scope
   * enable map; a scope absent from the map is treated as enabled, so callers
   * (and Phases 6-8) get a safe default-on for any scope not yet listed. This is
   * the global on/off switch for a surface, distinct from `defaultScopes` (which
   * governs which scopes a rule applies to).
   */
  isScopeEnabled(scope: string): boolean {
    const flag = this.settings.scopeEnabled?.[scope];
    return flag !== false;
  }

  async setScopeEnabled(scope: string, enabled: boolean): Promise<void> {
    this.settings.scopeEnabled = { ...this.settings.scopeEnabled, [scope]: enabled };
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

  onChange(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => {
      const idx = this.listeners.indexOf(cb);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  async reload(): Promise<void> {
    await this.load();
  }
}
