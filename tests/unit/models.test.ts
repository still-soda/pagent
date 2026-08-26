import { describe, expect, it } from 'vitest';
import { createChatModel, resolveApiProtocol, resolveModelBaseURL } from '@/features/agent/runtime/models';
import {
  API_PROTOCOLS,
  DEFAULT_SETTINGS,
  PROVIDER_IDS,
  resolveModelList,
  modelsForProvider,
  providerSupportsResponsesApi,
  providerUsesOpenAICompat,
  resolveCatalogModel,
  type AgentSettings,
} from '@/shared/contracts/settings';
import { parseRpcPayload } from '@/shared/contracts/rpc';

function settings(patch: Partial<AgentSettings['model']>): AgentSettings {
  return {
    ...DEFAULT_SETTINGS,
    model: { ...DEFAULT_SETTINGS.model, ...patch },
  };
}

describe('model providers', () => {
  it('uses DeepSeek chat completions so streamed reasoning is preserved', () => {
    const deepseek = settings({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      apiProtocol: 'chat-completions',
    });
    expect(providerSupportsResponsesApi('deepseek')).toBe(false);
    expect(resolveApiProtocol(deepseek)).toBe('chat-completions');
    expect(resolveModelBaseURL(deepseek)).toBe('https://api.deepseek.com');
    expect(createChatModel(deepseek, { deepseek: 'sk-test' })).toMatchObject({
      useResponsesApi: false,
      modelKwargs: {
        thinking: { type: 'enabled' },
        reasoning_effort: 'high',
      },
    });
  });

  it('enables DeepSeek thinking for chat completions', () => {
    const deepseek = settings({
      provider: 'deepseek',
      model: 'deepseek-reasoner',
      apiProtocol: 'chat-completions',
    });
    expect(createChatModel(deepseek, { deepseek: 'sk-test' })).toMatchObject({
      useResponsesApi: false,
      modelKwargs: {
        thinking: { type: 'enabled' },
        reasoning_effort: 'high',
      },
    });
  });

  it('keeps OpenAI on chat completions unless requested', () => {
    expect(resolveApiProtocol(DEFAULT_SETTINGS)).toBe('chat-completions');
    expect(
      resolveApiProtocol(settings({ provider: 'openai', apiProtocol: 'responses' })),
    ).toBe('responses');
  });

  it('requires a base URL for compatible endpoints', () => {
    expect(() => resolveModelBaseURL(settings({ provider: 'openai-compatible' }))).toThrow(
      /Base URL/,
    );
    expect(
      resolveModelBaseURL(
        settings({ provider: 'openai-compatible', baseURL: 'https://example.com/v1' }),
      ),
    ).toBe('https://example.com/v1');
  });

  it('lists real models for each provider', () => {
    expect(modelsForProvider('deepseek').map((item) => item.id)).toContain('deepseek-v4-flash');
    expect(resolveCatalogModel('deepseek', 'deepseek-v4-flash').apiProtocol).toBe('chat-completions');
    expect(resolveCatalogModel('deepseek', 'deepseek-chat').apiProtocol).toBe('chat-completions');
    expect(resolveCatalogModel('openai', 'gpt-4o-mini').id).toBe('gpt-4o-mini');
  });

  it('accepts DeepSeek in secret and test RPC payloads', () => {
    expect(
      parseRpcPayload('secrets.set', { provider: 'deepseek', apiKey: 'sk-test' }),
    ).toEqual({ provider: 'deepseek', apiKey: 'sk-test' });
    expect(
      parseRpcPayload('llm.test', {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        apiProtocol: 'responses',
      }),
    ).toMatchObject({
      provider: 'deepseek',
      apiProtocol: 'responses',
    });
  });

  it('each provider exposes a distinct non-empty catalog', () => {
    const signatures = PROVIDER_IDS.map((id) => JSON.stringify(modelsForProvider(id).map((m) => m.id)));
    expect(new Set(signatures).size).toBe(PROVIDER_IDS.length);
    for (const id of PROVIDER_IDS) {
      const catalog = modelsForProvider(id);
      expect(catalog.length).toBeGreaterThan(0);
      for (const model of catalog) {
        expect(API_PROTOCOLS).toContain(model.apiProtocol);
        expect(model.id).toBeTruthy();
      }
    }
  });

  it('resolves preset base URLs for OpenAI-compatible providers', () => {
    expect(resolveModelBaseURL(settings({ provider: 'moonshot' }))).toBe('https://api.moonshot.cn/v1');
    expect(resolveModelBaseURL(settings({ provider: 'qwen' }))).toBe(
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
    );
    expect(resolveModelBaseURL(settings({ provider: 'ollama' }))).toBe('http://localhost:11434/v1');
    // 原生 SDK 服务商不套用 preset baseURL
    expect(resolveModelBaseURL(settings({ provider: 'anthropic' }))).toBeUndefined();
  });

  it('builds an Ollama chat model without a key', () => {
    const ollama = settings({ provider: 'ollama', model: 'qwen3:8b' });
    expect(providerUsesOpenAICompat('ollama')).toBe(true);
    expect(() => createChatModel(ollama, {})).not.toThrow();
    expect(createChatModel(ollama, {})).toMatchObject({
      useResponsesApi: false,
      clientConfig: { baseURL: 'http://localhost:11434/v1' },
    });
  });

  it('replaces the static catalog entirely once online models are fetched', () => {
    const base = modelsForProvider('deepseek');
    const online = [
      { id: 'deepseek-chat', label: 'deepseek-chat (new)', tag: 'DeepSeek', apiProtocol: 'chat-completions' as const },
      { id: 'deepseek-new-model', label: 'deepseek-new-model', tag: 'DeepSeek', apiProtocol: 'chat-completions' as const },
    ];
    // 在线列表非空时完全覆写，不包含任何内置模型
    expect(resolveModelList(base, online).map((m) => m.id)).toEqual([
      'deepseek-chat',
      'deepseek-new-model',
    ]);
    // 未拉取到在线列表（未获取/为空）时回退内置目录
    expect(resolveModelList(base)).toEqual(base);
    expect(resolveModelList(base, [])).toEqual(base);
  });

  it('parses models.list RPC payloads', () => {
    expect(parseRpcPayload('models.list', { provider: 'moonshot' })).toEqual({ provider: 'moonshot' });
    expect(
      parseRpcPayload('models.list', { provider: 'ollama', baseURL: 'http://127.0.0.1:11434', force: true }),
    ).toEqual({ provider: 'ollama', baseURL: 'http://127.0.0.1:11434', force: true });
    expect(() => parseRpcPayload('models.list', { provider: 'unknown' })).toThrow();
  });
});
