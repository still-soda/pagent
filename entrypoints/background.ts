import { CHANNEL, isRpcRequest, parseRpcPayload, type RpcName } from '../lib/shared/rpc';
import { toErrorMessage } from '../lib/shared/errors';
import { isProtectedUrl } from '../lib/shared/errors';
import {
  clearSecrets,
  loadSettings,
  saveSecret,
  saveSettings,
  secretPresence,
} from '../lib/storage';
import { getPermissionState, requestPermissions } from '../lib/browser/permissions';
import {
  closeTab,
  createTab,
  getActiveTab,
  goBack,
  goForward,
  listTabs,
  navigateTab,
  reloadTab,
  switchTab,
} from '../lib/browser/tabs';
import { captureVisibleTab, trimDataUrl } from '../lib/browser/screenshot';
import {
  attachDebugger,
  captureCdpScreenshot,
  detachDebugger,
  dispatchClick,
  dispatchMove,
  evaluateExpression,
  getConsoleLog,
  getNetworkLog,
  getNetworkRequest,
  insertText,
  startDevtoolsCapture,
} from '../lib/browser/cdp';
import { assertNavigableUrl } from '../lib/shared/policy';
import { runAgent } from '../lib/agent/runtime';
import {
  clearTabUi,
  loadConversationsForPage,
  loadTabConversations,
  loadTabUi,
  migrateLegacyPageStores,
  savePageConversations,
  saveTabUi,
  saveVaultFromStore,
} from '../lib/storage';
import {
  adoptTabStore,
  conversationTabKey,
  createPageStore,
  emptyConversation,
  isSparseStore,
  titleFromPrompt,
} from '../lib/conversations';
import { adoptLiveStore, applyAgentEventToStore, nextStoreRevision } from '../lib/session-live';
import { conversationVaultKey } from '../lib/vault';
import { TOGGLE_PANEL_COMMAND } from '../lib/hotkey';
import { testModelConnection } from '../lib/agent/models';
import { loadSecrets } from '../lib/storage';
import { checkpointKey, clearCheckpoint, loadCheckpoints } from '../lib/agent/checkpoint';
import type { AgentEvent, AgentSettings, ChatMessage, PageConversationStore } from '../lib/shared/types';
import { nowId } from '../lib/utils';
import {
  beginBusyKeepAlive,
  endBusyKeepAlive,
  installServiceWorkerKeepAlive,
} from '../lib/keepalive';

const CONTENT_FILE = '/content-scripts/content.js';

type AgentControl = {
  abort: AbortController;
  conversationId?: string;
  sessionId: string;
  store: PageConversationStore;
  tabId: number;
};

const running = new Map<number, AgentControl>();
const tabStores = new Map<number, PageConversationStore>();
const tabDomains = new Map<number, string>();
const tabStoreWrites = new Map<number, Promise<unknown>>();
const pendingTabStores = new Map<number, PageConversationStore>();
const tabStoreWriteTimers = new Map<number, ReturnType<typeof setTimeout>>();
const TAB_STORE_WRITE_DEBOUNCE_MS = 300;

function flushTabStoreWrite(tabId: number): void {
  const timer = tabStoreWriteTimers.get(tabId);
  if (timer) clearTimeout(timer);
  tabStoreWriteTimers.delete(tabId);
  const store = pendingTabStores.get(tabId);
  if (!store) return;
  pendingTabStores.delete(tabId);
  const previous = tabStoreWrites.get(tabId) ?? Promise.resolve();
  const write = previous
    .catch(() => undefined)
    .then(() => writeTabStore(tabId, store, undefined, { deleteMissing: false }));
  tabStoreWrites.set(tabId, write);
  void write.finally(() => {
    if (tabStoreWrites.get(tabId) === write) tabStoreWrites.delete(tabId);
  });
}

function queueTabStoreWrite(
  tabId: number,
  store: PageConversationStore,
  immediate = false,
): void {
  pendingTabStores.set(tabId, store);
  const timer = tabStoreWriteTimers.get(tabId);
  if (timer) clearTimeout(timer);
  if (immediate) {
    flushTabStoreWrite(tabId);
    return;
  }
  tabStoreWriteTimers.set(
    tabId,
    setTimeout(() => flushTabStoreWrite(tabId), TAB_STORE_WRITE_DEBOUNCE_MS),
  );
}

function findRunningByTab(tabId: number): AgentControl | undefined {
  return [...running.values()].find((control) => control.tabId === tabId);
}

async function retargetAgent(fromTabId: number, toTabId: number): Promise<void> {
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

async function resolveTabUrl(tabId: number, fallback?: string): Promise<string | undefined> {
  try {
    return (await browser.tabs.get(tabId)).url ?? fallback;
  } catch {
    return fallback;
  }
}

async function readTabStore(tabId: number, url?: string): Promise<PageConversationStore | null> {
  const resolvedUrl = await resolveTabUrl(tabId, url);
  const domain = resolvedUrl ? conversationVaultKey(resolvedUrl) : null;
  const stored = await loadConversationsForPage(tabId, resolvedUrl, tabStores.get(tabId));
  if (stored) {
    const previous = tabStores.get(tabId);
    const tabUi = await loadTabUi(tabId);
    tabStores.set(tabId, {
      ...stored,
      panelOpen: stored.panelOpen ?? previous?.panelOpen ?? tabUi?.panelOpen,
    });
    if (domain) tabDomains.set(tabId, domain);
    return tabStores.get(tabId) ?? stored;
  }
  return tabStores.get(tabId) ?? null;
}

async function writeTabStore(
  tabId: number,
  store: PageConversationStore,
  url?: string,
  options?: { deleteMissing?: boolean },
): Promise<PageConversationStore> {
  const resolvedUrl = await resolveTabUrl(tabId, url);
  const domain = resolvedUrl ? conversationVaultKey(resolvedUrl) : tabDomains.get(tabId);
  const previous = tabStores.get(tabId) ?? (await loadTabConversations(tabId, resolvedUrl));
  const nextStore = adoptTabStore(store, previous);
  tabStores.set(tabId, nextStore);
  if (domain) tabDomains.set(tabId, domain);
  await savePageConversations(conversationTabKey(tabId), nextStore);
  if (typeof nextStore.panelOpen === 'boolean') {
    await saveTabUi(tabId, { panelOpen: nextStore.panelOpen });
  }
  if (domain && !isSparseStore(nextStore)) {
    await saveVaultFromStore(domain, nextStore, { deleteMissing: options?.deleteMissing ?? true });
  }
  return nextStore;
}

async function archiveTabNavigation(tabId: number, url: string): Promise<void> {
  const domain = conversationVaultKey(url);
  if (!domain) return;
  const live = tabStores.get(tabId) ?? (await loadTabConversations(tabId, url));
  if (!live || isSparseStore(live)) {
    tabDomains.set(tabId, domain);
    return;
  }
  const viewed = await loadConversationsForPage(tabId, url, live);
  if (!viewed) {
    tabDomains.set(tabId, domain);
    return;
  }
  const next = adoptTabStore(viewed, live);
  tabStores.set(tabId, next);
  tabDomains.set(tabId, domain);
  await savePageConversations(conversationTabKey(tabId), next);
  if (!isSparseStore(next)) {
    await saveVaultFromStore(domain, next, { deleteMissing: false });
  }
}

async function recoverInterruptedSessions(): Promise<void> {
  const checkpoints = await loadCheckpoints();
  for (const [key, checkpoint] of Object.entries(checkpoints)) {
    if (!checkpoint.running) {
      await clearCheckpoint(key);
      continue;
    }
    const current =
      (await readTabStore(checkpoint.tabId)) ??
      createPageStore(conversationVaultKey((await resolveTabUrl(checkpoint.tabId)) ?? '') ?? undefined);
    const conversationId = checkpoint.conversationId ?? current.activeId;
    let found = false;
    const conversations = current.conversations.map((item) => {
      if (item.id !== conversationId) return item;
      found = true;
      return {
        ...item,
        revision: (item.revision ?? 0) + 1,
        updatedAt: Date.now(),
        messages: checkpoint.messages,
        tasks: checkpoint.tasks.map((task) =>
          task.status === 'running' || task.status === 'pending'
            ? { ...task, status: 'error' as const }
            : task,
        ),
        budget: { modelCalls: checkpoint.modelCalls, toolCalls: checkpoint.toolCalls },
        running: false,
        thinking: '',
        error: '任务因扩展后台重启而中断，请重新发送消息继续。',
      };
    });
    if (!found) {
      const item = emptyConversation('中断的任务', tabDomains.get(checkpoint.tabId) ? [tabDomains.get(checkpoint.tabId)!] : []);
      item.id = conversationId;
      item.revision = 1;
      item.messages = checkpoint.messages;
      item.tasks = checkpoint.tasks.map((task) => ({ ...task, status: task.status === 'done' ? 'done' : 'error' }));
      item.budget = { modelCalls: checkpoint.modelCalls, toolCalls: checkpoint.toolCalls };
      item.error = '任务因扩展后台重启而中断，请重新发送消息继续。';
      conversations.push(item);
    }
    await writeTabStore(checkpoint.tabId, {
      ...current,
      activeId: conversationId,
      conversations,
      sessionId: checkpoint.sessionId,
      revision: nextStoreRevision(current),
    });
    await clearCheckpoint(checkpointKey(checkpoint));
  }
}

async function togglePanel(tabId: number) {
  await sendToContent(tabId, 'ui.toggle', {});
  return { ok: true };
}

async function sendToContent<T>(tabId: number, name: string, payload: unknown = {}): Promise<T> {
  await ensureContentScript(tabId);
  const response = await browser.tabs.sendMessage(tabId, {
    channel: CHANNEL,
    kind: 'content-command',
    name,
    payload,
  });
  if (!response?.ok) {
    throw new Error(response?.error?.message ?? `内容脚本命令失败：${name}`);
  }
  return response.result as T;
}

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, { channel: CHANNEL, kind: 'ping' });
    return;
  } catch {
    // inject
  }
  const tab = await browser.tabs.get(tabId);
  if (!tab.url || isProtectedUrl(tab.url)) {
    throw new Error('当前页面受浏览器保护，无法注入 Agent');
  }
  await browser.scripting.executeScript({
    target: { tabId },
    files: [CONTENT_FILE],
  });
  await new Promise((resolve) => setTimeout(resolve, 120));
}

async function snapshotMentionedTab(tabId: number) {
  let tab: { title?: string; url?: string; active?: boolean };
  try {
    tab = (await browser.tabs.get(tabId)) as typeof tab;
  } catch (error) {
    return { tabId, title: '未知标签页', url: '', error: toErrorMessage(error) };
  }
  const base = {
    tabId,
    title: tab.title?.trim() || '无标题',
    url: tab.url ?? '',
    active: Boolean(tab.active),
  };
  if (!tab.url || isProtectedUrl(tab.url)) {
    return { ...base, error: '该页面受浏览器保护，无法读取内容。' };
  }
  try {
    const source = await sendToContent<{
      content?: string;
      truncated?: boolean;
      hasMore?: boolean;
    }>(tabId, 'page.source', { type: 'text', limit: 4_000 });
    return {
      ...base,
      content: source.content ?? '',
      truncated: Boolean(source.truncated || source.hasMore),
    };
  } catch (error) {
    return { ...base, error: toErrorMessage(error) };
  }
}

function createBridge(control: AgentControl, settings: AgentSettings) {
  const tabId = () => control.tabId;
  return {
    get tabId() {
      return tabId();
    },
    settings,
    content: <T,>(name: string, payload?: unknown) => sendToContent<T>(tabId(), name, payload),
    screenshot: async (fullPage?: boolean) => {
      if (fullPage) return trimDataUrl(await captureCdpScreenshot(tabId(), true));
      const tab = await browser.tabs.get(tabId());
      return trimDataUrl(await captureVisibleTab(tab.windowId));
    },
    navigate: (url: string) => navigateTab(tabId(), url),
    back: () => goBack(tabId()),
    forward: () => goForward(tabId()),
    reload: () => reloadTab(tabId()),
    tabs: {
      query: listTabs,
      create: async (url?: string) => {
        const tab = await createTab(url);
        if (tab.id) await retargetAgent(tabId(), tab.id);
        return tab;
      },
      switch: async (targetId: number) => {
        const tab = await switchTab(targetId);
        await retargetAgent(tabId(), targetId);
        return tab;
      },
      close: closeTab,
    },
    cdp: {
      script: (expression: string, awaitPromise?: boolean) =>
        evaluateExpression(tabId(), expression, awaitPromise),
      input: async (payload: { x: number; y: number; type?: string; text?: string }) => {
        await attachDebugger(tabId());
        if (payload.type === 'move') await dispatchMove(tabId(), payload.x, payload.y);
        else await dispatchClick(tabId(), payload.x, payload.y);
        if (payload.text) await insertText(tabId(), payload.text);
        return { ok: true };
      },
      screenshot: async (fullPage?: boolean) =>
        trimDataUrl(await captureCdpScreenshot(tabId(), Boolean(fullPage))),
      network: (filter?: Parameters<typeof getNetworkLog>[1]) => getNetworkLog(tabId(), filter),
      console: (filter?: Parameters<typeof getConsoleLog>[1]) => getConsoleLog(tabId(), filter),
      request: (requestId: string, includeBody?: boolean) =>
        getNetworkRequest(tabId(), requestId, includeBody),
    },
  };
}

async function handleRpc(name: RpcName, payload: unknown, senderTabId?: number) {
  const tabId = senderTabId ?? (await getActiveTab()).id!;
  const settings = await loadSettings();

  switch (name) {
    case 'dom.observe':
    case 'dom.search':
    case 'dom.click':
    case 'dom.dblclick':
    case 'dom.hover':
    case 'dom.focus':
    case 'dom.highlight':
    case 'dom.type':
    case 'dom.clear':
    case 'dom.select':
    case 'dom.press':
    case 'dom.drag':
    case 'dom.scroll':
    case 'dom.wait':
    case 'dom.script':
    case 'page.info':
    case 'page.source':
      return sendToContent(tabId, name, parseRpcPayload(name, payload));
    case 'page.navigate': {
      const data = parseRpcPayload('page.navigate', payload);
      assertNavigableUrl(data.url, settings);
      return navigateTab(tabId, data.url);
    }
    case 'page.back':
      return goBack(tabId);
    case 'page.forward':
      return goForward(tabId);
    case 'page.reload':
      return reloadTab(tabId);
    case 'tabs.query':
      return listTabs();
    case 'tabs.snapshot': {
      const data = parseRpcPayload('tabs.snapshot', payload);
      return Promise.all(data.tabIds.map(snapshotMentionedTab));
    }
    case 'tabs.create': {
      const data = parseRpcPayload('tabs.create', payload);
      if (data.url) assertNavigableUrl(data.url, settings);
      return createTab(data.url);
    }
    case 'tabs.switch': {
      const data = parseRpcPayload('tabs.switch', payload);
      const target = data.tabId ?? tabId;
      const result = await switchTab(target);
      await retargetAgent(tabId, target);
      return result;
    }
    case 'tabs.close': {
      const data = parseRpcPayload('tabs.close', payload);
      return closeTab(data.tabId ?? tabId);
    }
    case 'screenshot.capture': {
      const data = parseRpcPayload('screenshot.capture', payload);
      if (data.fullPage) return trimDataUrl(await captureCdpScreenshot(tabId, true));
      return trimDataUrl(await captureVisibleTab((await browser.tabs.get(tabId)).windowId));
    }
    case 'permissions.get':
      return getPermissionState();
    case 'permissions.request':
      return requestPermissions(parseRpcPayload('permissions.request', payload));
    case 'cdp.attach':
      await attachDebugger(tabId);
      return { ok: true };
    case 'cdp.detach':
      await detachDebugger(tabId);
      return { ok: true };
    case 'cdp.script': {
      const data = parseRpcPayload('cdp.script', payload);
      return evaluateExpression(tabId, data.expression, data.awaitPromise);
    }
    case 'cdp.input': {
      const data = parseRpcPayload('cdp.input', payload);
      await attachDebugger(tabId);
      if (data.type === 'move') await dispatchMove(tabId, data.x, data.y);
      else await dispatchClick(tabId, data.x, data.y);
      if (data.text) await insertText(tabId, data.text);
      return { ok: true };
    }
    case 'cdp.screenshot': {
      const data = parseRpcPayload('cdp.screenshot', payload);
      return trimDataUrl(await captureCdpScreenshot(tabId, Boolean(data.fullPage)));
    }
    case 'cdp.network':
      if (!settings.captureDevtools) return { error: '用户已关闭网络/控制台采集。' };
      return getNetworkLog(tabId, parseRpcPayload('cdp.network', payload));
    case 'cdp.console':
      if (!settings.captureDevtools) return { error: '用户已关闭网络/控制台采集。' };
      return getConsoleLog(tabId, parseRpcPayload('cdp.console', payload));
    case 'cdp.networkRequest': {
      if (!settings.captureDevtools) return { error: '用户已关闭网络/控制台采集。' };
      const data = parseRpcPayload('cdp.networkRequest', payload);
      return getNetworkRequest(tabId, data.requestId, data.includeBody);
    }
    case 'settings.get':
      return settings;
    case 'settings.set':
      return saveSettings(parseRpcPayload('settings.set', payload) as Partial<AgentSettings>);
    case 'secrets.set': {
      const data = parseRpcPayload('secrets.set', payload);
      await saveSecret(data.provider, data.apiKey);
      return { ok: true };
    }
    case 'secrets.clear':
      await clearSecrets(parseRpcPayload('secrets.clear', payload).provider);
      return { ok: true };
    case 'secrets.has':
      return secretPresence();
    case 'llm.test': {
      const data = parseRpcPayload('llm.test', payload);
      const next = await saveSettings({
        model: {
          ...settings.model,
          provider: data.provider,
          model: data.model,
          baseURL: data.baseURL,
          apiProtocol: data.apiProtocol ?? settings.model.apiProtocol,
        },
      });
      return testModelConnection(next, await loadSecrets());
    }
    case 'agent.start': {
      const data = parseRpcPayload('agent.start', payload);
      return startAgent(data.tabId ?? tabId, data.prompt, data.conversationId, data.history, data.context);
    }
    case 'session.context': {
      const data = parseRpcPayload('session.context', payload);
      const control = findRunningByTab(tabId);
      const url = await resolveTabUrl(tabId, data.url);
      if (url) await archiveTabNavigation(tabId, url);
      const stored = await readTabStore(tabId, url);
      const store = control?.store ?? stored;
      const tabUi = await loadTabUi(tabId);
      const tabOpen = store?.panelOpen ?? tabUi?.panelOpen ?? tabStores.get(tabId)?.panelOpen ?? false;
      return {
        tabId,
        sessionTabId: control?.tabId ?? tabId,
        sessionId: control?.sessionId ?? store?.sessionId,
        revision: store?.revision ?? 0,
        running: Boolean(control),
        agentActive: running.size > 0,
        conversationId: control?.conversationId ?? store?.activeId,
        panelOpen: Boolean(control) || Boolean(tabOpen),
        store,
      };
    }
    case 'session.setUi': {
      const data = parseRpcPayload('session.setUi', payload);
      const url = await resolveTabUrl(tabId);
      await saveTabUi(tabId, { panelOpen: data.panelOpen });
      const store = await readTabStore(tabId, url);
      if (!store) return { ok: true };
      await writeTabStore(tabId, { ...store, panelOpen: data.panelOpen }, url, { deleteMissing: false });
      return { ok: true };
    }
    case 'session.saveStore': {
      const data = parseRpcPayload('session.saveStore', payload);
      const senderUrl = data.url;
      const currentUrl = await resolveTabUrl(tabId);
      const senderDomain = senderUrl ? conversationVaultKey(senderUrl) : null;
      const currentDomain = currentUrl ? conversationVaultKey(currentUrl) : tabDomains.get(tabId);
      const deleted = new Set(data.deletedConversationIds ?? []);
      const incoming: PageConversationStore = {
        activeId: data.activeId,
        conversations: data.conversations.filter((item) => !deleted.has(item.id)),
        panelOpen: data.panelOpen,
        sessionId: data.sessionId,
        revision: data.revision,
      };
      const control = findRunningByTab(tabId);
      if (
        control &&
        (incoming.revision ?? 0) > (control.store.revision ?? 0) &&
        incoming.conversations.some((item) => item.id === control.conversationId)
      ) {
        control.store = incoming;
      }
      if (senderDomain && !isSparseStore(incoming)) {
        await saveVaultFromStore(senderDomain, incoming, {
          deleteMissing: !currentDomain || currentDomain === senderDomain,
        });
      }
      if (!currentDomain || !senderDomain || currentDomain === senderDomain) {
        await writeTabStore(tabId, incoming, senderUrl ?? currentUrl);
      }
      return { ok: true };
    }
    case 'agent.stop':
      stopAgent(parseRpcPayload('agent.stop', payload).tabId ?? tabId);
      return { ok: true };
    case 'agent.toggle':
      return togglePanel(tabId);
    default:
      throw new Error(`未知命令 ${name}`);
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

async function startAgent(
  tabId: number,
  prompt: string,
  conversationId?: string,
  history?: ChatMessage[],
  context?: string,
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
  const hasPrompt =
    target.messages.at(-1)?.role === 'user' &&
    target.messages.at(-1)?.content.trim() === prompt.trim();
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
            : [...item.messages, { id: nowId('m'), role: 'user' as const, content: prompt }],
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
    bridge: createBridge(control, settings),
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

function stopAgent(tabId: number) {
  const control = findRunningByTab(tabId) ?? running.get(tabId);
  control?.abort.abort();
  if (control) running.delete(control.tabId);
  running.delete(tabId);
}

export default defineBackground(() => {
  installServiceWorkerKeepAlive();
  void migrateLegacyPageStores().catch(() => {});
  void recoverInterruptedSessions().catch(() => {});

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo.url) return;
    void archiveTabNavigation(tabId, changeInfo.url).catch(() => {});
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    const control = findRunningByTab(tabId) ?? running.get(tabId);
    control?.abort.abort();
    const timer = tabStoreWriteTimers.get(tabId);
    if (timer) clearTimeout(timer);
    tabStoreWriteTimers.delete(tabId);
    pendingTabStores.delete(tabId);
    tabStores.delete(tabId);
    tabDomains.delete(tabId);
    running.delete(tabId);
    void clearTabUi(tabId).catch(() => {});
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.channel !== CHANNEL) return;
    if (message.kind === 'ping') {
      sendResponse({ ok: true });
      return;
    }
    if (!isRpcRequest(message)) return;
    const tabId = sender.tab?.id;
    handleRpc(message.name, message.payload, tabId)
      .then((result) => sendResponse({ channel: CHANNEL, kind: 'rpc-result', id: message.id, ok: true, result }))
      .catch((error) =>
        sendResponse({
          channel: CHANNEL,
          kind: 'rpc-result',
          id: message.id,
          ok: false,
          error: { code: 'rpc_error', message: toErrorMessage(error) },
        }),
      );
    return true;
  });

  browser.action.onClicked.addListener(async (tab) => {
    if (!tab.id) return;
    try {
      await togglePanel(tab.id);
    } catch (error) {
      console.warn('Pagent inject failed', error);
    }
  });

  browser.commands.onCommand.addListener(async (command, tab) => {
    if (command !== TOGGLE_PANEL_COMMAND) return;
    try {
      const tabId = tab?.id ?? (await getActiveTab()).id;
      if (!tabId) return;
      await togglePanel(tabId);
    } catch (error) {
      console.warn('Pagent shortcut failed', error);
    }
  });
});
