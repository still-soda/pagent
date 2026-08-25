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
  imageDataUrl?: string;
  thinking?: string;
  tools?: ChatToolCall[];
  parts?: AssistantPart[];
  usage?: TurnUsage;
};
