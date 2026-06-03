import { describe, expect, it } from 'vitest';
import { Plugin } from 'obsidian';
import { SettingsManager } from '../src/storage/settings';
import { DEFAULT_SETTINGS, Rule, SCHEMA_VERSION } from '../src/types';

function pluginWith(data: unknown): Plugin {
  const p = new Plugin();
  p.data = data;
  return p;
}

function customRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'r1',
    name: 'r1',
    enabled: true,
    priority: 50,
    match: { type: 'list', list: [] },
    action: 'hide',
    scopes: ['tag-pane'],
    ...overrides,
  };
}

describe('SettingsManager.load - fresh install', () => {
  it('uses defaults when stored data is null', async () => {
    const mgr = new SettingsManager(pluginWith(null));
    await mgr.load();
    expect(mgr.get()).toEqual({ ...DEFAULT_SETTINGS, schemaVersion: SCHEMA_VERSION });
  });

  it('uses defaults when stored data is empty object', async () => {
    const mgr = new SettingsManager(pluginWith({}));
    await mgr.load();
    expect(mgr.get().schemaVersion).toBe(SCHEMA_VERSION);
    expect(mgr.get().enabledPresets).toEqual(DEFAULT_SETTINGS.enabledPresets);
  });
});

describe('SettingsManager.load - v0 to v1 migration', () => {
  it('migrates legacy `rules` array into `customRules`', async () => {
    const legacy = {
      // no schemaVersion = v0
      rules: [customRule({ id: 'old', enabled: true })],
    };
    const mgr = new SettingsManager(pluginWith(legacy));
    await mgr.load();
    const s = mgr.get();
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.customRules.map((r) => r.id)).toEqual(['old']);
  });

  it('migrates legacy `enabledRules` set onto rules without explicit enabled flag', async () => {
    const legacy = {
      rules: [
        { ...customRule({ id: 'a' }), enabled: undefined as unknown as boolean },
        { ...customRule({ id: 'b' }), enabled: undefined as unknown as boolean },
      ],
      enabledRules: ['a'],
    };
    const mgr = new SettingsManager(pluginWith(legacy));
    await mgr.load();
    const s = mgr.get();
    expect(s.customRules.find((r) => r.id === 'a')?.enabled).toBe(true);
    expect(s.customRules.find((r) => r.id === 'b')?.enabled).toBe(false);
  });

  it('persists schemaVersion bump to disk on migration', async () => {
    const plugin = pluginWith({ rules: [] });
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    expect((plugin.data as { schemaVersion?: number }).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('handles already-current data without rewriting unrelated fields', async () => {
    const original = {
      ...DEFAULT_SETTINGS,
      schemaVersion: SCHEMA_VERSION,
      enabled: false,
      enabledPresets: ['hide-hex-codes'],
    };
    const mgr = new SettingsManager(pluginWith(original));
    await mgr.load();
    expect(mgr.get().enabled).toBe(false);
    expect(mgr.get().enabledPresets).toEqual(['hide-hex-codes']);
  });

  it('does not persist (no downgrade) when reading a future-version file', async () => {
    const futureShape = {
      ...DEFAULT_SETTINGS,
      schemaVersion: SCHEMA_VERSION + 1,
      enabled: false,
      enabledPresets: ['hide-hex-codes'],
      // a hypothetical v2-only field the older plugin does not know about
      futureField: { kept: true } as unknown,
    };
    const plugin = pluginWith(futureShape);
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    // The on-disk data should NOT have been rewritten - the future field is intact.
    const onDisk = plugin.data as { futureField?: { kept: boolean }; schemaVersion: number };
    expect(onDisk.futureField).toEqual({ kept: true });
    expect(onDisk.schemaVersion).toBe(SCHEMA_VERSION + 1);
  });
});

describe('SettingsManager mutations', () => {
  it('update merges partials and persists', async () => {
    const plugin = pluginWith(null);
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    await mgr.update({ enabled: false, previewMode: true });
    expect(mgr.get().enabled).toBe(false);
    expect(mgr.get().previewMode).toBe(true);
    expect((plugin.data as { enabled: boolean }).enabled).toBe(false);
  });

  it('setPresetEnabled adds and removes by id', async () => {
    const mgr = new SettingsManager(pluginWith(null));
    await mgr.load();
    await mgr.setPresetEnabled('hide-orphans', true);
    expect(mgr.get().enabledPresets).toContain('hide-orphans');
    await mgr.setPresetEnabled('hide-orphans', false);
    expect(mgr.get().enabledPresets).not.toContain('hide-orphans');
  });

  it('setPresetEnabled is idempotent', async () => {
    const mgr = new SettingsManager(pluginWith(null));
    await mgr.load();
    await mgr.setPresetEnabled('hide-hex-codes', true);
    await mgr.setPresetEnabled('hide-hex-codes', true);
    const count = mgr
      .get()
      .enabledPresets.filter((id) => id === 'hide-hex-codes').length;
    expect(count).toBe(1);
  });

  it('addCustomRule appends', async () => {
    const mgr = new SettingsManager(pluginWith(null));
    await mgr.load();
    await mgr.addCustomRule(customRule({ id: 'new' }));
    expect(mgr.get().customRules.map((r) => r.id)).toEqual(['new']);
  });

  it('updateCustomRule patches by id and ignores unknowns', async () => {
    const mgr = new SettingsManager(pluginWith(null));
    await mgr.load();
    await mgr.addCustomRule(customRule({ id: 'a', name: 'first' }));
    await mgr.addCustomRule(customRule({ id: 'b', name: 'second' }));
    await mgr.updateCustomRule('a', { name: 'renamed' });
    await mgr.updateCustomRule('ghost', { name: 'oops' });
    expect(mgr.get().customRules.find((r) => r.id === 'a')?.name).toBe('renamed');
    expect(mgr.get().customRules.find((r) => r.id === 'b')?.name).toBe('second');
  });

  it('deleteCustomRule removes by id', async () => {
    const mgr = new SettingsManager(pluginWith(null));
    await mgr.load();
    await mgr.addCustomRule(customRule({ id: 'a' }));
    await mgr.addCustomRule(customRule({ id: 'b' }));
    await mgr.deleteCustomRule('a');
    expect(mgr.get().customRules.map((r) => r.id)).toEqual(['b']);
  });

  it('onChange listeners fire on persist', async () => {
    const mgr = new SettingsManager(pluginWith(null));
    await mgr.load();
    let callCount = 0;
    mgr.onChange(() => {
      callCount += 1;
    });
    await mgr.update({ enabled: false });
    await mgr.setEnabled(true);
    expect(callCount).toBe(2);
  });

  it('onChange returns an unsubscribe function that stops the callback from firing', async () => {
    const mgr = new SettingsManager(pluginWith(null));
    await mgr.load();
    let callCount = 0;
    const off = mgr.onChange(() => {
      callCount += 1;
    });
    await mgr.update({ enabled: false });
    expect(callCount).toBe(1);
    off();
    await mgr.setEnabled(true);
    await mgr.update({ previewMode: true });
    expect(callCount).toBe(1); // no further calls after unsubscribe
  });

  it('reload re-reads persisted data', async () => {
    const plugin = pluginWith(null);
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    plugin.data = { ...DEFAULT_SETTINGS, schemaVersion: SCHEMA_VERSION, previewMode: true };
    await mgr.reload();
    expect(mgr.get().previewMode).toBe(true);
  });
});

describe('SettingsManager.load - v1 to v2 migration', () => {
  it('maps legacy `dryRun` onto `previewMode` when reading v1 data', async () => {
    const v1 = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 1,
      dryRun: true,
    } as unknown;
    delete (v1 as { previewMode?: boolean }).previewMode;
    const plugin = pluginWith(v1);
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    expect(mgr.get().previewMode).toBe(true);
    expect(mgr.get().schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('keeps previewMode false when v1 data did not set dryRun', async () => {
    const v1 = { ...DEFAULT_SETTINGS, schemaVersion: 1 } as unknown;
    delete (v1 as { previewMode?: boolean }).previewMode;
    const plugin = pluginWith(v1);
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    expect(mgr.get().previewMode).toBe(false);
  });

  it('persists the renamed field to disk after migration', async () => {
    const v1 = { ...DEFAULT_SETTINGS, schemaVersion: 1, dryRun: true } as unknown;
    delete (v1 as { previewMode?: boolean }).previewMode;
    const plugin = pluginWith(v1);
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    const onDisk = plugin.data as { previewMode?: boolean; schemaVersion: number };
    expect(onDisk.previewMode).toBe(true);
    expect(onDisk.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('SettingsManager.load - v2 to v3 migration', () => {
  it('defaults seenWelcomeModal to false when reading v2 data', async () => {
    const v2 = { ...DEFAULT_SETTINGS, schemaVersion: 2 } as unknown;
    delete (v2 as { seenWelcomeModal?: boolean }).seenWelcomeModal;
    const plugin = pluginWith(v2);
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    expect(mgr.get().seenWelcomeModal).toBe(false);
    expect(mgr.get().schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('preserves seenWelcomeModal when already present on v2 data', async () => {
    const v2 = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 2,
      seenWelcomeModal: true,
    } as unknown;
    const plugin = pluginWith(v2);
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    expect(mgr.get().seenWelcomeModal).toBe(true);
  });

  it('persists the v3 schemaVersion + new field to disk', async () => {
    const v2 = { ...DEFAULT_SETTINGS, schemaVersion: 2 } as unknown;
    delete (v2 as { seenWelcomeModal?: boolean }).seenWelcomeModal;
    const plugin = pluginWith(v2);
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    const onDisk = plugin.data as {
      seenWelcomeModal?: boolean;
      schemaVersion: number;
    };
    expect(onDisk.schemaVersion).toBe(SCHEMA_VERSION);
    expect(onDisk.seenWelcomeModal).toBe(false);
  });
});

describe('SettingsManager.setSeenWelcomeModal', () => {
  it('persists the flag', async () => {
    const mgr = new SettingsManager(pluginWith(null));
    await mgr.load();
    expect(mgr.get().seenWelcomeModal).toBe(false);
    await mgr.setSeenWelcomeModal(true);
    expect(mgr.get().seenWelcomeModal).toBe(true);
  });
});

describe('SettingsManager.load - v3 to v4 migration (overrides)', () => {
  it('defaults overrides to {} when reading v3 data', async () => {
    const v3 = { ...DEFAULT_SETTINGS, schemaVersion: 3 } as unknown;
    delete (v3 as { overrides?: unknown }).overrides;
    const mgr = new SettingsManager(pluginWith(v3));
    await mgr.load();
    expect(mgr.get().schemaVersion).toBe(SCHEMA_VERSION);
    expect(mgr.get().overrides).toEqual({});
  });

  it('preserves an existing overrides map unchanged on v4 data', async () => {
    const v4 = {
      ...DEFAULT_SETTINGS,
      schemaVersion: SCHEMA_VERSION,
      overrides: { foo: 'show', bar: 'hide' },
    } as unknown;
    const mgr = new SettingsManager(pluginWith(v4));
    await mgr.load();
    expect(mgr.get().overrides).toEqual({ foo: 'show', bar: 'hide' });
  });

  it('persists the v4 schemaVersion + overrides field to disk', async () => {
    const v3 = { ...DEFAULT_SETTINGS, schemaVersion: 3 } as unknown;
    delete (v3 as { overrides?: unknown }).overrides;
    const plugin = pluginWith(v3);
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    const onDisk = plugin.data as { overrides?: unknown; schemaVersion: number };
    expect(onDisk.schemaVersion).toBe(SCHEMA_VERSION);
    expect(onDisk.overrides).toEqual({});
  });

  it('resets overrides to {} when v3 data has an array instead of an object', async () => {
    const v3 = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 3,
      overrides: [] as unknown,
    };
    const mgr = new SettingsManager(pluginWith(v3));
    await mgr.load();
    expect(mgr.get().overrides).toEqual({});
  });

  it('does not downgrade or persist when reading a future-version file with overrides', async () => {
    const future = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 99,
      overrides: { kept: 'hide' },
      futureField: { kept: true } as unknown,
    };
    const plugin = pluginWith(future);
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    const onDisk = plugin.data as {
      futureField?: { kept: boolean };
      schemaVersion: number;
    };
    expect(onDisk.futureField).toEqual({ kept: true });
    expect(onDisk.schemaVersion).toBe(99);
  });
});

describe('SettingsManager.load - v4 to v5 migration (per-scope enable + NN notice)', () => {
  // A v4 fixture must NOT carry the v5 fields, so we build it from DEFAULT_SETTINGS
  // and explicitly strip the fields v5 introduces; otherwise the defaults would
  // mask the migration we are exercising.
  function v4Fixture(extra: Record<string, unknown> = {}): unknown {
    const v4 = { ...DEFAULT_SETTINGS, schemaVersion: 4 } as Record<string, unknown>;
    // Strip the v5-introduced fields so the migration is what fills them; then
    // layer any caller-supplied overrides on top (so a test can inject a v4 file
    // that DID already carry, say, an explicit scopeEnabled value).
    delete v4.scopeEnabled;
    delete v4.seenNnTooOldNotice;
    return { ...v4, ...extra };
  }

  it('defaults scopeEnabled with all four v1.0 scopes enabled when absent', async () => {
    const mgr = new SettingsManager(pluginWith(v4Fixture()));
    await mgr.load();
    const s = mgr.get();
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.scopeEnabled).toEqual({
      'tag-pane': true,
      'notebook-navigator': true,
      properties: true,
      autocomplete: true,
    });
  });

  it('defaults seenNnTooOldNotice to false when absent', async () => {
    const mgr = new SettingsManager(pluginWith(v4Fixture()));
    await mgr.load();
    expect(mgr.get().seenNnTooOldNotice).toBe(false);
  });

  it('preserves an explicit per-scope false (kill switch) across migration', async () => {
    const fixture = v4Fixture({
      scopeEnabled: { 'notebook-navigator': false },
    });
    const mgr = new SettingsManager(pluginWith(fixture));
    await mgr.load();
    // The explicit false is preserved verbatim; the spread merge does not
    // re-add the other scopes, but isScopeEnabled treats unlisted as enabled.
    expect(mgr.get().scopeEnabled['notebook-navigator']).toBe(false);
    expect(mgr.isScopeEnabled('notebook-navigator')).toBe(false);
    expect(mgr.isScopeEnabled('tag-pane')).toBe(true);
  });

  it('repairs a malformed (array) scopeEnabled to the default map', async () => {
    const fixture = v4Fixture({ scopeEnabled: [] as unknown });
    const mgr = new SettingsManager(pluginWith(fixture));
    await mgr.load();
    expect(mgr.get().scopeEnabled).toEqual(DEFAULT_SETTINGS.scopeEnabled);
  });

  it('persists the v5 schemaVersion + new fields to disk', async () => {
    const plugin = pluginWith(v4Fixture());
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    const onDisk = plugin.data as {
      schemaVersion: number;
      scopeEnabled?: Record<string, boolean>;
      seenNnTooOldNotice?: boolean;
    };
    expect(onDisk.schemaVersion).toBe(SCHEMA_VERSION);
    expect(onDisk.scopeEnabled).toEqual(DEFAULT_SETTINGS.scopeEnabled);
    expect(onDisk.seenNnTooOldNotice).toBe(false);
  });
});

describe('SettingsManager.isScopeEnabled / setScopeEnabled', () => {
  it('treats an unlisted scope as enabled (safe default-on)', async () => {
    const mgr = new SettingsManager(pluginWith(null));
    await mgr.load();
    expect(mgr.isScopeEnabled('graph')).toBe(true);
  });

  it('setScopeEnabled toggles a scope off and back on, persisting each time', async () => {
    const plugin = pluginWith(null);
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    await mgr.setScopeEnabled('notebook-navigator', false);
    expect(mgr.isScopeEnabled('notebook-navigator')).toBe(false);
    expect(
      (plugin.data as { scopeEnabled: Record<string, boolean> }).scopeEnabled[
        'notebook-navigator'
      ],
    ).toBe(false);
    await mgr.setScopeEnabled('notebook-navigator', true);
    expect(mgr.isScopeEnabled('notebook-navigator')).toBe(true);
  });

  it('setScopeEnabled does not clobber other scopes', async () => {
    const mgr = new SettingsManager(pluginWith(null));
    await mgr.load();
    await mgr.setScopeEnabled('notebook-navigator', false);
    expect(mgr.isScopeEnabled('tag-pane')).toBe(true);
    expect(mgr.isScopeEnabled('properties')).toBe(true);
  });
});

describe('SettingsManager.setSeenNnTooOldNotice', () => {
  it('persists the one-time notice flag', async () => {
    const plugin = pluginWith(null);
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    expect(mgr.get().seenNnTooOldNotice).toBe(false);
    await mgr.setSeenNnTooOldNotice(true);
    expect(mgr.get().seenNnTooOldNotice).toBe(true);
    expect((plugin.data as { seenNnTooOldNotice: boolean }).seenNnTooOldNotice).toBe(true);
  });
});

describe('SettingsManager.load - v5 to v6 migration (paneEnabled)', () => {
  // A v5 fixture must NOT carry paneEnabled so the migration is what fills it.
  function v5Fixture(extra: Record<string, unknown> = {}): unknown {
    const v5 = { ...DEFAULT_SETTINGS, schemaVersion: 5 } as Record<string, unknown>;
    delete v5.paneEnabled;
    return { ...v5, ...extra };
  }

  it('defaults paneEnabled to true when absent from v5 data', async () => {
    const mgr = new SettingsManager(pluginWith(v5Fixture()));
    await mgr.load();
    expect(mgr.get().schemaVersion).toBe(SCHEMA_VERSION);
    expect(mgr.get().paneEnabled).toBe(true);
  });

  it('preserves an explicit paneEnabled false across migration', async () => {
    const fixture = v5Fixture({ paneEnabled: false });
    const mgr = new SettingsManager(pluginWith(fixture));
    await mgr.load();
    expect(mgr.get().paneEnabled).toBe(false);
  });

  it('persists the v6 schemaVersion + paneEnabled to disk', async () => {
    const plugin = pluginWith(v5Fixture());
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    const onDisk = plugin.data as { schemaVersion: number; paneEnabled?: boolean };
    expect(onDisk.schemaVersion).toBe(SCHEMA_VERSION);
    expect(onDisk.paneEnabled).toBe(true);
  });
});

describe('SettingsManager.setPaneEnabled', () => {
  it('defaults paneEnabled to true on a fresh install', async () => {
    const mgr = new SettingsManager(pluginWith(null));
    await mgr.load();
    expect(mgr.get().paneEnabled).toBe(true);
  });

  it('setPaneEnabled toggles the flag and persists', async () => {
    const plugin = pluginWith(null);
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    expect(mgr.get().paneEnabled).toBe(true);
    await mgr.setPaneEnabled(false);
    expect(mgr.get().paneEnabled).toBe(false);
    expect((plugin.data as { paneEnabled: boolean }).paneEnabled).toBe(false);
    await mgr.setPaneEnabled(true);
    expect(mgr.get().paneEnabled).toBe(true);
  });
});

describe('SettingsManager.load - v6 to v7 migration (tableColumns)', () => {
  // A v6 fixture must NOT carry tableColumns so the migration is what fills it.
  function v6Fixture(extra: Record<string, unknown> = {}): unknown {
    const v6 = { ...DEFAULT_SETTINGS, schemaVersion: 6 } as Record<string, unknown>;
    delete v6.tableColumns;
    return { ...v6, ...extra };
  }

  it('defaults tableColumns with all three optional columns on when absent', async () => {
    const mgr = new SettingsManager(pluginWith(v6Fixture()));
    await mgr.load();
    expect(mgr.get().schemaVersion).toBe(SCHEMA_VERSION);
    expect(mgr.get().tableColumns).toEqual({ lastSeen: true, source: true, rule: true });
  });

  it('preserves an explicit tableColumns map across migration', async () => {
    const fixture = v6Fixture({ tableColumns: { lastSeen: false, source: true, rule: false } });
    const mgr = new SettingsManager(pluginWith(fixture));
    await mgr.load();
    expect(mgr.get().tableColumns).toEqual({ lastSeen: false, source: true, rule: false });
  });

  it('repairs a malformed (array) tableColumns to the default map', async () => {
    const fixture = v6Fixture({ tableColumns: [] as unknown });
    const mgr = new SettingsManager(pluginWith(fixture));
    await mgr.load();
    expect(mgr.get().tableColumns).toEqual(DEFAULT_SETTINGS.tableColumns);
  });

  it('persists the v7 schemaVersion + tableColumns to disk', async () => {
    const plugin = pluginWith(v6Fixture());
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    const onDisk = plugin.data as { schemaVersion: number; tableColumns?: unknown };
    expect(onDisk.schemaVersion).toBe(SCHEMA_VERSION);
    expect(onDisk.tableColumns).toEqual({ lastSeen: true, source: true, rule: true });
  });
});

describe('SettingsManager.setTableColumns', () => {
  it('replaces the column map and persists', async () => {
    const plugin = pluginWith(null);
    const mgr = new SettingsManager(plugin);
    await mgr.load();
    expect(mgr.get().tableColumns).toEqual({ lastSeen: true, source: true, rule: true });
    await mgr.setTableColumns({ lastSeen: false, source: false, rule: true });
    expect(mgr.get().tableColumns).toEqual({ lastSeen: false, source: false, rule: true });
    expect(
      (plugin.data as { tableColumns: { lastSeen: boolean } }).tableColumns.lastSeen,
    ).toBe(false);
  });
});
