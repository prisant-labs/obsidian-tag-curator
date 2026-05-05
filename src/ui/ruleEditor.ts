/**
 * Rule editor UI for creating and editing custom rules
 */

import { Modal, App, Setting } from 'obsidian';
import { Rule, MatchCriteria } from '../types';
import { RuleEngine } from '../engine/ruleEngine';
import TagCuratorPlugin from '../main';

export class RuleEditorModal extends Modal {
  plugin: TagCuratorPlugin;
  rule: Rule;
  onSave: (rule: Rule) => Promise<void>;
  isNew: boolean;

  constructor(
    app: App,
    plugin: TagCuratorPlugin,
    rule?: Rule,
    onSave?: (rule: Rule) => Promise<void>
  ) {
    super(app);
    this.plugin = plugin;
    this.isNew = !rule;
    this.rule = rule || this.createNewRule();
    this.onSave = onSave || (async () => { return; });
  }

  private createNewRule(): Rule {
    return {
      id: `rule-${Date.now()}`,
      name: 'New Rule',
      enabled: true,
      priority: 50,
      match: {
        type: 'regex',
        pattern: '',
      },
      action: 'hide',
      scopes: ['tag-pane'],
    };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', {
      text: this.isNew ? 'Create Rule' : 'Edit Rule',
    });

    this.buildForm(contentEl);
  }

  private buildForm(contentEl: HTMLElement) {
    const form = contentEl.createDiv({ cls: 'tag-curator-rule-form' });

    // Name
    new Setting(form)
      .setName('Rule Name')
      .setDesc('A descriptive name for this rule')
      .addText(text => {
        text
          .setValue(this.rule.name)
          .onChange(value => {
            this.rule.name = value;
          });
      });

    // Priority
    new Setting(form)
      .setName('Priority')
      .setDesc('Higher priority rules are evaluated last (last match wins)')
      .addSlider(slider => {
        slider
          .setLimits(0, 100, 5)
          .setValue(this.rule.priority)
          .onChange(value => {
            this.rule.priority = value;
          });
      });

    // Match type
    new Setting(form)
      .setName('Match Type')
      .setDesc('How to identify tags to apply this rule to')
      .addDropdown(dropdown => {
        dropdown
          .addOption('regex', 'Regex Pattern')
          .addOption('frequency', 'Frequency (count)')
          .addOption('list', 'Explicit List')
          .setValue(this.rule.match.type)
          .onChange(value => {
            this.rule.match.type = value as any;
            this.onOpen(); // Rebuild form to show appropriate inputs
          });
      });

    // Match criteria - dynamic based on type
    this.buildMatchCriteria(form);

    // Notes
    new Setting(form)
      .setName('Notes')
      .setDesc('Optional comment about this rule')
      .addTextArea(text => {
        text
          .setValue(this.rule.notes || '')
          .onChange(value => {
            this.rule.notes = value;
          });
      });

    // Test field
    new Setting(form)
      .setName('Test Tag')
      .setDesc('Type a tag to see if this rule would match')
      .addText(text => {
        text
          .setPlaceholder('#my-tag')
          .onChange(value => {
            const tag = value.startsWith('#') ? value.slice(1) : value;
            const matches = RuleEngine.testTag(tag, this.rule);
            const result = form.querySelector('.test-result');
            if (result) {
              result.textContent = matches ? 'Would match!' : 'No match';
              result.className = `test-result ${matches ? 'match' : 'no-match'}`;
            }
          });
      });

    form.createDiv({
      cls: 'test-result no-match',
      text: 'No match',
    });

    // Enabled toggle
    new Setting(form)
      .setName('Enabled')
      .setDesc('Turn this rule on or off')
      .addToggle(toggle => {
        toggle
          .setValue(this.rule.enabled)
          .onChange(value => {
            this.rule.enabled = value;
          });
      });

    // Save button
    new Setting(form)
      .addButton(btn =>
        btn
          .setButtonText('Save Rule')
          .setCta()
          .onClick(async () => {
            await this.onSave(this.rule);
            this.close();
          })
      )
      .addButton(btn =>
        btn
          .setButtonText('Cancel')
          .onClick(() => this.close())
      );
  }

  private buildMatchCriteria(form: HTMLElement) {
    const section = form.createDiv({ cls: 'match-criteria-section' });
    section.createEl('h3', { text: 'Match Criteria' });

    switch (this.rule.match.type) {
      case 'regex':
        this.buildRegexCriteria(section);
        break;
      case 'frequency':
        this.buildFrequencyCriteria(section);
        break;
      case 'list':
        this.buildListCriteria(section);
        break;
    }
  }

  private buildRegexCriteria(section: HTMLElement) {
    new Setting(section)
      .setName('Regex Pattern')
      .setDesc('JavaScript-compatible regular expression')
      .addText(text => {
        text
          .setPlaceholder('^#[0-9A-Fa-f]{3,8}$')
          .setValue(this.rule.match.pattern || '')
          .onChange(value => {
            this.rule.match.pattern = value;
          });
      });
  }

  private buildFrequencyCriteria(section: HTMLElement) {
    new Setting(section)
      .setName('Operator')
      .setDesc('How to compare tag count')
      .addDropdown(dropdown => {
        dropdown
          .addOption('<', 'Less than')
          .addOption('<=', 'Less than or equal')
          .addOption('=', 'Equal to')
          .addOption('>=', 'Greater than or equal')
          .addOption('>', 'Greater than')
          .setValue(this.rule.match.operator || '<=')
          .onChange(value => {
            this.rule.match.operator = value as MatchCriteria['operator'];
          });
      });

    new Setting(section)
      .setName('Count Value')
      .setDesc('Number of times tag appears')
      .addText(text => {
        text
          .setPlaceholder('1')
          .setValue(String(this.rule.match.value || 1))
          .onChange(value => {
            this.rule.match.value = parseInt(value) || 0;
          });
      });
  }

  private buildListCriteria(section: HTMLElement) {
    new Setting(section)
      .setName('Tags (one per line)')
      .setDesc('List of specific tags to match')
      .addTextArea(text => {
        const listStr = (this.rule.match.list || []).join('\n');
        text
          .setPlaceholder('#tag1\n#tag2\n#tag3')
          .setValue(listStr)
          .onChange(value => {
            this.rule.match.list = value
              .split('\n')
              .map(t => t.trim())
              .filter(t => t.length > 0)
              .map(t => (t.startsWith('#') ? t.slice(1) : t));
          });
      });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
