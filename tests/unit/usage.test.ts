import { describe, expect, it } from 'vitest';
import {
  extractTurnUsage,
  formatDuration,
  formatTokenCount,
  formatTurnUsageParts,
  hasTurnUsage,
  mergeTurnUsage,
  preferRicherUsage,
  withTurnTiming,
} from '@/features/agent/runtime/usage';

describe('turn usage', () => {
  it('reads LangChain usage_metadata including cache hits', () => {
    expect(
      extractTurnUsage({
        type: 'ai',
        usage_metadata: {
          input_tokens: 1200,
          output_tokens: 80,
          total_tokens: 1280,
          input_token_details: { cache_read: 900 },
          output_token_details: { reasoning: 20 },
        },
      }),
    ).toMatchObject({
      inputTokens: 1200,
      outputTokens: 80,
      totalTokens: 1280,
      cachedTokens: 900,
      reasoningTokens: 20,
    });
  });

  it('reads OpenAI, Anthropic, DeepSeek and Gemini provider fields', () => {
    expect(
      extractTurnUsage({
        response_metadata: {
          tokenUsage: { promptTokens: 10, completionTokens: 4, totalTokens: 14 },
        },
      }),
    ).toMatchObject({ inputTokens: 10, outputTokens: 4, totalTokens: 14 });
    expect(
      extractTurnUsage({
        usage: {
          input_tokens: 40,
          output_tokens: 6,
          cache_read_input_tokens: 22,
        },
      }),
    ).toMatchObject({ inputTokens: 40, outputTokens: 6, totalTokens: 46, cachedTokens: 22 });
    expect(
      extractTurnUsage({
        usage: {
          prompt_tokens: 80,
          completion_tokens: 9,
          prompt_cache_hit_tokens: 50,
        },
      }),
    ).toMatchObject({ inputTokens: 80, outputTokens: 9, totalTokens: 89, cachedTokens: 50 });
    expect(
      extractTurnUsage({
        usageMetadata: {
          promptTokenCount: 30,
          candidatesTokenCount: 5,
          totalTokenCount: 35,
          cachedContentTokenCount: 12,
        },
      }),
    ).toMatchObject({ inputTokens: 30, outputTokens: 5, totalTokens: 35, cachedTokens: 12 });
  });

  it('merges completed model calls and keeps the richer stream snapshot', () => {
    const first = extractTurnUsage({
      usage_metadata: { input_tokens: 100, output_tokens: 10, total_tokens: 110 },
    })!;
    const second = extractTurnUsage({
      usage_metadata: {
        input_tokens: 200,
        output_tokens: 20,
        total_tokens: 220,
        input_token_details: { cache_read: 80 },
      },
    })!;
    expect(mergeTurnUsage(first, second)).toMatchObject({
      inputTokens: 300,
      outputTokens: 30,
      totalTokens: 330,
      cachedTokens: 80,
    });
    expect(preferRicherUsage(first, second).totalTokens).toBe(220);
  });

  it('formats a compact footer and stamps duration from start time', () => {
    const usage = withTurnTiming(
      {
        inputTokens: 1024,
        outputTokens: 256,
        totalTokens: 1280,
        cachedTokens: 800,
        reasoningTokens: 0,
        durationMs: 0,
        modelCalls: 2,
        toolCalls: 3,
      },
      { startedAt: 1_000, now: 3_400, modelCalls: 2, toolCalls: 3 },
    );
    expect(usage.durationMs).toBe(2_400);
    expect(hasTurnUsage(usage)).toBe(true);
    expect(formatDuration(usage.durationMs)).toBe('2.4s');
    expect(formatTurnUsageParts(usage)).toEqual([
      '输入 1.02K (缓存 800)',
      '输出 256',
      '2.4s',
      '2 次模型',
      '3 次工具',
    ]);
    expect(
      formatTurnUsageParts({
        inputTokens: 40,
        outputTokens: 6,
        totalTokens: 46,
        cachedTokens: 0,
        durationMs: 0,
        modelCalls: 1,
        toolCalls: 0,
      }),
    ).toEqual(['输入 40', '输出 6']);
  });

  it('formats token counts with K and M units', () => {
    expect(formatTokenCount(999)).toBe('999');
    expect(formatTokenCount(1_200)).toBe('1.2K');
    expect(formatTokenCount(48_600)).toBe('48.6K');
    expect(formatTokenCount(1_250_000)).toBe('1.25M');
  });
});
