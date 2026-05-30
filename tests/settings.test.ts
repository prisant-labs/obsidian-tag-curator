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
