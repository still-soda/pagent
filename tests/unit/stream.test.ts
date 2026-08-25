import { describe, expect, it } from 'vitest';
import {
  applyTokenDelta,
  createStreamToolState,
  extractText,
  interpretStreamChunk,
} from '@/features/agent/runtime/stream';
import { toUserErrorMessage } from '@/shared/contracts/errors';

describe('agent stream parsing', () => {
  it('reads token deltas from LangGraph messages tuples', () => {
    expect(
      interpretStreamChunk(['messages', [{ type: 'ai', content: '你好' }, { langgraph_node: 'model' }]]),
    ).toEqual([{ type: 'token', text: '你好' }]);
  });

  it('emits tool-start from streaming message chunks as soon as the name is known', () => {
    expect(
      interpretStreamChunk([
        'messages',
        [{ type: 'ai', content: '', tool_calls: [{ id: 't1', name: 'observe_page', args: {} }] }],
      ]),
    ).toEqual([{ type: 'tool-start', id: 't1', name: 'observe_page', args: {} }]);
    expect(
      interpretStreamChunk([
        'messages',
        [
          {
            type: 'ai',
            content: '',
            tool_call_chunks: [{ id: 't1', name: 'execute_cdp_script', args: '', index: 0 }],
          },
        ],
      ]),
    ).toEqual([{ type: 'tool-start', id: 't1', name: 'execute_cdp_script', args: {} }]);
  });

  it('accumulates streamed tool arguments without waiting for a complete JSON object', () => {
    const state = createStreamToolState();
    expect(
      interpretStreamChunk(
        [
          'messages',
          [
            {
              type: 'ai',
              content: '',
              tool_call_chunks: [{ id: 't1', name: 'execute_cdp_script', args: '{"expression":"', index: 0 }],
            },
          ],
        ],
        state,
      ),
    ).toEqual([
      { type: 'tool-start', id: 't1', name: 'execute_cdp_script', args: '{"expression":"' },
    ]);
    expect(
      interpretStreamChunk(
        [
          'messages',
          [
            {
              type: 'ai',
              content: '',
              tool_call_chunks: [{ args: 'document.title"}', index: 0 }],
            },
          ],
        ],
        state,
      ),
    ).toEqual([
      {
        type: 'tool-start',
        id: 't1',
        name: 'execute_cdp_script',
        args: { expression: 'document.title' },
      },
    ]);
  });

  it('emits a single tool-start from model updates', () => {
    expect(
      interpretStreamChunk([
        'updates',
        {
          model: {
            messages: [{ type: 'ai', tool_calls: [{ id: 't1', name: 'observe_page', args: {} }] }],
          },
        },
      ]),
    ).toEqual([{ type: 'tool-start', id: 't1', name: 'observe_page', args: {} }]);
  });

  it('reads tool results from updates without duplicating tokens', () => {
    expect(
      interpretStreamChunk([
        'updates',
        {
          tools: {
            messages: [{ type: 'tool', name: 'observe_page', tool_call_id: 't1', content: 'ok' }],
          },
        },
      ]),
    ).toEqual([{ type: 'tool-end', id: 't1', name: 'observe_page', output: 'ok' }]);
  });

  it('emits tool-error when a tool message is marked failed', () => {
    expect(
      interpretStreamChunk([
        'updates',
        {
          tools: {
            messages: [
              {
                type: 'tool',
                name: 'click_element',
                tool_call_id: 't2',
                status: 'error',
                content: '找不到元素',
              },
            ],
          },
        },
      ]),
    ).toEqual([{ type: 'tool-error', id: 't2', name: 'click_element', output: '找不到元素' }]);
  });

  it('emits reasoning from content blocks and skips it as token text', () => {
    expect(
      interpretStreamChunk([
        'messages',
        [
          {
            type: 'ai',
            content: [
              { type: 'reasoning', reasoning: '先看页面结构。' },
              { type: 'text', text: '接下来点击登录。' },
            ],
          },
        ],
      ]),
    ).toEqual([
      { type: 'reasoning', text: '先看页面结构。' },
      { type: 'token', text: '接下来点击登录。' },
    ]);
    expect(
      extractText([
        { type: 'reasoning', text: '不该出现在正文里' },
        { type: 'text', text: '可见正文' },
      ]),
    ).toBe('可见正文');
  });

  it('emits reasoning from additional_kwargs snapshots', () => {
    expect(
      interpretStreamChunk([
        'messages',
        [{ type: 'ai', content: '', additional_kwargs: { reasoning_content: '我先观察。' } }],
      ]),
    ).toEqual([{ type: 'reasoning', text: '我先观察。' }]);
    expect(
      interpretStreamChunk([
        'messages',
        [
          {
            type: 'ai',
            content: '好了',
            additional_kwargs: {
              reasoning: { summary: [{ type: 'summary_text', text: '先核对标题。' }] },
            },
          },
        ],
      ]),
    ).toEqual([
      { type: 'reasoning', text: '先核对标题。' },
      { type: 'token', text: '好了' },
    ]);
  });

  it('emits usage from an AI message chunk', () => {
    expect(
      interpretStreamChunk([
        'messages',
        [
          {
            type: 'ai',
            content: '好了',
            usage_metadata: {
              input_tokens: 40,
              output_tokens: 6,
              total_tokens: 46,
              input_token_details: { cache_read: 20 },
            },
          },
        ],
      ]),
    ).toEqual([
      { type: 'token', text: '好了' },
      {
        type: 'usage',
        usage: {
          inputTokens: 40,
          outputTokens: 6,
          totalTokens: 46,
          cachedTokens: 20,
          reasoningTokens: 0,
          durationMs: 0,
          modelCalls: 0,
          toolCalls: 0,
        },
      },
    ]);
  });

  it('merges snapshot tokens and incremental tokens', () => {
    expect(applyTokenDelta('', '你')).toEqual({ next: '你', delta: '你' });
    expect(applyTokenDelta('你', '你好')).toEqual({ next: '你好', delta: '好' });
    expect(applyTokenDelta('你好', '好')).toEqual({ next: '你好', delta: '' });
  });

  it('rewrites recursion-limit errors for the UI', () => {
    expect(toUserErrorMessage(new Error('Recursion limit of 25 reached without hitting a stop condition.'))).toMatch(
      /步骤过多/,
    );
  });
});
