import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/shared/contracts/session-messages';
import {
  lastRoundStartIndex,
  messagesAfter,
  olderRoundStartId,
  visibleWindow,
  windowStartIndex,
} from '@/features/agent/ui/message-window';

function msg(id: string, role: ChatMessage['role']): ChatMessage {
  return { id, role, content: id };
}

const rounds = [
  msg('u1', 'user'),
  msg('a1', 'assistant'),
  msg('u2', 'user'),
  msg('a2', 'assistant'),
  msg('u3', 'user'),
  msg('a3', 'assistant'),
];

describe('messagesAfter', () => {
  it('keeps messages after the cutoff id', () => {
    expect(messagesAfter(rounds, 'a1').map((item) => item.id)).toEqual(['u2', 'a2', 'u3', 'a3']);
  });

  it('returns all messages when the cutoff is missing', () => {
    expect(messagesAfter(rounds, undefined)).toEqual(rounds);
    expect(messagesAfter(rounds, 'missing')).toEqual(rounds);
  });
});

describe('conversation rounds', () => {
  it('treats the latest user message as the start of the current round', () => {
    expect(lastRoundStartIndex(rounds)).toBe(4);
    expect(lastRoundStartIndex([msg('a0', 'assistant'), ...rounds.slice(0, 2)])).toBe(1);
  });

  it('renders only the latest round until a fromId is set', () => {
    expect(visibleWindow(rounds).map((item) => item.id)).toEqual(['u3', 'a3']);
    expect(visibleWindow(rounds, 'u2').map((item) => item.id)).toEqual(['u2', 'a2', 'u3', 'a3']);
  });

  it('walks back one round at a time when loading older messages', () => {
    expect(olderRoundStartId(rounds)).toBe('u2');
    expect(olderRoundStartId(rounds, 'u2')).toBe('u1');
    expect(olderRoundStartId(rounds, 'u1')).toBeUndefined();
  });

  it('falls back to the latest round when fromId cannot be found', () => {
    expect(windowStartIndex(rounds, 'gone')).toBe(4);
    expect(visibleWindow(rounds, 'gone').map((item) => item.id)).toEqual(['u3', 'a3']);
  });

  it('keeps a leading assistant in the previous round', () => {
    const leading = [msg('a0', 'assistant'), ...rounds.slice(0, 2)];
    expect(visibleWindow(leading).map((item) => item.id)).toEqual(['u1', 'a1']);
    expect(olderRoundStartId(leading)).toBe('a0');
  });
});
