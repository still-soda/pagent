import { PAGENT_Z_INDEX } from './panel-position';

type PopoverHost = HTMLElement & {
  showPopover?: () => void;
  hidePopover?: () => void;
};

const HOST_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'fixed',
  inset: '0px',
  width: '100vw',
  height: '100vh',
  maxWidth: 'none',
  maxHeight: 'none',
  margin: '0px',
  padding: '0px',
  border: 'none',
  overflow: 'visible',
  display: 'block',
  pointerEvents: 'none',
  background: 'transparent',
  color: 'inherit',
  boxShadow: 'none',
};

export function applyTopLayerHostStyles(host: HTMLElement) {
  Object.assign(host.style, HOST_STYLE);
  host.style.setProperty('z-index', String(PAGENT_Z_INDEX), 'important');
}

export function topLayerParent(): Element {
  return document.fullscreenElement ?? document.documentElement;
}

export function placeHostLast(host: HTMLElement, parent = topLayerParent()) {
  if (host.parentElement !== parent || parent.lastElementChild !== host) {
    parent.append(host);
  }
}

export function showAsManualPopover(host: HTMLElement): boolean {
  const popover = host as PopoverHost;
  if (typeof popover.showPopover !== 'function') return false;
  try {
    host.setAttribute('popover', 'manual');
    if (!host.matches(':popover-open')) popover.showPopover();
    return host.matches(':popover-open');
  } catch {
    return false;
  }
}

export function promoteHostToTopLayer(host: HTMLElement) {
  applyTopLayerHostStyles(host);
  placeHostLast(host);
  showAsManualPopover(host);
}

export function attachTopLayer(host: HTMLElement): () => void {
  let placing = false;
  let observedParent: Element | null = null;

  const observer = new MutationObserver(() => {
    const parent = topLayerParent();
    if (host.parentElement !== parent || parent.lastElementChild !== host) place();
  });

  const observeParent = (parent: Element) => {
    if (observedParent === parent) return;
    observer.disconnect();
    observer.observe(parent, { childList: true });
    observedParent = parent;
  };

  const place = () => {
    if (placing || !host.isConnected) return;
    placing = true;
    try {
      observeParent(topLayerParent());
      promoteHostToTopLayer(host);
    } finally {
      placing = false;
    }
  };

  place();

  const onFullscreen = () => place();
  const onToggle = (event: Event) => {
    const next = 'newState' in event ? String((event as { newState?: string }).newState) : '';
    if (next === 'closed') queueMicrotask(place);
  };

  document.addEventListener('fullscreenchange', onFullscreen);
  host.addEventListener('toggle', onToggle);

  return () => {
    observer.disconnect();
    document.removeEventListener('fullscreenchange', onFullscreen);
    host.removeEventListener('toggle', onToggle);
  };
}
