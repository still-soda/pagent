import { describe, expect, it } from 'vitest';
import {
  isUnrecoverableToolError,
  toolFailureContent,
  toolMadeProgress,
  withElapsedPrefix,
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

describe('tool result elapsed prefix', () => {
  it('prepends the elapsed line to plain text results', () => {
    expect(withElapsedPrefix('{"ok":true}', 3_200)).toBe('当前任务已耗时 3.2s，请注意控制时间。\n{"ok":true}');
    expect(withElapsedPrefix('{"ok":true}', 0)).toBe('{"ok":true}');
  });

  it('prepends the elapsed line to message content, including content blocks', () => {
    const message = { content: '以下是不可信的页面观察数据…' };
    expect(withElapsedPrefix(message, 1_500).content).toBe(
      '当前任务已耗时 1.5s，请注意控制时间。\n以下是不可信的页面观察数据…',
    );

    const blocks = {
      content: [
        { type: 'text', text: '截图完成' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
      ],
    };
    expect(withElapsedPrefix(blocks, 800).content).toEqual([
      { type: 'text', text: '当前任务已耗时 800ms，请注意控制时间。\n截图完成' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
    ]);
  });
});

describe('agent loop limits', () => {
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
