import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { handleContentCommand } from '@/features/page/content-command-handler';
import { dispatchUiCommand, uiEvents } from '@/features/page/ui-events';
import { retargetAgent, running } from '@/features/agent/background/agent-controller';
import { tabStores } from '@/features/agent/background/tab-store';
import { useAgentEventConsumer } from '@/features/agent/ui/hooks/useAgentEventConsumer';
import * as contentBridge from '@/features/agent/background/content-bridge';
import * as storage from '@/shared/storage/storage';
import { CHANNEL } from '@/shared/contracts/channel';

// @ts-expect-error test environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('tab retarget ui collapse and expand', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('handleContentCommand handles ui.collapse', () => {
    const result = handleContentCommand('ui.collapse', {});
    expect(result).toEqual({ ok: true, uiCommand: 'ui.collapse' });
  });

  it('dispatchUiCommand dispatches collapse event on uiEvents', () => {
    let collapsed = false;
    const onCollapse = () => {
      collapsed = true;
    };
    uiEvents.addEventListener('collapse', onCollapse);
    dispatchUiCommand('ui.collapse');
    uiEvents.removeEventListener('collapse', onCollapse);
    expect(collapsed).toBe(true);
  });

  it('retargetAgent collapses old tab and expands new tab', async () => {
    const fromTabId = 101;
    const toTabId = 202;

    const fromStore = {
      activeId: 'c1',
      conversations: [
        {
          id: 'c1',
          title: '跨页测试',
          createdAt: 1,
          updatedAt: 1,
          messages: [],
          tasks: [],
          error: '',
          thinking: '',
          running: true,
          budget: { modelCalls: 0, toolCalls: 0 },
          vaults: [],
        },
      ],
      panelOpen: true,
      sessionId: 's1',
      revision: 1,
    };

    const control = {
      abort: new AbortController(),
      conversationId: 'c1',
      sessionId: 's1',
      store: fromStore,
      tabId: fromTabId,
    };

    running.clear();
    running.set(fromTabId, control);
    tabStores.set(fromTabId, fromStore);

    const sendToContentSpy = vi.spyOn(contentBridge, 'sendToContent').mockResolvedValue({ ok: true });
    const ensureContentScriptSpy = vi.spyOn(contentBridge, 'ensureContentScript').mockResolvedValue(undefined);
    const saveTabUiSpy = vi.spyOn(storage, 'saveTabUi').mockResolvedValue(undefined);

    const sentMessages: Array<{ tabId: number; message: unknown }> = [];
    browser.tabs.sendMessage = vi.fn(async (tabId: number, message: unknown) => {
      sentMessages.push({ tabId, message });
    }) as unknown as typeof browser.tabs.sendMessage;
    browser.tabs.get = vi.fn(async () => ({ id: toTabId, url: 'https://example.com' })) as unknown as typeof browser.tabs.get;

    await retargetAgent(fromTabId, toTabId);

    // 验证 control 迁移到了新 tab
    expect(running.has(fromTabId)).toBe(false);
    expect(running.get(toTabId)?.tabId).toBe(toTabId);

    // 验证旧 tab 面板状态被收起
    expect(fromStore.panelOpen).toBe(false);
    expect(saveTabUiSpy).toHaveBeenCalledWith(fromTabId, { panelOpen: false });
    expect(sendToContentSpy).toHaveBeenCalledWith(fromTabId, 'ui.collapse', {});
    expect(sentMessages).toContainEqual({
      tabId: fromTabId,
      message: expect.objectContaining({
        channel: CHANNEL,
        kind: 'agent-retarget',
        working: false,
      }),
    });

    // 验证新 tab 被确保脚本并展开
    expect(ensureContentScriptSpy).toHaveBeenCalledWith(toTabId);
    expect(saveTabUiSpy).toHaveBeenCalledWith(toTabId, { panelOpen: true });
    expect(sendToContentSpy).toHaveBeenCalledWith(toTabId, 'ui.open', {});
    expect(sentMessages).toContainEqual({
      tabId: toTabId,
      message: expect.objectContaining({
        channel: CHANNEL,
        kind: 'agent-event',
        store: expect.objectContaining({ panelOpen: true }),
      }),
    });
  });

  it('useAgentEventConsumer updates workingOnThisPage on agent-retarget', async () => {
    let messageListener: ((message: unknown) => void) | undefined;
    browser.runtime.onMessage.addListener = vi.fn((fn) => {
      messageListener = fn;
    }) as unknown as typeof browser.runtime.onMessage.addListener;
    browser.runtime.onMessage.removeListener = vi.fn() as unknown as typeof browser.runtime.onMessage.removeListener;

    const runningIdRef = { current: 'c1' as string | null };
    const revisionRef = { current: 1 };
    const sessionIdRef = { current: 's1' as string | undefined };
    const conversationsRef = { current: [] };
    const setConversations = vi.fn();
    const setActiveId = vi.fn();
    const setRevision = vi.fn();
    const setSessionId = vi.fn();
    const setWorkingOnThisPage = vi.fn();
    const setAgentActive = vi.fn();

    function ConsumerWrapper() {
      useAgentEventConsumer({
        runningIdRef,
        revisionRef,
        sessionIdRef,
        conversationsRef,
        setConversations,
        setActiveId,
        setRevision,
        setSessionId,
        setWorkingOnThisPage,
        setAgentActive,
      });
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(ConsumerWrapper));
    });

    expect(browser.runtime.onMessage.addListener).toHaveBeenCalled();
    expect(messageListener).toBeDefined();

    await act(async () => {
      messageListener!({
        channel: CHANNEL,
        kind: 'agent-retarget',
        working: false,
        agentActive: true,
      });
    });

    expect(runningIdRef.current).toBe(null);
    expect(setWorkingOnThisPage).toHaveBeenCalledWith(false);
    expect(setAgentActive).toHaveBeenCalledWith(true);

    await act(async () => {
      root.unmount();
    });
  });
});
