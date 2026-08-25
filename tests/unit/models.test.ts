import { describe, expect, it } from 'vitest';
import { createChatModel, resolveApiProtocol, resolveModelBaseURL } from '../../lib/agent/models';
import {
  DEFAULT_SETTINGS,
  modelsForProvider,
  providerSupportsResponsesApi,
  resolveCatalogModel,
  type AgentSettings,
} from '../../lib/shared/types';
import { parseRpcPayload } from '../../lib/shared/rpc';

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
});
