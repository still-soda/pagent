import { CHANNEL } from '@/shared/contracts/channel';
import { toErrorMessage } from '@/shared/contracts/errors';
import { isProtectedUrl } from '@/shared/contracts/errors';
import {
  attachDebugger,
  captureCdpScreenshot,
  dispatchClick,
  dispatchMove,
  evaluateExpression,
  getConsoleLog,
  getNetworkLog,
  getNetworkRequest,
  insertText,
} from '@/shared/browser/cdp';
import {
  closeTab,
  createTab,
  goBack,
  goForward,
  listTabs,
  navigateTab,
  reloadTab,
  switchTab,
} from '@/shared/browser/tabs';
import { captureVisibleTab, trimDataUrl } from '@/shared/browser/screenshot';
import { callMcpTool, listMcpTools } from '@/features/mcp/background/mcp-manager';
import type { AgentSettings } from '@/shared/contracts/settings';
import type { AgentControl } from './agent-controller';
import { queryMemory, writeMemory } from '@/features/memory/service';

const CONTENT_FILE = '/content-scripts/content.js';

export async function sendToContent<T>(tabId: number, name: string, payload: unknown = {}): Promise<T> {
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

export async function ensureContentScript(tabId: number): Promise<void> {
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

export async function togglePanel(tabId: number) {
  await sendToContent(tabId, 'ui.toggle', {});
  return { ok: true };
}

export async function snapshotMentionedTab(tabId: number) {
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

export function createBridge(
  control: AgentControl,
  settings: AgentSettings,
  retargetAgent: (fromTabId: number, toTabId: number) => Promise<void>,
) {
  const tabId = () => control.tabId;
  const currentUrl = async () => (await browser.tabs.get(tabId())).url;
  const captureWithHiddenPanel = async <T>(capture: (targetTabId: number) => Promise<T>): Promise<T> => {
    const targetTabId = tabId();
    await sendToContent(targetTabId, 'ui.capture.start', {});
    try {
      return await capture(targetTabId);
    } finally {
      await sendToContent(targetTabId, 'ui.capture.end', {}).catch(() => {});
    }
  };
  return {
    get tabId() {
      return tabId();
    },
    settings,
    content: <T,>(name: string, payload?: unknown) => sendToContent<T>(tabId(), name, payload),
    screenshot: async (fullPage?: boolean) =>
      captureWithHiddenPanel(async (targetTabId) => {
        if (fullPage) return trimDataUrl(await captureCdpScreenshot(targetTabId, true));
        const tab = await browser.tabs.get(targetTabId);
        return trimDataUrl(await captureVisibleTab(tab.windowId));
      }),
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
        captureWithHiddenPanel(async (targetTabId) =>
          trimDataUrl(await captureCdpScreenshot(targetTabId, Boolean(fullPage))),
        ),
      network: (filter?: Parameters<typeof getNetworkLog>[1]) => getNetworkLog(tabId(), filter),
      console: (filter?: Parameters<typeof getConsoleLog>[1]) => getConsoleLog(tabId(), filter),
      request: (requestId: string, includeBody?: boolean) =>
        getNetworkRequest(tabId(), requestId, includeBody),
    },
    mcp: {
      listTools: listMcpTools,
      callTool: (name: string, args: unknown) => callMcpTool(name, args),
    },
    memory: {
      search: async (query: string, limit?: number) => queryMemory(query, await currentUrl(), limit),
      write: async (content: string, scope: 'global' | 'local', memoryId?: string) =>
        writeMemory({ content, scope, memoryId, url: await currentUrl() }),
    },
  };
}
