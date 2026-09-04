import { describe, expect, it } from 'vitest';
import {
  assertUsageWithinBudget,
  isUnrecoverableToolError,
  toolFailureContent,
  toolMadeProgress,
} from '@/features/agent/runtime/middleware';

describe('tool error recovery', () => {
  it('turns ordinary tool failures into a message the model can continue from', () => {
    expect(isUnrecoverableToolError(new Error('找不到元素 e12'))).toBe(false);
    expect(toolFailureContent('click_element', new Error('找不到元素 e12'))).toContain('调用失败');
    expect(toolFailureContent('click_element', new Error('找不到元素 e12'))).toContain('点击');
  });

  it('still stops on abort', () => {
    const abort = new Error('任务已停止');
    abort.name = 'AbortError';
    expect(isUnrecoverableToolError(abort)).toBe(true);
    expect(isUnrecoverableToolError(new Error('任务已停止'))).toBe(true);
    expect(isUnrecoverableToolError(Object.assign(new Error('interrupt'), { is_bubble_up: true }))).toBe(true);
  });
});

describe('agent loop limits', () => {
  it('enforces configured model, tool and duration budgets', () => {
    const usage = { modelCalls: 2, toolCalls: 3, startedAt: 100 };
    expect(() =>
      assertUsageWithinBudget(usage, { maxModelCalls: 2 }, 'model', 110),
    ).toThrow(/模型调用上限/);
    expect(() =>
      assertUsageWithinBudget(usage, { maxToolCalls: 3 }, 'tool', 110),
    ).toThrow(/工具调用上限/);
    expect(() =>
      assertUsageWithinBudget(usage, { maxDurationMs: 10 }, 'tool', 110),
    ).toThrow(/时长上限/);
  });

  it('only treats verified state changes as progress', () => {
    expect(toolMadeProgress('search_page_text', { content: '{"total":0,"count":0}' })).toBe(false);
    expect(toolMadeProgress('search_page_text', { content: '{"total":3,"count":3}' })).toBe(false);
    expect(toolMadeProgress('get_source', { content: '{"content":"useful text"}' })).toBe(false);
    expect(toolMadeProgress('click_element', { content: '{"ok":true}' })).toBe(false);
    expect(toolMadeProgress('observe_page_changes', { content: '{"changed":true}' })).toBe(true);
    expect(toolMadeProgress('interact_elements', { content: '{"satisfied":true,"changed":false}' })).toBe(false);
    expect(toolMadeProgress('interact_elements', { content: '{"satisfied":true,"changed":true}' })).toBe(true);
  });
});
