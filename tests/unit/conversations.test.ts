import { describe, expect, it } from 'vitest';
import {
  adoptTabStore,
  conversationPageKey,
  conversationTabKey,
  emptyConversation,
  isSparseStore,
  mergeConversationStores,
  pickConversationStore,
  nextConversationTitle,
  formatConversationTime,
  groupConversationsByTime,
  restoreConversationStore,
  settleFinishedConversation,
  titleFromPrompt,
} from '../../lib/conversations';

describe('page conversations', () => {
  it('can still derive a legacy origin+path key', () => {
    expect(conversationPageKey('https://example.com/docs?x=1#hash')).toBe(
      'https://example.com/docs',
    );
  });

  it('keys live sessions by tab so in-tab navigation keeps the chat', () => {
    expect(conversationTabKey(42)).toBe('tab:42');
  });

  it('merges two non-empty stores by conversation id', () => {
    const first = emptyConversation('一');
    first.messages = [{ id: 'm1', role: 'user', content: 'hello' }];
    const second = emptyConversation('二');
    second.messages = [{ id: 'm2', role: 'user', content: 'world' }];
    const merged = mergeConversationStores(
      { activeId: first.id, conversations: [first] },
      { activeId: second.id, conversations: [second] },
    );
    expect(merged.conversations.map((item) => item.id).sort()).toEqual([first.id, second.id].sort());
    expect(merged.activeId).toBe(second.id);
  });

  it('prefers a finished reply with more text over a stale still-running snapshot', () => {
    const streaming = emptyConversation('工作');
    streaming.running = true;
    streaming.messages = [{ id: 'm1', role: 'assistant', content: '可用模型：`deepseek-v' }];
    const finished = emptyConversation('工作');
    finished.id = streaming.id;
    finished.running = false;
    finished.messages = [
      {
        id: 'm1',
        role: 'assistant',
        content: '可用模型：`deepseek-v4-flash` 和 `deepseek-chat`',
      },
    ];
    const merged = mergeConversationStores(
      { activeId: finished.id, conversations: [finished] },
      { activeId: streaming.id, conversations: [streaming] },
    );
    expect(merged.conversations[0]?.messages[0]?.content).toContain('deepseek-chat');
    expect(merged.conversations[0]?.running).toBe(false);
  });

  it('does not pick another tab or site store just because it has more messages', () => {
    const empty = emptyConversation('会话 1');
    const filled = emptyConversation('工作');
    filled.messages = [{ id: 'm1', role: 'user', content: '继续' }];
    const emptyStore = { activeId: empty.id, conversations: [empty] };
    const filledStore = { activeId: filled.id, conversations: [filled] };
    expect(isSparseStore(emptyStore)).toBe(true);
    expect(
      mergeConversationStores(filledStore, emptyStore).conversations[0]?.messages,
    ).toEqual(filled.messages);
    expect(
      pickConversationStore(
        {
          'tab:7': emptyStore,
          'https://example.com/old': filledStore,
        },
        7,
        'https://example.com/new',
      )?.activeId,
    ).toBe(empty.id);
    expect(
      pickConversationStore(
        {
          'tab:8': emptyStore,
          'https://example.com/old': filledStore,
        },
        9,
        'https://example.com/other',
      ),
    ).toBeNull();
  });

  it('keeps an existing tab store when a sparse snapshot arrives after refresh', () => {
    const filled = emptyConversation('工作');
    filled.messages = [{ id: 'm1', role: 'user', content: '还在' }];
    const persisted = { activeId: filled.id, conversations: [filled], panelOpen: true };
    const incoming = {
      activeId: 'fresh',
      conversations: [emptyConversation('会话 1')],
    };
    const adopted = adoptTabStore(incoming, persisted);
    expect(adopted.conversations[0]?.messages[0]?.content).toBe('还在');
    expect(adopted.activeId).toBe(filled.id);
    expect(adopted.panelOpen).toBe(true);
  });

  it('preserves panelOpen when a later save omits it', () => {
    const filled = emptyConversation('工作');
    filled.messages = [{ id: 'm1', role: 'user', content: '还在' }];
    const adopted = adoptTabStore(
      { activeId: filled.id, conversations: [filled] },
      { activeId: filled.id, conversations: [filled], panelOpen: true },
    );
    expect(adopted.panelOpen).toBe(true);
    expect(adopted.conversations[0]?.messages[0]?.content).toBe('还在');
  });

  it('accepts a newer destructive snapshot instead of resurrecting cleared content', () => {
    const filled = emptyConversation('工作');
    filled.revision = 1;
    filled.messages = [{ id: 'm1', role: 'user', content: '应被清空' }];
    const cleared = { ...filled, revision: 2, messages: [] };
    const adopted = adoptTabStore(
      { activeId: cleared.id, conversations: [cleared], revision: 2 },
      { activeId: filled.id, conversations: [filled], revision: 1 },
    );
    expect(adopted.conversations[0]?.messages).toEqual([]);
  });

  it('accepts a newer list that explicitly removed a conversation', () => {
    const removed = emptyConversation('删除我');
    removed.messages = [{ id: 'm1', role: 'user', content: '旧内容' }];
    const kept = emptyConversation('保留');
    const adopted = adoptTabStore(
      { activeId: kept.id, conversations: [kept], revision: 3 },
      { activeId: removed.id, conversations: [removed, kept], revision: 2 },
    );
    expect(adopted.conversations.map((item) => item.id)).toEqual([kept.id]);
  });

  it('lets a newer finished conversation override an equally long running snapshot', () => {
    const running = emptyConversation('任务');
    running.revision = 4;
    running.running = true;
    running.messages = [{ id: 'm1', role: 'assistant', content: '完整回答' }];
    const finished = { ...running, revision: 5, running: false };
    const merged = mergeConversationStores(
      { activeId: running.id, conversations: [running] },
      { activeId: finished.id, conversations: [finished] },
    );
    expect(merged.conversations[0]?.running).toBe(false);
  });

  it('allocates the next unused session title', () => {
    expect(nextConversationTitle(['会话 1', '会话 3'])).toBe('会话 2');
  });

  it('groups history by recency and keeps newer items first', () => {
    const now = Date.parse('2026-08-24T15:00:00+08:00');
    const today = { id: 'a', title: '今天的会话', updatedAt: now - 10 * 60_000 };
    const yesterday = { id: 'b', title: '昨天的会话', updatedAt: now - 26 * 60 * 60_000 };
    const lastWeek = { id: 'c', title: '上周的会话', updatedAt: now - 4 * 86_400_000 };
    const older = { id: 'd', title: '更早的会话', updatedAt: now - 20 * 86_400_000 };
    expect(groupConversationsByTime([older, lastWeek, today, yesterday], now).map((group) => [
      group.label,
      group.items.map((item) => item.id),
    ])).toEqual([
      ['今天', ['a']],
      ['昨天', ['b']],
      ['过去 7 天', ['c']],
      ['更早', ['d']],
    ]);
    expect(formatConversationTime(today.updatedAt, now)).toMatch(/^\d{1,2}:\d{2}$/);
    expect(formatConversationTime(older.updatedAt, now)).toMatch(/\d+[/-月]/);
  });

  it('renames a default session from the first prompt', () => {
    expect(titleFromPrompt('会话 1', '帮我点掉弹窗')).toBe('帮我点掉弹窗');
    expect(titleFromPrompt('已命名', '下一句')).toBe('已命名');
  });

  it('clears leftover running tools when a conversation is no longer live', () => {
    const finished = emptyConversation('已结束');
    finished.running = true;
    finished.thinking = '正在执行 click…';
    finished.tasks = [{ id: 't1', title: 'click', status: 'running' }];
    finished.messages = [
      {
        id: 'm1',
        role: 'assistant',
        content: '',
        parts: [{ type: 'tool', id: 't1', name: 'click', status: 'running' }],
      },
    ];
    const settled = settleFinishedConversation(finished);
    expect(settled.running).toBe(false);
    expect(settled.thinking).toBe('');
    expect(settled.tasks[0]?.status).toBe('done');
    expect(settled.messages[0]?.parts?.[0]).toMatchObject({ id: 't1', status: 'done' });
  });

  it('does not treat a finished store as still running after restore', () => {
    const finished = emptyConversation('已结束');
    finished.running = true;
    finished.thinking = '正在执行 click…';
    finished.messages = [
      {
        id: 'm1',
        role: 'assistant',
        content: '',
        parts: [{ type: 'tool', id: 't1', name: 'click', status: 'running' }],
      },
    ];
    const restored = restoreConversationStore(
      { activeId: finished.id, conversations: [finished] },
      { running: false, conversationId: finished.id },
    );
    expect(restored.conversations[0]?.running).toBe(false);
    expect(restored.conversations[0]?.thinking).toBe('');
    expect(restored.conversations[0]?.messages[0]?.parts?.[0]).toMatchObject({ status: 'done' });
  });
});
