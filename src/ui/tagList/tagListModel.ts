import { TagCuratorSettings, TagMeta } from '../../types';
import { RuleEngine } from '../../engine/ruleEngine';
import { resolveActiveRules } from '../../engine/presets';

export type TagVisibility = 'shown' | 'hidden' | 'flagged';
export type SortKey = 'name' | 'count' | 'firstSeen' | 'lastSeen' | 'source' | 'visible';
export type FilterChip =
  | 'all'
  | 'shown'
  | 'hidden'
  | 'flagged'
  | 'orphans'
  | 'frontmatter'
  | 'inline'
  | 'unreviewed';

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
  private ruleFilter: string | null = null;
  private search = '';
  private selected = new Set<string>();

  constructor(private data: TagListDataSource) {}

  allRows(): TagRow[] {
    const settings = this.data.getSettings();
    const meta = this.data.getMeta();
    const activeRules = resolveActiveRules(settings);
    const rows: TagRow[] = [];
    for (const tagMeta of meta.values()) {
      const attribution = RuleEngine.resolveVisibility(
        tagMeta.tag,
        tagMeta,
        activeRules,
        settings.overrides,
      );
      const matches = attribution.allMatches.map((m) => ({
        ruleId: m.ruleId,
        ruleName: m.ruleName,
      }));
      // An effective match hides the tag unless it is an always-show override,
      // which keeps the tag visible (the safety net beats every rule).
      const eff = attribution.effective;
      let visibility: TagVisibility = 'shown';
      if (RuleEngine.isEffectivelyHidden(eff)) {
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
  /** Restrict rows to those matched by a specific rule id; null clears it. */
  setRuleFilter(ruleId: string | null): void {
    this.ruleFilter = ruleId;
  }
  get activeFilter(): FilterChip {
    return this.filter;
  }
  get activeRuleFilter(): string | null {
    return this.ruleFilter;
  }

  matchesFilter(row: TagRow): boolean {
    if (this.search && !row.meta.tag.toLowerCase().includes(this.search)) return false;
    if (this.ruleFilter && !row.matches.some((m) => m.ruleId === this.ruleFilter)) {
      return false;
    }
    switch (this.filter) {
      case 'all':
        return true;
      case 'shown':
        return row.visibility === 'shown';
      case 'hidden':
        return row.visibility !== 'shown';
      case 'flagged':
        return row.visibility === 'flagged';
      case 'orphans':
        return row.meta.count <= 1;
      case 'frontmatter':
        return row.meta.sources.length === 1 && row.meta.sources[0] === 'frontmatter';
      case 'inline':
        return row.meta.sources.length === 1 && row.meta.sources[0] === 'inline';
      case 'unreviewed':
        return !row.meta.reviewed;
    }
  }

  setSort(key: SortKey, desc?: boolean): void {
    if (desc === undefined) {
      this.sortDesc = this.sortBy === key ? !this.sortDesc : true;
    } else {
      this.sortDesc = desc;
    }
    this.sortBy = key;
  }
  get sortState(): { key: SortKey; desc: boolean } {
    return { key: this.sortBy, desc: this.sortDesc };
  }

  compare(a: TagRow, b: TagRow): number {
    let av: string | number = 0;
    let bv: string | number = 0;
    switch (this.sortBy) {
      case 'name':
        av = a.meta.tag;
        bv = b.meta.tag;
        break;
      case 'count':
        av = a.meta.count;
        bv = b.meta.count;
        break;
      case 'firstSeen':
        av = a.meta.firstSeen;
        bv = b.meta.firstSeen;
        break;
      case 'lastSeen':
        av = a.meta.lastSeen;
        bv = b.meta.lastSeen;
        break;
      case 'source':
        av = a.meta.sources.join(',');
        bv = b.meta.sources.join(',');
        break;
      case 'visible':
        av = a.visibility;
        bv = b.visibility;
        break;
    }
    if (typeof av === 'string' && typeof bv === 'string') {
      return this.sortDesc ? bv.localeCompare(av) : av.localeCompare(bv);
    }
    return this.sortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number);
  }

  rows(): TagRow[] {
    const filtered = this.allRows().filter((r) => this.matchesFilter(r));
    filtered.sort((a, b) => this.compare(a, b));
    return filtered;
  }

  toggleSelect(tag: string): void {
    if (this.selected.has(tag)) this.selected.delete(tag);
    else this.selected.add(tag);
  }
  clearSelection(): void {
    this.selected.clear();
  }
  get selection(): ReadonlySet<string> {
    return this.selected;
  }

  /**
   * Select every row that currently passes the active filter / search / rule
   * filter. Virtualization-safe: the table renders only a window of rows, so
   * "select all matching" must operate on the full filtered set (rows()), not
   * just the rendered DOM (per Q-004 there are no pages). Additive: leaves any
   * already-selected tag selected.
   */
  selectAllMatching(): void {
    for (const row of this.rows()) this.selected.add(row.meta.tag);
  }

  /**
   * Deselect every row in the current filtered set. The inverse of
   * selectAllMatching; used by the header "select all" toggle when it is
   * already fully checked. Leaves selections outside the current filter intact.
   */
  deselectAllMatching(): void {
    for (const row of this.rows()) this.selected.delete(row.meta.tag);
  }

  /**
   * True when every row in the current filtered set is selected (and there is
   * at least one such row). Drives the header checkbox checked state.
   */
  allMatchingSelected(): boolean {
    const rows = this.rows();
    if (rows.length === 0) return false;
    return rows.every((row) => this.selected.has(row.meta.tag));
  }

  rowFor(tag: string): TagRow | undefined {
    return this.allRows().find((r) => r.meta.tag === tag);
  }
}
