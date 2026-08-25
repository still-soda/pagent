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

export type PageBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ObservedElement = {
  id: string;
  tag: string;
  role: string;
  name: string;
  type?: string;
  value?: string;
  href?: string;
  placeholder?: string;
  visible: boolean;
  clickable: boolean;
  disabled?: boolean;
  checked?: boolean;
  box?: PageBox;
};

export type PageObservation = {
  url: string;
  title: string;
  revision: number;
  documentId: string;
  viewport: {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
  };
  selection: string;
  headings: string[];
  frames: Array<{
    index: number;
    sameOrigin: boolean;
    url?: string;
  }>;
  elements: ObservedElement[];
  textPreview: string;
};

export type TaskStatus = 'pending' | 'running' | 'done' | 'error';

export type TaskRow = {
  id: string;
  title: string;
  detail?: string;
  status: TaskStatus;
};

export type ChatRole = 'user' | 'assistant' | 'system';

export type ChatToolCall = {
  id: string;
  name: string;
  args?: unknown;
  output?: string;
  status: TaskStatus;
};

export type AssistantTextPart = { type: 'text'; text: string };
export type AssistantThinkingPart = { type: 'thinking'; text: string };
export type AssistantToolPart = { type: 'tool' } & ChatToolCall;
export type AssistantPart = AssistantTextPart | AssistantThinkingPart | AssistantToolPart;

export type TurnUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  reasoningTokens?: number;
  durationMs: number;
  startedAt?: number;
  modelCalls: number;
  toolCalls: number;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  thinking?: string;
  tools?: ChatToolCall[];
  parts?: AssistantPart[];
  usage?: TurnUsage;
};

export type PageConversation = {
  id: string;
  revision?: number;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  tasks: TaskRow[];
  error: string;
  thinking: string;
  running: boolean;
  budget: { modelCalls: number; toolCalls: number };
  vaults: string[];
};

export type PageConversationStore = {
  activeId: string;
  conversations: PageConversation[];
  panelOpen?: boolean;
  sessionId?: string;
  revision?: number;
};

export type DomainVault = {
  domain: string;
  updatedAt: number;
  panelOpen?: boolean;
  activeId?: string;
  conversations: PageConversation[];
};

export type VaultMap = Record<string, DomainVault>;

export type SessionContext = {
  tabId: number;
  sessionTabId?: number;
  sessionId?: string;
  revision?: number;
  running: boolean;
  agentActive?: boolean;
  conversationId?: string;
  panelOpen: boolean;
  store?: PageConversationStore | null;
};

export type AgentEvent =
  | { type: 'token'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool-start'; id: string; name: string; args: unknown }
  | { type: 'tool-end'; id: string; name: string; output: string }
  | { type: 'tool-error'; id: string; name: string; output: string }
  | { type: 'message'; content: string }
  | { type: 'status'; text: string }
  | { type: 'budget'; modelCalls: number; toolCalls: number }
  | { type: 'usage'; usage: TurnUsage }
  | { type: 'error'; message: string }
  | { type: 'done' };

export type Checkpoint = {
  tabId: number;
  sessionId?: string;
  updatedAt: number;
  running: boolean;
  prompt?: string;
  conversationId?: string;
  messages: ChatMessage[];
  tasks: TaskRow[];
  revision?: number;
  modelCalls: number;
  toolCalls: number;
};

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

export const NAMED_SCRIPTS = [
  'extract_links',
  'extract_headings',
  'extract_forms',
  'extract_meta',
  'page_stats',
  'get_selection',
] as const;

export type NamedScript = (typeof NAMED_SCRIPTS)[number];

export const SOURCE_TYPES = [
  'dom',
  'page',
  'url',
  'title',
  'text',
  'links',
  'scripts',
  'stylesheets',
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];
