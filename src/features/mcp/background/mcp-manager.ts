import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';
import { requestPermissions } from '@/shared/browser/permissions';
import { loadMcpConfig } from '@/shared/storage/storage';
import { originOf } from '@/shared/utils/utils';
import { serializeMcpResult } from '@/features/mcp/serialize';
import { BUILTIN_TOOL_NAMES } from '@/features/agent/runtime/tools/index';
import type {
  McpServerConfig,
  McpServerStatus,
  McpState,
  McpToolMeta,
} from '@/shared/contracts/mcp';

const REMOTE_SCHEMES = new Set(['http:', 'https:', 'ws:', 'wss:']);

type RegisteredTool = McpToolMeta & { tool: string };

type LiveServer = {
  name: string;
  url: string;
  client: Client;
  status: McpServerStatus['status'];
  error?: string;
  tools: RegisteredTool[];
};

const servers = new Map<string, LiveServer>();
/** 展示名 → 原始 MCP 工具引用（server + tool） */
const toolRegistry = new Map<string, { server: string; tool: string }>();
let syncPromise: Promise<void> | null = null;

function originPattern(url: string): string | null {
  const origin = originOf(url);
  return origin ? `${origin}/*` : null;
}

async function hasOriginAccess(url: string): Promise<boolean> {
  const pattern = originPattern(url);
  if (!pattern) return false;
  return browser.permissions.contains({ origins: [pattern] });
}

/** 对 MCP 服务器域名使用 chrome.permissions.request 申请访问权限 */
async function ensureOriginAccess(url: string): Promise<boolean> {
  if (await hasOriginAccess(url)) return true;
  try {
    await requestPermissions({ origins: [url] });
  } catch {
    return false;
  }
  return hasOriginAccess(url);
}

function sanitizeName(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'mcp_tool';
}

function createTransport(config: McpServerConfig) {
  const url = new URL(config.url);
  const hasHeaders = config.headers != null && Object.keys(config.headers).length > 0;
  const requestInit = hasHeaders ? ({ headers: config.headers } as RequestInit) : undefined;
  const transportType =
    config.transport ??
    (url.protocol === 'ws:' || url.protocol === 'wss:' ? 'websocket' : 'streamable-http');
  switch (transportType) {
    case 'websocket':
      return new WebSocketClientTransport(url);
    case 'sse':
      return new SSEClientTransport(url, { requestInit });
    case 'streamable-http':
    default:
      return new StreamableHTTPClientTransport(url, { requestInit });
  }
}

function registerTools(serverName: string, tools: RegisteredTool[]) {
  for (const display of tools) toolRegistry.delete(display.name);
  for (const tool of tools) {
    const base = sanitizeName(tool.name);
    let display = BUILTIN_TOOL_NAMES.has(base) || toolRegistry.has(base) ? `${sanitizeName(serverName)}_${base}` : base;
    let index = 2;
    while (BUILTIN_TOOL_NAMES.has(display) || toolRegistry.has(display)) {
      display = `${sanitizeName(serverName)}_${base}_${index}`;
      index += 1;
    }
    toolRegistry.set(display, { server: serverName, tool: tool.tool });
    tool.name = display;
  }
}

function unregisterTools(serverName: string, tools: RegisteredTool[]) {
  for (const tool of tools) toolRegistry.delete(tool.name);
}

async function connectServer(
  name: string,
  config: McpServerConfig,
  requestPermission: boolean,
): Promise<void> {
  const previous = servers.get(name);
  if (previous) {
    unregisterTools(name, previous.tools);
    await previous.client.close().catch(() => {});
    servers.delete(name);
  }

  let url: URL;
  try {
    url = new URL(config.url);
  } catch {
    servers.set(name, { name, url: config.url, client: undefined as unknown as Client, status: 'error', error: '无法解析服务器地址', tools: [] });
    return;
  }
  if (!REMOTE_SCHEMES.has(url.protocol)) {
    servers.set(name, { name, url: config.url, client: undefined as unknown as Client, status: 'error', error: '浏览器扩展仅支持 http/https/ws/wss 远程服务器，不支持 stdio(command) 启动', tools: [] });
    return;
  }
  if (!(await hasOriginAccess(config.url))) {
    const granted = requestPermission ? await ensureOriginAccess(config.url) : false;
    if (!granted) {
      servers.set(name, { name, url: config.url, client: undefined as unknown as Client, status: 'unauthorized', error: `未获得 ${url.origin} 的访问权限`, tools: [] });
      return;
    }
  }

  const client = new Client({ name: `pagent-${sanitizeName(name)}`, version: '0.1.0' });
  servers.set(name, { name, url: config.url, client, status: 'connecting', tools: [] });
  try {
    await client.connect(createTransport(config));
    const listed = await client.listTools();
    const tools: RegisteredTool[] = (listed.tools ?? []).map((item) => ({
      name: item.name,
      description: item.description,
      inputSchema: item.inputSchema,
      tool: item.name,
    }));
    registerTools(name, tools);
    servers.set(name, { name, url: config.url, client, status: 'connected', tools });
  } catch (error) {
    await client.close().catch(() => {});
    servers.set(name, {
      name,
      url: config.url,
      client,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      tools: [],
    });
  }
}

async function disconnectServer(name: string): Promise<void> {
  const live = servers.get(name);
  if (!live) return;
  unregisterTools(name, live.tools);
  await live.client.close().catch(() => {});
  servers.delete(name);
}

/**
 * 读取配置并对齐连接：断开被移除/禁用的服务器，连接新增/变更的服务器。
 * requestPermission 为 true 时（用户主动保存/重新连接），对未授权的服务器域名发起 chrome.permissions.request；
 * 被动场景（扩展启动、状态查询、Agent 运行前）为 false，仅连接已授权域名。
 */
export async function syncMcpServers(requestPermission = false): Promise<McpState> {
  if (!syncPromise) {
    syncPromise = (async () => {
      const config = await loadMcpConfig();
      for (const name of [...servers.keys()]) {
        const next = config.mcpServers[name];
        if (!next || next.enabled === false) await disconnectServer(name);
      }
      for (const [name, next] of Object.entries(config.mcpServers)) {
        if (next.enabled === false) continue;
        const live = servers.get(name);
        if (live && live.status === 'connected' && live.url === next.url) continue;
        await connectServer(name, next, requestPermission);
      }
    })().finally(() => {
      syncPromise = null;
    });
  }
  await syncPromise;
  return getMcpState();
}

export async function getMcpState(): Promise<McpState> {
  const config = await loadMcpConfig();
  const statuses: McpServerStatus[] = [];
  for (const [name, entry] of Object.entries(config.mcpServers)) {
    const live = servers.get(name);
    if (entry.enabled === false) {
      statuses.push({ name, url: entry.url, status: 'disabled', toolCount: 0, tools: [] });
      continue;
    }
    if (!live) {
      statuses.push({ name, url: entry.url, status: 'disconnected', toolCount: 0, tools: [] });
      continue;
    }
    const disabledTools = new Set(entry.disabledTools ?? []);
    statuses.push({
      name,
      url: live.url,
      status: live.status,
      error: live.error,
      toolCount: live.tools.length,
      tools: live.tools.map((tool) => ({
        name: tool.name,
        originalName: tool.tool,
        description: tool.description,
        enabled: !disabledTools.has(tool.tool),
      })),
    });
  }
  return { config, servers: statuses };
}

/** 供 Agent 运行时使用：确保已按配置发起连接（服务工作者重启后自动重连） */
async function ensureMcpReady(): Promise<void> {
  const config = await loadMcpConfig();
  const enabled = Object.values(config.mcpServers).some((entry) => entry.enabled !== false);
  const connected = [...servers.values()].some((live) => live.status === 'connected');
  if (enabled && !connected) await syncMcpServers();
}

export async function listMcpTools(): Promise<McpToolMeta[]> {
  await ensureMcpReady();
  const config = await loadMcpConfig();
  const out: McpToolMeta[] = [];
  for (const live of servers.values()) {
    if (live.status !== 'connected') continue;
    const disabledTools = new Set(config.mcpServers[live.name]?.disabledTools ?? []);
    for (const tool of live.tools) {
      if (disabledTools.has(tool.tool)) continue;
      out.push({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema });
    }
  }
  return out;
}

export async function callMcpTool(displayName: string, args: unknown): Promise<string> {
  const ref = toolRegistry.get(displayName);
  if (!ref) throw new Error(`MCP 工具不可用：${displayName}（服务器可能未连接）`);
  const live = servers.get(ref.server);
  if (!live || live.status !== 'connected') {
    throw new Error(`MCP 服务器 ${ref.server} 未连接`);
  }
  const config = await loadMcpConfig();
  if (config.mcpServers[ref.server]?.disabledTools?.includes(ref.tool)) {
    throw new Error(`MCP 工具已禁用：${displayName}`);
  }
  const result = await live.client.callTool({
    name: ref.tool,
    arguments: (args ?? undefined) as Record<string, unknown> | undefined,
  });
  return serializeMcpResult(result);
}
