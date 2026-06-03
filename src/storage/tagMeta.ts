import { App, Events, Plugin, TFile, normalizePath } from 'obsidian';
import { TagMeta, TagSource } from '../types';
import { tagsFromCache } from '../util/tagUtils';

interface PersistedTagMeta {
  schemaVersion: number;
  tags: Record<string, TagMeta>;
}

const SCHEMA = 1;

export class TagMetaManager extends Events {
  private app: App;
  private plugin: Plugin;
  private store = new Map<string, TagMeta>();
  private fileTags = new Map<string, Set<string>>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceMs = 5000;

  constructor(app: App, plugin: Plugin) {
    super();
    this.app = app;
    this.plugin = plugin;
  }

  setDebounceMs(ms: number): void {
    this.debounceMs = Math.max(500, ms);
  }

  private filePath(): string {
    const dir = this.plugin.manifest.dir ?? `.obsidian/plugins/${this.plugin.manifest.id}`;
    return normalizePath(`${dir}/tags.json`);
  }

  async load(): Promise<void> {
    const path = this.filePath();
    const adapter = this.app.vault.adapter;
    try {
      if (!(await adapter.exists(path))) {
        this.store = new Map();
        return;
      }
      const raw = await adapter.read(path);
      const parsed = JSON.parse(raw) as PersistedTagMeta;
      if (parsed.schemaVersion !== SCHEMA) {
        this.store = new Map();
        return;
      }
      this.store = new Map(Object.entries(parsed.tags ?? {}));
    } catch (e) {
      console.error('[tag-curator] tags.json corrupted, rebuilding', e);
      this.store = new Map();
    }
  }

  async scanAll(): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      this.indexFile(file);
    }
    await this.flushNow();
  }

  indexFile(file: TFile): void {
    const cache = this.app.metadataCache.getFileCache(file);
    const inlineTags = (cache?.tags ?? []).map((t) => t.tag);
    const allTags = tagsFromCache(cache);
    const inlineSet = new Set(inlineTags.map((t) => (t.startsWith('#') ? t.slice(1) : t)));
    const fm = cache?.frontmatter?.tags;
    const frontmatterSet = new Set<string>();
    if (typeof fm === 'string') frontmatterSet.add(fm);
    else if (Array.isArray(fm)) for (const t of fm) frontmatterSet.add(t);
    const now = Date.now();

    const previousTags = this.fileTags.get(file.path) ?? new Set<string>();
    const currentTags = new Set<string>(allTags);
    this.fileTags.set(file.path, currentTags);

    for (const tag of currentTags) {
      // A tag may appear in BOTH inline body and frontmatter; record each
      // source so the sidecar's `sources` field reflects every location.
      const seen: TagSource[] = [];
      if (inlineSet.has(tag)) seen.push('inline');
      if (frontmatterSet.has(tag)) seen.push('frontmatter');
      if (seen.length === 0) seen.push('frontmatter'); // fallback: came via cache but neither set
      for (const source of seen) this.touchTag(tag, source, now);
    }
    for (const tag of previousTags) {
      if (!currentTags.has(tag)) this.recomputeCount(tag);
    }
    this.scheduleSave();
    this.trigger('changed');
  }

  removeFile(filePath: string): void {
    const previous = this.fileTags.get(filePath);
    if (!previous) return;
    this.fileTags.delete(filePath);
    for (const tag of previous) this.recomputeCount(tag);
    this.scheduleSave();
    this.trigger('changed');
  }

  renameFile(oldPath: string, newPath: string): void {
    const existing = this.fileTags.get(oldPath);
    if (!existing) return;
    this.fileTags.delete(oldPath);
    this.fileTags.set(newPath, existing);
  }

  private touchTag(tag: string, source: TagSource, now: number): void {
    const existing = this.store.get(tag);
    if (!existing) {
      this.store.set(tag, {
        tag,
        firstSeen: now,
        lastSeen: now,
        count: 1,
        sources: [source],
      });
    } else {
      existing.lastSeen = now;
      if (!existing.sources.includes(source)) existing.sources.push(source);
    }
    this.recomputeCount(tag);
  }

  private recomputeCount(tag: string): void {
    let count = 0;
    for (const set of this.fileTags.values()) if (set.has(tag)) count++;
    const existing = this.store.get(tag);
    if (!existing) return;
    if (count === 0) this.store.delete(tag);
    else existing.count = count;
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      void this.flushNow();
    }, this.debounceMs);
  }

  private async flushNow(): Promise<void> {
    this.saveTimer = null;
    const payload: PersistedTagMeta = {
      schemaVersion: SCHEMA,
      tags: Object.fromEntries(this.store),
    };
    const adapter = this.app.vault.adapter;
    const path = this.filePath();
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
    await adapter.write(path, JSON.stringify(payload, null, 2));
  }

  get(tag: string): TagMeta | undefined {
    return this.store.get(tag);
  }

  /**
   * Mark a tag reviewed / unreviewed (the triage inbox). No-op if the tag is
   * not in the store. Persists via the debounced sidecar save and announces via
   * `changed` so open views re-render. Tag keys carry no leading '#'.
   */
  setReviewed(tag: string, value: boolean): void {
    const existing = this.store.get(tag);
    if (!existing) return;
    existing.reviewed = value;
    this.scheduleSave();
    this.trigger('changed');
  }

  all(): Map<string, TagMeta> {
    return new Map(this.store);
  }

  unload(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      void this.flushNow();
    }
  }
}
