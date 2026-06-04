/**
 * Host surface the TagTable component and its helpers (bulkBar, rowMenu) depend
 * on. The CurationWorkspaceView implements this so the table stays decoupled
 * from the plugin: it reads settings / meta / active rules for diagnostics and
 * asks the host to refresh after a write, but it never reaches into the plugin
 * directly.
 */
import { Rule, TableColumnPrefs, TagCuratorSettings, TagMeta } from '../../types';

export interface TagListDiagnosticsHost {
  /** Current settings (overrides, previewMode, ...) for visibility resolution. */
  getSettings(): TagCuratorSettings;
  /** Live tag metadata, keyed by tag name (no leading '#'). */
  getMeta(): Map<string, TagMeta>;
  /** The enabled rules in effect (presets + custom), priority order applied by the engine. */
  getActiveRules(): Rule[];
  /** True when the named community plugin is enabled (e.g. 'tag-wrangler'). */
  isPluginEnabled(id: string): boolean;
  /** Re-render the table from current model + data state. */
  requestRefresh(): void;
  /** Open Obsidian's core global search filtered to the given tag (no-op if unavailable). */
  searchTag(tag: string): void;
  /** This surface's persisted column-visibility prefs (Last used / Source / Rule). */
  getColumns(): TableColumnPrefs;
  /** Persist this surface's column-visibility prefs. Independent per surface (item 8a). */
  setColumns(cols: TableColumnPrefs): void;
}
