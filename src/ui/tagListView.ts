/**
 * Tag list view showing all tags in the vault
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import { TagMeta } from '../types';
import { RuleEngine } from '../engine/ruleEngine';
import { resolveActiveRules } from '../engine/presets';
import TagCuratorPlugin from '../main';

export const TAG_LIST_VIEW_TYPE = 'tag-curator-list';

export class TagListView extends ItemView {
  plugin: TagCuratorPlugin;
  private container: HTMLElement;
  private searchInput!: HTMLInputElement;
  private tagsContainer!: HTMLElement;
  private sortBy: 'count' | 'name' | 'firstSeen' | 'lastSeen' = 'count';
  private sortDesc = true;

  constructor(leaf: WorkspaceLeaf, plugin: TagCuratorPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.container = this.containerEl.children[1] as HTMLElement;
  }

  getViewType(): string {
    return TAG_LIST_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Tag List';
  }

  getIcon(): string {
    return 'tags';
  }

  async onOpen() {
    this.buildUI();
    this.refreshTags();
  }

  private buildUI() {
    this.container.empty();

    // Header
    const header = this.container.createDiv({ cls: 'tag-curator-list-header' });
    header.createEl('h2', { text: 'Vault Tags' });

    // Search/Filter
    const filterDiv = this.container.createDiv({ cls: 'tag-curator-list-filter' });
    filterDiv.createEl('label', { text: 'Search: ' });
    this.searchInput = filterDiv.createEl('input', {
      type: 'text',
      placeholder: 'Filter by tag name...',
      cls: 'tag-curator-search',
    });
    this.searchInput.addEventListener('input', () => this.refreshTags());

    // Table
    const tableDiv = this.container.createDiv({ cls: 'tag-curator-table-wrapper' });
    const table = tableDiv.createEl('table', { cls: 'tag-curator-table' });

    // Header row
    const thead = table.createEl('thead');
    const headerRow = thead.createEl('tr');

    this.createHeaderCell(headerRow, 'Tag', 'name', 'tag-col');
    this.createHeaderCell(headerRow, 'Count', 'count', 'count-col');
    this.createHeaderCell(headerRow, 'First Seen', 'firstSeen', 'date-col');
    this.createHeaderCell(headerRow, 'Last Used', 'lastSeen', 'date-col');
    this.createHeaderCell(headerRow, 'Source', 'source', 'source-col');
    this.createHeaderCell(headerRow, 'Status', 'status', 'status-col');

    // Body
    this.tagsContainer = table.createEl('tbody', { cls: 'tag-curator-table-body' });

    this.container.createDiv({ cls: 'tag-curator-list-status' });
    this.containerEl.setAttribute('data-tag-curator-status', 'ready');
  }

  private createHeaderCell(
    row: HTMLTableRowElement,
    label: string,
    sortKey: string,
    className: string
  ) {
    const cell = row.createEl('th', { text: label, cls: className });
    cell.style.cursor = 'pointer';
    cell.addEventListener('click', () => {
      if (this.sortBy === (sortKey as any)) {
        this.sortDesc = !this.sortDesc;
      } else {
        this.sortBy = sortKey as any;
        this.sortDesc = true;
      }
      this.refreshTags();
    });
  }

  private refreshTags() {
    const metadata = this.plugin.tagMetaManager.all();
    const rules = resolveActiveRules(this.plugin.settingsManager.get());
    const searchTerm = this.searchInput.value.toLowerCase();

    // Filter tags
    let tags = Array.from(metadata.values());

    if (searchTerm) {
      tags = tags.filter(meta => meta.tag.toLowerCase().includes(searchTerm));
    }

    // Sort tags
    tags.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (this.sortBy) {
        case 'count':
          aVal = a.count;
          bVal = b.count;
          break;
        case 'name':
          aVal = a.tag;
          bVal = b.tag;
          break;
        case 'firstSeen':
          aVal = a.firstSeen;
          bVal = b.firstSeen;
          break;
        case 'lastSeen':
          aVal = a.lastSeen;
          bVal = b.lastSeen;
          break;
      }

      if (typeof aVal === 'string') {
        return this.sortDesc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      } else {
        return this.sortDesc ? bVal - aVal : aVal - bVal;
      }
    });

    // Clear and populate table
    this.tagsContainer.empty();

    for (const tagMeta of tags) {
      const matchResult = RuleEngine.evaluateTag(tagMeta.tag, tagMeta, rules);
      this.createTagRow(tagMeta, matchResult?.ruleName);
    }
  }

  private createTagRow(tagMeta: TagMeta, hiddenByRule?: string) {
    const row = this.tagsContainer.createEl('tr', {
      cls: hiddenByRule ? 'tag-hidden' : 'tag-visible',
    });

    row.createEl('td', {
      text: `#${tagMeta.tag}`,
      cls: 'tag-name-cell',
    });

    // Count
    row.createEl('td', {
      text: tagMeta.count.toString(),
      cls: 'tag-count-cell',
    });

    // First seen
    const firstSeenDate = new Date(tagMeta.firstSeen).toLocaleDateString();
    row.createEl('td', {
      text: firstSeenDate,
      cls: 'tag-date-cell',
    });

    // Last used
    const lastUsedDate = new Date(tagMeta.lastSeen).toLocaleDateString();
    row.createEl('td', {
      text: lastUsedDate,
      cls: 'tag-date-cell',
    });

    // Source
    const sourceText = tagMeta.sources.join(', ');
    row.createEl('td', {
      text: sourceText,
      cls: 'tag-source-cell',
    });

    // Status
    const statusCell = row.createEl('td', { cls: 'tag-status-cell' });
    if (hiddenByRule) {
      statusCell.createEl('span', {
        text: `Hidden (${hiddenByRule})`,
        cls: 'tag-hidden-badge',
      });
    } else {
      statusCell.createEl('span', {
        text: 'Visible',
        cls: 'tag-visible-badge',
      });
    }
  }

  onClose(): Promise<void> {
    return Promise.resolve();
  }
}
