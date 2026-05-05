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
  init() {
    // Load existing metadata
    this.loadMetadata();

    // Listen for metadata cache changes
    this.app.metadataCache.on('changed', (file) => {
      this.updateFileMetadata(file);
    });
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
   * Update metadata for a file
   */
  private updateFileMetadata(file: TFile) {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache) return;

    const tags = cache.tags || [];
    const now = Date.now();

    for (const tagObj of tags) {
      const tag = tagObj.tag.startsWith('#') ? tagObj.tag.slice(1) : tagObj.tag;
      const source: TagSource = 'inline';

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
        meta.count += 1;
        if (!meta.sources.includes(source)) {
          meta.sources.push(source);
        }
      }

      this.tagMetadata.set(tag, meta);
    }

    // Also check frontmatter tags
    const frontmatter = cache.frontmatter;
    if (frontmatter && frontmatter.tags) {
      const fmTags = frontmatter.tags as string[] | string;
      const tagsArray = Array.isArray(fmTags) ? fmTags : [fmTags];

      for (const tag of tagsArray) {
        const normalizedTag = tag.startsWith('#') ? tag.slice(1) : tag;
        const source: TagSource = 'frontmatter';

        let meta = this.tagMetadata.get(normalizedTag);
        if (!meta) {
          meta = {
            tag: normalizedTag,
            firstSeen: now,
            lastSeen: now,
            count: 1,
            sources: [source],
          };
        } else {
          meta.lastSeen = now;
          meta.count += 1;
          if (!meta.sources.includes(source)) {
            meta.sources.push(source);
          }
        }

        this.tagMetadata.set(normalizedTag, meta);
      }
    }

    this.debouncedSave();
    if (this.onMetadataChanged) {
      this.onMetadataChanged();
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
