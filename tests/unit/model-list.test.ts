import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearModelListCache,
  fetchProviderModels,
} from '@/features/settings/model-list';

type FetchHandler = (url: string, init?: RequestInit) => { ok: boolean; status: number; body: unknown };

function mockFetch(handler: FetchHandler) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const { ok, status, body } = handler(url, init);
    return {
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  clearModelListCache();
  vi.unstubAllGlobals();
});

describe('fetchProviderModels', () => {
  it('fetches OpenAI-compatible models with Bearer auth', async () => {
    const fetchMock = mockFetch((url, init) => ({
      ok: true,
      status: 200,
      body: { data: [{ id: 'kimi-k2-0711-preview' }, { id: 'moonshot-v1-8k' }] },
    }));
    const models = await fetchProviderModels('moonshot', { apiKey: 'sk-1', baseURL: 'https://api.moonshot.cn/v1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.moonshot.cn/v1/models');
    expect(((fetchMock.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>).Authorization).toBe('Bearer sk-1');
    expect(models.map((m) => m.id)).toEqual(['kimi-k2-0711-preview', 'moonshot-v1-8k']);
  });

  it('maps OpenAI reasoning models to the responses protocol', async () => {
    mockFetch(() => ({
      ok: true,
      status: 200,
      body: { data: [{ id: 'o3-mini' }, { id: 'gpt-4o-mini' }, { id: 'gpt-5' }] },
    }));
    const models = await fetchProviderModels('openai', { apiKey: 'sk-1' });
    expect(models.find((m) => m.id === 'o3-mini')?.apiProtocol).toBe('responses');
    expect(models.find((m) => m.id === 'gpt-4o-mini')?.apiProtocol).toBe('chat-completions');
    expect(models.find((m) => m.id === 'gpt-5')?.apiProtocol).toBe('chat-completions');
  });

  it('paginates Anthropic model list with cursor', async () => {
    const fetchMock = mockFetch((url, init) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers['x-api-key']).toBe('sk-ant-1');
      expect(headers['anthropic-version']).toBe('2023-06-01');
      if (String(url).includes('after_id=m2')) {
        return {
          ok: true,
          status: 200,
          body: {
            data: [{ id: 'claude-haiku-4-5', display_name: 'Claude Haiku 4.5' }],
            has_more: false,
          },
        };
      }
      return {
        ok: true,
        status: 200,
        body: {
          data: [
            { id: 'claude-sonnet-4', display_name: 'Claude Sonnet 4' },
            { id: 'claude-opus-4', display_name: 'Claude Opus 4' },
          ],
          has_more: true,
          last_id: 'm2',
        },
      };
    });
    const models = await fetchProviderModels('anthropic', { apiKey: 'sk-ant-1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toContain('after_id=m2');
    expect(models.map((m) => m.id)).toEqual(['claude-sonnet-4', 'claude-opus-4', 'claude-haiku-4-5']);
    expect(models[2]?.label).toBe('Claude Haiku 4.5');
  });

  it('filters non-generative Google models and uses key query param', async () => {
    const fetchMock = mockFetch((url) => ({
      ok: true,
      status: 200,
      body: {
        models: [
          { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/text-embedding-001', displayName: 'Embedding', supportedGenerationMethods: ['embedContent'] },
        ],
      },
    }));
    const models = await fetchProviderModels('google', { apiKey: 'AIza-1' });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/v1beta/models?key=AIza-1');
    expect(models.map((m) => m.id)).toEqual(['gemini-2.5-flash']);
    expect(models[0]?.label).toBe('Gemini 2.5 Flash');
  });

  it('builds the Ollama tags URL from the /v1 runtime base', async () => {
    const fetchMock = mockFetch((url) => ({
      ok: true,
      status: 200,
      body: { models: [{ name: 'qwen3:8b' }, { model: 'llama3.1:8b' }] },
    }));
    const models = await fetchProviderModels('ollama', { baseURL: 'http://localhost:11434/v1' });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:11434/api/tags');
    expect(models.map((m) => m.id)).toEqual(['qwen3:8b', 'llama3.1:8b']);
  });

  it('requires a key for authenticated providers', async () => {
    await expect(fetchProviderModels('anthropic', {})).rejects.toThrow(/API Key/);
    await expect(fetchProviderModels('google', {})).rejects.toThrow(/API Key/);
  });

  it('requires a Base URL for custom compatible endpoints', async () => {
    await expect(fetchProviderModels('openai-compatible', { apiKey: 'sk-1' })).rejects.toThrow(/Base URL/);
  });

  it('reports auth failures with a friendly message', async () => {
    mockFetch(() => ({ ok: false, status: 401, body: { error: { message: 'bad key' } } }));
    await expect(fetchProviderModels('deepseek', { apiKey: 'sk-bad' })).rejects.toThrow(/API Key 无效/);
  });

  it('caches results within TTL and refreshes on force', async () => {
    const fetchMock = mockFetch(() => ({
      ok: true,
      status: 200,
      body: { data: [{ id: 'glm-4.6' }] },
    }));
    await fetchProviderModels('zhipu', { apiKey: 'id.secret' });
    await fetchProviderModels('zhipu', { apiKey: 'id.secret' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await fetchProviderModels('zhipu', { apiKey: 'id.secret', force: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
