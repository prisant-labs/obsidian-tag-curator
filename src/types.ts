/**
 * Core types for Tag Curator plugin
 */

export interface TagCuratorSettings {
  mode: 'default' | 'allow-only' | 'inbox';
  defaultScopes: Scope[];
  enabledPresets: string[];
  enabledRules: string[];
  dryRun: boolean;
  debugLog: boolean;
  sidecarDebounceMs: number;
}

export const DEFAULT_SETTINGS: TagCuratorSettings = {
  mode: 'default',
  defaultScopes: ['tag-pane'],
  enabledPresets: ['hide-hex-codes', 'hide-url-anchors', 'hide-orphans'],
  enabledRules: [],
  dryRun: false,
  debugLog: false,
  sidecarDebounceMs: 5000,
};

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  match: MatchCriteria;
  action: Action;
  scopes: Scope[];
  notes?: string;
}

export interface MatchCriteria {
  type: 'regex' | 'frequency' | 'list';
  pattern?: string;
  operator?: '<' | '<=' | '>' | '>=' | '=';
  value?: number | string;
  list?: string[];
}

export type Action = 'hide' | 'show-only' | 'flag' | 'group' | 'delegate-color';

export type Scope =
  | 'tag-pane'
  | 'graph'
  | 'local-graph'
  | 'autocomplete'
  | 'properties'
  | 'search-facets'
  | 'quick-switcher'
  | 'backlinks'
  | 'hover-preview'
  | 'bases'
  | 'notebook-navigator'
  | 'tag-wrangler-menu';

export interface TagMeta {
  tag: string;
  firstSeen: number;
  lastSeen: number;
  count: number;
  description?: string;
  aliases?: string[];
  reviewed?: boolean;
  sources: TagSource[];
}

export type TagSource = 'frontmatter' | 'inline';

/**
 * Preset rule configuration
 */
export interface RulePreset {
  id: string;
  name: string;
  description: string;
  rule: Rule;
}

/**
 * Match result for a tag against a rule
 */
export interface MatchResult {
  matched: boolean;
  ruleId: string;
  ruleName: string;
}
