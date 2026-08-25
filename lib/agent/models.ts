import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import {
  DEEPSEEK_BASE_URL,
  PROVIDER_PRESETS,
  providerSupportsResponsesApi,
  type AgentSettings,
  type ApiProtocol,
  type ProviderId,
  type SecretMap,
} from '../shared/types';

export { providerSupportsResponsesApi };

export function resolveApiKey(provider: ProviderId, secrets: SecretMap): string {
  const key = secrets[provider];
  if (!key) throw new Error(`尚未配置 ${provider} 的 API Key`);
  return key;
}

export function resolveApiProtocol(settings: AgentSettings): ApiProtocol {
  const { provider, apiProtocol } = settings.model;
  if (providerSupportsResponsesApi(provider)) {
    return apiProtocol ?? PROVIDER_PRESETS[provider].apiProtocol;
  }
  return 'chat-completions';
}

export function resolveModelBaseURL(settings: AgentSettings): string | undefined {
  const { provider, baseURL } = settings.model;
  if (provider === 'deepseek') return baseURL?.trim() || DEEPSEEK_BASE_URL;
  if (provider === 'openai-compatible') {
    if (!baseURL?.trim()) throw new Error('兼容端点需要填写 Base URL');
    return baseURL.trim();
  }
  return baseURL?.trim() || undefined;
}

export function createChatModel(settings: AgentSettings, secrets: SecretMap) {
  const { provider, model } = settings.model;
  const apiKey = resolveApiKey(provider, secrets);

  if (provider === 'anthropic') {
    return new ChatAnthropic({ apiKey, model, temperature: 0 });
  }
  if (provider === 'google') {
    return new ChatGoogleGenerativeAI({ apiKey, model, temperature: 0 });
  }

  const baseURL = resolveModelBaseURL(settings);
  const protocol = resolveApiProtocol(settings);
  return new ChatOpenAI({
    apiKey,
    model,
    temperature: 0,
    streaming: true,
    useResponsesApi: protocol === 'responses',
    ...(provider === 'deepseek'
      ? protocol === 'responses'
        ? { modelKwargs: { reasoning: { effort: 'high' } } }
        : {
            modelKwargs: {
              thinking: { type: 'enabled' },
              reasoning_effort: 'high',
            },
          }
      : {}),
    configuration: baseURL ? { baseURL } : undefined,
  });
}

export async function testModelConnection(settings: AgentSettings, secrets: SecretMap) {
  const model = createChatModel(settings, secrets);
  const result = await model.invoke('只回复：ok');
  return {
    ok: true,
    preview: typeof result.content === 'string' ? result.content : JSON.stringify(result.content),
  };
}
