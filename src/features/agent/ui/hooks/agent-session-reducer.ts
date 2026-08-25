import type { AgentEvent } from '@/shared/contracts/agent';
import type { PageConversation, PageConversationStore } from '@/shared/contracts/session';
import {
  applyAssistantFinalText,
  applyAssistantThinking,
  applyAssistantToken,
  applyAssistantToolResult,
  applyAssistantToolStart,
  applyAssistantUsage,
} from '@/features/agent/session/messages';
import { nowId } from '@/shared/utils/utils';

export function patchConversation(
  list: PageConversation[],
  id: string,
  patch: (current: PageConversation) => PageConversation,
) {
  return list.map((item) =>
    item.id === id
      ? { ...patch(item), revision: (item.revision ?? 0) + 1, updatedAt: Date.now() }
      : item,
  );
}

export function lastAssistantId(item: PageConversation): string | undefined {
  return [...item.messages].reverse().find((message) => message.role === 'assistant')?.id;
}

export type StreamPending = { targetId: string; token: string; reasoning: string };

export function applyStreamPending(
  conversations: PageConversation[],
  pending: StreamPending,
): PageConversation[] {
  return patchConversation(conversations, pending.targetId, (item) => {
    let messages = item.messages;
    if (pending.reasoning) {
      messages = applyAssistantThinking(messages, pending.reasoning, nowId('m'));
    }
    if (pending.token) {
      messages = applyAssistantToken(messages, pending.token, nowId('m'));
    }
    return {
      ...item,
      thinking: pending.reasoning ? '正在思考…' : item.thinking,
      messages,
    };
  });
}

export function applyAgentEventToConversations(
  conversations: PageConversation[],
  targetId: string,
  event: AgentEvent,
): PageConversation[] {
  if (event.type === 'thinking') {
    return patchConversation(conversations, targetId, (item) => ({ ...item, thinking: event.text }));
  }
  if (event.type === 'tool-start') {
    return patchConversation(conversations, targetId, (item) => {
      const tool = {
        id: event.id,
        name: event.name,
        args: event.args,
        status: 'running' as const,
      };
      const argsDetail =
        event.args == null
          ? undefined
          : typeof event.args === 'string'
            ? event.args
            : JSON.stringify(event.args);
      return {
        ...item,
        messages: applyAssistantToolStart(item.messages, tool, nowId('m')),
        tasks: item.tasks.some((task) => task.id === event.id)
          ? item.tasks.map((task) =>
              task.id === event.id
                ? {
                    ...task,
                    title: event.name || task.title,
                    detail:
                      argsDetail && argsDetail !== '{}' && argsDetail !== '[]'
                        ? argsDetail
                        : task.detail,
                    status: 'running' as const,
                  }
                : task,
            )
          : [
              ...item.tasks,
              {
                id: event.id,
                title: event.name,
                detail: argsDetail,
                status: 'running' as const,
              },
            ],
      };
    });
  }
  if (event.type === 'tool-end' || event.type === 'tool-error') {
    return patchConversation(conversations, targetId, (item) => ({
      ...item,
      tasks: item.tasks.map((task) =>
        task.id === event.id
          ? {
              ...task,
              status: event.type === 'tool-end' ? 'done' : 'error',
              detail: event.output,
            }
          : task,
      ),
      messages: applyAssistantToolResult(
        item.messages,
        event.id,
        event.type === 'tool-end' ? 'done' : 'error',
        event.output,
      ),
    }));
  }
  if (event.type === 'budget') {
    return patchConversation(conversations, targetId, (item) => ({
      ...item,
      budget: { modelCalls: event.modelCalls, toolCalls: event.toolCalls },
    }));
  }
  if (event.type === 'message') {
    return patchConversation(conversations, targetId, (item) => ({
      ...item,
      messages: applyAssistantFinalText(
        item.messages,
        event.content,
        lastAssistantId(item) ?? nowId('m'),
      ),
    }));
  }
  if (event.type === 'usage') {
    return patchConversation(conversations, targetId, (item) => ({
      ...item,
      messages: applyAssistantUsage(
        item.messages,
        event.usage,
        lastAssistantId(item) ?? nowId('m'),
      ),
    }));
  }
  return conversations;
}

export function mergeStoreFromEvent(
  incoming: PageConversationStore,
  revision: number,
): { conversations: PageConversation[]; activeId: string; revision: number } {
  return {
    conversations: incoming.conversations,
    activeId: incoming.activeId,
    revision: incoming.revision ?? revision,
  };
}
