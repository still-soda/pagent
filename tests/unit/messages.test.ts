import { describe, expect, it } from 'vitest';
import {
  applyAssistantFinalText,
  applyAssistantThinking,
  applyAssistantToken,
  applyAssistantToolResult,
  applyAssistantToolStart,
  applyAssistantUsage,
  messageBlocks,
  settleAssistantMessages,
  shouldHoldToolGroupOpen,
  toModelMessages,
} from '../../lib/messages';
import type { ChatMessage } from '../../lib/shared/types';

describe('assistant message parts', () => {
  it('keeps a longer streamed reply when a shorter snapshot arrives', () => {
    let messages: ChatMessage[] = [];
    messages = applyAssistantToken(messages, '可用模型：`deepseek-v4-flash` 和 `deepseek-chat`', 'm1');
    expect(applyAssistantFinalText(messages, '可用模型：`deepseek-v', 'm1')[0]?.content).toContain(
      'deepseek-chat',
    );
    expect(
      applyAssistantFinalText(messages, '可用模型：`deepseek-v4-flash` 和 `deepseek-chat` 以及 `deepseek-reasoner`', 'm1')[0]
        ?.content,
    ).toContain('deepseek-reasoner');
  });

  it('keeps tool calls between the surrounding text', () => {
    let messages: ChatMessage[] = [{ id: 'u1', role: 'user', content: '看一下' }];
    messages = applyAssistantToken(messages, '先观察页面。', 'm1');
    messages = applyAssistantToolStart(
      messages,
      { id: 't1', name: 'observe_page', args: {}, status: 'running' },
      'm1',
    );
    messages = applyAssistantToolResult(messages, 't1', 'done', '标题：首页');
    messages = applyAssistantToken(messages, '接下来点击登录。', 'm1');

    const assistant = messages.at(-1)!;
    expect(messageBlocks(assistant)).toEqual([
      { type: 'text', text: '先观察页面。' },
      {
        type: 'tools',
        tools: [
          {
            type: 'tool',
            id: 't1',
            name: 'observe_page',
            args: {},
            status: 'done',
            output: '标题：首页',
          },
        ],
      },
      { type: 'text', text: '接下来点击登录。' },
    ]);
    expect(assistant.content).toBe('先观察页面。接下来点击登录。');
  });

  it('groups consecutive tools and still places later text after them', () => {
    let messages: ChatMessage[] = [];
    messages = applyAssistantToolStart(
      messages,
      { id: 't1', name: 'observe_page', status: 'running' },
      'm1',
    );
    messages = applyAssistantToolStart(
      messages,
      { id: 't2', name: 'click', status: 'running' },
      'm1',
    );
    messages = applyAssistantToken(messages, '完成。', 'm1');

    expect(messageBlocks(messages[0]!)).toEqual([
      {
        type: 'tools',
        tools: [
          { type: 'tool', id: 't1', name: 'observe_page', status: 'running' },
          { type: 'tool', id: 't2', name: 'click', status: 'running' },
        ],
      },
      { type: 'text', text: '完成。' },
    ]);
  });

  it('holds a tool group open until the reply body starts or the turn ends', () => {
    const tools = {
      type: 'tools' as const,
      tools: [{ type: 'tool' as const, id: 't1', name: 'observe_page', status: 'done' as const }],
    };
    const thinking = { type: 'thinking' as const, text: '先看结果。' };
    const text = { type: 'text' as const, text: '已经打开登录框。' };

    expect(shouldHoldToolGroupOpen(true, [])).toBe(true);
    expect(shouldHoldToolGroupOpen(true, [thinking])).toBe(true);
    expect(shouldHoldToolGroupOpen(true, [text])).toBe(false);
    expect(shouldHoldToolGroupOpen(false, [])).toBe(false);
    expect(shouldHoldToolGroupOpen(true, [tools])).toBe(true);
  });

  it('settles leftover running tools after the run ends', () => {
    let messages: ChatMessage[] = [];
    messages = applyAssistantToolStart(
      messages,
      { id: 't1', name: 'click', status: 'running' },
      'm1',
    );
    messages = settleAssistantMessages(messages);
    expect(messages[0]?.parts?.[0]).toMatchObject({ id: 't1', status: 'done' });
  });

  it('turns prior turns into model history and drops the trailing prompt', () => {
    expect(
      toModelMessages(
        [
          { id: 'u1', role: 'user', content: '先观察页面' },
          { id: 'a1', role: 'assistant', content: ' 已经打开登录框。 ' },
          { id: 'u2', role: 'user', content: '然后填邮箱' },
        ],
        '然后填邮箱',
      ),
    ).toEqual([
      { role: 'user', content: '先观察页面' },
      { role: 'assistant', content: '已经打开登录框。' },
    ]);
  });

  it('keeps thinking blocks before later tools and text', () => {
    let messages: ChatMessage[] = [];
    messages = applyAssistantThinking(messages, '先观察页面。', 'm1');
    messages = applyAssistantToolStart(
      messages,
      { id: 't1', name: 'observe_page', status: 'running' },
      'm1',
    );
    messages = applyAssistantToken(messages, '打开登录框。', 'm1');

    const assistant = messages.at(-1)!;
    expect(messageBlocks(assistant)).toEqual([
      { type: 'thinking', text: '先观察页面。' },
      {
        type: 'tools',
        tools: [{ type: 'tool', id: 't1', name: 'observe_page', status: 'running' }],
      },
      { type: 'text', text: '打开登录框。' },
    ]);
    expect(assistant.thinking).toBe('先观察页面。');
    expect(assistant.content).toBe('打开登录框。');
  });

  it('does not send thinking back as model history', () => {
    expect(
      toModelMessages(
        [
          { id: 'u1', role: 'user', content: '看一下' },
          {
            id: 'a1',
            role: 'assistant',
            content: '已经打开登录框。',
            thinking: '用户想登录。',
            parts: [
              { type: 'thinking', text: '用户想登录。' },
              { type: 'text', text: '已经打开登录框。' },
            ],
          },
        ],
        '看一下',
      ),
    ).toEqual([
      { role: 'user', content: '看一下' },
      { role: 'assistant', content: '已经打开登录框。' },
    ]);
  });

  it('updates args on a tool that is already on screen', () => {
    let messages: ChatMessage[] = [];
    messages = applyAssistantToolStart(
      messages,
      { id: 't1', name: 'execute_cdp_script', args: '{"expression":"', status: 'running' },
      'm1',
    );
    messages = applyAssistantToolStart(
      messages,
      { id: 't1', name: 'execute_cdp_script', args: { expression: 'document.title' }, status: 'running' },
      'm1',
    );

    expect(messages[0]?.parts?.[0]).toMatchObject({
      id: 't1',
      args: { expression: 'document.title' },
      status: 'running',
    });
  });

  it('keeps richer args when a later start event is empty', () => {
    let messages: ChatMessage[] = [];
    messages = applyAssistantToolStart(
      messages,
      { id: 't1', name: 'observe_page', args: { reason: '登录框' }, status: 'running' },
      'm1',
    );
    messages = applyAssistantToolStart(
      messages,
      { id: 't1', name: 'observe_page', args: {}, status: 'running' },
      'm1',
    );

    expect(messages[0]?.parts?.[0]).toMatchObject({
      id: 't1',
      args: { reason: '登录框' },
    });
  });

  it('attaches turn usage to the latest assistant message', () => {
    const usage = {
      inputTokens: 12,
      outputTokens: 3,
      totalTokens: 15,
      cachedTokens: 4,
      durationMs: 1200,
      modelCalls: 1,
      toolCalls: 0,
    };
    let messages: ChatMessage[] = applyAssistantToken([], '先观察页面。', 'm1');
    messages = applyAssistantUsage(messages, usage, 'm1');
    expect(messages[0]).toMatchObject({ content: '先观察页面。', usage });
    messages = applyAssistantToken(messages, '再点击登录。', 'm1');
    expect(messages[0]?.usage).toEqual(usage);
  });

  it('renders legacy messages as thinking, tools, then text', () => {
    expect(
      messageBlocks({
        id: 'm1',
        role: 'assistant',
        content: '好了',
        thinking: '先想一下',
        tools: [{ id: 't1', name: 'observe_page', status: 'done' }],
      }),
    ).toEqual([
      { type: 'thinking', text: '先想一下' },
      { type: 'tools', tools: [{ type: 'tool', id: 't1', name: 'observe_page', status: 'done' }] },
      { type: 'text', text: '好了' },
    ]);
  });
});
