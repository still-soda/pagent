import { createAgent } from 'langchain';
import { createChatModel } from './models';
import { createSafetyMiddleware } from './middleware';
import { createAgentTools, type ToolBridge } from './tools/index';
import { buildSystemPrompt } from './prompts';
import { checkpointKey, clearCheckpoint, saveCheckpoint } from '@/features/agent/session/checkpoint';
import { applyTokenDelta, createStreamToolState, interpretStreamChunk } from './stream';
import { loadSecrets, loadSettings } from '@/shared/storage/storage';
import { toUserErrorMessage } from '@/shared/contracts/errors';
import { toolLabel } from '@/features/agent/session/tool-display';
import { nowId } from '@/shared/utils/utils';
import {
  applyAssistantThinking,
  applyAssistantToken,
  applyAssistantToolResult,
  applyAssistantToolStart,
  applyAssistantUsage,
  modelUserContent,
  toModelMessages,
} from '@/features/agent/session/messages';
import { emptyTurnUsage, preferRicherUsage, withTurnTiming } from './usage';
import type { AgentEvent } from '@/shared/contracts/agent';
import type { AgentSettings } from '@/shared/contracts/settings';
import type { ChatMessage, TaskRow } from '@/shared/contracts/session-messages';

export type RuntimeHandle = {
  stop: () => void;
  done: Promise<void>;
};

export async function runAgent(options: {
  prompt: string;
  context?: string;
  imageDataUrl?: string;
  tabId: number;
  url?: string;
  getTabId?: () => number;
  sessionId?: string;
  conversationId?: string;
  history?: ChatMessage[];
  bridge: ToolBridge;
  emit: (event: AgentEvent) => void;
  signal: AbortSignal;
}): Promise<void> {
  const settings = await loadSettings();
  const secrets = await loadSecrets();
  const model = createChatModel(settings, secrets);
  const tools = await createAgentTools({ ...options.bridge, settings });
  let streamUsage = emptyTurnUsage();
  const history = options.history ?? [];
  let messages: ChatMessage[] = [
    ...history,
    {
      id: nowId('m'),
      role: 'user',
      content: options.prompt,
      imageDataUrl: options.imageDataUrl,
    },
  ];
  let emitUsage = () => {};

  const safety = createSafetyMiddleware({
    onBudget: (usage) =>
      options.emit({
        type: 'budget',
        modelCalls: usage.modelCalls,
        toolCalls: usage.toolCalls,
      }),
    onStatus: (text) => options.emit({ type: 'thinking', text }),
    onUsage: () => emitUsage(),
    maxModelCalls: settings.maxModelCalls,
    maxToolCalls: settings.maxToolCalls,
    maxDurationMs: settings.maxDurationMs,
  });

  emitUsage = () => {
    const usage = withTurnTiming(
      safety.usage.tokens.totalTokens > 0 ? safety.usage.tokens : streamUsage,
      {
        startedAt: safety.usage.startedAt,
        modelCalls: safety.usage.modelCalls,
        toolCalls: safety.usage.toolCalls,
      },
    );
    messages = applyAssistantUsage(messages, usage, nowId('m'));
    options.emit({ type: 'usage', usage });
  };

  const agent = createAgent({
    model,
    tools,
    systemPrompt: buildSystemPrompt(options.context, undefined, settings.memory.enabled),
    middleware: [safety.middleware],
  });
  const tasks: TaskRow[] = [];
  const recursionLimit = Math.max(
    50,
    (settings.maxModelCalls + settings.maxToolCalls) * 2 + 10,
  );
  const CHECKPOINT_INTERVAL_MS = 750;
  let checkpointTimer: ReturnType<typeof setTimeout> | undefined;
  let checkpointQueue: Promise<unknown> = Promise.resolve();

  const persist = (running: boolean) => {
    const checkpoint = {
      tabId: options.getTabId?.() ?? options.tabId,
      sessionId: options.sessionId,
      updatedAt: Date.now(),
      running,
      prompt: options.prompt,
      conversationId: options.conversationId,
      messages,
      tasks: tasks.map((task) => ({ ...task })),
      modelCalls: safety.usage.modelCalls,
      toolCalls: safety.usage.toolCalls,
    };
    checkpointQueue = checkpointQueue
      .catch(() => undefined)
      .then(() => saveCheckpoint(checkpoint));
    return checkpointQueue;
  };

  const scheduleCheckpoint = () => {
    if (checkpointTimer) return;
    checkpointTimer = setTimeout(() => {
      checkpointTimer = undefined;
      void persist(true);
    }, CHECKPOINT_INTERVAL_MS);
  };

  const persistTerminal = async () => {
    if (checkpointTimer) clearTimeout(checkpointTimer);
    checkpointTimer = undefined;
    await persist(false);
  };

  await persist(true);
  options.emit({ type: 'thinking', text: '正在调用模型…' });

  try {
    const stream = await agent.stream(
      {
        messages: [
          ...toModelMessages(history, options.prompt),
          {
            role: 'user',
            content: modelUserContent(options.prompt, options.imageDataUrl),
          },
        ],
      },
      {
        signal: options.signal,
        streamMode: ['messages', 'updates'],
        recursionLimit,
      },
    );

    let assistant = '';
    let reasoning = '';
    const streamTools = createStreamToolState();
    for await (const chunk of stream) {
      if (options.signal.aborted) throw new Error('任务已停止');
      for (const event of interpretStreamChunk(chunk, streamTools)) {
        if (event.type === 'reasoning') {
          const applied = applyTokenDelta(reasoning, event.text);
          if (!applied.delta) continue;
          reasoning = applied.next;
          messages = applyAssistantThinking(messages, applied.delta, nowId('m'));
          options.emit({ type: 'reasoning', text: applied.delta });
          continue;
        }
        if (event.type === 'token') {
          const applied = applyTokenDelta(assistant, event.text);
          if (!applied.delta) continue;
          assistant = applied.next;
          messages = applyAssistantToken(messages, applied.delta, nowId('m'));
          options.emit({ type: 'token', text: applied.delta });
          continue;
        }
        if (event.type === 'tool-start') {
          assistant = '';
          reasoning = '';
          const existing = tasks.find((item) => item.id === event.id);
          const argsDetail =
            event.args == null
              ? existing?.detail
              : typeof event.args === 'string'
                ? event.args
                : JSON.stringify(event.args);
          if (existing) {
            const nextDetail =
              argsDetail && argsDetail !== '{}' && argsDetail !== '[]' ? argsDetail : existing.detail;
            if (existing.title === (event.name || existing.title) && existing.detail === nextDetail) {
              continue;
            }
            existing.title = event.name || existing.title;
            existing.detail = nextDetail;
            messages = applyAssistantToolStart(
              messages,
              { id: event.id, name: event.name, args: event.args, status: 'running' },
              nowId('m'),
            );
            options.emit(event);
            continue;
          }
          tasks.push({
            id: event.id,
            title: event.name,
            detail: argsDetail,
            status: 'running',
          });
          messages = applyAssistantToolStart(
            messages,
            { id: event.id, name: event.name, args: event.args, status: 'running' },
            nowId('m'),
          );
          options.emit({ type: 'thinking', text: `正在${toolLabel(event.name)}…` });
          options.emit(event);
          continue;
        }
        if (event.type === 'tool-end' || event.type === 'tool-error') {
          const task = tasks.find((item) => item.id === event.id);
          if (task) {
            task.status = event.type === 'tool-end' ? 'done' : 'error';
            task.detail = event.output;
          }
          messages = applyAssistantToolResult(
            messages,
            event.id,
            event.type === 'tool-end' ? 'done' : 'error',
            event.output,
          );
          options.emit(event);
          continue;
        }
        if (event.type === 'usage') {
          if (safety.usage.tokens.totalTokens <= 0) {
            streamUsage = preferRicherUsage(streamUsage, event.usage);
            emitUsage();
          }
          continue;
        }
        options.emit(event);
      }
      scheduleCheckpoint();
    }

    if (assistant) options.emit({ type: 'message', content: assistant });
    emitUsage();
    options.emit({ type: 'done' });
    await persistTerminal();
    await clearCheckpoint(checkpointKey({
      tabId: options.getTabId?.() ?? options.tabId,
      conversationId: options.conversationId,
      sessionId: options.sessionId,
    }));
  } catch (error) {
    const message = options.signal.aborted ? '任务已停止' : toUserErrorMessage(error);
    emitUsage();
    options.emit({ type: 'error', message });
    await persistTerminal();
    await clearCheckpoint(checkpointKey({
      tabId: options.getTabId?.() ?? options.tabId,
      conversationId: options.conversationId,
      sessionId: options.sessionId,
    }));
    throw error;
  }
}

export function settingsSummary(settings: AgentSettings): string {
  return [
    `模型 ${settings.model.provider}/${settings.model.model}`,
    `执行 ${settings.executionMode}`,
  ].join(' · ');
}
