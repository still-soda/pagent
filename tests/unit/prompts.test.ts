import { describe, expect, it } from 'vitest';
import {
  MEMORY_WRITE_RULES,
  SYSTEM_PROMPT,
  buildSystemPrompt,
} from '@/features/agent/runtime/prompts';

describe('system prompt', () => {
  it('appends mentioned-tab context without changing the base prompt', () => {
    expect(buildSystemPrompt().startsWith(SYSTEM_PROMPT)).toBe(true);
    expect(buildSystemPrompt('  ').startsWith(SYSTEM_PROMPT)).toBe(true);
    const next = buildSystemPrompt('用户通过 @ 附加了这些浏览器标签页。');
    expect(next.startsWith(SYSTEM_PROMPT)).toBe(true);
    expect(next).toContain('用户通过 @ 附加了这些浏览器标签页。');
  });

  it('marks recalled memories as trusted and includes extensible write rules', () => {
    const next = buildSystemPrompt(undefined, '- [mem_1] 长期记忆');
    expect(next).toContain('<memory_context>');
    expect(next).toContain('以下是可信的长期记忆');
    expect(next).not.toContain('不可信的历史记忆');
    for (const rule of MEMORY_WRITE_RULES) expect(next).toContain(rule);
    expect(buildSystemPrompt(undefined, undefined, false)).not.toContain('memory_search');
  });
});
