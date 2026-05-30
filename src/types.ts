export const SCHEMA_VERSION = 4;

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

/**
 * Per-tag visibility override (D-015). A tag pinned to 'show' is always visible
 * (the spec's safety net, beats every rule); a tag pinned to 'hide' is always
 * hidden without authoring a rule (beats every rule except an always-show on the
 * same tag, which cannot co-occur since the store holds one value per tag).
 */
export type TagOverride = 'show' | 'hide';

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
  // Per-tag visibility overrides (D-015), keyed by tag (no leading #). Resolved
  // ahead of rules: 'show' beats every rule, 'hide' beats every rule except an
  // always-show on the same tag. Schema v4 added this; v3->v4 defaults it to {}.
  overrides: Record<string, TagOverride>;
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
  overrides: {},
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
  // Set only when this match comes from a per-tag override (D-015) rather than a
  // rule. Lets RuleEngine.resolveVisibility return the existing RuleAttribution
  // shape (so TagListModel and ObserverBase consume one type) while flagging that
  // the effective reason is an always-show / always-hide override, not a rule.
  overrideReason?: 'always-show' | 'always-hide';
}

export interface RuleAttribution {
  tag: string;
  effective: AttributedMatch | null;
  allMatches: AttributedMatch[];
}
