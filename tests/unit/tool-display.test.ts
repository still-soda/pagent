import { describe, expect, it } from 'vitest';
import { toolChip, toolDetailLines, toolKind, toolLabel, toolUsesMono } from '@/features/agent/session/tool-display';

describe('tool display', () => {
  it('gives each built-in tool a Chinese label', () => {
    expect(toolLabel('observe_page')).toBe('观察页面');
    expect(toolLabel('click_element')).toBe('点击');
    expect(toolLabel('get_network_log')).toBe('查看网络请求');
    expect(toolLabel('execute_named_script')).toBe('运行内置脚本');
    expect(toolLabel('get_source')).toBe('查看源码');
    expect(toolLabel('inspect_element_tree')).toBe('查看元素结构');
  });

  it('describes the action instead of a terminal invocation', () => {
    expect(toolChip('search_page_text', { query: '登录' })).toBe('查找「登录」');
    expect(toolChip('navigate', { url: 'https://example.com/docs' })).toBe('example.com/docs');
    expect(toolChip('type_text', { text: 'hello@site.com' })).toBe('「hello@site.com」');
    expect(toolChip('press_key', { key: 'Enter' })).toBe('按 Enter');
    expect(toolChip('execute_named_script', { name: 'extract_links' })).toBe('提取链接');
    expect(toolChip('get_source', { type: 'dom' })).toBe('实时 HTML');
    expect(toolChip('get_source', { type: 'scripts', grep: 'gtag' })).toBe('scripts 搜索「gtag」');
    expect(toolChip('observe_page', {}, 'running')).toBe('查看当前页面');
    expect(toolChip('inspect_element_tree', { elementId: 'el_example' })).toBe('根元素 el_example');
  });

  it('only treats page scripts as monospaced', () => {
    expect(toolKind('click_element')).toBe('click');
    expect(toolUsesMono('click_element')).toBe(false);
    expect(toolUsesMono('execute_cdp_script')).toBe(true);
  });

  it('keeps tool details on a single compact line', () => {
    expect(toolDetailLines({ query: '登录', maxResults: 8 }, undefined, 'running')).toEqual([
      '{"query":"登录","maxResults":8}',
    ]);
    expect(toolDetailLines({}, '标题：首页', 'done')).toEqual(['标题：首页']);
    expect(toolDetailLines(undefined, '第一行\n第二行', 'done')).toEqual(['第一行 第二行']);
    expect(toolDetailLines(undefined, undefined, 'error')).toEqual(['调用失败']);
    expect(toolDetailLines(undefined, undefined, 'running')).toEqual(['正在执行…']);
  });
});
