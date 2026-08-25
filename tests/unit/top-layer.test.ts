import { describe, expect, it, afterEach } from 'vitest';
import { applyTopLayerHostStyles, placeHostLast, promoteHostToTopLayer } from '@/shared/extension/top-layer';

describe('top-layer', () => {
  afterEach(() => {
    document.querySelectorAll('pagent-root').forEach((node) => node.remove());
  });

  it('keeps the host as the last child after later overlays appear', () => {
    const host = document.createElement('pagent-root');
    const overlay = document.createElement('div');
    overlay.style.zIndex = '2147483647';
    document.documentElement.append(host, overlay);

    placeHostLast(host);

    expect(document.documentElement.lastElementChild).toBe(host);
  });

  it('applies full-viewport host styles that beat popover UA defaults', () => {
    const host = document.createElement('pagent-root');
    applyTopLayerHostStyles(host);
    expect(host.style.position).toBe('fixed');
    expect(host.style.inset).toBe('0px');
    expect(host.style.width).toBe('100vw');
    expect(host.style.background).toBe('transparent');
    expect(host.style.pointerEvents).toBe('none');
    expect(host.style.getPropertyPriority('z-index')).toBe('important');
  });

  it('promotes a connected host without throwing when popover is unavailable', () => {
    const host = document.createElement('pagent-root');
    document.documentElement.append(host);
    expect(() => promoteHostToTopLayer(host)).not.toThrow();
    expect(document.documentElement.lastElementChild).toBe(host);
  });
});
