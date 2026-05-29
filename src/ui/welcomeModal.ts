/**
 * First-run welcome modal (D-008).
 *
 * Fires once on first enable when settings.seenWelcomeModal is false. Structure:
 *   - Header: state-aware ("Tag Curator is now enabled" + "Choose how to start")
 *   - Safety promises strip (left-aligned check rows, no centered chunks)
 *   - Two preset cards with toggles (default presets, can be untoggled before start)
 *   - Detected integrations as per-plugin cards with state pills + bullets
 *   - Footer: "Start curating" (primary) + "Start in preview mode" (secondary)
 *
 * Plugin integration detection: v0.1 ships a hardcoded card set; full detection
 * via app.plugins.enabledPlugins is B004 (v0.2). For v0.1 we DO detect known
 * integrations as a courtesy so the cards reflect reality where cheap.
 */
import { App, Modal } from 'obsidian';
import TagCuratorPlugin from '../main';

type Choice = 'curating' | 'preview';

interface IntegrationDescriptor {
  id: string;
  name: string;
  bullets: string[];
}

const INTEGRATIONS: IntegrationDescriptor[] = [
  {
    id: 'tag-wrangler',
    name: 'Tag Wrangler',
    bullets: [
      'Right-click renames in the tag pane stay alongside Tag Curator actions.',
      'The "Send to Tag Wrangler" bulk action in the tag list delegates renaming to Tag Wrangler so files stay safe.',
    ],
  },
  {
    id: 'notebook-navigator',
    name: 'Notebook Navigator',
    bullets: [
      'Hidden tags stay hidden in the Notebook Navigator tag tree.',
      'Cascade-respect: filters set there honor Tag Curator hide rules.',
    ],
  },
  {
    id: 'colored-tags-wrangler',
    name: 'Colored Tags Wrangler',
    bullets: [
      'If you install it, Tag Curator will defer color decisions to it (v0.2).',
    ],
  },
];

export class WelcomeModal extends Modal {
  constructor(
    app: App,
    private plugin: TagCuratorPlugin,
    private onChoice: (choice: Choice) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass('tag-curator-welcome-modal');
    this.titleEl.detach(); // we render our own header
    const c = this.contentEl;
    c.empty();

    // Header
    const head = c.createDiv({ cls: 'tcw-head' });
    head.createDiv({ cls: 'tcw-eyebrow', text: 'Tag Curator is now enabled' });
    head.createEl('h3', { cls: 'tcw-title', text: 'Choose how to start' });
    head.createDiv({
      cls: 'tcw-subhead',
      text: 'Before any tag is curated, here is what you can expect.',
    });

    // Safety promises
    c.createDiv({ cls: 'tcw-section-label', text: 'Our safety promise' });
    const promises = c.createDiv({ cls: 'tcw-promises' });
    this.renderPromise(promises, 'Display-only.', 'It never edits your notes.');
    this.renderPromise(promises, 'File-safe.', 'No content is written to markdown.');
    this.renderPromise(promises, 'Fully reversible.', 'Disable Tag Curator and everything returns.');

    // Default presets (with live toggles)
    c.createDiv({
      cls: 'tcw-section-label',
      text: 'Tag Curator will start by hiding these noisy tags',
    });
    this.renderPresetCard(
      c,
      'hide-hex-codes',
      'Hide hex color codes',
      'Filters tags like #ffaa00 left over from CSS in web clippings.',
    );
    this.renderPresetCard(
      c,
      'hide-url-anchors',
      'Hide URL anchor fragments',
      'Filters tags like #section-3 or #top from URL fragments in clippings.',
    );
    const presetCaption = c.createDiv({ cls: 'tcw-section-caption' });
    presetCaption.setText(
      "Toggle off any preset you don't want to enable now. Change these any time in Settings > Presets.",
    );

    // Integrations
    c.createDiv({ cls: 'tcw-section-label', text: 'Integrations we detected' });
    for (const integ of INTEGRATIONS) {
      this.renderIntegrationCard(c, integ);
    }

    // Footer
    const foot = c.createDiv({ cls: 'tcw-foot' });
    const explainer = foot.createDiv({ cls: 'tcw-foot-explainer' });
    explainer.createEl('strong', { text: 'Preview mode ' });
    explainer.appendText(
      'flags matched tags so you can see what would be hidden, without anything actually disappearing. Recommended for the first 24 hours.',
    );
    const previewBtn = foot.createEl('button', {
      cls: 'tcw-btn',
      text: 'Start in preview mode',
    });
    previewBtn.addEventListener('click', () => this.finish('preview'));
    const startBtn = foot.createEl('button', {
      cls: 'tcw-btn tcw-btn-accent',
      text: 'Start curating',
    });
    startBtn.addEventListener('click', () => this.finish('curating'));
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderPromise(parent: HTMLElement, lead: string, rest: string): void {
    const row = parent.createDiv({ cls: 'tcw-promise-row' });
    row.createSpan({ cls: 'tcw-promise-check', text: '✓' });
    const body = row.createDiv();
    body.createEl('strong', { text: lead });
    body.appendText(' ' + rest);
  }

  private renderPresetCard(
    parent: HTMLElement,
    presetId: string,
    name: string,
    desc: string,
  ): void {
    const card = parent.createDiv({ cls: 'tcw-preset' });
    const enabled = this.plugin.settingsManager
      .get()
      .enabledPresets.includes(presetId);
    const toggleWrap = card.createDiv({ cls: 'tcw-toggle' });
    toggleWrap.toggleClass('on', enabled);
    toggleWrap.addEventListener('click', () => {
      const isOn = toggleWrap.hasClass('on');
      toggleWrap.toggleClass('on', !isOn);
      void this.plugin.settingsManager.setPresetEnabled(presetId, !isOn);
    });
    const body = card.createDiv({ cls: 'tcw-preset-body' });
    body.createDiv({ cls: 'tcw-preset-name', text: name });
    body.createDiv({ cls: 'tcw-preset-desc', text: desc });
  }

  private renderIntegrationCard(
    parent: HTMLElement,
    integ: IntegrationDescriptor,
  ): void {
    const state = this.detectPluginState(integ.id);
    const card = parent.createDiv({ cls: 'tcw-integ' });
    if (state === 'missing') card.addClass('tcw-integ-muted');
    const head = card.createDiv({ cls: 'tcw-integ-head' });
    head.createDiv({ cls: 'tcw-integ-name', text: integ.name });
    const pill = head.createSpan({ cls: 'tcw-integ-pill' });
    if (state === 'enabled') {
      pill.addClass('tcw-integ-pill-enabled');
      pill.setText('Enabled');
    } else if (state === 'installed') {
      pill.addClass('tcw-integ-pill-installed');
      pill.setText('Installed');
    } else {
      pill.addClass('tcw-integ-pill-missing');
      pill.setText('Not installed');
    }
    const list = card.createEl('ul');
    for (const bullet of integ.bullets) {
      list.createEl('li', { text: bullet });
    }
  }

  private detectPluginState(pluginId: string): 'enabled' | 'installed' | 'missing' {
    // app.plugins is not in the official Obsidian types; access defensively.
    const plugins = (this.app as unknown as {
      plugins?: {
        enabledPlugins?: Set<string>;
        manifests?: Record<string, unknown>;
      };
    }).plugins;
    if (!plugins) return 'missing';
    if (plugins.enabledPlugins?.has(pluginId)) return 'enabled';
    if (plugins.manifests && pluginId in plugins.manifests) return 'installed';
    return 'missing';
  }

  private async finish(choice: Choice): Promise<void> {
    await this.plugin.settingsManager.setSeenWelcomeModal(true);
    if (choice === 'preview') {
      await this.plugin.settingsManager.setPreviewMode(true);
    }
    this.onChoice(choice);
    this.close();
  }
}
