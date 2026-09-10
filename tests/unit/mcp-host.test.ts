import { beforeEach, describe, expect, it, vi } from 'vitest';
import { running } from '@/features/agent/background/agent-controller';
import { tabStores } from '@/features/agent/background/tab-store';
import { emptyConversation } from '@/features/agent/session/conversations';
import {
  dispatchHostTask,
  getHostSession,
  listHostTabs,
} from '@/features/mcp/background/host-handlers';
import * as agentController from '@/features/agent/background/agent-controller';
import * as contentBridge from '@/features/agent/background/content-bridge';
import * as tabs from '@/shared/browser/tabs';
import * as storage from '@/shared/storage/storage';
import { DEFAULT_SETTINGS } from '@/shared/contracts/settings';
import type { PageConversationStore } from '@/shared/contracts/session';

function makeStore(overrides?: Partial<PageConversationStore>): PageConversationStore {
  const conversation = emptyConversation('测试会话', ['example.com']);
  conversation.id = 'c_live';
  conversation.thinking = '正在填写表单';
  conversation.running = true;
  conversation.messages = [
    { id: 'm1', role: 'user', content: '帮我登录' },
    { id: 'm2', role: 'assistant', content: '好的，我先观察页面' },
  ];
  conversation.tasks = [{ id: 't1', title: '观察页面', status: 'running' }];
  return {
    activeId: conversation.id,
    conversations: [conversation],
    sessionId: 's_live',
    revision: 1,
    panelOpen: true,
    ...overrides,
  };
}

describe('mcp host handlers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    running.clear();
    tabStores.clear();
    vi.spyOn(storage, 'loadSettings').mockResolvedValue(DEFAULT_SETTINGS);
    vi.spyOn(contentBridge, 'ensureContentScript').mockResolvedValue(undefined);
    vi.spyOn(contentBridge, 'sendToContent').mockResolvedValue({ ok: true });
  });

  it('lists tabs with agent working state', async () => {
    const store = makeStore();
    tabStores.set(11, store);
    running.set(11, {
      abort: new AbortController(),
      conversationId: 'c_live',
      sessionId: 's_live',
      store,
      tabId: 11,
    });

    browser.tabs.query = vi.fn(async () => [
      {
        id: 11,
        title: '工作页',
        url: 'https://a.example/app',
        active: true,
        windowId: 1,
        status: 'complete',
        pinned: false,
      },
      {
        id: 12,
        title: '其他页',
        url: 'https://b.example',
        active: false,
        windowId: 1,
        status: 'complete',
        pinned: true,
      },
      {
        id: 13,
        title: '设置',
        url: 'chrome://settings',
        active: false,
        windowId: 1,
        status: 'complete',
      },
    ]) as unknown as typeof browser.tabs.query;

    const result = await listHostTabs();
    expect(result.tabs).toHaveLength(3);
    expect(result.tabs[0]).toMatchObject({
      tabId: 11,
      title: '工作页',
      agent: {
        working: true,
        sessionId: 's_live',
        conversationId: 'c_live',
        title: '测试会话',
        thinking: '正在填写表单',
      },
      protected: false,
    });
    expect(result.tabs[1]?.agent.working).toBe(false);
    expect(result.tabs[2]).toMatchObject({
      tabId: 13,
      protected: true,
      agent: { working: false },
    });
  });

  it('dispatches a task to the active tab and opens a new conversation', async () => {
    vi.spyOn(tabs, 'getActiveTab').mockResolvedValue({
      id: 21,
      url: 'https://work.example',
    } as Awaited<ReturnType<typeof tabs.getActiveTab>>);
    browser.tabs.get = vi.fn(async () => ({
      id: 21,
      url: 'https://work.example',
    })) as unknown as typeof browser.tabs.get;
    const startSpy = vi.spyOn(agentController, 'startAgent').mockResolvedValue({
      ok: true,
      tabId: 21,
      sessionId: 's_new',
      conversationId: 'c_new',
    });

    const result = await dispatchHostTask({ prompt: '点击保存按钮' });
    expect(result).toEqual({
      ok: true,
      tabId: 21,
      sessionId: 's_new',
      conversationId: 'c_new',
    });
    expect(contentBridge.ensureContentScript).toHaveBeenCalledWith(21);
    expect(contentBridge.sendToContent).toHaveBeenCalledWith(21, 'ui.open', {});
    expect(startSpy).toHaveBeenCalledWith(21, '点击保存按钮', expect.stringMatching(/^c_/));
  });

  it('opens a url in a new tab when dispatching without tabId', async () => {
    vi.spyOn(tabs, 'createTab').mockResolvedValue({
      id: 33,
      url: 'https://form.example/new',
    } as Awaited<ReturnType<typeof tabs.createTab>>);
    browser.tabs.get = vi.fn(async () => ({
      id: 33,
      url: 'https://form.example/new',
    })) as unknown as typeof browser.tabs.get;
    vi.spyOn(agentController, 'startAgent').mockResolvedValue({
      ok: true,
      tabId: 33,
      sessionId: 's_url',
      conversationId: 'c_keep',
    });

    const result = await dispatchHostTask({
      prompt: '填写表单',
      url: 'https://form.example/new',
      conversationId: 'c_keep',
    });
    expect(tabs.createTab).toHaveBeenCalledWith('https://form.example/new');
    expect(result.tabId).toBe(33);
    expect(agentController.startAgent).toHaveBeenCalledWith(33, '填写表单', 'c_keep');
  });

  it('rejects dispatching onto a protected page', async () => {
    browser.tabs.get = vi.fn(async () => ({
      id: 8,
      url: 'chrome://extensions',
    })) as unknown as typeof browser.tabs.get;
    await expect(dispatchHostTask({ prompt: 'x', tabId: 8 })).rejects.toThrow('受浏览器保护');
  });

  it('returns live session status by sessionId', async () => {
    const store = makeStore();
    running.set(11, {
      abort: new AbortController(),
      conversationId: 'c_live',
      sessionId: 's_live',
      store,
      tabId: 11,
    });
    tabStores.set(11, store);
    browser.tabs.get = vi.fn(async () => ({
      id: 11,
      title: '工作页',
      url: 'https://a.example/app',
    })) as unknown as typeof browser.tabs.get;

    const status = await getHostSession({ sessionId: 's_live' });
    expect(status).toMatchObject({
      found: true,
      running: true,
      tabId: 11,
      sessionId: 's_live',
      conversationId: 'c_live',
      conversationTitle: '测试会话',
      thinking: '正在填写表单',
      url: 'https://a.example/app',
    });
    expect(status.messages?.map((item) => item.role)).toEqual(['user', 'assistant']);
  });

  it('falls back to tab store when the agent has finished', async () => {
    const store = makeStore();
    store.conversations[0]!.running = false;
    store.conversations[0]!.thinking = '';
    tabStores.set(44, store);
    browser.tabs.get = vi.fn(async () => ({
      id: 44,
      title: '已完成',
      url: 'https://done.example',
    })) as unknown as typeof browser.tabs.get;

    const status = await getHostSession({ conversationId: 'c_live' });
    expect(status).toMatchObject({
      found: true,
      running: false,
      tabId: 44,
      conversationId: 'c_live',
    });
  });

  it('returns not found for unknown sessions', async () => {
    await expect(getHostSession({ sessionId: 'missing' })).resolves.toEqual({
      found: false,
      running: false,
    });
  });
});
