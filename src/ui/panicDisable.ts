const CLASSES = ['tag-curator-hidden', 'tag-curator-flagged'];
const ATTR = 'data-tag-curator-rule';

export function panicCleanup(doc: Document): void {
  for (const cls of CLASSES) {
    const nodes = doc.querySelectorAll<HTMLElement>(`.${cls}`);
    for (const node of Array.from(nodes)) {
      node.classList.remove(cls);
      node.removeAttribute('aria-hidden');
      node.removeAttribute(ATTR);
    }
  }
  const attributed = doc.querySelectorAll<HTMLElement>(`[${ATTR}]`);
  for (const node of Array.from(attributed)) {
    node.removeAttribute(ATTR);
    node.removeAttribute('aria-hidden');
  }
}
