/**
 * Pure windowing helper for the virtualized tag table (Phase 3B-1).
 *
 * Given the scroll offset, a fixed row height, the viewport height, and the
 * total row count, compute the half-open index range [start, end) of rows that
 * should actually be rendered. Rows outside the range are represented only by a
 * sized spacer, so a 1500+ tag list stays smooth: we render the visible window
 * plus a small overscan buffer on each side (so a fast scroll does not flash
 * blank rows before the next paint).
 *
 * This is intentionally framework-free and DOM-free so it is trivially unit
 * tested. tagTable.ts owns the DOM: it reads scrollTop, calls this, and renders
 * rows[start..end) at the correct vertical offset.
 */
export function visibleRange(
  scrollTop: number,
  rowHeight: number,
  viewportHeight: number,
  total: number,
  overscan = 5,
): { start: number; end: number } {
  // Guard degenerate inputs: a zero/negative row height (unmeasured layout) or
  // an empty list yields an empty window anchored at the top, never NaN.
  if (rowHeight <= 0 || total <= 0) {
    return { start: 0, end: 0 };
  }

  const safeScroll = Math.max(0, scrollTop);
  const firstVisible = Math.floor(safeScroll / rowHeight);
  const visibleCount = Math.ceil(viewportHeight / rowHeight);

  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(total, firstVisible + visibleCount + overscan);

  return { start, end };
}
