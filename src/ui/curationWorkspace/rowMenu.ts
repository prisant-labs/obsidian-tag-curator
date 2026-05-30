/**
 * Per-row override menu and "why is this affected?" diagnostics (Phase 3B-1,
 * Step 4).
 *
 * The override actions (Always show / Always hide / Clear override) route
 * through TagActions.setVisibility, which writes a per-tag override (D-015) that
 * the rule engine resolves ahead of rules. The diagnostics consume
 * RuleEngine.resolveVisibility / getRuleAttribution only - no new engine logic
 * here, we just render the attribution chain the engine already computes.
 *
 * DOM behaviors (the obsidian Menu, the popover) are exercised in the Phase 11
 * manual TESTING matrix, not unit tests: the obsidian stub does not implement
 * Menu or a full DOM, so forcing a brittle DOM test would test the stub, not
 * the plugin.
 */
import { Menu, setIcon } from 'obsidian';
import { RuleEngine } from '../../engine/ruleEngine';
import { TagActions, VisibilityIntent } from '../tagList/tagActions';
import { TagListDiagnosticsHost } from './tagTableHost';

/**
 * Open the per-row override menu at the click position. Each override action
 * awaits the write and then refreshes; the settings onChange triggered by the
 * write also refreshes, but awaiting first keeps the UI honest if a write ever
 * slows down.
 */
export function openRowMenu(
  evt: MouseEvent,
  tag: string,
  actions: TagActions,
  host: TagListDiagnosticsHost,
): void {
  const menu = new Menu();

  const overrideItem = (
    title: string,
    icon: string,
    intent: VisibilityIntent,
  ): void => {
    menu.addItem((item) =>
      item
        .setTitle(title)
        .setIcon(icon)
        .onClick(async () => {
          await actions.setVisibility([tag], intent);
          host.requestRefresh();
        }),
    );
  };

  overrideItem('Always show', 'eye', 'show');
  overrideItem('Always hide', 'eye-off', 'hide');
  overrideItem('Clear override', 'rotate-ccw', 'clear');

  // Tag Wrangler delegation (D-016, optional): only offered when Tag Wrangler
  // is enabled. Reuses the tested TagActions.sendToTagWrangler dispatch (which
  // executes 'tag-wrangler:rename-tag'); no rename logic lives here. When Tag
  // Wrangler is absent the item is simply not shown.
  if (host.isPluginEnabled('tag-wrangler')) {
    menu.addSeparator();
    menu.addItem((item) =>
      item
        .setTitle('Rename with Tag Wrangler')
        .setIcon('pencil')
        .onClick(() => {
          actions.sendToTagWrangler([tag]);
        }),
    );
  }

  menu.addSeparator();
  menu.addItem((item) =>
    item
      .setTitle('Why is this affected?')
      .setIcon('help-circle')
      .onClick(() => showWhyAffected(evt, tag, host)),
  );

  menu.showAtMouseEvent(evt);
}

/**
 * Build the human explanation lines for a tag from the engine attribution.
 * Pure (no DOM) so the wording is easy to reason about and reuse.
 *
 * - An always-show / always-hide override is the sole, supreme reason.
 * - Otherwise the effective rule leads, with its human reason, and any further
 *   matching rules follow as the rest of the chain.
 * - No effective match means nothing is hiding the tag.
 */
export function whyAffectedLines(
  tag: string,
  host: TagListDiagnosticsHost,
): { heading: string; detail: string[] } {
  const meta = host.getMeta().get(tag);
  const attribution = RuleEngine.resolveVisibility(
    tag,
    meta,
    host.getActiveRules(),
    host.getSettings().overrides,
  );
  const eff = attribution.effective;

  if (!eff) {
    return {
      heading: 'Shown',
      detail: ['No rule or override affects this tag. It is shown everywhere.'],
    };
  }
  if (eff.overrideReason === 'always-show') {
    return {
      heading: 'Always shown by you',
      detail: [
        'You pinned this tag to always show. This safety-net override beats every rule.',
      ],
    };
  }
  if (eff.overrideReason === 'always-hide') {
    return {
      heading: 'Always hidden by you',
      detail: ['You pinned this tag to always hide. This override beats every rule.'],
    };
  }

  const detail: string[] = [`${eff.ruleName}: ${eff.reason} (the effective rule).`];
  const rest = attribution.allMatches.slice(1);
  if (rest.length > 0) {
    detail.push('Also matched by:');
    for (const m of rest) detail.push(`- ${m.ruleName}: ${m.reason}`);
  }
  return { heading: `Affected by ${eff.ruleName}`, detail };
}

/**
 * Render a small dismissible popover near the click point with the
 * why-affected explanation. Clicking anywhere outside (or pressing Escape)
 * closes it.
 */
function showWhyAffected(
  evt: MouseEvent,
  tag: string,
  host: TagListDiagnosticsHost,
): void {
  const { heading, detail } = whyAffectedLines(tag, host);

  const pop = document.body.createDiv({ cls: 'tct-why-pop' });
  const head = pop.createDiv({ cls: 'tct-why-head' });
  const headIcon = head.createSpan({ cls: 'tct-why-head-ic' });
  setIcon(headIcon, 'info');
  head.createSpan({ text: heading });
  const body = pop.createDiv({ cls: 'tct-why-body' });
  for (const line of detail) body.createDiv({ cls: 'tct-why-line', text: line });

  // Position near the click, then nudge back on-screen if it would overflow.
  pop.style.position = 'fixed';
  pop.style.left = `${evt.clientX}px`;
  pop.style.top = `${evt.clientY + 8}px`;
  const rect = pop.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    pop.style.left = `${Math.max(8, window.innerWidth - rect.width - 8)}px`;
  }
  if (rect.bottom > window.innerHeight) {
    pop.style.top = `${Math.max(8, evt.clientY - rect.height - 8)}px`;
  }

  const close = (): void => {
    pop.remove();
    document.removeEventListener('mousedown', onDocMouseDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
  };
  const onDocMouseDown = (e: MouseEvent): void => {
    if (!pop.contains(e.target as Node)) close();
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  // Defer wiring the outside-click listener so the click that opened the menu
  // does not immediately close the popover.
  window.setTimeout(() => {
    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('keydown', onKeyDown, true);
  }, 0);
}
