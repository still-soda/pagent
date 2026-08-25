import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPT, buildSystemPrompt } from '../../lib/agent/prompts';

describe('system prompt', () => {
  it('appends mentioned-tab context without changing the base prompt', () => {
    expect(buildSystemPrompt()).toBe(SYSTEM_PROMPT);
    expect(buildSystemPrompt('  ')).toBe(SYSTEM_PROMPT);
    const next = buildSystemPrompt('用户通过 @ 附加了这些浏览器标签页。');
    expect(next.startsWith(SYSTEM_PROMPT)).toBe(true);
    expect(next).toContain('用户通过 @ 附加了这些浏览器标签页。');
  });
});
