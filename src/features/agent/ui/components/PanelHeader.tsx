import type { PointerEvent } from 'react';

export function PanelHeader({
  activeTitle,
  workingOnThisPage,
  view,
  onClear,
  onViewChange,
  onMinimize,
  onHeaderPointerDown,
}: {
  activeTitle: string;
  workingOnThisPage: boolean;
  view: 'chat' | 'settings';
  onClear: () => void;
  onViewChange: (view: 'chat' | 'settings') => void;
  onMinimize: () => void;
  onHeaderPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className="flex h-10 shrink-0 cursor-grab items-center gap-1.5 border-b border-line px-2 select-none active:cursor-grabbing"
      onPointerDown={onHeaderPointerDown}
    >
      <span aria-hidden className="grid h-4 w-2.5 shrink-0 grid-cols-2 gap-[3px] text-ink-3">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} className="size-[3px] rounded-full bg-current" />
        ))}
      </span>
      <span
        className={`pagent-led ${workingOnThisPage ? 'is-on' : ''}`}
        title={workingOnThisPage ? 'Agent 正在此页面工作' : 'Agent 未在此页面工作'}
        aria-label={workingOnThisPage ? 'Agent 正在此页面工作' : 'Agent 未在此页面工作'}
      />
      <div className="min-w-0 flex-1 px-0.5">
        <span
          className="block truncate text-[13px] text-ink-2"
          title={activeTitle}
        >
          {activeTitle}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {[
          { label: '清空上下文', onClick: onClear, path: <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /> },
          {
            label: '设置',
            onClick: () => onViewChange(view === 'settings' ? 'chat' : 'settings'),
            pressed: view === 'settings',
            path: (
              <>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
              </>
            ),
          },
          {
            label: '最小化',
            onClick: onMinimize,
            path: <path d="M5 12h14" />,
          },
        ].map((action) => (
          <button
            key={action.label}
            type="button"
            aria-label={action.label}
            aria-pressed={'pressed' in action ? action.pressed : undefined}
            onClick={action.onClick}
            className={`flex size-6 items-center justify-center rounded-[6px] transition-colors duration-100 hover:bg-hover hover:text-ink-2 ${
              'pressed' in action && action.pressed ? 'bg-hover text-ink' : 'text-ink-3'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {action.path}
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
