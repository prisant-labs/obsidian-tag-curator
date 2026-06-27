/**
 * Keyboard accessibility helpers for the non-<button> controls Tag Curator
 * builds from divs, spans, and anchors for layout reasons (tabs, toggles, cards,
 * sortable headers, filter chips, clickable cells). A plain <button> is
 * keyboard-operable for free; these helpers give the same operability to the
 * elements that cannot be one.
 */

/**
 * Make an element behave like a button for keyboard users: focusable, and
 * activated by Enter or Space as well as by click. Pass the same handler you
 * would give to a click listener; it receives the originating event (a
 * MouseEvent on click, a KeyboardEvent on Enter/Space), so `preventDefault` and
 * `stopPropagation` work on either path.
 */
export function makeActivatable(
  el: HTMLElement,
  handler: (evt: Event) => void,
  opts: { role?: string; tabIndex?: number; ariaLabel?: string } = {},
): void {
  el.setAttribute('role', opts.role ?? 'button');
  el.tabIndex = opts.tabIndex ?? 0;
  if (opts.ariaLabel) el.setAttribute('aria-label', opts.ariaLabel);
  el.addEventListener('click', handler);
  el.addEventListener('keydown', (evt: KeyboardEvent) => {
    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault();
      handler(evt);
    }
  });
}

/**
 * Reflect a two-state control's on/off for assistive tech. Use on elements given
 * `role="switch"` (the toggle pills); call once on build and again whenever the
 * state flips.
 */
export function setSwitchState(el: HTMLElement, on: boolean): void {
  el.setAttribute('aria-checked', on ? 'true' : 'false');
}
