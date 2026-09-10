import { describe, expect, it } from 'vitest';
import {
  clampFabPosition,
  clampPanelPosition,
  clampPanelWidth,
  collapsedPosition,
  defaultPanelPosition,
  FAB_SIZE,
  isPanelDragTarget,
  loadPanelPosition,
  nextPanelResize,
  panelPositionFromFab,
  savePanelLayout,
} from '@/shared/extension/panel-position';

describe('panel position', () => {
  it('keeps the panel inside the viewport', () => {
    expect(
      clampPanelPosition({ x: -40, y: 900 }, { width: 400, height: 680 }, { width: 800, height: 700 }),
    ).toEqual({ x: 8, y: 12 });
  });

  it('defaults to the bottom-right corner', () => {
    expect(defaultPanelPosition({ width: 400, height: 680 }, { width: 1200, height: 800 })).toEqual({
      x: 780,
      y: 100,
    });
  });

  it('clamps a custom width to the allowed range', () => {
    expect(clampPanelWidth(400, { width: 1200 })).toBe(400);
    expect(clampPanelWidth(200, { width: 1200 })).toBe(320);
    expect(clampPanelWidth(900, { width: 800 })).toBe(720);
  });

  it('grows from the left edge without moving the right edge', () => {
    expect(
      nextPanelResize(
        'left',
        { pointerX: 800, width: 400, left: 800, top: 100 },
        750,
        680,
        { width: 1400, height: 900 },
      ),
    ).toEqual({ width: 450, position: { x: 750, y: 100 } });
  });

  it('grows from the right edge without moving the left edge', () => {
    expect(
      nextPanelResize(
        'right',
        { pointerX: 1200, width: 400, left: 800, top: 100 },
        1250,
        680,
        { width: 1400, height: 900 },
      ),
    ).toEqual({ width: 450, position: { x: 800, y: 100 } });
  });

  it('collapses the panel onto the orb at its bottom-right corner', () => {
    expect(
      collapsedPosition(
        { x: 780, y: 100 },
        { width: 400, height: 680 },
        { width: 1200, height: 800 },
      ),
    ).toEqual({ x: 780 + 400 - FAB_SIZE, y: 100 + 680 - FAB_SIZE });
  });

  it('keeps the default collapsed orb in the bottom-right corner', () => {
    const size = { width: 400, height: 680 };
    const viewport = { width: 1200, height: 800 };
    expect(collapsedPosition(defaultPanelPosition(size, viewport), size, viewport)).toEqual({
      x: viewport.width - FAB_SIZE - 20,
      y: viewport.height - FAB_SIZE - 20,
    });
  });

  it('moves the orb when the panel moves', () => {
    const size = { width: 400, height: 680 };
    const viewport = { width: 1400, height: 900 };
    const from = collapsedPosition({ x: 100, y: 80 }, size, viewport);
    const to = collapsedPosition({ x: 180, y: 120 }, size, viewport);
    expect(to).toEqual({ x: from.x + 80, y: from.y + 40 });
  });

  it('maps an orb drag back to a panel that still shares that corner', () => {
    const size = { width: 400, height: 680 };
    const fab = { x: 200, y: 300 };
    const panel = panelPositionFromFab(fab, size);
    expect(panel).toEqual({
      x: fab.x + FAB_SIZE - size.width,
      y: fab.y + FAB_SIZE - size.height,
    });
    expect(collapsedPosition(panel, size, { width: 2000, height: 2000 })).toEqual(fab);
  });

  it('keeps the orb inside the viewport', () => {
    expect(clampFabPosition({ x: -40, y: 900 }, { width: 800, height: 700 })).toEqual({
      x: 8,
      y: 700 - FAB_SIZE - 8,
    });
  });

  it('persists an off-screen panel so a dragged orb can be restored', () => {
    const key = 'pagent-panel-pos';
    const previous = sessionStorage.getItem(key);
    try {
      savePanelLayout({ x: -300, y: -500 }, 400);
      expect(loadPanelPosition()).toEqual({ x: -300, y: -500 });
    } finally {
      if (previous == null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, previous);
    }
  });

  it('does not start a drag from header buttons or resize handles', () => {
    const button = document.createElement('button');
    const bar = document.createElement('div');
    const handle = document.createElement('div');
    handle.setAttribute('data-panel-resize', 'left');
    bar.append(button);
    expect(isPanelDragTarget(button)).toBe(false);
    expect(isPanelDragTarget(handle)).toBe(false);
    expect(isPanelDragTarget(bar)).toBe(true);
  });
});
