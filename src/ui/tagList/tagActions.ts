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
}
