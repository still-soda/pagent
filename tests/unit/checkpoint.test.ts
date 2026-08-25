import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkpointKey,
  clearCheckpoint,
  loadCheckpoints,
  saveCheckpoint,
} from '@/features/agent/session/checkpoint';
import { resetSessionStorageForTests } from '@/shared/storage/storage';

describe('agent checkpoints', () => {
  beforeEach(async () => {
    await resetSessionStorageForTests();
  });

  it('keeps concurrent sessions independently and clears one by session id', async () => {
    const first = {
      tabId: 1,
      sessionId: 's1',
      conversationId: 'c1',
      updatedAt: Date.now(),
      running: true,
      messages: [],
      tasks: [],
      modelCalls: 1,
      toolCalls: 0,
    };
    const second = { ...first, tabId: 2, sessionId: 's2', conversationId: 'c2' };
    await Promise.all([saveCheckpoint(first), saveCheckpoint(second)]);
    expect(Object.keys(await loadCheckpoints()).sort()).toEqual(['s1', 's2']);

    await clearCheckpoint(checkpointKey(first));
    expect(Object.keys(await loadCheckpoints())).toEqual(['s2']);
  });
});
