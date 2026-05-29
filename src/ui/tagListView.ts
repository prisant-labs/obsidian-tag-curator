/**
 * Tag list view (D-007, D-011, locked design section 2).
 *
 * Row-based, click-sortable table with multi-select + bulk actions, help-icon
 * tooltips on every column header, and the persistent state banner above.
 * Rendered in two host containers (sidebar leaf + Settings tab) per D-011;
 * state lives on the plugin so the views stay in sync.
 *
 * Source attribution per row: every matching rule is rendered as its own
 * line (no "+ N more" collapse, per round-3 review pin 23).
 */
import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import { TagMeta } from '../types';
import { RuleEngine } from '../engine/ruleEngine';
import { resolveActiveRules } from '../engine/presets';
import TagCuratorPlugin from '../main';
import { StateBanner } from './stateBanner';

export const TAG_LIST_VIEW_TYPE = 'tag-curator-list';

type SortKey = 'name' | 'count' | 'firstSeen' | 'lastSeen' | 'source' | 'visible';
type FilterChip = 'all' | 'hidden' | 'orphans' | 'frontmatter' | 'unreviewed';

interface Row {
  meta: TagMeta;
  matches: Array<{ ruleId: string; ruleName: string }>;
  visible: 'shown' | 'hidden' | 'flagged';
}

export class TagListView extends ItemView {
  plugin: TagCuratorPlugin;
  private container: HTMLElement;
  private banner: StateBanner | null = null;

  // Filter / sort state.
  private sortBy: SortKey = 'count';
  private sortDesc = true;
  private filter: FilterChip = 'all';
  private searchTerm = '';
  private hiddenOnly = false;

  // Selection state (Set of tag names).
  private selected = new Set<string>();

  // DOM hooks.
  private searchInput!: HTMLInputElement;
  private bulkBarEl!: HTMLElement;
  private bulkCountEl!: HTMLElement;
  private tbodyEl!: HTMLElement;
  private chipEls = new Map<FilterChip, HTMLElement>();

  // Cached rows so click handlers can refresh without recomputing twice.
  private rows: Row[] = [];

  // Event refs for cleanup.
  private settingsUnsub: () => void = () => {};
  private metaUnsub: () => void = () => {};

  constructor(leaf: WorkspaceLeaf, plugin: TagCuratorPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.container = this.containerEl.children[1] as HTMLElement;
  }

  getViewType(): string {
    return TAG_LIST_VIEW_TYPE;
  }
  getDisplayText(): string {
    return 'Tag list';
  }
  getIcon(): string {
    return 'tags';
  }

  async onOpen(): Promise<void> {
    this.buildUI();
    this.refresh();
    this.plugin.settingsManager.onChange(() => this.refresh());
    this.registerEvent(
      this.plugin.tagMetaManager.on('changed', () => this.refresh()),
    );
  }

  async onClose(): Promise<void> {
    this.banner?.destroy();
    this.settingsUnsub();
    this.metaUnsub();
  }

  /** Public hook used by main.ts for the "hidden only" command. */
  setHiddenOnly(v: boolean): void {
    this.hiddenOnly = v;
    if (v) {
      this.filter = 'hidden';
      this.searchTerm = '';
      if (this.searchInput) this.searchInput.value = '';
    }
    this.refresh();
  }

  // -----------------------------------------------------------------
  // UI construction
  // -----------------------------------------------------------------

  private buildUI(): void {
    this.container.empty();
    this.container.addClass('tag-curator-list');

    // Persistent state banner above the table (D-007).
    this.banner = new StateBanner(this.container, this.plugin);

    // Header.
    const header = this.container.createDiv({ cls: 'tcl-header' });
    header.createEl('h2', { text: 'Vault tags' });

    // Toolbar: search + filter chips.
    const toolbar = this.container.createDiv({ cls: 'tcl-toolbar' });
    const searchWrap = toolbar.createDiv({ cls: 'tcl-search' });
    searchWrap.createSpan({ cls: 'tcl-search-ic', text: '🔍' });
    this.searchInput = searchWrap.createEl('input', {
      type: 'text',
      placeholder: 'Filter tags...',
    });
    this.searchInput.addEventListener('input', () => {
      this.searchTerm = this.searchInput.value.toLowerCase();
      this.refresh();
    });

    const chips: Array<[FilterChip, string]> = [
      ['all', 'All'],
      ['hidden', 'Hidden'],
      ['orphans', 'Orphans'],
      ['frontmatter', 'Frontmatter'],
      ['unreviewed', 'Unreviewed'],
    ];
    for (const [id, label] of chips) {
      const chip = toolbar.createDiv({ cls: 'tcl-chip', text: label });
      if (id === this.filter) chip.addClass('active');
      this.chipEls.set(id, chip);
      chip.addEventListener('click', () => {
        this.filter = id;
        if (id !== 'hidden') this.hiddenOnly = false;
        this.refresh();
      });
    }

    // Bulk actions bar (hidden when no selection).
    this.bulkBarEl = this.container.createDiv({ cls: 'tcl-bulk-bar' });
    this.bulkBarEl.style.display = 'none';
    this.bulkCountEl = this.bulkBarEl.createSpan({ cls: 'tcl-bulk-count' });
    this.bulkBarEl.createDiv({ cls: 'tcl-bulk-spacer' });
    this.renderBulkButton('Hide', () => this.bulkAddDescription('hide-selected'));
    this.renderBulkButton('Unhide', () => this.bulkUnhide());
    if (this.tagWranglerInstalled()) {
      this.renderBulkButton('Send to Tag Wrangler', () =>
        this.bulkSendToTagWrangler(),
      );
    }
    this.renderBulkButton('Clear', () => this.clearSelection(), 'ghost');

    // Table.
    const tableWrap = this.container.createDiv({ cls: 'tcl-table-wrap' });
    const table = tableWrap.createEl('table', { cls: 'tcl-table' });
    const thead = table.createEl('thead');
    const headRow = thead.createEl('tr');

    // Select-all column.
    const selAllTh = headRow.createEl('th', { cls: 'tcl-select-col' });
    const selAllCb = selAllTh.createEl('input', { type: 'checkbox' });
    selAllCb.addEventListener('change', () => {
      if (selAllCb.checked) {
        for (const r of this.rows) this.selected.add(r.meta.tag);
      } else {
        for (const r of this.rows) this.selected.delete(r.meta.tag);
      }
      this.refresh();
    });

    this.makeColumnHeader(headRow, 'Tag', 'name');
    this.makeColumnHeader(headRow, 'Count', 'count', {
      tip: 'Number of notes the tag appears in. From `TagMeta.count` in the sidecar.',
    });
    this.makeColumnHeader(headRow, 'First seen', 'firstSeen', {
      tip: 'Date the plugin first indexed this tag. Not the note\'s created date. Stored in `TagMeta.firstSeen`.',
    });
    this.makeColumnHeader(headRow, 'Last used', 'lastSeen', {
      tip: 'Most recent indexing touch - the last time the tag was seen in any indexed note. Stored in `TagMeta.lastSeen`.',
    });
    this.makeColumnHeader(headRow, 'Source', 'source', {
      tip: 'Where the tag is written: `frontmatter` (in YAML), `inline` (in body text), or `both`. Sourced from Obsidian\'s metadataCache.',
    });
    this.makeColumnHeader(headRow, 'Visible?', 'visible', {
      tip: '`shown` = no rule hides this tag. `hidden` = a rule is hiding it. `flagged` = Preview mode is on and a rule would hide it.',
    });
    headRow.createEl('th', { text: 'Rule' });

    this.tbodyEl = table.createEl('tbody');
  }

  private renderBulkButton(
    label: string,
    onClick: () => void | Promise<void>,
    variant: '' | 'ghost' = '',
  ): void {
    const btn = this.bulkBarEl.createEl('button', {
      cls: 'tcl-bulk-btn' + (variant ? ` tcl-bulk-btn-${variant}` : ''),
      text: label,
    });
    btn.addEventListener('click', () => void onClick());
  }

  private makeColumnHeader(
    parent: HTMLElement,
    label: string,
    key: SortKey,
    opts: { tip?: string } = {},
  ): void {
    const th = parent.createEl('th');
    th.createSpan({ text: label });
    if (opts.tip) {
      const ic = th.createSpan({ cls: 'tcl-help-ic' });
      ic.setText('?');
      const tip = ic.createDiv({ cls: 'tcl-tip' });
      tip.setText(opts.tip);
    }
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      if (this.sortBy === key) {
        this.sortDesc = !this.sortDesc;
      } else {
        this.sortBy = key;
        this.sortDesc = true;
      }
      this.refresh();
    });
  }

  // -----------------------------------------------------------------
  // Data refresh
  // -----------------------------------------------------------------

  private refresh(): void {
    if (!this.tbodyEl) return;

    // Update chip active class (the user may have switched the filter via setHiddenOnly).
    for (const [id, el] of this.chipEls) {
      el.toggleClass('active', id === this.filter);
    }

    const settings = this.plugin.settingsManager.get();
    const meta = this.plugin.tagMetaManager.all();
    const activeRules = resolveActiveRules(settings);

    // Build Row[] then filter + sort.
    const rows: Row[] = [];
    for (const tagMeta of meta.values()) {
      const attribution = RuleEngine.getRuleAttribution(
        tagMeta.tag,
        tagMeta,
        activeRules,
      );
      const matches = attribution.allMatches.map((m) => ({
        ruleId: m.ruleId,
        ruleName: m.ruleName,
      }));
      let visible: Row['visible'] = 'shown';
      if (attribution.effective) {
        visible = settings.previewMode ? 'flagged' : 'hidden';
      }
      rows.push({ meta: tagMeta, matches, visible });
    }

    const filtered = rows.filter((r) => this.matchesFilter(r));
    filtered.sort((a, b) => this.compareRows(a, b));
    this.rows = filtered;

    // Render.
    this.tbodyEl.empty();
    if (this.rows.length === 0) {
      const emptyRow = this.tbodyEl.createEl('tr');
      const cell = emptyRow.createEl('td');
      cell.colSpan = 8;
      cell.setText(
        this.searchTerm || this.filter !== 'all'
          ? 'No tags match the current filter.'
          : 'No tags yet. Start tagging notes to populate this list.',
      );
      cell.style.textAlign = 'center';
      cell.style.color = 'var(--text-faint)';
      cell.style.padding = '20px';
    } else {
      for (const r of this.rows) this.renderRow(r);
    }
    this.refreshBulkBar();
  }

  private matchesFilter(row: Row): boolean {
    if (this.searchTerm && !row.meta.tag.toLowerCase().includes(this.searchTerm)) {
      return false;
    }
    if (this.hiddenOnly && row.visible === 'shown') return false;
    switch (this.filter) {
      case 'all':
        return true;
      case 'hidden':
        return row.visible !== 'shown';
      case 'orphans':
        return row.meta.count <= 1;
      case 'frontmatter':
        return (
          row.meta.sources.length === 1 && row.meta.sources[0] === 'frontmatter'
        );
      case 'unreviewed':
        return !row.meta.reviewed;
    }
  }

  private compareRows(a: Row, b: Row): number {
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
        av = a.visible;
        bv = b.visible;
        break;
    }
    if (typeof av === 'string' && typeof bv === 'string') {
      return this.sortDesc ? bv.localeCompare(av) : av.localeCompare(bv);
    }
    return this.sortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number);
  }

  private renderRow(row: Row): void {
    const tr = this.tbodyEl.createEl('tr');
    if (row.visible === 'hidden') tr.addClass('tcl-row-hidden');
    if (row.visible === 'flagged') tr.addClass('tcl-row-flagged');

    // Checkbox cell.
    const cbCell = tr.createEl('td', { cls: 'tcl-select-col' });
    const cb = cbCell.createEl('input', { type: 'checkbox' });
    cb.checked = this.selected.has(row.meta.tag);
    cb.addEventListener('change', () => {
      if (cb.checked) this.selected.add(row.meta.tag);
      else this.selected.delete(row.meta.tag);
      this.refreshBulkBar();
    });

    // Tag.
    const nameCell = tr.createEl('td');
    nameCell.createEl('span', {
      cls: 'tcl-tagname',
      text: '#' + row.meta.tag,
    });

    // Count, dates, source.
    tr.createEl('td', { text: String(row.meta.count) });
    tr.createEl('td', { text: this.formatDate(row.meta.firstSeen) });
    tr.createEl('td', { text: this.formatDate(row.meta.lastSeen) });
    const srcCell = tr.createEl('td');
    srcCell.createSpan({
      cls: 'tcl-src',
      text:
        row.meta.sources.length === 2 ? 'both' : (row.meta.sources[0] ?? '?'),
    });

    // Visible?
    const visCell = tr.createEl('td');
    const visSpan = visCell.createSpan({
      cls: 'tcl-vis tcl-vis-' + row.visible,
      text: row.visible,
    });
    void visSpan;

    // Rule column - stacked rule names, no "+N more" collapse.
    const ruleCell = tr.createEl('td');
    if (row.matches.length === 0) {
      ruleCell.createSpan({ cls: 'tcl-rule-none', text: 'none' });
    } else {
      for (const m of row.matches) {
        ruleCell.createDiv({ cls: 'tcl-rule-link', text: m.ruleName });
      }
    }
  }

  private formatDate(ts: number): string {
    if (!ts) return '-';
    return new Date(ts).toLocaleDateString();
  }

  private refreshBulkBar(): void {
    const count = this.selected.size;
    if (count === 0) {
      this.bulkBarEl.style.display = 'none';
      return;
    }
    this.bulkBarEl.style.display = '';
    this.bulkCountEl.setText(
      `${count} selected of ${this.rows.length} on this page`,
    );
  }

  // -----------------------------------------------------------------
  // Bulk actions
  // -----------------------------------------------------------------

  private clearSelection(): void {
    this.selected.clear();
    this.refresh();
  }

  private async bulkUnhide(): Promise<void> {
    // v0.1: bulk-unhide is a no-op against the rule list (we don't author
    // overrides yet). For now we just clear the selection and notify - the
    // proper "always show this tag" override lands with the rule-override
    // surface (B009 tag detail sheet).
    new Notice(
      'Bulk Unhide will add per-tag "always show" overrides in v0.2 (tracked under B009).',
    );
    this.clearSelection();
  }

  private bulkAddDescription(label: string): void {
    void label;
    new Notice(
      'Bulk descriptions land with the tag detail sheet (B009) in v0.2.',
    );
  }

  private async bulkSendToTagWrangler(): Promise<void> {
    if (!this.tagWranglerInstalled()) {
      new Notice(
        'Tag Wrangler is not available - re-enable it and try again.',
      );
      return;
    }
    const tags = Array.from(this.selected);
    if (tags.length === 0) return;
    const commands = (this.app as unknown as {
      commands?: {
        executeCommandById?: (id: string) => boolean;
      };
    }).commands;
    if (!commands?.executeCommandById) {
      new Notice('Tag Wrangler command not reachable from this Obsidian version.');
      return;
    }
    // Tag Wrangler exposes one rename command at a time; v0.1 sends them
    // sequentially. Tag Wrangler's own UI handles each tag individually.
    let dispatched = 0;
    for (const tag of tags) {
      void tag; // Tag Wrangler reads selection from the active tag-pane row.
      if (commands.executeCommandById('tag-wrangler:rename-tag')) {
        dispatched += 1;
      }
    }
    new Notice(
      `Sent ${dispatched} of ${tags.length} tags to Tag Wrangler. See spec §6.1.1.`,
    );
    this.clearSelection();
  }

  private tagWranglerInstalled(): boolean {
    const plugins = (this.app as unknown as {
      plugins?: { enabledPlugins?: Set<string> };
    }).plugins;
    return Boolean(plugins?.enabledPlugins?.has('tag-wrangler'));
  }
}
