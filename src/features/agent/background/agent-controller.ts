import { CHANNEL } from '@/shared/contracts/channel';
import { runAgent } from '@/features/agent/runtime/runtime';
import { startDevtoolsCapture } from '@/shared/browser/cdp';
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
import type { ChatMessage, PageConversationStore } from '@/shared/contracts/session';
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
    displaced.abort.abort();
    running.delete(toTabId);
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
    event.type !== 'status';
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

export async function startAgent(
  tabId: number,
  prompt: string,
  conversationId?: string,
  history?: ChatMessage[],
  context?: string,
  imageDataUrl?: string,
) {
  stopAgent(tabId);
  const abort = new AbortController();
  const existing =
    tabStores.get(tabId) ??
    (await readTabStore(tabId)) ??
    createPageStore(conversationVaultKey((await resolveTabUrl(tabId)) ?? '') ?? undefined);
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
                { id: nowId('m'), role: 'user' as const, content: prompt, imageDataUrl },
              ],
          running: true,
          thinking: '正在调用模型…',
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
  if (settings.captureDevtools) {
    void startDevtoolsCapture(tabId).catch(() => {});
  }
  const isCurrent = () => findRunningByTab(control.tabId)?.abort === abort;
  const done = runAgent({
    prompt,
    context,
    tabId,
    getTabId: () => control.tabId,
    sessionId,
    conversationId: targetId,
    history,
    imageDataUrl,
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
  void done;
  return { ok: true, tabId };
}

export function stopAgent(tabId: number) {
  const control = findRunningByTab(tabId) ?? running.get(tabId);
  control?.abort.abort();
  if (control) running.delete(control.tabId);
  running.delete(tabId);
}

export function stopAgentForTab(tabId: number): void {
  const control = findRunningByTab(tabId) ?? running.get(tabId);
  control?.abort.abort();
}
