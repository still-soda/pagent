import { useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { useAgentSession } from '../../hooks/useAgentSession';
import {
  retainPageSelectionOnPointerDown,
  restoreRememberedSelection,
} from '../../entrypoints/content/selection';
import {
  clampPanelPosition,
  clampPanelWidth,
  isPanelDragTarget,
  loadPanelPosition,
  loadPanelWidth,
  nextPanelResize,
  panelSize,
  savePanelLayout,
  type PanelPosition,
  type PanelResizeEdge,
} from '../../lib/panel-position';
import { applyShadowTheme } from '../../lib/theme';
import { AgentPanel } from './AgentPanel';

export function AgentApp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const session = useAgentSession();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const resizeRef = useRef<{
    edge: PanelResizeEdge;
    pointerX: number;
    width: number;
    left: number;
    top: number;
  } | null>(null);
  const positionRef = useRef<PanelPosition>(loadPanelPosition());
  const widthRef = useRef(loadPanelWidth());
  const [position, setPosition] = useState<PanelPosition>(positionRef.current);
  const [width, setWidth] = useState(widthRef.current);
  const [manipulating, setManipulating] = useState(false);

  const updatePosition = (next: PanelPosition) => {
    positionRef.current = next;
    setPosition(next);
  };

  const updateWidth = (next: number) => {
    widthRef.current = next;
    setWidth(next);
  };

  const persistLayout = () => {
    savePanelLayout(positionRef.current, widthRef.current);
  };

  useLayoutEffect(() => {
    applyShadowTheme(rootRef.current, session.themeClass);
  }, [session.themeClass]);

  const restoredRef = useRef(false);
  const attachKeyRef = useRef(session.attachKey);
  useLayoutEffect(() => {
    if (!session.ready || !session.restorePanel) return;
    const attached = session.attachKey !== attachKeyRef.current;
    attachKeyRef.current = session.attachKey;
    if (restoredRef.current && !attached) return;
    restoredRef.current = true;
    onOpenChange(true);
  }, [session.ready, session.restorePanel, session.attachKey, onOpenChange]);

  useLayoutEffect(() => {
    if (session.agentActive && !session.workingOnThisPage) onOpenChange(false);
  }, [session.agentActive, session.workingOnThisPage, onOpenChange]);

  useLayoutEffect(() => {
    const clampToViewport = () => {
      const nextWidth = clampPanelWidth(widthRef.current);
      const next = clampPanelPosition(
        positionRef.current,
        panelSize(nextWidth),
      );
      updateWidth(nextWidth);
      updatePosition(next);
      savePanelLayout(next, nextWidth);
    };
    clampToViewport();
    window.addEventListener('resize', clampToViewport);
    return () => window.removeEventListener('resize', clampToViewport);
  }, [open]);

  useLayoutEffect(() => {
    const onMove = (event: PointerEvent) => {
      const resize = resizeRef.current;
      if (resize) {
        const size = panelRef.current?.getBoundingClientRect();
        const next = nextPanelResize(
          resize.edge,
          resize,
          event.clientX,
          size?.height ?? panelSize(widthRef.current).height,
        );
        updateWidth(next.width);
        updatePosition(next.position);
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      const size = panelRef.current?.getBoundingClientRect();
      updatePosition(
        clampPanelPosition(
          { x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY },
          { width: widthRef.current, height: size?.height ?? panelSize(widthRef.current).height },
        ),
      );
    };
    const onUp = () => {
      if (!dragRef.current && !resizeRef.current) return;
      dragRef.current = null;
      resizeRef.current = null;
      setManipulating(false);
      persistLayout();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const onHeaderPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !isPanelDragTarget(event.target)) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    dragRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    setManipulating(true);
  };

  const onResizePointerDown = (edge: PanelResizeEdge) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = {
      edge,
      pointerX: event.clientX,
      width: widthRef.current,
      left: positionRef.current.x,
      top: positionRef.current.y,
    };
    setManipulating(true);
  };

  const closedPosition = {
    x: Math.max(20, window.innerWidth - 76),
    y: Math.max(20, window.innerHeight - 76),
  };
  const height = panelSize(width).height;

  return (
    <div ref={rootRef} className={`${session.themeClass} pointer-events-none`}>
      <div className="pointer-events-none fixed inset-0">
        <div
          ref={panelRef}
          className={`pagent-morph-shell pointer-events-auto absolute ${
            open ? 'is-open' : ''
          } ${manipulating ? 'is-manipulating' : ''}`}
          style={{
            left: open ? position.x : closedPosition.x,
            top: open ? position.y : closedPosition.y,
            width: open ? width : 56,
            height: open ? height : 56,
          }}
          onPointerDown={retainPageSelectionOnPointerDown}
          onMouseDown={retainPageSelectionOnPointerDown}
          onPointerUp={(event) => restoreRememberedSelection(event)}
        >
          <div
            className="pagent-panel-stage"
            aria-hidden={!open}
            inert={!open}
          >
            <div
              data-panel-resize="left"
              className="pagent-resize pagent-resize-left"
              role="separator"
              aria-orientation="vertical"
              aria-label="向左调整面板宽度"
              onPointerDown={onResizePointerDown('left')}
            />
            <div
              data-panel-resize="right"
              className="pagent-resize pagent-resize-right"
              role="separator"
              aria-orientation="vertical"
              aria-label="向右调整面板宽度"
              onPointerDown={onResizePointerDown('right')}
            />
            <AgentPanel
              settings={session.settings}
              messages={session.messages}
              tasks={session.tasks}
              running={session.running}
              workingOnThisPage={session.workingOnThisPage}
              thinking={session.thinking}
              error={session.error}
              page={session.page}
              conversations={session.conversations}
              activeConversationId={session.activeId}
              onSelectConversation={session.selectConversation}
              onCreateConversation={session.createConversation}
              onCloseConversation={session.closeConversation}
              view={session.view}
              onViewChange={session.setView}
              onClose={() => onOpenChange(false)}
              onSubmit={(prompt, context) => void session.send(prompt, context)}
              onStop={() => void session.stop()}
              onClear={session.clear}
              onClearSelection={session.clearSelection}
              onSettingsChange={session.setSettings}
              onHeaderPointerDown={onHeaderPointerDown}
            />
          </div>
          <button
            type="button"
            className={`pagent-fab ${
              session.agentActive ? 'is-working' : ''
            }`}
            onClick={() => onOpenChange(true)}
            tabIndex={open ? -1 : 0}
            aria-hidden={open}
            aria-label={session.agentActive ? '打开 Pagent，Agent Active' : '打开 Pagent'}
          >
            {session.agentActive ? <span className="pagent-fab-halo" aria-hidden /> : null}
            <span className="pagent-fab-face">
              <Sparkles className="size-6" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
