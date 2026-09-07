import { describe, expect, it } from 'vitest';
import {
  applyAgentEventToConversations,
  applyStreamPending,
  patchConversation,
} from '@/features/agent/ui/hooks/agent-session-reducer';

describe('agent-session-reducer', () => {
  const base = {
    id: 'c1',
    title: '会话 1',
    createdAt: 1,
    updatedAt: 1,
    messages: [],
    tasks: [],
    error: '',
    thinking: '',
    running: true,
    budget: { modelCalls: 0, toolCalls: 0 },
    vaults: [],
  };

  it('patches a single conversation with revision bump', () => {
    const next = patchConversation([base], 'c1', (item) => ({ ...item, thinking: 'busy' }));
    expect(next[0]?.thinking).toBe('busy');
    expect(next[0]?.revision).toBe(1);
  });

  it('applies stream pending token updates', () => {
    const next = applyStreamPending([base], { targetId: 'c1', token: 'hello', reasoning: '', tools: [] });
    expect(next[0]?.messages.at(-1)?.content).toContain('hello');
  });

  it('applies thinking events', () => {
    const next = applyAgentEventToConversations([base], 'c1', { type: 'thinking', text: '分析页面' });
    expect(next[0]?.thinking).toBe('分析页面');
  });
});
