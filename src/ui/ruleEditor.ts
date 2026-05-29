/**
 * Rule editor (D-010 - card view + right-docked preview, supersedes D-001).
 *
 * Two modes share one surface (no wizard, per D-002 closed):
 *   - "cards": each rule rendered as a full-width row with toggle + name +
 *     Type pill + match summary + "N tags affected" + chevron. A dashed
 *     "+ New rule" card opens edit mode with defaults.
 *   - "edit": replaces the cards with a sectioned editor (Type / Identity /
 *     Match / Then), header with the rule name as a proper h2 + enable
 *     toggle + back-to-cards crumb.
 *
 * A right-docked preview panel stays visible across both modes:
 *   - cards mode: shows every tag any rule is currently affecting
 *   - edit mode: filtered to the selected rule, with a stats row
 *     (Unique tags / Total instances)
 *
 * Priority is hidden from the UI (D-009). New custom rules default to 50.
 */
import { App, Modal, Notice } from 'obsidian';
import TagCuratorPlugin from '../main';
import {
  Action,
  MatchCriteria,
  MatchType,
  Rule,
  Scope,
  TagMeta,
} from '../types';
import { RuleEngine } from '../engine/ruleEngine';
import { resolveActiveRules } from '../engine/presets';
import { compileSafeRegex } from '../util/safeRegex';

type Mode = 'cards' | 'edit';

const DEFAULT_PRIORITY = 50; // D-009: hidden in UI; engine uses this default.

export class RuleEditor {
  private root: HTMLElement;
  private mainEl!: HTMLElement;
  private previewEl!: HTMLElement;
  private mode: Mode = 'cards';
  private draft: Rule | null = null;
  private isNew = false;

  constructor(container: HTMLElement, private plugin: TagCuratorPlugin) {
    this.root = container.createDiv({ cls: 'tcr-workspace' });
    this.mainEl = this.root.createDiv({ cls: 'tcr-main' });
    this.previewEl = this.root.createDiv({ cls: 'tcr-preview-dock' });
    this.render();
    this.plugin.settingsManager.onChange(() => this.render());
  }

  destroy(): void {
    this.root.remove();
  }

  // -----------------------------------------------------------------
  // Top-level render
  // -----------------------------------------------------------------

  private render(): void {
    this.mainEl.empty();
    this.previewEl.empty();
    if (this.mode === 'cards') {
      this.renderCards();
      this.renderPreviewVaultWide();
    } else {
      this.renderEdit();
      this.renderPreviewForRule(this.draft);
    }
  }

  // -----------------------------------------------------------------
  // Card view
  // -----------------------------------------------------------------

  private renderCards(): void {
    const s = this.plugin.settingsManager.get();
    const rules = s.customRules;

    const toolbar = this.mainEl.createDiv({ cls: 'tcr-toolbar' });
    toolbar.createDiv({
      cls: 'tcr-toolbar-title',
      text: `Custom rules · ${rules.length}`,
    });

    const cards = this.mainEl.createDiv({ cls: 'tcr-cards' });
    for (const rule of rules) {
      this.renderCard(cards, rule);
    }
    this.renderNewCard(cards);
  }

  private renderCard(parent: HTMLElement, rule: Rule): void {
    const card = parent.createDiv({ cls: 'tcr-card' });
    if (!rule.enabled) card.addClass('tcr-card-off');

    const toggleWrap = card.createDiv({ cls: 'tcr-card-toggle' });
    this.makeToggle(toggleWrap, rule.enabled, async (next) => {
      await this.plugin.settingsManager.updateCustomRule(rule.id, {
        enabled: next,
      });
    });

    const info = card.createDiv({ cls: 'tcr-card-info' });
    info.createDiv({ cls: 'tcr-card-name', text: rule.name });
    const meta = info.createDiv({ cls: 'tcr-card-meta' });
    meta.createSpan({
      cls: 'tcr-type-pill',
      text: friendlyTypeLabel(rule.match.type),
    });
    meta.createSpan({
      cls: 'tcr-match-summary',
      text: matchSummaryString(rule.match),
    });

    const affectedCount = this.countAffectedForRule(rule);
    const affectedEl = card.createDiv({
      cls: 'tcr-card-affected',
      text: rule.enabled ? `${affectedCount} tags affected` : 'off',
    });
    if (!rule.enabled) affectedEl.addClass('tcr-card-affected-zero');

    card.createDiv({ cls: 'tcr-card-chevron', text: '›' });

    card.addEventListener('click', (e) => {
      const tgt = e.target as HTMLElement;
      if (tgt.closest('.tcr-card-toggle')) return;
      this.openEdit(rule);
    });
  }

  private renderNewCard(parent: HTMLElement): void {
    const card = parent.createDiv({ cls: 'tcr-card tcr-card-new' });
    card.createDiv({ cls: 'tcr-card-new-title', text: '+ New rule' });
    card.createDiv({
      cls: 'tcr-card-new-sub',
      text: 'Opens the editor with defaults. No separate wizard.',
    });
    card.addEventListener('click', () => this.openEdit(null));
  }

  private openEdit(rule: Rule | null): void {
    if (rule) {
      this.draft = { ...rule, match: { ...rule.match } };
      this.isNew = false;
    } else {
      this.draft = this.makeDefaultRule();
      this.isNew = true;
    }
    this.mode = 'edit';
    this.render();
  }

  private makeDefaultRule(): Rule {
    return {
      id: `r-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      name: 'Untitled rule',
      enabled: true,
      priority: DEFAULT_PRIORITY,
      match: { type: 'regex', pattern: '' },
      action: 'hide',
      scopes: ['tag-pane'],
    };
  }

  // -----------------------------------------------------------------
  // Edit mode
  // -----------------------------------------------------------------

  private renderEdit(): void {
    const draft = this.draft;
    if (!draft) {
      this.exitEdit();
      return;
    }
    const edit = this.mainEl.createDiv({ cls: 'tcr-edit' });

    const head = edit.createDiv({ cls: 'tcr-edit-head' });
    const crumbs = head.createDiv({ cls: 'tcr-edit-crumbs' });
    const back = crumbs.createEl('button', {
      cls: 'tcr-edit-back',
      text: '← Back to rules',
    });
    back.addEventListener('click', () => this.exitEdit());
    crumbs.createSpan({ cls: 'tcr-edit-crumb-sep', text: '/' });
    crumbs.createSpan({ text: 'Custom rules' });
    crumbs.createSpan({ cls: 'tcr-edit-crumb-sep', text: '/' });
    crumbs.createSpan({ text: this.isNew ? 'New rule' : 'Edit rule' });

    const title = head.createDiv({ cls: 'tcr-edit-title-row' });
    this.makeToggle(title, draft.enabled, (next) => {
      draft.enabled = next;
    });
    title.createEl('h2', {
      cls: 'tcr-edit-title',
      text: draft.name || 'Untitled rule',
    });

    this.section(edit, 'Type', (sec) => {
      const row = this.row(sec);
      const label = this.label(row, 'Match by');
      this.attachHelp(
        label,
        "Choose how this rule decides which tags match. Pattern match runs a regex against the tag name. Count threshold compares the tag's note-count. Specific tags is an explicit list.",
      );
      const control = this.control(row);
      const select = control.createEl('select', { cls: 'tcr-select tight' });
      for (const t of ['regex', 'frequency', 'list'] as MatchType[]) {
        const opt = select.createEl('option', {
          value: t,
          text: friendlyTypeLabel(t),
        });
        if (draft.match.type === t) opt.selected = true;
      }
      select.addEventListener('change', () => {
        draft.match = blankCriteriaFor(select.value as MatchType);
        this.render();
      });
    });

    this.section(edit, 'Identity', (sec) => {
      const nameRow = this.row(sec);
      this.label(nameRow, 'Name');
      const ctl = this.control(nameRow);
      const input = ctl.createEl('input', { cls: 'tcr-input' });
      input.value = draft.name;
      input.addEventListener('input', () => {
        draft.name = input.value;
      });

      const hint = sec.createDiv({ cls: 'tcr-edit-hint' });
      hint.setText(
        'Toggle in the header above (or on the card) enables/disables this rule. Priority is architected in the engine (default 50, see D-009) but hidden from the UI for v0.1.',
      );
    });

    this.section(edit, 'Match', (sec) => {
      this.renderMatchSection(sec, draft);
    });

    this.section(edit, 'Then', (sec) => {
      const actionRow = this.row(sec);
      this.label(actionRow, 'Action');
      const ctl = this.control(actionRow);
      const sel = ctl.createEl('select', { cls: 'tcr-select tight' });
      for (const a of ['hide', 'flag', 'show-only', 'group'] as Action[]) {
        const opt = sel.createEl('option', { value: a, text: a });
        if (draft.action === a) opt.selected = true;
      }
      sel.addEventListener('change', () => {
        draft.action = sel.value as Action;
      });

      const scopeRow = this.row(sec);
      const scopeLabel = this.label(scopeRow, 'Scope');
      this.attachHelp(
        scopeLabel,
        'Where the rule applies. v0.1 supports tag-pane only; graph view, autocomplete, and properties chips arrive in v0.2.',
      );
      const sctl = this.control(scopeRow);
      const ssel = sctl.createEl('select', { cls: 'tcr-select' });
      const opts: Array<{
        value: Scope[];
        label: string;
        disabled?: boolean;
      }> = [
        { value: ['tag-pane'], label: 'tag-pane' },
        {
          value: ['tag-pane', 'graph'],
          label: 'tag-pane + graph (v0.2)',
          disabled: true,
        },
      ];
      for (const o of opts) {
        const opt = ssel.createEl('option', {
          value: o.value.join(','),
          text: o.label,
        });
        if (o.disabled) opt.disabled = true;
        if (draft.scopes.join(',') === o.value.join(',')) opt.selected = true;
      }
      ssel.addEventListener('change', () => {
        draft.scopes = ssel.value.split(',') as Scope[];
      });
    });

    const foot = edit.createDiv({ cls: 'tcr-edit-foot' });
    if (!this.isNew) {
      const del = foot.createEl('button', {
        cls: 'tcr-btn tcr-btn-warning',
        text: 'Delete rule',
      });
      del.addEventListener('click', () => void this.deleteDraft());
    }
    const cancel = foot.createEl('button', {
      cls: 'tcr-btn tcr-btn-ghost',
      text: 'Cancel',
    });
    cancel.addEventListener('click', () => this.exitEdit());
    const save = foot.createEl('button', {
      cls: 'tcr-btn tcr-btn-accent',
      text: 'Save',
    });
    save.addEventListener('click', () => void this.saveDraft());
  }

  private renderMatchSection(sec: HTMLElement, draft: Rule): void {
    const wrap = sec.createDiv({ cls: 'tcr-match-sentence' });
    wrap.createSpan({ cls: 'tcr-match-lead', text: "When a tag's name" });

    switch (draft.match.type) {
      case 'regex': {
        wrap.createSpan({
          cls: 'tcr-match-lead',
          text: ' matches the regex ',
        });
        const input = wrap.createEl('input', { cls: 'tcr-input wide' });
        input.value = draft.match.pattern ?? '';
        input.placeholder = '^draft(-|$)';
        const status = wrap.createSpan({ cls: 'tcr-regex-status' });
        const update = (): void => {
          status.empty();
          if (!input.value) return;
          try {
            compileSafeRegex(input.value);
            status.removeClass('tcr-regex-err');
            status.addClass('tcr-regex-ok');
            status.setText(' ✓ valid');
          } catch (e) {
            status.removeClass('tcr-regex-ok');
            status.addClass('tcr-regex-err');
            status.setText(' ✗ ' + (e as Error).message);
          }
        };
        input.addEventListener('input', () => {
          draft.match = { ...draft.match, pattern: input.value };
          update();
          this.renderPreviewForRule(draft);
        });
        update();
        break;
      }
      case 'frequency': {
        wrap.createSpan({
          cls: 'tcr-match-lead',
          text: ' has a count that ',
        });
        const opSel = wrap.createEl('select', { cls: 'tcr-select inline' });
        for (const op of ['<', '<=', '=', '>=', '>']) {
          const opt = opSel.createEl('option', { value: op, text: op });
          if ((draft.match.operator ?? '<=') === op) opt.selected = true;
        }
        const valInput = wrap.createEl('input', {
          cls: 'tcr-input narrow',
          type: 'number',
        });
        valInput.value = String(draft.match.value ?? 1);
        const update = (): void => {
          draft.match = {
            type: 'frequency',
            operator: opSel.value as MatchCriteria['operator'],
            value: Number(valInput.value),
          };
          this.renderPreviewForRule(draft);
        };
        opSel.addEventListener('change', update);
        valInput.addEventListener('input', update);
        break;
      }
      case 'list': {
        wrap.createSpan({ cls: 'tcr-match-lead', text: ' is one of ' });
        const input = wrap.createEl('input', { cls: 'tcr-input wide' });
        input.value = (draft.match.list ?? []).join(', ');
        input.placeholder = 'wip, todo, fixme';
        input.addEventListener('input', () => {
          const list = input.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          draft.match = { type: 'list', list };
          this.renderPreviewForRule(draft);
        });
        break;
      }
    }
  }

  // -----------------------------------------------------------------
  // Save / delete / cancel
  // -----------------------------------------------------------------

  private async saveDraft(): Promise<void> {
    const draft = this.draft;
    if (!draft) return;
    if (!draft.name.trim()) {
      new Notice('Rule needs a name.');
      return;
    }
    if (draft.match.type === 'regex' && draft.match.pattern) {
      try {
        compileSafeRegex(draft.match.pattern);
      } catch (e) {
        new Notice('Invalid regex: ' + (e as Error).message);
        return;
      }
    }
    if (this.isNew) {
      await this.plugin.settingsManager.addCustomRule(draft);
      new Notice(`Rule "${draft.name}" created.`);
    } else {
      await this.plugin.settingsManager.updateCustomRule(draft.id, draft);
      new Notice(`Rule "${draft.name}" saved.`);
    }
    this.exitEdit();
  }

  private async deleteDraft(): Promise<void> {
    const draft = this.draft;
    if (!draft || this.isNew) return;
    const ok = await confirmModal(
      this.plugin.app,
      'Delete rule?',
      `"${draft.name}" will be removed. This cannot be undone.`,
    );
    if (!ok) return;
    await this.plugin.settingsManager.deleteCustomRule(draft.id);
    new Notice(`Rule "${draft.name}" deleted.`);
    this.exitEdit();
  }

  private exitEdit(): void {
    this.mode = 'cards';
    this.draft = null;
    this.isNew = false;
    this.render();
  }

  // -----------------------------------------------------------------
  // Right-docked preview
  // -----------------------------------------------------------------

  private renderPreviewVaultWide(): void {
    const s = this.plugin.settingsManager.get();
    const meta = this.plugin.tagMetaManager.all();
    const activeRules = resolveActiveRules(s);

    const head = this.previewEl.createDiv({ cls: 'tcr-pd-head' });
    head.createDiv({ cls: 'tcr-pd-eyebrow', text: 'Preview · vault-wide' });
    head.createDiv({
      cls: 'tcr-pd-title',
      text: 'Every tag any rule is affecting',
    });

    const affected: Array<{ tag: string; count: number; ruleName: string }> = [];
    for (const m of meta.values()) {
      const attr = RuleEngine.getRuleAttribution(m.tag, m, activeRules);
      if (attr.effective) {
        affected.push({
          tag: m.tag,
          count: m.count,
          ruleName: attr.effective.ruleName,
        });
      }
    }
    affected.sort((a, b) => b.count - a.count);

    const totalInstances = affected.reduce((s, a) => s + a.count, 0);
    this.renderStatRow(head, affected.length, totalInstances);
    head.createDiv({
      cls: 'tcr-pd-sub',
      text: 'Scrollable. In edit mode this list filters to the selected rule.',
    });

    const body = this.previewEl.createDiv({ cls: 'tcr-pd-body' });
    if (affected.length === 0) {
      body.createDiv({
        cls: 'tcr-pd-empty',
        text: 'No tags currently affected by any rule.',
      });
      return;
    }
    for (const a of affected) {
      const row = body.createDiv({ cls: 'tcr-pd-row' });
      row.createSpan({ cls: 'tcr-pd-tag', text: a.tag });
      row.createSpan({ cls: 'tcr-pd-count', text: String(a.count) });
      row.createSpan({ cls: 'tcr-pd-rule', text: a.ruleName });
    }
  }

  private renderPreviewForRule(rule: Rule | null): void {
    this.previewEl.empty();
    const head = this.previewEl.createDiv({ cls: 'tcr-pd-head' });
    head.createDiv({ cls: 'tcr-pd-eyebrow', text: 'Preview · filtered to' });

    if (!rule) {
      head.createDiv({ cls: 'tcr-pd-title', text: 'No rule selected' });
      return;
    }

    const titleRow = head.createDiv({ cls: 'tcr-pd-title-row' });
    titleRow.createSpan({ cls: 'tcr-pd-dot' });
    titleRow.createSpan({ text: rule.name || 'Untitled rule' });

    const meta = this.plugin.tagMetaManager.all();
    const matching: TagMeta[] = [];
    for (const m of meta.values()) {
      if (this.testCriteriaOnTag(rule.match, m)) matching.push(m);
    }
    matching.sort((a, b) => b.count - a.count);

    const totalInstances = matching.reduce((s, m) => s + m.count, 0);
    this.renderStatRow(head, matching.length, totalInstances);

    head.createDiv({
      cls: 'tcr-pd-sub',
      text: 'Scrollable. Updates as you edit the rule.',
    });

    const body = this.previewEl.createDiv({ cls: 'tcr-pd-body' });
    if (matching.length === 0) {
      body.createDiv({
        cls: 'tcr-pd-empty',
        text: 'No tags match this rule yet.',
      });
      return;
    }
    for (const m of matching) {
      const row = body.createDiv({ cls: 'tcr-pd-row' });
      row.createSpan({ cls: 'tcr-pd-tag', text: m.tag });
      row.createSpan({ cls: 'tcr-pd-count', text: String(m.count) });
    }
  }

  private renderStatRow(
    parent: HTMLElement,
    unique: number,
    totalInstances: number,
  ): void {
    const stats = parent.createDiv({ cls: 'tcr-pd-stats' });
    this.statCard(stats, 'Unique tags', unique);
    this.statCard(stats, 'Total instances', totalInstances);
  }

  private statCard(parent: HTMLElement, label: string, value: number): void {
    const c = parent.createDiv({ cls: 'tcr-pd-stat' });
    c.createDiv({ cls: 'tcr-pd-stat-label', text: label });
    c.createDiv({ cls: 'tcr-pd-stat-value', text: value.toLocaleString() });
  }

  // -----------------------------------------------------------------
  // Affected-tag computation
  // -----------------------------------------------------------------

  private countAffectedForRule(rule: Rule): number {
    if (!rule.enabled) return 0;
    let count = 0;
    for (const m of this.plugin.tagMetaManager.all().values()) {
      if (this.testCriteriaOnTag(rule.match, m)) count += 1;
    }
    return count;
  }

  private testCriteriaOnTag(criteria: MatchCriteria, m: TagMeta): boolean {
    if (criteria.type === 'frequency') {
      return frequencyMatchesMeta(criteria, m);
    }
    const synthetic: Rule = {
      id: 'preview',
      name: 'preview',
      enabled: true,
      priority: 0,
      match: criteria,
      action: 'hide',
      scopes: ['tag-pane'],
    };
    try {
      return RuleEngine.testTag(m.tag, synthetic);
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------------------
  // Tiny DOM helpers
  // -----------------------------------------------------------------

  private section(
    parent: HTMLElement,
    label: string,
    build: (sec: HTMLElement) => void,
  ): void {
    const sec = parent.createDiv({ cls: 'tcr-section' });
    sec.createDiv({ cls: 'tcr-section-label', text: label });
    build(sec);
  }

  private row(sec: HTMLElement): HTMLElement {
    return sec.createDiv({ cls: 'tcr-row' });
  }

  private label(row: HTMLElement, text: string): HTMLElement {
    return row.createDiv({ cls: 'tcr-label', text });
  }

  private control(row: HTMLElement): HTMLElement {
    return row.createDiv({ cls: 'tcr-control' });
  }

  private attachHelp(parent: HTMLElement, text: string): void {
    const ic = parent.createSpan({ cls: 'tcr-help-ic', text: '?' });
    const tip = ic.createDiv({ cls: 'tcr-tip' });
    tip.setText(text);
  }

  private makeToggle(
    parent: HTMLElement,
    initial: boolean,
    onChange: (next: boolean) => Promise<void> | void,
  ): HTMLElement {
    const t = parent.createDiv({ cls: 'tcr-toggle' });
    t.toggleClass('on', initial);
    t.addEventListener('click', (e) => {
      e.stopPropagation();
      const next = !t.hasClass('on');
      t.toggleClass('on', next);
      void onChange(next);
    });
    return t;
  }
}

// =================================================================
// Helpers
// =================================================================

function friendlyTypeLabel(t: MatchType): string {
  switch (t) {
    case 'regex':
      return 'Pattern match (regex)';
    case 'frequency':
      return 'Count threshold (frequency)';
    case 'list':
      return 'Specific tags (list)';
  }
}

function matchSummaryString(match: MatchCriteria): string {
  switch (match.type) {
    case 'regex':
      return match.pattern ? `matches /${match.pattern}/` : '(no pattern set)';
    case 'frequency': {
      const op = match.operator ?? '=';
      return `when count ${op} ${match.value ?? 0}`;
    }
    case 'list': {
      const list = match.list ?? [];
      if (list.length === 0) return '(no tags listed)';
      if (list.length <= 3) return list.map((t) => `\`${t}\``).join(', ');
      return `${list.length} tags: ${list
        .slice(0, 3)
        .map((t) => `\`${t}\``)
        .join(', ')}...`;
    }
  }
}

function blankCriteriaFor(type: MatchType): MatchCriteria {
  switch (type) {
    case 'regex':
      return { type: 'regex', pattern: '' };
    case 'frequency':
      return { type: 'frequency', operator: '<=', value: 1 };
    case 'list':
      return { type: 'list', list: [] };
  }
}

function frequencyMatchesMeta(criteria: MatchCriteria, m: TagMeta): boolean {
  if (criteria.type !== 'frequency') return false;
  const op = criteria.operator ?? '=';
  const v = criteria.value ?? 0;
  switch (op) {
    case '<':
      return m.count < v;
    case '<=':
      return m.count <= v;
    case '=':
      return m.count === v;
    case '>=':
      return m.count >= v;
    case '>':
      return m.count > v;
  }
}

async function confirmModal(
  app: App,
  title: string,
  message: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = new (class extends Modal {
      onOpen(): void {
        this.titleEl.setText(title);
        const body = this.contentEl.createDiv();
        body.createDiv({ text: message });
        const foot = this.contentEl.createDiv();
        foot.style.display = 'flex';
        foot.style.gap = '8px';
        foot.style.justifyContent = 'flex-end';
        foot.style.marginTop = '16px';
        const cancel = foot.createEl('button', { text: 'Cancel' });
        cancel.addEventListener('click', () => {
          resolve(false);
          this.close();
        });
        const ok = foot.createEl('button', {
          text: 'Delete',
          cls: 'mod-warning',
        });
        ok.addEventListener('click', () => {
          resolve(true);
          this.close();
        });
      }
      onClose(): void {
        this.contentEl.empty();
      }
    })(app);
    modal.open();
  });
}
