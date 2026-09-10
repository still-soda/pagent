import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createPagentMcpServer } from '../../mcp/server';
import { createExtensionRpc } from '../../mcp/extension-rpc';
import { getUsageGuide } from '../../mcp/usage';
import { MCP_HOST_PROTOCOL } from '@/shared/contracts/mcp-host';

describe('pagent mcp server', () => {
  it('exposes get_usage, list_tabs, dispatch_task and get_session', async () => {
    const callExtension = vi.fn(async (method: string) => {
      if (method === 'list_tabs') return { tabs: [{ tabId: 1, agent: { working: false } }] };
      if (method === 'dispatch_task') return { ok: true, tabId: 1, sessionId: 's1', conversationId: 'c1' };
      return { found: true, running: true, sessionId: 's1' };
    });
    const server = createPagentMcpServer(callExtension);
    const client = new Client({ name: 'test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual([
      'dispatch_task',
      'get_session',
      'get_usage',
      'list_tabs',
    ]);

    const tabs = await client.callTool({ name: 'list_tabs', arguments: {} });
    expect(tabs.content).toEqual([
      expect.objectContaining({
        type: 'text',
        text: expect.stringContaining('"tabId": 1'),
      }),
    ]);
    expect(callExtension).toHaveBeenCalledWith('list_tabs', {}, 15_000);

    const dispatched = await client.callTool({
      name: 'dispatch_task',
      arguments: { prompt: '打开设置', tabId: 2 },
    });
    expect(JSON.stringify(dispatched)).toContain('s1');
    expect(callExtension).toHaveBeenCalledWith(
      'dispatch_task',
      { prompt: '打开设置', tabId: 2, url: undefined, conversationId: undefined },
      45_000,
    );

    await client.close();
    await server.close();
  });

  it('returns a tool error when the extension is not connected', async () => {
    const rpc = createExtensionRpc();
    const server = createPagentMcpServer(rpc.callExtension);
    const client = new Client({ name: 'test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({ name: 'list_tabs', arguments: {} });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain('扩展未连接');

    await client.close();
    await server.close();
  });

  it('returns usage without talking to the extension', async () => {
    const callExtension = vi.fn();
    const server = createPagentMcpServer(callExtension);
    const client = new Client({ name: 'test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const full = await client.callTool({ name: 'get_usage', arguments: {} });
    expect(full.isError).toBeFalsy();
    expect(JSON.stringify(full)).toContain('dispatch_task');
    expect(JSON.stringify(full)).toContain('本地 Agent');

    const section = await client.callTool({
      name: 'get_usage',
      arguments: { topic: 'workflow' },
    });
    expect(JSON.stringify(section)).toContain('推荐流程');
    expect(callExtension).not.toHaveBeenCalled();

    await client.close();
    await server.close();
  });
});

describe('usage guide', () => {
  it('returns a single section or the full document', () => {
    expect(getUsageGuide('dispatch_task')).toContain('prompt');
    expect(getUsageGuide()).toContain('## collaboration');
    expect(getUsageGuide()).toContain('## get_session');
  });
});

describe('extension rpc queue', () => {
  it('forwards a call to the waiting extension and returns its result', async () => {
    const rpc = createExtensionRpc();
    rpc.touch();
    const pending = rpc.callExtension('get_session', { sessionId: 's_live' }, 1_000);
    const request = await rpc.takeRequest(200);
    expect(request).toMatchObject({
      v: MCP_HOST_PROTOCOL,
      method: 'get_session',
      params: { sessionId: 's_live' },
    });
    rpc.complete({
      v: MCP_HOST_PROTOCOL,
      id: request!.id,
      ok: true,
      result: { found: true, running: true, sessionId: 's_live' },
    });
    await expect(pending).resolves.toEqual({ found: true, running: true, sessionId: 's_live' });
  });

  it('rejects when the extension reports an error', async () => {
    const rpc = createExtensionRpc();
    rpc.touch();
    const pending = rpc.callExtension('dispatch_task', { prompt: 'x' }, 1_000);
    const request = await rpc.takeRequest(200);
    rpc.complete({
      v: MCP_HOST_PROTOCOL,
      id: request!.id,
      ok: false,
      error: '找不到标签页 9',
    });
    await expect(pending).rejects.toThrow('找不到标签页 9');
  });
});
