import './style.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { AgentApp } from '@/features/agent/ui/components/AgentApp';
import { CHANNEL } from '@/shared/contracts/channel';
import { rpc } from '@/shared/extension/rpc-client';
import type { SessionContext } from '@/shared/contracts/session';
import { toErrorMessage } from '@/shared/contracts/errors';
import { pageObserver } from '@/features/page/observer';
import { installPageSelectionTracker } from '@/features/page/selection';
import { attachTopLayer } from '@/shared/extension/top-layer';
import { isTogglePanelHotkey } from '@/shared/extension/hotkey';
import { installPageNavigationEvents, PAGE_NAVIGATION_EVENT } from '@/features/page/navigation';
import { handleContentCommand } from '@/features/page/content-command-handler';
import { dispatchUiCommand, uiEvents } from '@/features/page/ui-events';

function persistPanelOpen(open: boolean) {
  void rpc('session.setUi', { panelOpen: open });
}

function ContentShell() {
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  const lastToggleAt = useRef(0);
  openRef.current = open;

  const setOpenAndPersist = useCallback((next: boolean) => {
    setOpen(next);
    persistPanelOpen(next);
  }, []);

  const togglePanel = useCallback(() => {
    const now = Date.now();
    if (now - lastToggleAt.current < 120) return;
    lastToggleAt.current = now;
    setOpenAndPersist(!openRef.current);
  }, [setOpenAndPersist]);

  useEffect(() => {
    void rpc('session.context', { url: location.href }).then((value) => {
      const context = value as SessionContext;
      if (context.panelOpen || context.running) setOpen(true);
    });
    const onToggle = () => togglePanel();
    const onOpen = () => setOpenAndPersist(true);
    const onKeyDown = (event: Event) => {
      if (!(event instanceof KeyboardEvent) || !isTogglePanelHotkey(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      togglePanel();
    };
    const bump = () => pageObserver.bump();
    const shadowRoot = document.querySelector('pagent-root')?.shadowRoot;
    uiEvents.addEventListener('toggle', onToggle);
    uiEvents.addEventListener('open', onOpen);
    window.addEventListener('keydown', onKeyDown, true);
    shadowRoot?.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('popstate', bump);
    window.addEventListener('hashchange', bump);
    window.addEventListener(PAGE_NAVIGATION_EVENT, bump);
    return () => {
      uiEvents.removeEventListener('toggle', onToggle);
      uiEvents.removeEventListener('open', onOpen);
      window.removeEventListener('keydown', onKeyDown, true);
      shadowRoot?.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('popstate', bump);
      window.removeEventListener('hashchange', bump);
      window.removeEventListener(PAGE_NAVIGATION_EVENT, bump);
    };
  }, [setOpenAndPersist, togglePanel]);

  return <AgentApp open={open} onOpenChange={setOpenAndPersist} />;
}

export default defineContentScript({
  matches: ['https://*/*', 'http://*/*'],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',

  async main(ctx) {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.channel !== CHANNEL) return;
      if (message.kind === 'ping') {
        sendResponse({ ok: true });
        return;
      }
      if (message.kind !== 'content-command') return;
      Promise.resolve(handleContentCommand(message.name, message.payload ?? {}))
        .then((result) => {
          if (result && typeof result === 'object' && 'uiCommand' in result) {
            dispatchUiCommand(result.uiCommand as 'ui.toggle' | 'ui.open');
            sendResponse({ ok: true, result: { ok: true } });
            return;
          }
          sendResponse({ ok: true, result });
        })
        .catch((error) =>
          sendResponse({
            ok: false,
            error: { code: 'content_error', message: toErrorMessage(error) },
          }),
        );
      return true;
    });

    installPageSelectionTracker();
    installPageNavigationEvents();

    const ui = await createShadowRootUi(ctx, {
      name: 'pagent-root',
      position: 'overlay',
      alignment: 'top-left',
      zIndex: 2147483647,
      isolateEvents: true,
      onMount(container, _shadow, shadowHost) {
        const releaseTopLayer = attachTopLayer(shadowHost);
        Object.assign(container.style, {
          pointerEvents: 'none',
          background: 'transparent',
        });
        const app = document.createElement('div');
        app.dataset.pagentUi = 'true';
        Object.assign(app.style, {
          pointerEvents: 'none',
          background: 'transparent',
        });
        container.append(app);
        const root = ReactDOM.createRoot(app);
        root.render(<ContentShell />);
        return {
          unmount() {
            releaseTopLayer();
            root.unmount();
          },
        };
      },
      onRemove(mounted) {
        mounted?.unmount();
      },
    });

    ui.mount();
  },
});
