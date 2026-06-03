/**
 * Virtualized, sortable, filterable, searchable tag table (Phase 3B-1, Step 2).
 *
 * Plain-DOM component (no framework). Given the headless TagListModel +
 * TagActions and a host for settings/meta access plus a refresh callback, it
 * renders:
 *   - a toolbar: a search box + a column selector (2-5), filter chips
 *     (reflecting model.activeFilter), and sortable column headers;
 *   - a WINDOWED row body: a scroll container with a spacer sized
 *     total * rowHeight, rendering only the rows in visibleRange(...) at their
 *     correct vertical offset, so 1500+ tags stay smooth;
 *   - a contextual bulk-action bar (BulkBar) shown only when a selection exists;
 *   - per-row checkboxes, a header "select all matching" affordance (operating
 *     on model.rows(), virtualization-safe), and a per-row more-actions menu.
 *
 * Columns are data-driven (ALL_COLS): which ones are present depends on the mode
 * (select + actions chrome is manage-only) and on the persisted column prefs
 * (Last used / Source / Rule are user-toggleable). The grid template is computed
 * from the active column set and published as the --tct-grid CSS variable so the
 * sticky header and every row stay column-aligned with one source of truth.
 *
 * The component owns DOM only; all filter / sort / search / selection /
 * visibility logic lives in the model and actions, which are already tested.
 * DOM behaviors (scroll windowing, menu, popover) are verified in the Phase 11
 * manual TESTING matrix, not unit tests (the obsidian stub lacks full DOM/Menu).
 */
import { Menu, setIcon } from 'obsidian';
import { TableColumnPrefs } from '../../types';
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

type ColId = 'select' | 'name' | 'count' | 'lastSeen' | 'source' | 'visible' | 'rule' | 'actions';

interface ColDef {
  id: ColId;
  /** Grid track size for this column. */
  track: string;
  /** Header text label (omitted for chrome columns and icon headers). */
  label?: string;
  /** Header icon name; overrides the text label (e.g. Visible -> eye). */
  icon?: string;
  /** Sort key if the column is click-sortable. */
  sortKey?: SortKey;
  /** Native title tooltip on the header cell. */
  tip?: string;
  /** Present only in manage mode (the select + actions chrome). */
  manageOnly?: boolean;
  /** Toggleable via the column selector; keyed into the persisted prefs. */
  optional?: keyof TableColumnPrefs;
}

// Left-to-right column order. Tag / Count / Visible are always shown; Last used,
// Source, and Rule are user-toggleable; select + actions are manage-only chrome.
const ALL_COLS: ColDef[] = [
  { id: 'select', track: '34px', manageOnly: true },
  { id: 'name', track: 'minmax(150px, 2fr)', label: 'Tag', sortKey: 'name' },
  {
    id: 'count',
    track: '72px',
    label: 'Count',
    sortKey: 'count',
    tip: 'Number of notes this tag appears in.',
  },
  {
    id: 'lastSeen',
    track: '92px',
    label: 'Last used',
    sortKey: 'lastSeen',
    optional: 'lastSeen',
    tip: 'Most recent time the tag was seen in an indexed note.',
  },
  {
    id: 'source',
    track: '78px',
    label: 'Source',
    sortKey: 'source',
    optional: 'source',
    tip: 'Where the tag is written: inline (#tag in the body), frontmatter (a YAML property), or both. Not the same as a curation scope.',
  },
  {
    id: 'visible',
    track: '52px',
    label: 'Visible',
    icon: 'eye',
    sortKey: 'visible',
    tip: 'Shown = no rule hides it. Hidden = a rule is hiding it. Flagged = Preview mode would hide it.',
  },
  {
    id: 'rule',
    track: 'minmax(120px, 1.5fr)',
    label: 'Rule',
    optional: 'rule',
    tip: 'The effective rule or preset affecting this tag.',
  },
  { id: 'actions', track: '40px', manageOnly: true },
];

const OPTIONAL_COLS: Array<[keyof TableColumnPrefs, string]> = [
  ['lastSeen', 'Last used'],
  ['source', 'Source'],
  ['rule', 'Rule'],
];

const DEFAULT_COLS: TableColumnPrefs = { lastSeen: true, source: true, rule: true };

export class TagTable {
  private root: HTMLElement;
  private chipEls = new Map<FilterChip, HTMLElement>();
  private searchInput!: HTMLInputElement;
  private headerCells = new Map<SortKey, HTMLElement>();
  private selectAllCb: HTMLInputElement | null = null;
  private filtersToggle!: HTMLElement;
  private chipBar!: HTMLElement;
  private headRow!: HTMLElement;

  private scrollEl!: HTMLElement;
  private spacerEl!: HTMLElement;
  private rowsLayer!: HTMLElement;
  private emptyEl!: HTMLElement;

  private bulkBar: BulkBar;

  // Cached current filtered/sorted rows; recomputed each refresh().
  private rows: TagRow[] = [];

  // Persisted column visibility prefs; re-read from the host on every refresh so
  // a toggle in either surface fans out here. Signature gates header rebuilds.
  private cols: TableColumnPrefs = { ...DEFAULT_COLS };
  private colSig = '';

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
  // Toolbar: search + column selector + chips; the header row is built
  // separately (buildHeader) so it can rebuild when the column set changes.
  // -----------------------------------------------------------------

  private buildToolbar(): void {
    const toolbar = this.root.createDiv({ cls: 'tct-toolbar' });

    const topRow = toolbar.createDiv({ cls: 'tct-toolbar-top' });
    const searchWrap = topRow.createDiv({ cls: 'tct-search' });
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

    // Column selector (2-5). A plain text button (no icon dependency) opens a
    // checkable menu for the three optional columns; the choice persists.
    const colsBtn = topRow.createEl('button', { cls: 'tct-cols-btn', text: 'Columns' });
    colsBtn.setAttribute('aria-label', 'Choose visible columns');
    colsBtn.addEventListener('click', (evt) => this.openColumnMenu(evt));

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

    // Sticky header row above the scroll body; populated by buildHeader once the
    // active column set is known (and rebuilt when it changes).
    this.headRow = this.root.createDiv({ cls: 'tct-head-row' });
  }

  /** The columns present right now, given mode + persisted prefs. */
  private activeCols(): ColDef[] {
    return ALL_COLS.filter((c) => {
      if (c.manageOnly && this.mode !== 'manage') return false;
      if (c.optional && !this.cols[c.optional]) return false;
      return true;
    });
  }

  /** Publish the grid template so the header and rows share one column layout. */
  private applyGrid(): void {
    this.root.style.setProperty(
      '--tct-grid',
      this.activeCols().map((c) => c.track).join(' '),
    );
  }

  /** (Re)build the sortable header row for the current active column set. */
  private buildHeader(): void {
    this.headRow.empty();
    this.headerCells.clear();
    this.selectAllCb = null;

    for (const col of this.activeCols()) {
      if (col.id === 'select') {
        const selCell = this.headRow.createDiv({ cls: 'tct-cell tct-cell-select' });
        const cb = selCell.createEl('input', { type: 'checkbox' });
        cb.setAttribute('aria-label', 'Select all matching tags');
        cb.addEventListener('change', () => {
          if (cb.checked) this.model.selectAllMatching();
          else this.model.deselectAllMatching();
          this.refresh();
        });
        this.selectAllCb = cb;
        continue;
      }
      if (col.id === 'actions') {
        this.headRow.createDiv({ cls: 'tct-cell tct-cell-actions' });
        continue;
      }
      const cell = this.headRow.createDiv({ cls: 'tct-cell tct-cell-' + col.id });
      if (col.tip) cell.setAttribute('title', col.tip);
      if (col.icon) {
        const ic = cell.createSpan({ cls: 'tct-head-ic' });
        ic.setAttribute('aria-label', col.label ?? col.id);
        setIcon(ic, col.icon);
      } else {
        cell.createSpan({ text: col.label ?? '' });
      }
      if (col.sortKey) {
        const sk = col.sortKey;
        cell.addClass('tct-head-sortable');
        cell.createSpan({ cls: 'tct-sort-arrow' });
        this.headerCells.set(sk, cell);
        cell.addEventListener('click', () => {
          this.model.setSort(sk);
          this.refresh();
        });
      }
    }
  }

  private openColumnMenu(evt: MouseEvent): void {
    const menu = new Menu();
    for (const [key, label] of OPTIONAL_COLS) {
      menu.addItem((item) =>
        item
          .setTitle(label)
          .setChecked(this.cols[key])
          .onClick(() => {
            this.host.setColumns({ ...this.cols, [key]: !this.cols[key] });
          }),
      );
    }
    menu.showAtMouseEvent(evt);
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
    this.syncColumns();
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

  /**
   * Re-read the persisted column prefs and rebuild the header + grid only when
   * the active column set actually changed (mode switch or a column toggle).
   * Normal refreshes (search / sort / filter) leave the header intact.
   */
  private syncColumns(): void {
    this.cols = this.host.getSettings().tableColumns ?? { ...DEFAULT_COLS };
    const sig = this.mode + ':' + this.activeCols().map((c) => c.id).join(',');
    if (sig !== this.colSig) {
      this.colSig = sig;
      this.buildHeader();
      this.applyGrid();
    }
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
    if (!this.selectAllCb) return;
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
    for (const col of this.activeCols()) {
      this.renderCell(tr, col, row);
    }
  }

  private renderCell(tr: HTMLElement, col: ColDef, row: TagRow): void {
    switch (col.id) {
      case 'select': {
        const selCell = tr.createDiv({ cls: 'tct-cell tct-cell-select' });
        const cb = selCell.createEl('input', { type: 'checkbox' });
        cb.checked = this.model.selection.has(row.meta.tag);
        cb.addEventListener('change', () => {
          this.model.toggleSelect(row.meta.tag);
          this.bulkBar.update();
          this.syncSelectAll();
        });
        break;
      }
      case 'name': {
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
        break;
      }
      case 'count':
        tr.createDiv({ cls: 'tct-cell tct-cell-count', text: String(row.meta.count) });
        break;
      case 'lastSeen':
        tr.createDiv({
          cls: 'tct-cell tct-cell-lastSeen',
          text: this.formatDate(row.meta.lastSeen),
        });
        break;
      case 'source': {
        const srcCell = tr.createDiv({ cls: 'tct-cell tct-cell-source' });
        srcCell.createSpan({
          cls: 'tct-src',
          text: row.meta.sources.length === 2 ? 'both' : (row.meta.sources[0] ?? '?'),
        });
        break;
      }
      case 'visible': {
        const visCell = tr.createDiv({ cls: 'tct-cell tct-cell-visible' });
        const dot = visCell.createSpan({ cls: 'tct-vis-dot tct-vis-' + row.visibility });
        dot.setAttribute('aria-label', row.visibility);
        dot.setAttribute('title', row.visibility);
        break;
      }
      case 'rule': {
        const ruleCell = tr.createDiv({ cls: 'tct-cell tct-cell-rule' });
        const eff = row.matches[0];
        if (eff) {
          const nm = ruleCell.createSpan({ cls: 'tct-rule-name', text: eff.ruleName });
          // Full rule name on hover so a truncated cell is still legible (2-2).
          nm.setAttribute('title', eff.ruleName);
        } else {
          ruleCell.createSpan({ cls: 'tct-rule-none', text: 'none' });
        }
        break;
      }
      case 'actions': {
        const actCell = tr.createDiv({ cls: 'tct-cell tct-cell-actions' });
        const moreBtn = actCell.createEl('button', { cls: 'tct-more-btn' });
        moreBtn.setAttribute('aria-label', 'Tag actions');
        setIcon(moreBtn, 'more-vertical');
        moreBtn.addEventListener('click', (evt) => {
          openRowMenu(evt, row.meta.tag, this.actions, this.host);
        });
        break;
      }
    }
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
