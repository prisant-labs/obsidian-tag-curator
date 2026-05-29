export const SCHEMA_VERSION = 2;

export type Mode = 'default' | 'allow-only' | 'inbox';

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

export type MatchType = 'regex' | 'frequency' | 'list';
export type FrequencyOperator = '<' | '<=' | '>' | '>=' | '=';

export interface MatchCriteria {
  type: MatchType;
  pattern?: string;
  operator?: FrequencyOperator;
  value?: number;
  list?: string[];
}

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  match: MatchCriteria;
  action: Action;
  scopes: Scope[];
  notes?: string;
  builtin?: boolean;
}

export type TagSource = 'frontmatter' | 'inline';

export interface TagMeta {
  tag: string;
  firstSeen: number;
  lastSeen: number;
  count: number;
  sources: TagSource[];
  description?: string;
  aliases?: string[];
  reviewed?: boolean;
}

export interface TagCuratorSettings {
  schemaVersion: number;
  enabled: boolean;
  mode: Mode;
  defaultScopes: Scope[];
  enabledPresets: string[];
  customRules: Rule[];
  previewMode: boolean;
  debugLog: boolean;
  sidecarDebounceMs: number;
}

export const DEFAULT_SETTINGS: TagCuratorSettings = {
  schemaVersion: SCHEMA_VERSION,
  enabled: true,
  mode: 'default',
  defaultScopes: ['tag-pane'],
  enabledPresets: ['hide-hex-codes', 'hide-url-anchors'],
  customRules: [],
  previewMode: false,
  debugLog: false,
  sidecarDebounceMs: 5000,
};

export interface RulePreset {
  id: string;
  name: string;
  description: string;
  rule: Rule;
}

export interface MatchResult {
  matched: boolean;
  ruleId: string;
  ruleName: string;
}

export interface AttributedMatch {
  ruleId: string;
  ruleName: string;
  action: Action;
  scopes: Scope[];
  priority: number;
  builtin: boolean;
  reason: string;
}

export interface RuleAttribution {
  tag: string;
  effective: AttributedMatch | null;
  allMatches: AttributedMatch[];
}
