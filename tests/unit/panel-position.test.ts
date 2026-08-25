import { describe, expect, it } from 'vitest';
import {
  clampPanelPosition,
  clampPanelWidth,
  defaultPanelPosition,
  isPanelDragTarget,
  nextPanelResize,
} from '../../lib/panel-position';

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
