import { describe, expect, it } from 'vitest';
import {
  MEMORY_WRITE_RULES,
  SYSTEM_PROMPT,
  buildSystemPrompt,
} from '@/features/agent/runtime/prompts';

describe('system prompt', () => {
  it('appends mentioned-tab context without changing the base prompt', () => {
    expect(buildSystemPrompt()).toContain(SYSTEM_PROMPT);
    expect(buildSystemPrompt('  ')).toContain(SYSTEM_PROMPT);
    const next = buildSystemPrompt('用户通过 @ 附加了这些浏览器标签页。');
    expect(next).toMatch(/^<pagent_prompt>/);
    expect(next).toContain('<runtime_context>用户通过 @ 附加了这些浏览器标签页。</runtime_context>');
    expect(next).toMatch(/<\/pagent_prompt>$/);
  });

  it('marks recalled memories as trusted and includes extensible write rules', () => {
    const next = buildSystemPrompt(undefined, '- [mem_1] 长期记忆');
    expect(next).toContain('<memory_context trust="trusted">');
    expect(next).toContain('- [mem_1] 长期记忆');
    expect(next).not.toContain('不可信的历史记忆');
    expect(next).toContain('查找过去是否有执行同类任务的经验');
    expect(next).toContain('用一个完整自然语言问题查询');
    expect(next).toContain('创建多条独立记忆');
    expect(next).toContain('禁止把多组 QA 合并到一条记忆');
    for (const rule of MEMORY_WRITE_RULES) expect(next).toContain(rule);
    expect(buildSystemPrompt(undefined, undefined, false)).toContain(
      '如果开启了长期记忆，当用户要求执行任务时，先考虑调用 memory_search',
    );
  });
});
