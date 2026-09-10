import { z } from 'zod';
import { isProtectedUrl, toErrorMessage } from '@/shared/contracts/errors';
import { assertNavigableUrl } from '@/shared/contracts/policy';
import { nowId, truncate } from '@/shared/utils/utils';
import { createTab, getActiveTab, navigateTab } from '@/shared/browser/tabs';
import { loadSettings } from '@/shared/storage/storage';
import { findRunningByTab, running, startAgent, type AgentControl } from '@/features/agent/background/agent-controller';
import { ensureContentScript, sendToContent } from '@/features/agent/background/content-bridge';
import { tabStores } from '@/features/agent/background/tab-store';
import type { PageConversation, PageConversationStore } from '@/shared/contracts/session';
import type {
  DispatchTaskInput,
  DispatchTaskResult,
  GetSessionInput,
  HostSessionStatus,
  HostTab,
  HostTabAgent,
  McpHostMethod,
} from '@/shared/contracts/mcp-host';

export const dispatchTaskSchema = z.object({
  prompt: z.string().min(1).max(32_000),
  tabId: z.number().int().positive().optional(),
  url: z.string().min(1).optional(),
  conversationId: z.string().min(1).optional(),
});

export const getSessionSchema = z
  .object({
    sessionId: z.string().min(1).optional(),
    tabId: z.number().int().positive().optional(),
    conversationId: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.sessionId || value.conversationId || value.tabId != null), {
    message: '需要提供 sessionId、tabId 或 conversationId',
  });

function agentFromConversation(
  working: boolean,
  sessionId: string | undefined,
  conversation: PageConversation | undefined,
): HostTabAgent {
  return {
    working,
    sessionId,
    conversationId: conversation?.id,
    title: conversation?.title,
    thinking: conversation?.thinking || undefined,
    error: conversation?.error || undefined,
  };
}

function conversationOf(store: PageConversationStore | undefined, conversationId?: string) {
  if (!store) return undefined;
  const id = conversationId ?? store.activeId;
  return store.conversations.find((item) => item.id === id) ?? store.conversations.at(-1);
}

async function requireTab(tabId: number) {
  try {
    return await browser.tabs.get(tabId);
  } catch {
    throw new Error(`找不到标签页 ${tabId}`);
  }
}

export async function listHostTabs(): Promise<{ tabs: HostTab[] }> {
  const tabs = await browser.tabs.query({});
  return {
    tabs: tabs
      .filter((tab): tab is typeof tab & { id: number } => typeof tab.id === 'number')
      .map((tab) => {
        const control = findRunningByTab(tab.id);
        const store = tabStores.get(tab.id);
        const conversation = conversationOf(store ?? control?.store, control?.conversationId);
        const url = tab.url ?? '';
        return {
          tabId: tab.id,
          title: tab.title?.trim() || '无标题',
          url,
          active: Boolean(tab.active),
          windowId: tab.windowId,
          status: tab.status,
          pinned: Boolean(tab.pinned),
          protected: !url || isProtectedUrl(url),
          agent: agentFromConversation(
            Boolean(control),
            control?.sessionId ?? store?.sessionId,
            conversation,
          ),
        };
      }),
  };
}

async function resolveDispatchTab(input: DispatchTaskInput): Promise<number> {
  const settings = await loadSettings();
  if (input.url) assertNavigableUrl(input.url, settings);

  if (input.tabId != null && input.url) {
    await requireTab(input.tabId);
    await navigateTab(input.tabId, input.url);
    return input.tabId;
  }
  if (input.tabId != null) {
    await requireTab(input.tabId);
    return input.tabId;
  }
  if (input.url) {
    const tab = await createTab(input.url);
    if (!tab.id) throw new Error('创建标签页失败');
    return tab.id;
  }
  const active = await getActiveTab();
  if (!active.id) throw new Error('找不到当前标签页');
  return active.id;
}

export async function dispatchHostTask(input: DispatchTaskInput): Promise<DispatchTaskResult> {
  const data = dispatchTaskSchema.parse(input);
  const tabId = await resolveDispatchTab(data);
  const tab = await requireTab(tabId);
  if (!tab.url || isProtectedUrl(tab.url)) {
    throw new Error('当前页面受浏览器保护，无法派发 Agent 任务');
  }
  await ensureContentScript(tabId);
  await sendToContent(tabId, 'ui.open', {}).catch(() => undefined);
  const conversationId = data.conversationId ?? nowId('c');
  const started = await startAgent(tabId, data.prompt, conversationId);
  return {
    ok: true,
    tabId: started.tabId,
    sessionId: started.sessionId,
    conversationId: started.conversationId,
  };
}

function controlMatches(control: AgentControl, query: GetSessionInput): boolean {
  if (query.sessionId && control.sessionId !== query.sessionId) return false;
  if (query.conversationId && control.conversationId !== query.conversationId) return false;
  if (query.tabId != null && control.tabId !== query.tabId) return false;
  return true;
}

function storeMatches(
  tabId: number,
  store: PageConversationStore,
  query: GetSessionInput,
): PageConversation | undefined {
  if (query.sessionId && store.sessionId !== query.sessionId) return undefined;
  if (query.tabId != null && query.tabId !== tabId) return undefined;
  if (query.conversationId) {
    return store.conversations.find((item) => item.id === query.conversationId);
  }
  if (query.sessionId || query.tabId != null) return conversationOf(store);
  return undefined;
}

function toSessionStatus(
  tabId: number,
  store: PageConversationStore,
  conversation: PageConversation,
  runningNow: boolean,
  sessionId: string | undefined,
  tab?: { url?: string; title?: string },
): HostSessionStatus {
  return {
    found: true,
    running: runningNow,
    tabId,
    url: tab?.url,
    title: tab?.title?.trim() || undefined,
    sessionId: sessionId ?? store.sessionId,
    conversationId: conversation.id,
    conversationTitle: conversation.title,
    thinking: conversation.thinking || undefined,
    error: conversation.error || undefined,
    updatedAt: conversation.updatedAt,
    budget: conversation.budget,
    tasks: conversation.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      detail: task.detail,
    })),
    messages: conversation.messages.slice(-8).map((message) => ({
      role: message.role,
      content: truncate(message.content, 500),
    })),
  };
}

export async function getHostSession(input: GetSessionInput): Promise<HostSessionStatus> {
  const query = getSessionSchema.parse(input);

  for (const control of running.values()) {
    if (!controlMatches(control, query)) continue;
    const conversation = conversationOf(control.store, control.conversationId ?? query.conversationId);
    if (!conversation) continue;
    let tab: { url?: string; title?: string } | undefined;
    try {
      tab = await browser.tabs.get(control.tabId);
    } catch {
      tab = undefined;
    }
    return toSessionStatus(control.tabId, control.store, conversation, true, control.sessionId, tab);
  }

  for (const [tabId, store] of tabStores) {
    const conversation = storeMatches(tabId, store, query);
    if (!conversation) continue;
    let tab: { url?: string; title?: string } | undefined;
    try {
      tab = await browser.tabs.get(tabId);
    } catch {
      tab = undefined;
    }
    return toSessionStatus(tabId, store, conversation, Boolean(findRunningByTab(tabId)), store.sessionId, tab);
  }

  return { found: false, running: false };
}

export async function handleHostMethod(method: McpHostMethod, params: unknown): Promise<unknown> {
  switch (method) {
    case 'list_tabs':
      return listHostTabs();
    case 'dispatch_task':
      return dispatchHostTask((params ?? {}) as DispatchTaskInput);
    case 'get_session':
      return getHostSession((params ?? {}) as GetSessionInput);
    default:
      throw new Error(`未知 MCP Host 方法：${method}`);
  }
}

export function hostMethodError(error: unknown): string {
  return toErrorMessage(error);
}
