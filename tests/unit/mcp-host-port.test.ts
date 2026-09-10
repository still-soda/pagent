import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MCP_HOST_PORT,
  MCP_HOST_PORT_COUNT,
  MCP_HOST_PROTOCOL,
  MCP_HOST_SERVICE,
  isMcpHostHealth,
  mcpHostPortRangeLabel,
  mcpHostPorts,
  preferMcpHost,
} from '@/shared/contracts/mcp-host';
import { discoverMcpHost } from '@/features/mcp/background/host-discover';
import { listenFirstFree } from '../../mcp/listen';

function healthResponse(port: number, extensionConnected: boolean) {
  return new Response(
    JSON.stringify({
      ok: true,
      name: 'pagent',
      service: MCP_HOST_SERVICE,
      version: '0.1.0',
      protocol: MCP_HOST_PROTOCOL,
      extensionConnected,
      port,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

describe('mcp host port range', () => {
  it('covers 16 consecutive ports from the default base', () => {
    const ports = mcpHostPorts();
    expect(ports).toHaveLength(MCP_HOST_PORT_COUNT);
    expect(ports[0]).toBe(DEFAULT_MCP_HOST_PORT);
    expect(ports.at(-1)).toBe(DEFAULT_MCP_HOST_PORT + MCP_HOST_PORT_COUNT - 1);
    expect(mcpHostPortRangeLabel()).toBe('17342-17357');
  });

  it('prefers a live sticky port, otherwise an unoccupied lower port', () => {
    const hosts = [
      { port: 17344, extensionConnected: true },
      { port: 17346, extensionConnected: false },
      { port: 17343, extensionConnected: false },
    ];
    expect(preferMcpHost(hosts)?.port).toBe(17343);
    expect(preferMcpHost(hosts, 17344)?.port).toBe(17344);
    expect(preferMcpHost(hosts.filter((item) => item.extensionConnected))?.port).toBe(17344);
  });

  it('accepts only pagent-host health payloads', () => {
    expect(
      isMcpHostHealth({
        ok: true,
        name: 'pagent',
        service: MCP_HOST_SERVICE,
        protocol: MCP_HOST_PROTOCOL,
        port: 17342,
      }),
    ).toBe(true);
    expect(isMcpHostHealth({ ok: true, name: 'pagent', protocol: MCP_HOST_PROTOCOL, port: 17342 })).toBe(false);
    expect(isMcpHostHealth({ ok: true, service: MCP_HOST_SERVICE, protocol: 2, name: 'pagent', port: 1 })).toBe(false);
  });
});

describe('discoverMcpHost', () => {
  it('probes the range in parallel and picks an unused pagent host', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('17344')) return healthResponse(17344, true);
      if (url.includes('17346')) return healthResponse(17346, false);
      if (url.includes('17347')) return new Response('nope', { status: 200 });
      throw new Error('ECONNREFUSED');
    });
    const port = await discoverMcpHost({
      fetch: fetchImpl as typeof fetch,
      ports: [17342, 17344, 17346, 17347],
    });
    expect(port).toBe(17346);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('sticks to the previous port when it is still healthy', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('17344')) return healthResponse(17344, true);
      if (url.includes('17346')) return healthResponse(17346, false);
      throw new Error('ECONNREFUSED');
    });
    const port = await discoverMcpHost({
      fetch: fetchImpl as typeof fetch,
      ports: [17344, 17346],
      preferPort: 17344,
    });
    expect(port).toBe(17344);
  });

  it('returns null when no host is found', async () => {
    const port = await discoverMcpHost({
      fetch: vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }) as typeof fetch,
      ports: [17342, 17343],
    });
    expect(port).toBeNull();
  });
});

describe('listenFirstFree', () => {
  it('skips a busy port and binds the next one', async () => {
    const occupied = createServer();
    await new Promise<void>((resolve) => occupied.listen(0, '127.0.0.1', () => resolve()));
    const busyPort = (occupied.address() as AddressInfo).port;
    const placeholder = createServer();
    await new Promise<void>((resolve) => placeholder.listen(0, '127.0.0.1', () => resolve()));
    const freePort = (placeholder.address() as AddressInfo).port;
    await new Promise<void>((resolve) => placeholder.close(() => resolve()));

    const server = createServer();
    try {
      const bound = await listenFirstFree(server, [busyPort, freePort]);
      expect(bound).toBe(freePort);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await new Promise<void>((resolve) => occupied.close(() => resolve()));
    }
  });
});
