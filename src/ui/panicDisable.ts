// Tag Curator owns three decoration namespaces: the core tag pane
// (tag-curator-*), the Notebook Navigator tag tree (tc-nn-*), and the
// Properties panel tag pills (tc-prop-*). Panic disable must sweep all of them,
// so a stale scope cannot leave hidden rows behind after the user hits the
// panic command (Phase 5B, Phase 6).
const CLASSES = [
  'tag-curator-hidden',
  'tag-curator-flagged',
  'tc-nn-hidden',
  'tc-nn-flagged',
  'tc-prop-hidden',
  'tc-prop-flagged',
];
const ATTRS = ['data-tag-curator-rule', 'data-tc-nn-rule', 'data-tc-prop-rule'];

export function panicCleanup(doc: Document): void {
  for (const cls of CLASSES) {
    const nodes = doc.querySelectorAll<HTMLElement>(`.${cls}`);
    for (const node of Array.from(nodes)) {
      node.classList.remove(cls);
      node.removeAttribute('aria-hidden');
    }
  }
  for (const attr of ATTRS) {
    const attributed = doc.querySelectorAll<HTMLElement>(`[${attr}]`);
    for (const node of Array.from(attributed)) {
      node.removeAttribute(attr);
      node.removeAttribute('aria-hidden');
    }
  }
}
