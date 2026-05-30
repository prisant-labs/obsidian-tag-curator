import { TagCuratorSettings, TagMeta } from '../../types';
import { RuleEngine } from '../../engine/ruleEngine';
import { resolveActiveRules } from '../../engine/presets';

export type TagVisibility = 'shown' | 'hidden' | 'flagged';
export type SortKey = 'name' | 'count' | 'firstSeen' | 'lastSeen' | 'source' | 'visible';
export type FilterChip = 'all' | 'hidden' | 'orphans' | 'frontmatter' | 'unreviewed';

export interface TagRow {
  meta: TagMeta;
  matches: Array<{ ruleId: string; ruleName: string }>;
  visibility: TagVisibility;
}

export interface TagListDataSource {
  getSettings(): TagCuratorSettings;
  getMeta(): Map<string, TagMeta>;
}

export class TagListModel {
  private sortBy: SortKey = 'count';
  private sortDesc = true;
  private filter: FilterChip = 'all';
  private search = '';
  private selected = new Set<string>();

  constructor(private data: TagListDataSource) {}

  allRows(): TagRow[] {
    const settings = this.data.getSettings();
    const meta = this.data.getMeta();
    const activeRules = resolveActiveRules(settings);
    const rows: TagRow[] = [];
    for (const tagMeta of meta.values()) {
      const attribution = RuleEngine.getRuleAttribution(tagMeta.tag, tagMeta, activeRules);
      const matches = attribution.allMatches.map((m) => ({
        ruleId: m.ruleId,
        ruleName: m.ruleName,
      }));
      let visibility: TagVisibility = 'shown';
      if (attribution.effective) {
        visibility = settings.previewMode ? 'flagged' : 'hidden';
      }
      rows.push({ meta: tagMeta, matches, visibility });
    }
    return rows;
  }

  setFilter(chip: FilterChip): void {
    this.filter = chip;
  }
  setSearch(term: string): void {
    this.search = term.toLowerCase();
  }
  get activeFilter(): FilterChip {
    return this.filter;
  }

  matchesFilter(row: TagRow): boolean {
    if (this.search && !row.meta.tag.toLowerCase().includes(this.search)) return false;
    switch (this.filter) {
      case 'all':
        return true;
      case 'hidden':
        return row.visibility !== 'shown';
      case 'orphans':
        return row.meta.count <= 1;
      case 'frontmatter':
        return row.meta.sources.length === 1 && row.meta.sources[0] === 'frontmatter';
      case 'unreviewed':
        return !row.meta.reviewed;
    }
  }

  rows(): TagRow[] {
    return this.allRows().filter((r) => this.matchesFilter(r));
  }
}
