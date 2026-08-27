import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cosineSimilarity, embeddingFingerprint, searchMemories } from '@/features/memory/retrieval';
import {
  getMemory,
  listMemoriesForDomain,
  putMemory,
  resetMemoryStorageForTests,
} from '@/features/memory/storage';
import { writeMemory } from '@/features/memory/service';
import { sanitizeUrl } from '@/shared/contracts/policy';
import { DEFAULT_SETTINGS } from '@/shared/contracts/settings';
import {
  clearMemorySecret,
  resetSessionStorageForTests,
  saveMemorySecret,
} from '@/shared/storage/storage';
import type { MemoryRecord } from '@/shared/contracts/memory';

const memorySettings = DEFAULT_SETTINGS.memory;

function record(
  id: string,
  scope: 'global' | 'local',
  vector: number[],
  domain?: string,
): MemoryRecord {
  const embedding = new Float32Array(vector);
  return {
    id,
    content: id,
    scope,
    domain,
    embedding: embedding.buffer.slice(0) as ArrayBuffer,
    embeddingModel: embeddingFingerprint(memorySettings),
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('Memory RAG', () => {
  beforeEach(async () => {
    resetMemoryStorageForTests();
    await resetSessionStorageForTests();
    await clearMemorySecret();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores embeddings as binary ArrayBuffer', async () => {
    await putMemory(record('binary', 'global', [0.25, 0.5]));
    const loaded = await getMemory('binary');
    expect(loaded?.embedding).toBeInstanceOf(ArrayBuffer);
    expect([...new Float32Array(loaded!.embedding)]).toEqual([0.25, 0.5]);
  });

  it('combines global memory with only the current domain', async () => {
    await putMemory(record('global', 'global', [1, 0]));
    await putMemory(record('local-a', 'local', [1, 0], 'a.example'));
    await putMemory(record('local-b', 'local', [1, 0], 'b.example'));
    await expect(listMemoriesForDomain('a.example')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'global' }),
        expect.objectContaining({ id: 'local-a' }),
      ]),
    );
    expect((await listMemoriesForDomain('a.example')).some((item) => item.id === 'local-b')).toBe(false);
  });

  it('scans all vectors and falls back to cosine order when reranking fails', async () => {
    await putMemory(record('best', 'global', [1, 0]));
    await putMemory(record('worse', 'global', [0, 1]));
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding: [1, 0] }] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'unavailable',
      }));
    const results = await searchMemories({
      query: 'query',
      domain: 'a.example',
      settings: memorySettings,
      apiKey: 'test-key',
    });
    expect(results.map((item) => item.id)).toEqual(['best', 'worse']);
    expect(results[0]).not.toHaveProperty('createdAt');
    expect(results[0]).not.toHaveProperty('updatedAt');
  });

  it('removes reranked memories with scores below 0.2', async () => {
    await putMemory(record('high', 'global', [1, 0]));
    await putMemory(record('low', 'global', [0, 1]));
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding: [1, 0] }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { index: 0, relevance_score: 0.8 },
            { index: 1, relevance_score: 0.19 },
          ],
        }),
      }));
    const results = await searchMemories({
      query: 'query',
      domain: 'a.example',
      settings: memorySettings,
      apiKey: 'test-key',
    });
    expect(results).toEqual([
      expect.objectContaining({ id: 'high', score: 0.8 }),
    ]);
  });

  it('writes local memory with a redacted URL and generated binary vector', async () => {
    await saveMemorySecret('test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [1, 0, 0] }] }),
    }));
    const saved = await writeMemory({
      content: '记住这个做法',
      scope: 'local',
      url: 'https://example.com/path?token=secret-value&tab=1',
    });
    const loaded = await getMemory(saved.id);
    expect(saved.domain).toBe('example.com');
    expect(saved.sourceUrl).toContain('token=%5Bredacted%5D');
    expect(loaded?.embedding.byteLength).toBe(12);
  });

  it('redacts URL credentials, sensitive parameters and secrets', () => {
    const value = sanitizeUrl('https://user:pass@example.com/a?email=a@b.com&tab=sk-1234567890123456');
    expect(value).not.toContain('user:pass');
    expect(value).toContain('email=%5Bredacted%5D');
    expect(value).toContain('[redacted-key]');
    expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([1, 0]))).toBe(1);
  });
});
