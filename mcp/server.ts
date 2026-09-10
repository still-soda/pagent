import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpHostMethod } from '../src/shared/contracts/mcp-host.ts';
import { USAGE_TOPICS, getUsageGuide } from './usage.ts';

export const SERVER_NAME = 'pagent';
export const SERVER_VERSION = '0.1.0';

export type CallExtension = (method: McpHostMethod, params?: unknown, timeoutMs?: number) => Promise<unknown>;

function textResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
}

async function runTool(work: () => Promise<unknown>) {
  try {
    return textResult(await work());
  } catch (error) {
    return errorResult(error);
  }
}

export function createPagentMcpServer(callExtension: CallExtension): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        'Pagent 浏览器 Agent 的 MCP 服务，供本地 Agent 与浏览器内 Pagent 协同。不确定如何配合时先调用 get_usage。常用路径：list_tabs → dispatch_task → get_session。',
    },
  );

  server.registerTool(
    'get_usage',
    {
      title: '查询 Pagent MCP 用法',
      description:
        '返回本地 Agent 与浏览器内 Pagent 如何协同的说明：分工、推荐流程，以及 list_tabs / dispatch_task / get_session 的参数与约定。不需要 Pagent 扩展在线。可传 topic 只看某一段。',
      inputSchema: {
        topic: z
          .enum(USAGE_TOPICS)
          .optional()
          .describe(
            `可选。${USAGE_TOPICS.join(' | ')}。省略则返回完整用法。`,
          ),
      },
    },
    async ({ topic }) => ({
      content: [{ type: 'text' as const, text: getUsageGuide(topic) }],
    }),
  );

  server.registerTool(
    'list_tabs',
    {
      title: '罗列浏览器标签页',
      description:
        '列出当前浏览器的全部标签页，以及每个标签页上是否有 Pagent Agent 正在工作（含会话 ID、会话标题、思考状态）。',
    },
    async () => runTool(() => callExtension('list_tabs', {}, 15_000)),
  );

  server.registerTool(
    'dispatch_task',
    {
      title: '派发任务给 Agent',
      description:
        '向指定标签页上的 Pagent Agent 派发任务。可传 tabId 使用已有标签页，或传 url 打开/导航后再执行。不传 tabId 和 url 时使用当前活动标签页。返回 sessionId，可随后用 get_session 查询进度。',
      inputSchema: {
        prompt: z.string().min(1).describe('要交给 Agent 执行的任务描述'),
        tabId: z.number().int().positive().optional().describe('目标标签页 ID，省略则使用当前活动标签页'),
        url: z.string().min(1).optional().describe('可选。若同时提供 tabId 则导航该标签页；否则新建标签页并打开该地址'),
        conversationId: z.string().min(1).optional().describe('可选。继续已有会话；省略则新建会话'),
      },
    },
    async ({ prompt, tabId, url, conversationId }) =>
      runTool(() =>
        callExtension(
          'dispatch_task',
          { prompt, tabId, url, conversationId },
          45_000,
        ),
      ),
  );

  server.registerTool(
    'get_session',
    {
      title: '查看 Agent 会话状态',
      description:
        '按 sessionId、tabId 或 conversationId 查询 Pagent Agent 会话：是否仍在运行、当前思考、任务列表和最近消息。',
      inputSchema: {
        sessionId: z.string().min(1).optional().describe('dispatch_task 返回的会话 ID'),
        tabId: z.number().int().positive().optional().describe('标签页 ID'),
        conversationId: z.string().min(1).optional().describe('会话/对话 ID'),
      },
    },
    async ({ sessionId, tabId, conversationId }) =>
      runTool(() =>
        callExtension(
          'get_session',
          { sessionId, tabId, conversationId },
          15_000,
        ),
      ),
  );

  return server;
}
