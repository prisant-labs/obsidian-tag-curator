// @vitest-environment happy-dom

import { describe, it, expect, vi } from 'vitest';
import { makeActivatable, setSwitchState } from '../src/util/a11y';

describe('makeActivatable', () => {
  it('makes an element focusable with a button role by default', () => {
    const el = document.createElement('div');
    makeActivatable(el, () => {});
    expect(el.getAttribute('role')).toBe('button');
    expect(el.tabIndex).toBe(0);
  });

  it('accepts a role override (e.g. tab, switch)', () => {
    const el = document.createElement('div');
    makeActivatable(el, () => {}, { role: 'switch' });
    expect(el.getAttribute('role')).toBe('switch');
  });

  it('sets an aria-label when provided', () => {
    const el = document.createElement('div');
    makeActivatable(el, () => {}, { ariaLabel: 'Enable preset: Hide hex codes' });
    expect(el.getAttribute('aria-label')).toBe('Enable preset: Hide hex codes');
  });

  it('fires the handler on click, Enter, and Space', () => {
    const el = document.createElement('div');
    const fn = vi.fn();
    makeActivatable(el, fn);
    el.dispatchEvent(new MouseEvent('click'));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('ignores keys other than Enter and Space', () => {
    const el = document.createElement('div');
    const fn = vi.fn();
    makeActivatable(el, fn);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('setSwitchState', () => {
  it('reflects on/off as aria-checked', () => {
    const el = document.createElement('div');
    setSwitchState(el, true);
    expect(el.getAttribute('aria-checked')).toBe('true');
    setSwitchState(el, false);
    expect(el.getAttribute('aria-checked')).toBe('false');
  });
});
