/**
 * Built-in rule presets
 */

import { RulePreset } from '../types';

export const PRESETS: RulePreset[] = [
  {
    id: 'hide-hex-codes',
    name: 'Hide hex color codes',
    description: 'Hide tags matching hex color codes (#FFAA00, #abcdef, etc.)',
    rule: {
      id: 'hide-hex-codes',
      name: 'Hide hex color codes',
      enabled: true,
      priority: 100,
      match: {
        type: 'regex',
        pattern: '^#[0-9A-Fa-f]{3,8}$',
      },
      action: 'hide',
      scopes: ['tag-pane'],
      notes: 'Catches CSS hex codes from web clippings, especially via MarkDownload',
    },
  },
  {
    id: 'hide-url-anchors',
    name: 'Hide URL anchor fragments',
    description: 'Hide tags that are URL fragments (#section-3, #top, etc.)',
    rule: {
      id: 'hide-url-anchors',
      name: 'Hide URL anchors',
      enabled: true,
      priority: 95,
      match: {
        type: 'regex',
        pattern: '^#[a-z]+-\\d+$|^#(top|bottom|navigation|content|main|header|footer|sidebar)$',
      },
      action: 'hide',
      scopes: ['tag-pane'],
      notes: 'Common URL fragment patterns from web clippings',
    },
  },
  {
    id: 'hide-single-char',
    name: 'Hide single-character tags',
    description: 'Hide single character tags (#a, #x, etc.)',
    rule: {
      id: 'hide-single-char',
      name: 'Hide single-character tags',
      enabled: false,
      priority: 90,
      match: {
        type: 'regex',
        pattern: '^#[a-zA-Z]$',
      },
      action: 'hide',
      scopes: ['tag-pane'],
      notes: 'Likely typos or single-character shortcuts',
    },
  },
  {
    id: 'hide-orphans',
    name: 'Hide orphan tags',
    description: 'Hide tags that appear only once (count = 1)',
    rule: {
      id: 'hide-orphans',
      name: 'Hide orphan tags (count <= 1)',
      enabled: false,
      priority: 80,
      match: {
        type: 'frequency',
        operator: '<=',
        value: 1,
      },
      action: 'hide',
      scopes: ['tag-pane'],
      notes: 'Tags appearing only once are likely typos or experiments',
    },
  },
  {
    id: 'hide-numeric',
    name: 'Hide pure numeric tags',
    description: 'Hide tags that are purely numeric (though Obsidian usually strips these)',
    rule: {
      id: 'hide-numeric',
      name: 'Hide pure numeric tags',
      enabled: false,
      priority: 85,
      match: {
        type: 'regex',
        pattern: '^#\\d+$',
      },
      action: 'hide',
      scopes: ['tag-pane'],
      notes: 'Catchall for numeric tags (edge case, usually filtered by Obsidian)',
    },
  },
];

export function getPresetById(id: string): RulePreset | undefined {
  return PRESETS.find(p => p.id === id);
}

export function getPresetRule(id: string): RulePreset['rule'] | undefined {
  return getPresetById(id)?.rule;
}
