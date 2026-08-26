import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

export const STICK_TO_BOTTOM_THRESHOLD = 48;

export function isScrolledToBottom(
  element: Pick<HTMLElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'>,
  threshold = STICK_TO_BOTTOM_THRESHOLD,
): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

export function nextStickPinned(input: {
  pinned: boolean;
  atBottom: boolean;
  scrollTop: number;
  lastScrollTop: number;
  heightChanged: boolean;
}): boolean {
  if (input.heightChanged) return input.pinned;
  if (input.atBottom) return true;
  if (input.scrollTop < input.lastScrollTop) return false;
  return input.pinned;
}

export function useStickToBottom(options: { enabled?: boolean; resetKey?: string } = {}) {
  const { enabled = true, resetKey } = options;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const ignoringRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const lastHeightRef = useRef(0);

  const remember = (scroller: HTMLElement) => {
    lastScrollTopRef.current = scroller.scrollTop;
    lastHeightRef.current = scroller.scrollHeight;
  };

  const stick = () => {
    const scroller = scrollerRef.current;
    if (!scroller || !enabled || !pinnedRef.current) return;
    ignoringRef.current = true;
    scroller.scrollTop = scroller.scrollHeight;
    remember(scroller);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ignoringRef.current = false;
        remember(scroller);
      });
    });
  };

  useLayoutEffect(() => {
    pinnedRef.current = true;
    stick();
  }, [resetKey, enabled]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => stick());
    observer.observe(content);
    return () => observer.disconnect();
  }, [enabled]);

  const onScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (ignoringRef.current) {
      remember(scroller);
      return;
    }

    const heightChanged = scroller.scrollHeight !== lastHeightRef.current;
    const atBottom = isScrolledToBottom(scroller);
    const wasPinned = pinnedRef.current;
    pinnedRef.current = nextStickPinned({
      pinned: wasPinned,
      atBottom,
      scrollTop: scroller.scrollTop,
      lastScrollTop: lastScrollTopRef.current,
      heightChanged,
    });
    remember(scroller);

    if (heightChanged && pinnedRef.current) {
      stick();
      return;
    }
    if (!wasPinned && pinnedRef.current) stick();
  };

  const unpin = useCallback(() => {
    pinnedRef.current = false;
  }, []);

  return { scrollerRef, contentRef, onScroll, unpin };
}
