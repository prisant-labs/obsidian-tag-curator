import { CachedMetadata, getAllTags as obsidianGetAllTags } from 'obsidian';

export function stripHash(tag: string): string {
  return tag.startsWith('#') ? tag.slice(1) : tag;
}

export function withHash(tag: string): string {
  return tag.startsWith('#') ? tag : `#${tag}`;
}

export function tagsFromCache(cache: CachedMetadata | null): string[] {
  if (!cache) return [];
  return (obsidianGetAllTags(cache) ?? []).map(stripHash);
}
