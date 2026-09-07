import { tool } from 'langchain';
import { isolateUntrustedPage } from '@/features/agent/runtime/middleware';
import { jsonSchemaToZod } from '@/features/mcp/json-schema-to-zod';
import { truncate } from '@/shared/utils/utils';
import type { McpToolMeta } from '@/shared/contracts/mcp';
import type { ToolBridge } from './types';

export async function createMcpAgentTools(bridge: ToolBridge) {
  let listed: McpToolMeta[] = [];
  try {
    listed = await bridge.mcp.listTools();
  } catch (error) {
    listed = [];
  }
  return listed.map((meta) =>
    tool(
      async (args) =>
        isolateUntrustedPage(truncate(await bridge.mcp.callTool(meta.name, args), 12_000)),
      {
        name: meta.name,
        description: meta.description
          ? truncate(meta.description, 800)
          : '外部 MCP 服务器提供的工具',
        schema: jsonSchemaToZod(meta.inputSchema),
      },
    ),
  );
}
