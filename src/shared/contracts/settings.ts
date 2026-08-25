export const PROVIDER_IDS = [
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'openai-compatible',
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export const API_PROTOCOLS = ['chat-completions', 'responses'] as const;

export type ApiProtocol = (typeof API_PROTOCOLS)[number];

export type ExecutionMode = 'dom' | 'cdp';

export type ModelSettings = {
  provider: ProviderId;
  model: string;
  baseURL?: string;
  apiProtocol: ApiProtocol;
  persistKey: boolean;
};

export const PROVIDER_PRESETS: Record<
  ProviderId,
  { label: string; model: string; apiProtocol: ApiProtocol; baseURL?: string }
> = {
  openai: { label: 'OpenAI', model: 'gpt-4o-mini', apiProtocol: 'chat-completions' },
  anthropic: { label: 'Anthropic', model: 'claude-sonnet-4-6', apiProtocol: 'chat-completions' },
  google: { label: 'Google', model: 'gemini-2.0-flash', apiProtocol: 'chat-completions' },
  deepseek: {
    label: 'DeepSeek',
    model: 'deepseek-v4-flash',
    apiProtocol: 'chat-completions',
    baseURL: 'https://api.deepseek.com',
  },
  'openai-compatible': {
    label: 'OpenAI Compatible',
    model: 'gpt-4o-mini',
    apiProtocol: 'chat-completions',
  },
};

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

export function providerSupportsResponsesApi(provider: ProviderId): boolean {
  return provider === 'openai' || provider === 'openai-compatible';
}

export type CatalogModel = {
  id: string;
  label: string;
  tag: string;
  apiProtocol: ApiProtocol;
};

export const PROVIDER_MODELS: Record<ProviderId, CatalogModel[]> = {
  openai: [
    { id: 'gpt-4o-mini', label: 'gpt-4o-mini', tag: 'Fast', apiProtocol: 'chat-completions' },
    { id: 'gpt-4o', label: 'gpt-4o', tag: 'Flagship', apiProtocol: 'chat-completions' },
    { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini', tag: 'Fast', apiProtocol: 'chat-completions' },
    { id: 'gpt-4.1', label: 'gpt-4.1', tag: 'Flagship', apiProtocol: 'chat-completions' },
    { id: 'o4-mini', label: 'o4-mini', tag: 'Reasoning', apiProtocol: 'responses' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6', tag: 'Sonnet', apiProtocol: 'chat-completions' },
    { id: 'claude-opus-4-6', label: 'claude-opus-4-6', tag: 'Opus', apiProtocol: 'chat-completions' },
    { id: 'claude-haiku-4-5', label: 'claude-haiku-4-5', tag: 'Haiku', apiProtocol: 'chat-completions' },
  ],
  google: [
    { id: 'gemini-2.0-flash', label: 'gemini-2.0-flash', tag: 'Flash', apiProtocol: 'chat-completions' },
    { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash', tag: 'Flash', apiProtocol: 'chat-completions' },
    { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro', tag: 'Pro', apiProtocol: 'chat-completions' },
  ],
  deepseek: [
    { id: 'deepseek-v4-flash', label: 'deepseek-v4-flash', tag: 'Fast', apiProtocol: 'chat-completions' },
    { id: 'deepseek-v4-pro', label: 'deepseek-v4-pro', tag: 'Pro', apiProtocol: 'chat-completions' },
    { id: 'deepseek-chat', label: 'deepseek-chat', tag: 'Chat', apiProtocol: 'chat-completions' },
    { id: 'deepseek-reasoner', label: 'deepseek-reasoner', tag: 'Reasoning', apiProtocol: 'chat-completions' },
  ],
  'openai-compatible': [
    { id: 'gpt-4o-mini', label: 'gpt-4o-mini', tag: 'Compat', apiProtocol: 'chat-completions' },
  ],
};

export function modelsForProvider(provider: ProviderId): CatalogModel[] {
  return PROVIDER_MODELS[provider];
}

export function resolveCatalogModel(provider: ProviderId, model: string): CatalogModel {
  return (
    PROVIDER_MODELS[provider].find((item) => item.id === model) ?? {
      id: model,
      label: model,
      tag: PROVIDER_PRESETS[provider].label,
      apiProtocol: PROVIDER_PRESETS[provider].apiProtocol,
    }
  );
}

export type AgentSettings = {
  model: ModelSettings;
  executionMode: ExecutionMode;
  allowCdpScript: boolean;
  allowCrossOrigin: boolean;
  captureScreenshots: boolean;
  captureDevtools: boolean;
  maxModelCalls: number;
  maxToolCalls: number;
  maxDurationMs: number;
  theme: 'light' | 'dark' | 'system';
};

export type SecretMap = Partial<Record<ProviderId, string>>;

export type PermissionState = {
  allSites: boolean;
  debugger: boolean;
  tabs: boolean;
  origins: string[];
};

export const DEFAULT_SETTINGS: AgentSettings = {
  model: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiProtocol: 'chat-completions',
    persistKey: true,
  },
  executionMode: 'dom',
  allowCdpScript: false,
  allowCrossOrigin: false,
  captureScreenshots: true,
  captureDevtools: true,
  maxModelCalls: 24,
  maxToolCalls: 40,
  maxDurationMs: 8 * 60 * 1000,
  theme: 'system',
};
