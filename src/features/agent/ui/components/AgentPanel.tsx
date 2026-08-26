import { useState } from 'react';
import type { PointerEvent } from 'react';
import LoadingState from '@/shared/ui/beautiful-ui/primitives/LoadingState';
import { SettingsPanel } from '@/features/settings/SettingsPanel';
import { useStickToBottom } from '../hooks/useStickToBottom';
import type { ChatMessage, TaskRow } from '@/shared/contracts/session-messages';
import type { AgentSettings } from '@/shared/contracts/settings';
import type { ObservedElement } from '@/shared/contracts/page';
import { PanelHeader } from './PanelHeader';
import { TabStrip } from './TabStrip';
import { HistoryDrawer } from './HistoryDrawer';
import { PageContext } from './PageContext';
import { AssistantMessage, hasAssistantOutput } from './AssistantMessage';
import { Composer } from './Composer';
import { FlowConfirmCard } from '@/features/teaching/ui/FlowConfirmCard';
import { CommandSavedAlert } from '@/features/teaching/ui/CommandSavedAlert';
import { isRecentConversation } from '@/features/agent/session/conversations';
import type { SavedCommand, TeachingSession } from '@/shared/contracts/teaching';

export function AgentPanel({
  settings,
  messages,
  tasks: _tasks,
  running,
  workingOnThisPage = running,
  thinking,
  error,
  page,
  view,
  conversations,
  closedTabIds,
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
  onCloseTab,
  onDeleteConversation,
  onViewChange,
  onClose,
  onSubmit,
  onStop,
  onClear,
  onClearSelection,
  onSettingsChange,
  onHeaderPointerDown,
  imageDataUrl,
  onMarkScreen,
  onRemoveImage,
  selectedElement,
  selectingElement,
  onSelectElement,
  onRemoveElement,
  teachingSession,
  teachingBusy,
  confirmedCommand,
  onStartTeaching,
  onCancelTeaching,
  onConfirmTeaching,
}: {
  settings: AgentSettings;
  messages: ChatMessage[];
  tasks: TaskRow[];
  running: boolean;
  workingOnThisPage?: boolean;
  thinking: string;
  error: string;
  page: { url: string; title: string; selection: string };
  conversations: Array<{ id: string; title: string; updatedAt?: number; running?: boolean }>;
  closedTabIds: ReadonlySet<string>;
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  onCreateConversation: () => void | Promise<void>;
  onCloseTab: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  view: 'chat' | 'settings';
  onViewChange: (view: 'chat' | 'settings') => void;
  onClose: () => void;
  onSubmit: (prompt: string, context?: string, imageDataUrl?: string) => void;
  onStop: () => void;
  onClear: () => void;
  onClearSelection: () => void;
  onSettingsChange: (settings: AgentSettings) => void;
  onHeaderPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  imageDataUrl?: string;
  onMarkScreen: () => void;
  onRemoveImage: () => void;
  selectedElement?: ObservedElement;
  selectingElement: boolean;
  onSelectElement: () => void;
  onRemoveElement: () => void;
  teachingSession?: TeachingSession | null;
  teachingBusy?: boolean;
  confirmedCommand?: SavedCommand | null;
  onStartTeaching: () => void;
  onCancelTeaching: () => void;
  onConfirmTeaching: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const lastUserId = [...messages].reverse().find((message) => message.role === 'user')?.id;
  const { scrollerRef, contentRef, onScroll } = useStickToBottom({
    enabled: view === 'chat' && !historyOpen,
    resetKey: `${activeConversationId}:${lastUserId ?? ''}:${running}:${thinking}`,
  });
  const activeTitle =
    conversations.find((item) => item.id === activeConversationId)?.title ?? '会话';

  // 标签页只展示最近 3h 内活跃（且未被关闭）的会话 + 当前会话；其余保留在历史抽屉中
  const tabs = conversations.filter(
    (item) =>
      (isRecentConversation(item) && !closedTabIds.has(item.id)) ||
      item.id === activeConversationId,
  );

  const handleDeleteConversation = (id: string) => {
    const target = conversations.find((item) => item.id === id);
    if (target?.running) onStop();
    onDeleteConversation(id);
  };

  return (
    <div className="pagent-window relative flex h-[min(680px,calc(100vh-48px))] w-full flex-col self-start">
      <PanelHeader
        activeTitle={activeTitle}
        workingOnThisPage={workingOnThisPage}
        view={view}
        onClear={onClear}
        onViewChange={onViewChange}
        onMinimize={onClose}
        onHeaderPointerDown={onHeaderPointerDown}
      />

      <TabStrip
        conversations={tabs}
        activeId={activeConversationId}
        onSelect={onSelectConversation}
        onClose={onCloseTab}
        onCreate={() => {
          setHistoryOpen(false);
          return onCreateConversation();
        }}
        onHistoryToggle={() => setHistoryOpen((open) => !open)}
        historyOpen={historyOpen}
      />

      <HistoryDrawer
        open={historyOpen}
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={(id) => {
          onSelectConversation(id);
          setHistoryOpen(false);
        }}
        onDelete={handleDeleteConversation}
        onClose={() => setHistoryOpen(false)}
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pt-2.5 pb-2"
        >
          {view === 'settings' ? (
            <SettingsPanel settings={settings} onChange={onSettingsChange} />
          ) : (
            <div ref={contentRef} className="flex flex-col gap-2.5">
              <PageContext page={page} onClearSelection={onClearSelection} />
              {messages.map((message) =>
                message.role === 'user' ? (
                  <div key={message.id} className="flex justify-end pl-14">
                    <div className="flex max-w-full flex-col gap-1.5 rounded-xl bg-field p-1.5 text-[13px] leading-[1.4] text-ink">
                      {message.imageDataUrl && (
                        <img
                          src={message.imageDataUrl}
                          alt="已标记的屏幕截图"
                          className="max-h-40 max-w-full rounded-lg object-contain"
                        />
                      )}
                      <span className="px-1.5">{message.content}</span>
                    </div>
                  </div>
                ) : (
                  <AssistantMessage
                    key={message.id}
                    message={message}
                    streaming={running && message === messages.at(-1)}
                  />
                ),
              )}
              {teachingSession && ['summarizing', 'reviewing'].includes(teachingSession.status) && (
                <FlowConfirmCard
                  session={teachingSession}
                  busy={Boolean(teachingBusy)}
                  onConfirm={onConfirmTeaching}
                  onDiscard={onCancelTeaching}
                />
              )}
              {confirmedCommand && (
                <CommandSavedAlert command={confirmedCommand} />
              )}
              {running && !hasAssistantOutput(messages.at(-1)) && (
                <LoadingState label={thinking || '正在思考…'} variant="Dots" />
              )}
              {error && (
                <div className="rounded-card bg-red-tint px-3 py-2 text-[12.5px] text-red">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {view === 'chat' && (
          <Composer
            settings={settings}
            running={running}
            onSubmit={onSubmit}
            onStop={onStop}
            onSettingsChange={onSettingsChange}
            imageDataUrl={imageDataUrl}
            onMarkScreen={onMarkScreen}
            onRemoveImage={onRemoveImage}
            selectedElement={selectedElement}
            selectingElement={selectingElement}
            onSelectElement={onSelectElement}
            onRemoveElement={onRemoveElement}
            onStartTeaching={onStartTeaching}
            placeholder={teachingSession?.status === 'reviewing' ? '告诉我如何调整这份流程总结…' : undefined}
          />
        )}
      </div>
    </div>
  );
}
