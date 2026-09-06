import { describe, expect, it } from 'vitest';
import { emptyConversation } from '@/features/agent/session/conversations';
import {
  adoptLiveStore,
  applyAgentEventToStore,
  sessionIsOnTab,
  shouldRestoreLiveSession,
} from '@/features/agent/session/session-live';
import type { PageConversationStore } from '@/shared/contracts/session';

describe('live session presence', () => {
  it('is only on the current tab while the agent is running there', () => {
    expect(sessionIsOnTab({ tabId: 3, sessionTabId: 3, running: true })).toBe(true);
    expect(sessionIsOnTab({ tabId: 3, sessionTabId: 8, running: true })).toBe(false);
    expect(sessionIsOnTab({ tabId: 3, sessionTabId: 3, running: false })).toBe(false);
    expect(sessionIsOnTab({ tabId: 3, running: true })).toBe(true);
  });

  it('restores when this tab becomes the live session or the conversation changes', () => {
    const incoming = { tabId: 4, sessionTabId: 4, running: true, conversationId: 'c2' };
    expect(
      shouldRestoreLiveSession({
        alreadyAttached: false,
        context: incoming,
      }),
    ).toBe(true);
    expect(
      shouldRestoreLiveSession({
        alreadyAttached: true,
        attachedConversationId: 'c1',
        context: incoming,
      }),
    ).toBe(true);
    expect(
      shouldRestoreLiveSession({
        alreadyAttached: true,
        attachedConversationId: 'c2',
        context: incoming,
      }),
    ).toBe(false);
    expect(
      shouldRestoreLiveSession({
        alreadyAttached: false,
        context: { tabId: 4, sessionTabId: 9, running: true, conversationId: 'c2' },
      }),
    ).toBe(false);
  });

  it('adopts the live conversation onto the destination tab store', () => {
    const live = emptyConversation('跨页任务');
    live.messages = [{ id: 'm1', role: 'user', content: '去另一个标签' }];
    const local = emptyConversation('本页');
    local.messages = [{ id: 'm0', role: 'user', content: '先看看这个页' }];
    const adopted = adoptLiveStore(
      { activeId: local.id, conversations: [local] },
      { activeId: live.id, conversations: [live] },
      live.id,
    );
    expect(adopted.activeId).toBe(live.id);
    expect(adopted.panelOpen).toBe(true);
    expect(adopted.conversations.map((item) => item.id).sort()).toEqual([live.id, local.id].sort());
  });

  it('keeps a complete authoritative snapshot while no content script is listening', () => {
    const conversation = emptyConversation('刷新中的任务');
    conversation.running = true;
    let store: PageConversationStore = {
      activeId: conversation.id,
      conversations: [conversation],
      sessionId: 's1',
      revision: 1,
    };
    store = applyAgentEventToStore(store, conversation.id, {
      type: 'token',
      text: '刷新期间生成的回答',
    });
    store = applyAgentEventToStore(store, conversation.id, {
      type: 'tool-start',
      id: 't1',
      name: 'page.info',
      args: {},
    });
    store = applyAgentEventToStore(store, conversation.id, {
      type: 'tool-end',
      id: 't1',
      name: 'page.info',
      output: '完成',
      elapsedMs: 1800,
    });
    store = applyAgentEventToStore(store, conversation.id, {
      type: 'usage',
      usage: {
        inputTokens: 40,
        outputTokens: 8,
        totalTokens: 48,
        cachedTokens: 16,
        durationMs: 1800,
        modelCalls: 1,
        toolCalls: 1,
      },
    });
    store = applyAgentEventToStore(store, conversation.id, { type: 'done' });

    expect(store.revision).toBe(6);
    expect(store.conversations[0]).toMatchObject({
      running: false,
      thinking: '',
      tasks: [{ id: 't1', status: 'done', detail: '完成' }],
    });
    expect(store.conversations[0]?.messages[0]).toMatchObject({
      content: '刷新期间生成的回答',
      usage: { totalTokens: 48, cachedTokens: 16, durationMs: 1800 },
      tools: [{ id: 't1', status: 'done', output: '完成', elapsedMs: 1800 }],
    });
  });
});
