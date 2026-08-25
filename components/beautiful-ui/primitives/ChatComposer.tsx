"use client";

import { useEffect, useState } from "react";
import type { PointerEvent } from "react";
import PromptBar from "./PromptBar";
import { useStickToBottom } from "../../../hooks/useStickToBottom";
import ToolChips from "./ToolChips";
import ThinkingState from "./ThinkingState";
import LoadingState from "./LoadingState";
import { MarkdownContent } from "../../agent/MarkdownContent";
import { SettingsPanel } from "../../settings/SettingsPanel";
import { rpc } from "../../../lib/rpc-client";
import { formatConversationTime, groupConversationsByTime } from "../../../lib/conversations";
import { messageBlocks, shouldHoldToolGroupOpen } from "../../../lib/messages";
import { toolChip, toolDetailLines, toolKind, toolLabel, toolUsesMono } from "../../../lib/tool-display";
import { formatTurnUsageParts, hasTurnUsage } from "../../../lib/agent/usage";
import {
  modelsForProvider,
  resolveCatalogModel,
  type AgentSettings,
  type ChatMessage,
  type TaskRow,
  type TurnUsage,
} from "../../../lib/shared/types";

export default function ChatComposer({
  settings,
  messages,
  tasks,
  running,
  workingOnThisPage = running,
  thinking,
  error,
  page,
  view,
  conversations,
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
  onCloseConversation,
  onViewChange,
  onClose,
  onSubmit,
  onStop,
  onClear,
  onClearSelection,
  onSettingsChange,
  onHeaderPointerDown,
}: {
  settings: AgentSettings;
  messages: ChatMessage[];
  tasks: TaskRow[];
  running: boolean;
  workingOnThisPage?: boolean;
  thinking: string;
  error: string;
  page: { url: string; title: string; selection: string };
  conversations: Array<{ id: string; title: string; updatedAt?: number }>;
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  onCreateConversation: () => void;
  onCloseConversation: (id: string) => void;
  view: "chat" | "settings";
  onViewChange: (view: "chat" | "settings") => void;
  onClose: () => void;
  onSubmit: (prompt: string, context?: string) => void;
  onStop: () => void;
  onClear: () => void;
  onClearSelection: () => void;
  onSettingsChange: (settings: AgentSettings) => void;
  onHeaderPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const lastUserId = [...messages].reverse().find((message) => message.role === "user")?.id;
  const { scrollerRef, contentRef, onScroll } = useStickToBottom({
    enabled: view === "chat" && !historyOpen,
    resetKey: `${activeConversationId}:${lastUserId ?? ""}`,
  });
  const activeTitle =
    conversations.find((item) => item.id === activeConversationId)?.title ?? "会话";

  return (
    <div className="pagent-window relative flex h-[min(680px,calc(100vh-48px))] w-full flex-col self-start">
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
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          <div className="flex min-w-0 items-center gap-1 rounded-[8px] bg-inset p-0.5">
            <span
              className="max-w-36 truncate rounded-[6px] bg-surface px-2 py-[3px] text-[13px] text-ink shadow-hairline"
              title={activeTitle}
            >
              {activeTitle}
            </span>
            <button
              type="button"
              aria-label="历史会话"
              aria-pressed={historyOpen}
              onClick={() => setHistoryOpen((open) => !open)}
              className={`flex size-6 items-center justify-center rounded-[6px] transition-colors duration-100 hover:bg-hover hover:text-ink-2 ${
                historyOpen ? "bg-hover text-ink" : "text-ink-3"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 8v4l2.5 1.5" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="新建会话"
              onClick={() => {
                setHistoryOpen(false);
                onCreateConversation();
              }}
              className="flex size-6 items-center justify-center rounded-[6px] text-ink-3 transition-colors duration-100 hover:bg-hover hover:text-ink-2"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {[
            { label: "清空上下文", onClick: onClear, path: <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /> },
            {
              label: "设置",
              onClick: () => onViewChange(view === "settings" ? "chat" : "settings"),
              pressed: view === "settings",
              path: (
                <>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
                </>
              ),
            },
            { label: running ? "停止" : "关闭", onClick: running ? onStop : onClose, path: running ? <path d="M6 6h12v12H6z" /> : <path d="M18 6L6 18M6 6l12 12" /> },
          ].map((action) => (
            <button
              key={action.label}
              type="button"
              aria-label={action.label}
              aria-pressed={"pressed" in action ? action.pressed : undefined}
              onClick={action.onClick}
              className={`flex size-6 items-center justify-center rounded-[6px] transition-colors duration-100 hover:bg-hover hover:text-ink-2 ${
                "pressed" in action && action.pressed ? "bg-hover text-ink" : "text-ink-3"
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {action.path}
              </svg>
            </button>
          ))}
        </div>
      </div>

      <HistoryDrawer
        open={historyOpen}
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={(id) => {
          onSelectConversation(id);
          setHistoryOpen(false);
        }}
        onDelete={onCloseConversation}
        onClose={() => setHistoryOpen(false)}
      />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] px-3 pt-2.5 pb-2"
        >
          {view === "settings" ? (
            <SettingsPanel settings={settings} onChange={onSettingsChange} />
          ) : (
            <div ref={contentRef} className="flex flex-col gap-2.5">
              <PageContext page={page} onClearSelection={onClearSelection} />
              {messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="flex justify-end pl-14">
                    <div className="rounded-xl bg-field px-3 py-1.5 text-[13px] leading-[1.4] text-ink">
                      {message.content}
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
              {running && !hasAssistantOutput(messages.at(-1)) && (
                <LoadingState label={thinking || "正在思考…"} variant="Dots" />
              )}
              {error && (
                <div className="rounded-card bg-red-tint px-3 py-2 text-[12.5px] text-red">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {view === "chat" && (
          <div className="mt-auto shrink-0 border-t border-line bg-page p-2">
            <PromptBar
              demo={false}
              placeholder="给当前页面下达任务…"
              onSend={onSubmit}
              modelKey={settings.model.model}
              models={modelsForProvider(settings.model.provider).map((item) => ({
                key: item.id,
                name: item.label,
                tag: item.tag,
              }))}
              onModelChange={(id) => {
                const next = resolveCatalogModel(settings.model.provider, id);
                void rpc("settings.set", {
                  model: {
                    ...settings.model,
                    model: next.id,
                    apiProtocol: next.apiProtocol,
                  },
                }).then((saved) => onSettingsChange(saved as AgentSettings));
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryDrawer({
  open,
  conversations,
  activeId,
  onSelect,
  onDelete,
  onClose,
}: {
  open: boolean;
  conversations: Array<{ id: string; title: string; updatedAt?: number }>;
  activeId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setShown(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = window.setTimeout(() => setMounted(false), 240);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!mounted) return null;
  const groups = groupConversationsByTime(conversations);

  return (
    <div className={`pagent-history-layer absolute inset-0 z-40 ${shown ? "is-open" : ""}`}>
      <button
        type="button"
        className={`pagent-history-backdrop ${shown ? "is-open" : ""}`}
        aria-label="关闭历史"
        onClick={onClose}
      />
      <aside className={`pagent-history-drawer flex flex-col border-r border-line bg-page ${shown ? "is-open" : ""}`}>
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-3">
          <span className="text-[13px] font-medium text-ink">历史会话</span>
          <button
            type="button"
            aria-label="关闭历史"
            onClick={onClose}
            className="flex size-6 items-center justify-center rounded-[6px] text-ink-3 hover:bg-hover hover:text-ink"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {groups.length === 0 ? (
            <div className="px-2 py-8 text-center text-[12.5px] text-ink-3">暂无历史会话</div>
          ) : (
            groups.map((group) => (
              <section key={group.key} className="mb-1.5 last:mb-0">
                <h3 className="px-1.5 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-ink-3">
                  {group.label}
                </h3>
                {group.items.map((item) => {
                  const selected = item.id === activeId;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-1 rounded-[8px] px-1.5 py-1.5 ${
                        selected ? "bg-accent-tint" : "hover:bg-hover"
                      }`}
                    >
                      <button
                        type="button"
                        aria-current={selected ? "true" : undefined}
                        onClick={() => onSelect(item.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className={`min-w-0 truncate text-[13px] ${selected ? "font-medium text-ink" : "text-ink-2"}`}>
                          {item.title}
                        </span>
                        {item.updatedAt ? (
                          <span className="ml-auto shrink-0 text-[11px] tabular-nums text-ink-3">
                            {formatConversationTime(item.updatedAt)}
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        aria-label={`删除${item.title}`}
                        onClick={() => onDelete(item.id)}
                        className="flex size-5 shrink-0 items-center justify-center rounded-[4px] text-ink-3 hover:bg-hover hover:text-ink"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </section>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function hasAssistantOutput(message?: ChatMessage) {
  return message?.role === "assistant" && messageBlocks(message).length > 0;
}

function AssistantMessage({
  message,
  streaming,
}: {
  message: ChatMessage;
  streaming: boolean;
}) {
  const blocks = messageBlocks(message);
  const lastTextIndex = blocks.findLastIndex((block) => block.type === "text");

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === "thinking") {
          return (
            <ThinkingState
              key={`${message.id}-thinking-${index}`}
              variant="Reasoning"
              working={streaming && index === blocks.length - 1}
              text={block.text}
              active="正在思考"
              done="思考完成"
            />
          );
        }
        if (block.type === "text") {
          return (
            <MarkdownContent
              key={`${message.id}-text-${index}`}
              text={block.text}
              streaming={streaming && index === lastTextIndex && lastTextIndex === blocks.length - 1}
            />
          );
        }
        return (
          <ToolChips
            key={`${message.id}-block-${index}`}
            holdOpen={shouldHoldToolGroupOpen(streaming, blocks.slice(index + 1))}
            summary={
              block.tools.length === 1
                ? toolLabel(block.tools[0]!.name)
                : `${block.tools.length} 个操作`
            }
            calls={block.tools.map((tool) => ({
              id: tool.id,
              label: toolLabel(tool.name),
              chip: toolChip(tool.name, tool.args, tool.status),
              icon: toolKind(tool.name),
              mono: toolUsesMono(tool.name),
              detailMono: true,
              detail: toolDetailLines(tool.args, tool.output, tool.status),
              status: tool.status,
            }))}
          />
        );
      })}
      {!streaming && hasTurnUsage(message.usage) ? <TurnUsageBar usage={message.usage!} /> : null}
    </div>
  );
}

function TurnUsageBar({ usage }: { usage: TurnUsage }) {
  const parts = formatTurnUsageParts(usage);
  if (!parts.length) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] tabular-nums text-ink-3"
      aria-label={`本轮用量：${parts.join(" · ")}`}
    >
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="inline-flex items-center gap-1.5">
          {index > 0 ? <span aria-hidden className="text-ink-3/70">·</span> : null}
          {part}
        </span>
      ))}
    </div>
  );
}

function PageContext({
  page,
  onClearSelection,
}: {
  page: { url: string; title: string; selection: string };
  onClearSelection: () => void;
}) {
  return (
    <div className="pagent-context">
      <div className="flex items-start gap-2 px-2.5 py-2">
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-[5px] bg-accent-tint text-accent">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-medium text-ink">{page.title || "当前页面"}</div>
          <div className="truncate text-[11px] text-ink-3">{page.url}</div>
        </div>
      </div>
      {page.selection ? (
        <div className="flex items-start gap-2 border-t border-line px-2.5 py-1.5">
          <p className="min-w-0 flex-1 text-[12px] leading-5 text-ink-2">{page.selection}</p>
          <button
            type="button"
            aria-label="清除选区"
            onClick={onClearSelection}
            className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] text-ink-3 hover:bg-hover hover:text-ink"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}
