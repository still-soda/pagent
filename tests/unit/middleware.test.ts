import { describe, expect, it } from 'vitest';
import { isUnrecoverableToolError, toolFailureContent } from '@/features/agent/runtime/middleware';

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
