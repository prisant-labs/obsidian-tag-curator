export type BulkAction = 'hide' | 'unhide' | 'send-to-tag-wrangler';

export interface VisibilityResult {
  applied: number;
  deferred: number;
  reason?: 'b009';
}

export interface TagActionsHost {
  isPluginEnabled(id: string): boolean;
  executeCommand(id: string): boolean;
}

export class TagActions {
  constructor(private hostApi: TagActionsHost) {}

  tagWranglerInstalled(): boolean {
    return this.hostApi.isPluginEnabled('tag-wrangler');
  }

  sendToTagWrangler(tags: string[]): number {
    if (!this.tagWranglerInstalled()) return 0;
    let dispatched = 0;
    for (let i = 0; i < tags.length; i++) {
      if (this.hostApi.executeCommand('tag-wrangler:rename-tag')) dispatched += 1;
    }
    return dispatched;
  }

  // Per-tag overrides land with B009; until then these report deferral so the
  // UI can show the "coming in v0.2" notice without the action layer touching DOM.
  setVisibility(tags: string[], _to: 'hide' | 'unhide'): VisibilityResult {
    return { applied: 0, deferred: tags.length, reason: 'b009' };
  }

  applyBulk(tags: string[], action: BulkAction): number | VisibilityResult {
    switch (action) {
      case 'send-to-tag-wrangler':
        return this.sendToTagWrangler(tags);
      case 'hide':
        return this.setVisibility(tags, 'hide');
      case 'unhide':
        return this.setVisibility(tags, 'unhide');
    }
  }
}
