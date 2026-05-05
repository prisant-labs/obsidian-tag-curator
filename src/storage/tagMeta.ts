/**
 * Tag metadata tracking and storage
 */

import { App, Plugin, TFile } from 'obsidian';
import { TagMeta, TagSource } from '../types';

export class TagMetaManager {
  private app: App;
  private plugin: Plugin;
  private tagMetadata: Map<string, TagMeta> = new Map();
  private saveTimeout: NodeJS.Timeout | null = null;
  private debounceMs = 5000;
  private onMetadataChanged: (() => void) | null = null;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
  }

  /**
   * Initialize metadata tracking
   */
  async init() {
    // Load existing metadata
    await this.loadMetadata();

    // Scan all files on first load
    await this.scanAllFiles();

    // Listen for metadata cache changes
    this.app.metadataCache.on('changed', (file) => {
      this.updateFileMetadata(file);
    });
  }

  /**
   * Scan all markdown files to build initial metadata
   */
  private async scanAllFiles() {
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      this.updateFileMetadata(file);
    }
  }

  /**
   * Load metadata from disk
   */
  private async loadMetadata() {
    try {
      const data = await this.plugin.loadData();
      if (data?.tagMetadata) {
        const stored = data.tagMetadata as Record<string, TagMeta>;
        this.tagMetadata = new Map(Object.entries(stored));
      }
    } catch (e) {
      console.error('Failed to load tag metadata:', e);
    }
  }

  /**
   * Save metadata to disk (debounced)
   */
  private debouncedSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(async () => {
      try {
        const data = await this.plugin.loadData();
        const stored = Object.fromEntries(this.tagMetadata);
        await this.plugin.saveData({
          ...data,
          tagMetadata: stored,
        });
      } catch (e) {
        console.error('Failed to save tag metadata:', e);
      }
    }, this.debounceMs);
  }

  /**
   * Track which files contain which tags (for accurate counting)
   */
  private fileTagMap: Map<string, Set<string>> = new Map();

  /**
   * Update metadata for a file
   */
  private updateFileMetadata(file: TFile) {
    const cache = this.app.metadataCache.getFileCache(file);
    const fileId = file.path;
    const now = Date.now();

    // Collect tags from this file
    const currentTags = new Set<string>();

    // Inline tags
    const inlineTags = cache?.tags || [];
    for (const tagObj of inlineTags) {
      const tag = tagObj.tag.startsWith('#') ? tagObj.tag.slice(1) : tagObj.tag;
      currentTags.add(tag);
      this.updateTagMeta(tag, 'inline', now);
    }

    // Frontmatter tags
    const frontmatter = cache?.frontmatter;
    if (frontmatter && frontmatter.tags) {
      const fmTags = frontmatter.tags as string[] | string;
      const tagsArray = Array.isArray(fmTags) ? fmTags : [fmTags];

      for (const tag of tagsArray) {
        const normalizedTag = tag.startsWith('#') ? tag.slice(1) : tag;
        currentTags.add(normalizedTag);
        this.updateTagMeta(normalizedTag, 'frontmatter', now);
      }
    }

    // Update file tag map
    const previousTags = this.fileTagMap.get(fileId) || new Set();
    this.fileTagMap.set(fileId, currentTags);

    // Recalculate count for tags that were removed
    for (const tag of previousTags) {
      if (!currentTags.has(tag)) {
        this.recalculateTagCount(tag);
      }
    }

    this.debouncedSave();
    if (this.onMetadataChanged) {
      this.onMetadataChanged();
    }
  }

  /**
   * Update or create metadata for a tag
   */
  private updateTagMeta(tag: string, source: TagSource, now: number) {
    let meta = this.tagMetadata.get(tag);
    if (!meta) {
      meta = {
        tag,
        firstSeen: now,
        lastSeen: now,
        count: 1,
        sources: [source],
      };
    } else {
      meta.lastSeen = now;
      if (!meta.sources.includes(source)) {
        meta.sources.push(source);
      }
    }
    this.tagMetadata.set(tag, meta);
  }

  /**
   * Recalculate count for a tag based on file tag map
   */
  private recalculateTagCount(tag: string) {
    let count = 0;
    for (const fileTags of this.fileTagMap.values()) {
      if (fileTags.has(tag)) {
        count++;
      }
    }
    const meta = this.tagMetadata.get(tag);
    if (meta) {
      meta.count = count;
      if (count === 0) {
        this.tagMetadata.delete(tag);
      } else {
        this.tagMetadata.set(tag, meta);
      }
    }
  }

  /**
   * Get metadata for a tag
   */
  getTagMeta(tag: string): TagMeta | undefined {
    return this.tagMetadata.get(tag);
  }

  /**
   * Get all tag metadata
   */
  getAllTagMeta(): Map<string, TagMeta> {
    return new Map(this.tagMetadata);
  }

  /**
   * Get all tags
   */
  getAllTags(): string[] {
    return Array.from(this.tagMetadata.keys());
  }

  /**
   * Set debounce time
   */
  setDebounceMs(ms: number) {
    this.debounceMs = ms;
  }

  /**
   * Register a callback for when metadata changes
   */
  onChanged(callback: () => void) {
    this.onMetadataChanged = callback;
  }

  /**
   * Clean up
   */
  unload() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
  }
}
