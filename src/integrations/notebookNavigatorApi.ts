/**
 * Minimal, hand-written local types for the subset of Notebook Navigator's
 * public plugin API that Tag Visibility calls at runtime.
 *
 * This is deliberately NOT NN's published `.d.ts`, and it is not derived from NN
 * source. It is an independent interface contract written only to type our own
 * runtime-interop calls, so it carries no GPL obligation (NN is GPL-3.0; Tag
 * Curator is Apache-2.0). Keep it minimal: add a member only when we call it.
 *
 * Shapes sourced from the integration study:
 * proposals/notebook-navigator-compat/findings_nn-integration-seam.md (Section 2).
 */

export interface NnTagMeta {
  color?: string | null;
  backgroundColor?: string | null;
  icon?: string | null;
}

export type NnEventName = 'storage-ready' | 'tag-changed';

export interface NnTagMenuContext {
  tag: string;
  addItem: (configure: unknown) => void;
}

export interface NotebookNavigatorApi {
  getVersion(): string;
  isStorageReady(): boolean;
  whenReady(): Promise<void>;
  on(event: NnEventName, cb: () => void): void;
  off(event: NnEventName, cb: () => void): void;
  metadata: {
    setTagMeta(tag: string, meta: NnTagMeta | null): void;
    getTagMeta(tag: string): NnTagMeta | undefined;
  };
  menus: {
    registerTagMenu(cb: (ctx: NnTagMenuContext) => void): void;
  };
}
