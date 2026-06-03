import { TagOverride } from '../../types';

export type BulkAction =
  | 'hide'
  | 'unhide'
  | 'mark-reviewed'
  | 'mark-unreviewed'
  | 'send-to-tag-wrangler';

/** Visibility verbs the action layer accepts. 'clear' removes any pin. */
export type VisibilityIntent = 'hide' | 'show' | 'clear';

export interface VisibilityResult {
  applied: number;
  deferred: number;
}

export interface TagActionsHost {
  isPluginEnabled(id: string): boolean;
  executeCommand(id: string): boolean;
  /**
   * Persist a per-tag visibility override (D-015): 'hide' / 'show' pins the tag,
   * null clears the pin. Keys carry no leading '#'. The store resolves these
   * ahead of rules; see SettingsManager.setOverride / RuleEngine.resolveVisibility.
   */
  setOverride(tag: string, value: TagOverride | null): void | Promise<void>;
  /** Persist a per-tag reviewed flag (the triage inbox). Keys carry no leading '#'. */
  setReviewed(tag: string, value: boolean): void | Promise<void>;
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

  // Per-tag overrides are real now (D-015): hide/show pin the tag, clear removes
  // the pin. The store resolves overrides ahead of rules, so every tag applies.
  async setVisibility(tags: string[], to: VisibilityIntent): Promise<VisibilityResult> {
    const value: TagOverride | null = to === 'clear' ? null : to;
    for (const tag of tags) {
      await this.hostApi.setOverride(tag, value);
    }
    return { applied: tags.length, deferred: 0 };
  }

  async markReviewed(tags: string[], value: boolean): Promise<VisibilityResult> {
    for (const tag of tags) {
      await this.hostApi.setReviewed(tag, value);
    }
    return { applied: tags.length, deferred: 0 };
  }

  async applyBulk(tags: string[], action: BulkAction): Promise<number | VisibilityResult> {
    switch (action) {
      case 'send-to-tag-wrangler':
        return this.sendToTagWrangler(tags);
      case 'hide':
        return this.setVisibility(tags, 'hide');
      case 'unhide':
        return this.setVisibility(tags, 'show');
      case 'mark-reviewed':
        return this.markReviewed(tags, true);
      case 'mark-unreviewed':
        return this.markReviewed(tags, false);
    }
  }
}
