/**
 * Virtualized, sortable, filterable, searchable tag table (Phase 3B-1, Step 2).
 *
 * Plain-DOM component (no framework). Given the headless TagListModel +
 * TagActions and a host for settings/meta access plus a refresh callback, it
 * renders:
 *   - a toolbar: filter chips (reflecting model.activeFilter), a debounced
 *     search box, and sortable column headers;
 *   - a WINDOWED row body: a scroll container with a spacer sized
 *     total * rowHeight, rendering only the rows in visibleRange(...) at their
 *     correct vertical offset, so 1500+ tags stay smooth;
 *   - a contextual bulk-action bar (BulkBar) shown only when a selection exists;
 *   - per-row checkboxes, a header "select all matching" affordance (operating
 *     on model.rows(), virtualization-safe), and a per-row more-actions menu.
 *
 * The component owns DOM only; all filter / sort / search / selection /
 * visibility logic lives in the model and actions, which are already tested.
 * DOM behaviors (scroll windowing, menu, popover) are verified in the Phase 11
 * manual TESTING matrix, not unit tests (the obsidian stub lacks full DOM/Menu).
 */
import { setIcon } from 'obsidian';
import { FilterChip, SortKey, TagListModel, TagRow } from '../tagList/tagListModel';
import { TagActions } from '../tagList/tagActions';
import { visibleRange } from './visibleRange';
import { BulkBar } from './bulkBar';
import { openRowMenu } from './rowMenu';
import { TagListDiagnosticsHost } from './tagTableHost';

const ROW_HEIGHT = 40; // px; must match .tct-row height in styles.css.
const OVERSCAN = 6;
const SEARCH_DEBOUNCE_MS = 120;

const CHIPS: Array<[FilterChip, string]> = [
  ['all', 'All'],
  ['shown', 'Shown'],
  ['hidden', 'Hidden'],
  ['flagged', 'Flagged'],
  ['orphans', 'Orphans'],
  ['frontmatter', 'Frontmatter'],
  ['inline', 'Inline'],
  ['unreviewed', 'Unreviewed'],
];

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: 'name', label: 'Tag' },
  { key: 'count', label: 'Count' },
  { key: 'lastSeen', label: 'Last used' },
  { key: 'source', label: 'Source' },
  { key: 'visible', label: 'Visible?' },
];

export class TagTable {
  private root: HTMLElement;
  private chipEls = new Map<FilterChip, HTMLElement>();
  private searchInput!: HTMLInputElement;
  private headerCells = new Map<SortKey, HTMLElement>();
  private selectAllCb!: HTMLInputElement;
  private filtersToggle!: HTMLElement;
  private chipBar!: HTMLElement;

  private scrollEl!: HTMLElement;
  private spacerEl!: HTMLElement;
  private rowsLayer!: HTMLElement;
  private emptyEl!: HTMLElement;

  private bulkBar: BulkBar;

  // Cached current filtered/sorted rows; recomputed each refresh().
  private rows: TagRow[] = [];

  private searchTimer: number | null = null;

  private mode: 'view' | 'manage';

  // Stable reference so the same function pointer can be removed in destroy().
  private readonly onScroll = (): void => { this.renderWindow(); };

  constructor(
    parent: HTMLElement,
    private model: TagListModel,
    private actions: TagActions,
    private host: TagListDiagnosticsHost,
    initialMode: 'view' | 'manage' = 'manage',
  ) {
    this.mode = initialMode;
    this.root = parent.createDiv({ cls: 'tct-root' });
    this.buildToolbar();
    this.bulkBar = new BulkBar(this.root, this.model, this.actions, this.host);
    this.buildBody();
    this.root.toggleClass('tct-view', this.mode === 'view');
    this.refresh();
  }

  /** Switch between view (read-only browse) and manage (full edit) mode. */
  setMode(mode: 'view' | 'manage'): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.root.toggleClass('tct-view', mode === 'view');
    this.refresh();
  }

  // -----------------------------------------------------------------
  // Toolbar: chips + search + sortable headers
  // -----------------------------------------------------------------

  private buildToolbar(): void {
    const toolbar = this.root.createDiv({ cls: 'tct-toolbar' });

    const searchWrap = toolbar.createDiv({ cls: 'tct-search' });
    const searchIc = searchWrap.createSpan({ cls: 'tct-search-ic' });
    setIcon(searchIc, 'search');
    this.searchInput = searchWrap.createEl('input', {
      type: 'text',
      placeholder: 'Search tags...',
    });
    this.searchInput.addEventListener('input', () => {
      if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => {
        this.model.setSearch(this.searchInput.value);
        this.refresh();
      }, SEARCH_DEBOUNCE_MS);
    });

    this.filtersToggle = toolbar.createEl('button', { cls: 'tct-filters-toggle' });
    this.filtersToggle.createSpan({ cls: 'tct-filters-caret', text: '▸' }); // right-pointing triangle
    this.filtersToggle.createSpan({ text: ' Filters' });
    this.filtersToggle.addEventListener('click', () => {
      const collapsed = this.chipBar.hasClass('tct-chips-collapsed');
      this.chipBar.toggleClass('tct-chips-collapsed', !collapsed);
      this.filtersToggle.toggleClass('open', collapsed);
    });

    this.chipBar = toolbar.createDiv({ cls: 'tct-chips' });
    // Collapsed state is only honored by CSS under .tct-view; harmless in manage mode.
    this.chipBar.addClass('tct-chips-collapsed');
    for (const [id, label] of CHIPS) {
      const chip = this.chipBar.createDiv({ cls: 'tct-chip', text: label });
      this.chipEls.set(id, chip);
      chip.addEventListener('click', () => {
        this.model.setFilter(id);
        this.refresh();
      });
    }

    // Sticky header row above the scroll body. A select-all checkbox plus the
    // sortable column headers; a trailing spacer column aligns with the per-row
    // more-actions control.
    const headRow = this.root.createDiv({ cls: 'tct-head-row' });

    const selCell = headRow.createDiv({ cls: 'tct-cell tct-cell-select' });
    this.selectAllCb = selCell.createEl('input', { type: 'checkbox' });
    this.selectAllCb.setAttribute('aria-label', 'Select all matching tags');
    this.selectAllCb.addEventListener('change', () => {
      if (this.selectAllCb.checked) this.model.selectAllMatching();
      else this.model.deselectAllMatching();
      this.refresh();
    });

    for (const col of COLUMNS) {
      const cell = headRow.createDiv({
        cls: 'tct-cell tct-cell-' + col.key + ' tct-head-sortable',
      });
      cell.createSpan({ text: col.label });
      const arrow = cell.createSpan({ cls: 'tct-sort-arrow' });
      void arrow;
      this.headerCells.set(col.key, cell);
      cell.addEventListener('click', () => {
        this.model.setSort(col.key);
        this.refresh();
      });
    }

    headRow.createDiv({ cls: 'tct-cell tct-cell-rule', text: 'Rule' });
    headRow.createDiv({ cls: 'tct-cell tct-cell-actions' });
  }

  private buildBody(): void {
    this.scrollEl = this.root.createDiv({ cls: 'tct-scroll' });
    this.spacerEl = this.scrollEl.createDiv({ cls: 'tct-spacer' });
    this.rowsLayer = this.spacerEl.createDiv({ cls: 'tct-rows' });
    this.emptyEl = this.root.createDiv({ cls: 'tct-empty' });
    this.emptyEl.addClass('tc-hidden');

    this.scrollEl.addEventListener('scroll', this.onScroll);
  }

  // -----------------------------------------------------------------
  // Refresh: recompute rows, update toolbar state, render the window
  // -----------------------------------------------------------------

  /** Public entry: recompute from the model and repaint. Called by the host. */
  refresh(): void {
    this.rows = this.model.rows();
    this.syncChips();
    this.syncSortHeaders();
    this.syncSelectAll();
    this.bulkBar.update();

    const total = this.rows.length;
    this.spacerEl.style.height = `${total * ROW_HEIGHT}px`;

    if (total === 0) {
      this.scrollEl.addClass('tc-hidden');
      this.emptyEl.removeClass('tc-hidden');
      this.emptyEl.setText(
        this.model.activeFilter === 'all' &&
          this.model.activeRuleFilter === null
          ? 'No tags yet. Start tagging notes to populate this list.'
          : 'No tags match the current filter.',
      );
      return;
    }
    this.scrollEl.removeClass('tc-hidden');
    this.emptyEl.addClass('tc-hidden');

    // Clamp scrollTop so a shrinking row set never leaves the viewport blank.
    const maxScroll = Math.max(0, total * ROW_HEIGHT - this.scrollEl.clientHeight);
    if (this.scrollEl.scrollTop > maxScroll) {
      this.scrollEl.scrollTop = maxScroll;
    }

    this.renderWindow();
  }

  private syncChips(): void {
    for (const [id, el] of this.chipEls) {
      el.toggleClass('active', id === this.model.activeFilter);
    }
  }

  private syncSortHeaders(): void {
    const { key, desc } = this.model.sortState;
    for (const [colKey, cell] of this.headerCells) {
      const arrow = cell.querySelector('.tct-sort-arrow') as HTMLElement | null;
      cell.toggleClass('active', colKey === key);
      if (!arrow) continue;
      if (colKey === key) arrow.setText(desc ? '▼' : '▲');
      else arrow.setText('');
    }
  }

  private syncSelectAll(): void {
    this.selectAllCb.checked = this.model.allMatchingSelected();
  }

  // -----------------------------------------------------------------
  // Virtualized window
  // -----------------------------------------------------------------

  private renderWindow(): void {
    const { start, end } = visibleRange(
      this.scrollEl.scrollTop,
      ROW_HEIGHT,
      this.scrollEl.clientHeight,
      this.rows.length,
      OVERSCAN,
    );

    this.rowsLayer.empty();
    // Offset the rendered slice so its first row sits at its true position.
    this.rowsLayer.style.transform = `translateY(${start * ROW_HEIGHT}px)`;

    for (let i = start; i < end; i++) {
      this.renderRow(this.rows[i]);
    }
  }

  private renderRow(row: TagRow): void {
    const tr = this.rowsLayer.createDiv({ cls: 'tct-row' });
    if (row.visibility === 'hidden') tr.addClass('tct-row-hidden');
    if (row.visibility === 'flagged') tr.addClass('tct-row-flagged');

    // Select checkbox.
    const selCell = tr.createDiv({ cls: 'tct-cell tct-cell-select' });
    const cb = selCell.createEl('input', { type: 'checkbox' });
    cb.checked = this.model.selection.has(row.meta.tag);
    cb.addEventListener('change', () => {
      this.model.toggleSelect(row.meta.tag);
      this.bulkBar.update();
      this.syncSelectAll();
    });

    // Tag name.
    const nameCell = tr.createDiv({ cls: 'tct-cell tct-cell-name' });
    nameCell.createSpan({ cls: 'tct-tagname', text: '#' + row.meta.tag });
    if (row.meta.reviewed) {
      const mark = nameCell.createSpan({ cls: 'tct-reviewed-mark' });
      mark.setAttribute('aria-label', 'Reviewed');
      mark.setAttribute('title', 'Reviewed');
      setIcon(mark, 'check');
    }
    if (this.mode === 'view') {
      nameCell.addClass('tct-tagname-link');
      nameCell.addEventListener('click', () => this.host.searchTag(row.meta.tag));
    }

    // Count.
    tr.createDiv({ cls: 'tct-cell tct-cell-count', text: String(row.meta.count) });

    // Last used.
    tr.createDiv({
      cls: 'tct-cell tct-cell-lastSeen',
      text: this.formatDate(row.meta.lastSeen),
    });

    // Source.
    const srcCell = tr.createDiv({ cls: 'tct-cell tct-cell-source' });
    srcCell.createSpan({
      cls: 'tct-src',
      text: row.meta.sources.length === 2 ? 'both' : (row.meta.sources[0] ?? '?'),
    });

    // Visibility dot (shown / hidden / flagged) - same semantics as the legacy
    // view: shown = success, hidden = accent, flagged = warning.
    const visCell = tr.createDiv({ cls: 'tct-cell tct-cell-visible' });
    const dot = visCell.createSpan({ cls: 'tct-vis-dot tct-vis-' + row.visibility });
    dot.setAttribute('aria-label', row.visibility);
    dot.setAttribute('title', row.visibility);

    // Affecting rule: the effective (first) match name, if any.
    const ruleCell = tr.createDiv({ cls: 'tct-cell tct-cell-rule' });
    const eff = row.matches[0];
    if (eff) ruleCell.createSpan({ cls: 'tct-rule-name', text: eff.ruleName });
    else ruleCell.createSpan({ cls: 'tct-rule-none', text: 'none' });

    // Per-row more-actions.
    const actCell = tr.createDiv({ cls: 'tct-cell tct-cell-actions' });
    const moreBtn = actCell.createEl('button', { cls: 'tct-more-btn' });
    moreBtn.setAttribute('aria-label', 'Tag actions');
    setIcon(moreBtn, 'more-vertical');
    moreBtn.addEventListener('click', (evt) => {
      openRowMenu(evt, row.meta.tag, this.actions, this.host);
    });
  }

  private formatDate(ts: number): string {
    if (!ts) return '-';
    return new Date(ts).toLocaleDateString();
  }

  // -----------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------

  destroy(): void {
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
    this.scrollEl.removeEventListener('scroll', this.onScroll);
    this.bulkBar.destroy();
    this.root.remove();
  }
}
