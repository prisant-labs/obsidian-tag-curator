export const SCHEMA_VERSION = 3;

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
  // First-run welcome modal (D-008). False on a fresh install, true once dismissed.
  // Schema v3 added this; migration from v2 defaults it to false (so existing BRAT
  // testers see the modal once on next load - intentional).
  seenWelcomeModal: boolean;
}

export const DEFAULT_SETTINGS: TagCuratorSettings = {
  schemaVersion: SCHEMA_VERSION,
  enabled: true,
  mode: 'default',
  defaultScopes: ['tag-pane'],
  enabledPresets: ['hide-hex-codes', 'hide-url-anchors'],
  customRules: [],
  previewMode: false,
  seenWelcomeModal: false,
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
