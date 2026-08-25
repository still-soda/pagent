import './style.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { AgentApp } from '../../components/agent/AgentApp';
import { CHANNEL } from '../../lib/shared/channel';
import { rpc } from '../../lib/rpc-client';
import type { SessionContext } from '../../lib/shared/types';
import { toErrorMessage } from '../../lib/shared/errors';
import { pageObserver } from './observer';
import {
  clearElement,
  clickElement,
  dblclickElement,
  focusElement,
  highlight,
  hoverElement,
  pressKey,
  runNamedScript,
  scrollPage,
  selectOption,
  typeText,
  waitFor,
  dragElement,
} from './actions';
import { getRememberedSelection, installPageSelectionTracker } from './selection';
import { searchPageText } from './search';
import { getPageSource } from './source';
import { attachTopLayer } from '../../lib/top-layer';
import { isTogglePanelHotkey } from '../../lib/hotkey';
import type { NamedScript, SourceType } from '../../lib/shared/types';
import { installPageNavigationEvents, PAGE_NAVIGATION_EVENT } from '../../lib/page-navigation';

const uiEvents = new EventTarget();

function handleContentCommand(name: string, payload: Record<string, unknown>) {
  switch (name) {
    case 'ui.toggle':
      uiEvents.dispatchEvent(new CustomEvent('toggle'));
      return { ok: true };
    case 'ui.open':
      uiEvents.dispatchEvent(new CustomEvent('open'));
      return { ok: true };
    case 'dom.observe':
      return pageObserver.observe(document, Number(payload.maxElements ?? 140));
    case 'dom.search':
      return searchPageText(String(payload.query ?? ''), {
        caseSensitive: Boolean(payload.caseSensitive),
        maxResults: payload.maxResults as number | undefined,
      });
    case 'dom.click':
      return clickElement(String(payload.elementId), payload.revision as number | undefined);
    case 'dom.dblclick':
      return dblclickElement(String(payload.elementId), payload.revision as number | undefined);
    case 'dom.hover':
      return hoverElement(String(payload.elementId), payload.revision as number | undefined);
    case 'dom.focus':
      return focusElement(String(payload.elementId), payload.revision as number | undefined);
    case 'dom.highlight': {
      const el = pageObserver.getElement(
        String(payload.elementId),
        payload.revision as number | undefined,
      );
      highlight(el);
      return { ok: true };
    }
    case 'dom.type':
      return typeText(String(payload.elementId), String(payload.text ?? ''), {
        clear: Boolean(payload.clear),
        submit: Boolean(payload.submit),
        revision: payload.revision as number | undefined,
      });
    case 'dom.clear':
      return clearElement(String(payload.elementId), payload.revision as number | undefined);
    case 'dom.select':
      return selectOption(
        String(payload.elementId),
        String(payload.value ?? ''),
        payload.revision as number | undefined,
      );
    case 'dom.press':
      return pressKey(String(payload.key ?? 'Enter'));
    case 'dom.drag':
      return dragElement(
        String(payload.elementId),
        String(payload.targetId),
        payload.revision as number | undefined,
      );
    case 'dom.scroll':
      return scrollPage({
        elementId: payload.elementId ? String(payload.elementId) : undefined,
        direction: payload.direction as 'up' | 'down' | undefined,
        amount: payload.amount as number | undefined,
        revision: payload.revision as number | undefined,
      });
    case 'dom.wait':
      return waitFor({
        ms: payload.ms as number | undefined,
        text: payload.text as string | undefined,
        elementId: payload.elementId as string | undefined,
        urlIncludes: payload.urlIncludes as string | undefined,
      });
    case 'dom.script':
      return runNamedScript(payload.name as NamedScript);
    case 'page.info':
      return {
        url: location.href,
        title: document.title,
        selection: getRememberedSelection(),
        revision: pageObserver.revision,
      };
    case 'page.source':
      return getPageSource({
        type: payload.type as SourceType | undefined,
        grep: payload.grep ? String(payload.grep) : undefined,
        regex: payload.regex as boolean | undefined,
        caseSensitive: payload.caseSensitive as boolean | undefined,
        limit: payload.limit as number | undefined,
        offset: payload.offset as number | undefined,
      });
    default:
      throw new Error(`未知内容命令：${name}`);
  }
}

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
        .then((result) => sendResponse({ ok: true, result }))
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
