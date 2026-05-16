/**
 * Minimal stub of the `obsidian` module for unit tests.
 *
 * Only what the engine + util layer touches at import time. Adapter / Plugin
 * surfaces consumed by storage are recreated per-test as plain objects.
 */

export interface CachedMetadata {
  tags?: Array<{ tag: string }>;
  frontmatter?: { tags?: string | string[] };
}

export function getAllTags(cache: CachedMetadata | null): string[] | null {
  if (!cache) return null;
  const out: string[] = [];
  for (const t of cache.tags ?? []) out.push(t.tag);
  const fm = cache.frontmatter?.tags;
  if (typeof fm === 'string') out.push(`#${fm}`);
  else if (Array.isArray(fm)) for (const t of fm) out.push(`#${t}`);
  return out;
}

export class Plugin {
  data: unknown = null;
  async loadData(): Promise<unknown> {
    return this.data;
  }
  async saveData(data: unknown): Promise<void> {
    this.data = data;
  }
}
