import { describe, expect, it } from 'vitest';
import { visibleRange } from '../src/ui/curationWorkspace/visibleRange';

// visibleRange windows a virtual list: given the current scrollTop, a fixed
// rowHeight, the viewport height, and the total row count, it returns the
// [start, end) index range that should be rendered (end exclusive), padded by
// an overscan buffer and clamped to [0, total].

describe('visibleRange', () => {
  it('at the top of the list starts at 0 (no negative start from overscan)', () => {
    const { start, end } = visibleRange(0, 30, 300, 1000, 5);
    expect(start).toBe(0);
    // 300 / 30 = 10 visible rows, + 5 overscan below, end is exclusive.
    expect(end).toBe(15);
  });

  it('mid-scroll windows around the scroll offset with overscan on both sides', () => {
    // scrollTop 600 / 30 = first visible index 20.
    const { start, end } = visibleRange(600, 30, 300, 1000, 5);
    expect(start).toBe(15); // 20 - 5 overscan
    expect(end).toBe(35); // 20 + 10 visible + 5 overscan
  });

  it('clamps end to total when scrolled to the bottom', () => {
    // 1000 rows * 30 = 30000 total height; viewport 300 -> max scrollTop 29700.
    const { start, end } = visibleRange(29700, 30, 300, 1000, 5);
    expect(end).toBe(1000);
    // first visible 990 - 5 overscan = 985.
    expect(start).toBe(985);
  });

  it('returns the whole list when the viewport is larger than the content', () => {
    const { start, end } = visibleRange(0, 30, 5000, 10, 5);
    expect(start).toBe(0);
    expect(end).toBe(10);
  });

  it('returns an empty range for zero rows', () => {
    const { start, end } = visibleRange(0, 30, 300, 0, 5);
    expect(start).toBe(0);
    expect(end).toBe(0);
  });

  it('defaults overscan to 5 when omitted', () => {
    const explicit = visibleRange(600, 30, 300, 1000, 5);
    const defaulted = visibleRange(600, 30, 300, 1000);
    expect(defaulted).toEqual(explicit);
  });

  it('treats a non-positive rowHeight as an empty-at-top window (guards divide-by-zero)', () => {
    const { start, end } = visibleRange(120, 0, 300, 1000, 5);
    expect(start).toBe(0);
    expect(end).toBe(0);
  });
});
