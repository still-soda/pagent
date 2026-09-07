import { CHANNEL } from '@/shared/contracts/channel';
import { runAgent } from '@/features/agent/runtime/runtime';
import {
  createPageStore,
  emptyConversation,
  isSparseStore,
  titleFromPrompt,
} from '@/features/agent/session/conversations';
import { adoptLiveStore, applyAgentEventToStore, nextStoreRevision } from '@/features/agent/session/session-live';
import { conversationVaultKey } from '@/features/agent/session/vault';
import { loadSettings } from '@/shared/storage/storage';
import type { AgentEvent } from '@/shared/contracts/agent';
import type { ChatMessage, PageConversationStore, UserBadge, UserReference } from '@/shared/contracts/session';
import { nowId } from '@/shared/utils/utils';
import { beginBusyKeepAlive, endBusyKeepAlive } from '@/shared/extension/keepalive';
import { createBridge, ensureContentScript } from './content-bridge';
import {
  queueTabStoreWrite,
  readTabStore,
  resolveTabUrl,
  tabDomains,
  tabStores,
  writeTabStore,
} from './tab-store';

export type AgentControl = {
  abort: AbortController;
  conversationId?: string;
  sessionId: string;
  store: PageConversationStore;
  tabId: number;
};

export const running = new Map<number, AgentControl>();

export function findRunningByTab(tabId: number): AgentControl | undefined {
  return [...running.values()].find((control) => control.tabId === tabId);
}

export async function retargetAgent(fromTabId: number, toTabId: number): Promise<void> {
  if (fromTabId === toTabId) return;
  const control = findRunningByTab(fromTabId);
  if (!control) return;
  const displaced = findRunningByTab(toTabId);
  if (displaced && displaced !== control) {
    let targetUrl = '';
    try {
      const tab = await browser.tabs.get(toTabId);
      targetUrl = tab?.url || '';
    } catch {
      // ignore
    }
    const hint = targetUrl ? `使用 tabs.create("${targetUrl}") 打开新标签页` : '使用 tabs.create 打开新标签页';
    throw new Error(
      `标签页 (tabId: ${toTabId}) 正在被另一个活跃的 Agent 任务占用。为避免冲突，已阻止切换到该标签页。建议${hint}以继续执行。`,
    );
  }
  const live = tabStores.get(fromTabId);
  running.delete(control.tabId);
  running.delete(fromTabId);
  control.tabId = toTabId;
  running.set(toTabId, control);
  if (live) {
    control.store = {
      ...adoptLiveStore(tabStores.get(toTabId), control.store, control.conversationId),
      sessionId: control.sessionId,
      revision: nextStoreRevision(tabStores.get(toTabId)),
    };
    await writeTabStore(toTabId, control.store);
  }
  try {
    await ensureContentScript(toTabId);
  } catch {
    // protected destination
  }
}

function broadcast(control: AgentControl, event: AgentEvent) {
  const includeStore =
    event.type !== 'token' &&
    event.type !== 'reasoning' &&
    event.type !== 'thinking' &&
    event.type !== 'status' &&
    event.type !== 'tool-start';
  browser.tabs.sendMessage(control.tabId, {
    channel: CHANNEL,
    kind: 'agent-event',
    event,
    sessionId: control.sessionId,
    revision: control.store.revision ?? 0,
    conversationId: control.conversationId,
    store: includeStore ? control.store : undefined,
  }).catch(() => {});
}

function stopControl(control: AgentControl, broadcastEvent: boolean) {
  running.delete(control.tabId);
  control.abort.abort();
  if (!control.conversationId) return;
  const event: AgentEvent = { type: 'error', message: '任务已停止' };
  control.store = applyAgentEventToStore(control.store, control.conversationId, event);
  tabStores.set(control.tabId, control.store);
  queueTabStoreWrite(control.tabId, control.store, true);
  if (broadcastEvent) broadcast(control, event);
}

export async function startAgent(
  tabId: number,
  prompt: string,
  conversationId?: string,
  history?: ChatMessage[],
  context?: string,
  imageDataUrl?: string,
  badges?: UserBadge[],
  references?: UserReference[],
) {
  const previous = findRunningByTab(tabId) ?? running.get(tabId);
  running.delete(tabId);
  if (previous) stopControl(previous, false);
  const abort = new AbortController();
  const currentUrl = await resolveTabUrl(tabId);
  const existing =
    tabStores.get(tabId) ??
    (await readTabStore(tabId)) ??
    createPageStore(conversationVaultKey(currentUrl ?? '') ?? undefined);
  const targetId = conversationId ?? existing.activeId;
  let conversations = existing.conversations;
  let target = conversations.find((item) => item.id === targetId);
  if (!target) {
    target = emptyConversation('会话 1', tabDomains.get(tabId) ? [tabDomains.get(tabId)!] : []);
    target.id = targetId;
    target.messages = history ?? [];
    conversations = [...conversations, target];
  }
  const lastMessage = target.messages.at(-1);
  const hasPrompt =
    lastMessage?.role === 'user' &&
    lastMessage.content.trim() === prompt.trim() &&
    lastMessage.imageDataUrl === imageDataUrl;
  const revision = nextStoreRevision(existing);
  conversations = conversations.map((item) =>
    item.id === targetId
      ? {
          ...item,
          revision: (item.revision ?? 0) + 1,
          updatedAt: Date.now(),
          title: titleFromPrompt(item.title, prompt),
          messages: hasPrompt
            ? item.messages
            : [
                ...item.messages,
                {
                  id: nowId('m'),
                  role: 'user' as const,
                  content: prompt,
                  imageDataUrl,
                  badges,
                  references,
                },
              ],
          running: true,
          thinking: '正在调用模型…',
          startedAt: item.startedAt ?? Date.now(),
          error: '',
        }
      : item,
  );
  const sessionId = nowId('s');
  const store: PageConversationStore = {
    ...existing,
    activeId: targetId,
    conversations,
    panelOpen: true,
    sessionId,
    revision,
  };
  const control: AgentControl = { abort, conversationId: targetId, sessionId, store, tabId };
  running.set(tabId, control);
  tabStores.set(tabId, store);
  await writeTabStore(tabId, store);
  beginBusyKeepAlive();
  const settings = await loadSettings();
  const isCurrent = () => findRunningByTab(control.tabId)?.abort === abort;
  const done = runAgent({
    prompt,
    context,
    tabId,
    url: currentUrl,
    getTabId: () => control.tabId,
    sessionId,
    conversationId: targetId,
    history,
    imageDataUrl,
    badges,
    references,
    bridge: createBridge(control, settings, retargetAgent),
    emit: (event) => {
      if (!isCurrent()) return;
      control.store = applyAgentEventToStore(control.store, targetId, event);
      tabStores.set(control.tabId, control.store);
      queueTabStoreWrite(
        control.tabId,
        control.store,
        event.type === 'done' || event.type === 'error',
      );
      broadcast(control, event);
    },
    signal: abort.signal,
  }).finally(() => {
    if (isCurrent()) running.delete(control.tabId);
    endBusyKeepAlive();
  });
  void done.catch(() => undefined);
  return { ok: true, tabId };
}

export function stopAgent(tabId: number) {
  const control = findRunningByTab(tabId) ?? running.get(tabId);
  running.delete(tabId);
  if (control) stopControl(control, true);
}

export function stopAgentForTab(tabId: number): void {
  const control = findRunningByTab(tabId) ?? running.get(tabId);
  if (control) stopControl(control, true);
}
