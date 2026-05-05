/**
 * Observer for the tag pane UI
 */

import { App, Plugin } from 'obsidian';
import { Rule, TagMeta } from '../types';
import { RuleEngine } from '../engine/ruleEngine';

const TAG_CURATOR_ATTR = 'data-tag-curator-hidden';
const TAG_PANE_ITEM_CLASS = 'tag-pane-tag-self';

export class TagPaneObserver {
  private observer: MutationObserver | null = null;
  private containerEl: HTMLElement | null = null;
  private app: App;
  private plugin: Plugin;
  private rules: Rule[] = [];
  private tagMetadata: Map<string, TagMeta> = new Map();
  private isEnabled = true;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
  }

  /**
   * Initialize the observer
   */
  init() {
    this.app.workspace.onLayoutReady(() => {
      this.setup();
    });

    this.app.workspace.on('layout-change', () => {
      this.setup();
    });
  }

  /**
   * Find and set up the tag pane container
   */
  private setup() {
    // Find the tag pane using Obsidian's class names
    const leaf = this.app.workspace.getLeavesOfType('tag');
    if (leaf.length === 0) {
      return; // Tag pane not open
    }

    const container = leaf[0].view.containerEl?.querySelector('.tag-container');
    if (!container) {
      return;
    }

    this.containerEl = container as HTMLElement;
    this.attachObserver();
    this.applyFilters();
  }

  /**
   * Attach mutation observer to tag pane
   */
  private attachObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }

    if (!this.containerEl) return;

    this.observer = new MutationObserver(() => {
      if (this.isEnabled) {
        this.applyFilters();
      }
    });

    this.observer.observe(this.containerEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  /**
   * Apply rules to all visible tags in the pane
   */
  private applyFilters() {
    if (!this.containerEl || !this.isEnabled) return;

    // Find all tag items in the pane
    const tagItems = this.containerEl.querySelectorAll(`.${TAG_PANE_ITEM_CLASS}`);

    for (const item of Array.from(tagItems)) {
      const element = item as HTMLElement;
      const tagText = element.textContent?.trim();

      if (!tagText) continue;

      // Normalize tag (remove # if present)
      const tag = tagText.startsWith('#') ? tagText.slice(1) : tagText;

      // Check if tag matches any active rule
      const matchResult = RuleEngine.evaluateTag(
        tag,
        this.tagMetadata.get(tag),
        this.rules
      );

      if (matchResult && matchResult.ruleName) {
        // Hide the tag
        element.setAttribute(TAG_CURATOR_ATTR, matchResult.ruleId);
        element.style.display = 'none';
      } else {
        // Show the tag
        element.removeAttribute(TAG_CURATOR_ATTR);
        element.style.display = '';
      }
    }
  }

  /**
   * Update rules and re-apply filters
   */
  updateRules(rules: Rule[]) {
    this.rules = rules;
    this.applyFilters();
  }

  /**
   * Update tag metadata and re-apply filters
   */
  updateTagMetadata(metadata: Map<string, TagMeta>) {
    this.tagMetadata = metadata;
    this.applyFilters();
  }

  /**
   * Enable/disable filtering
   */
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.clearFilters();
    } else {
      this.applyFilters();
    }
  }

  /**
   * Clear all applied styles
   */
  private clearFilters() {
    if (!this.containerEl) return;

    const hiddenItems = this.containerEl.querySelectorAll(`[${TAG_CURATOR_ATTR}]`);
    for (const item of Array.from(hiddenItems)) {
      const element = item as HTMLElement;
      element.removeAttribute(TAG_CURATOR_ATTR);
      element.style.display = '';
    }
  }

  /**
   * Clean up
   */
  unload() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.clearFilters();
    this.containerEl = null;
  }
}
