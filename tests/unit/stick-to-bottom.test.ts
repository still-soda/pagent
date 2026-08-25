import { describe, expect, it } from 'vitest';
import { isScrolledToBottom, nextStickPinned } from '@/features/agent/ui/hooks/useStickToBottom';

describe('isScrolledToBottom', () => {
  it('treats a near-bottom scroller as pinned', () => {
    expect(
      isScrolledToBottom({ scrollHeight: 800, scrollTop: 760, clientHeight: 40 }, 48),
    ).toBe(true);
  });

  it('unpins when the user scrolls away from the bottom', () => {
    expect(
      isScrolledToBottom({ scrollHeight: 800, scrollTop: 120, clientHeight: 400 }, 48),
    ).toBe(false);
  });
});

describe('nextStickPinned', () => {
  it('does not unpin when content grows under a pinned scroller', () => {
    expect(
      nextStickPinned({
        pinned: true,
        atBottom: false,
        scrollTop: 400,
        lastScrollTop: 400,
        heightChanged: true,
      }),
    ).toBe(true);
  });

  it('unpins only when the user scrolls up', () => {
    expect(
      nextStickPinned({
        pinned: true,
        atBottom: false,
        scrollTop: 120,
        lastScrollTop: 400,
        heightChanged: false,
      }),
    ).toBe(false);
  });

  it('re-pins when the user returns to the bottom', () => {
    expect(
      nextStickPinned({
        pinned: false,
        atBottom: true,
        scrollTop: 760,
        lastScrollTop: 120,
        heightChanged: false,
      }),
    ).toBe(true);
  });
});
