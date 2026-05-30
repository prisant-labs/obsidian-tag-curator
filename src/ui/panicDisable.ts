// Tag Curator owns two decoration namespaces: the core tag pane
// (tag-curator-*) and the Notebook Navigator tag tree (tc-nn-*). Panic disable
// must sweep both, so a stale NN scope cannot leave hidden rows behind after the
// user hits the panic command (Phase 5B).
const CLASSES = ['tag-curator-hidden', 'tag-curator-flagged', 'tc-nn-hidden', 'tc-nn-flagged'];
const ATTRS = ['data-tag-curator-rule', 'data-tc-nn-rule'];

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
