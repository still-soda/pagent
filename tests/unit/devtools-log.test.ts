import { describe, expect, it } from 'vitest';
import {
  MAX_NETWORK_ENTRIES,
  applyCdpEvent,
  createDevtoolsStore,
  getNetworkEntry,
  isTextualMime,
  listConsole,
  listNetwork,
  redactHeaders,
  summarizeNetwork,
} from '../../lib/browser/devtools-log';

describe('devtools-log', () => {
  it('tracks a request through response and finish', () => {
    const store = createDevtoolsStore(1_000);
    applyCdpEvent(
      store,
      'Network.requestWillBeSent',
      {
        requestId: 'r1',
        type: 'XHR',
        request: {
          url: 'https://api.example.com/users',
          method: 'post',
          headers: { Authorization: 'Bearer secret', Accept: 'application/json' },
          postData: 'email=alice@example.com',
        },
        initiator: { type: 'script', stack: { callFrames: [{ url: 'https://app.example/app.js', lineNumber: 12 }] } },
      },
      1_000,
    );
    applyCdpEvent(store, 'Network.responseReceived', {
      requestId: 'r1',
      type: 'XHR',
      response: {
        status: 201,
        statusText: 'Created',
        mimeType: 'application/json',
        protocol: 'h2',
        headers: { 'set-cookie': 'sid=abc', 'content-type': 'application/json' },
      },
    });
    applyCdpEvent(store, 'Network.loadingFinished', { requestId: 'r1', encodedDataLength: 128 }, 1_240);

    const [entry] = listNetwork(store);
    expect(entry).toBeDefined();
    expect(entry).toMatchObject({
      requestId: 'r1',
      method: 'POST',
      url: 'https://api.example.com/users',
      status: 201,
      type: 'XHR',
      encodedDataLength: 128,
      durationMs: 240,
    });
    expect(entry!.requestHeaders).toEqual({
      Authorization: '[redacted]',
      Accept: 'application/json',
    });
    expect(entry!.responseHeaders?.['set-cookie']).toBe('[redacted]');
    expect(entry!.postData).toContain('[redacted-email]');
    expect(entry!.initiator).toContain('script');
    expect(summarizeNetwork(entry!)).not.toHaveProperty('requestHeaders');
  });

  it('marks failed requests and supports failedOnly', () => {
    const store = createDevtoolsStore();
    applyCdpEvent(store, 'Network.requestWillBeSent', {
      requestId: 'ok',
      request: { url: 'https://ok.example/a', method: 'GET' },
    });
    applyCdpEvent(store, 'Network.requestWillBeSent', {
      requestId: 'bad',
      request: { url: 'https://bad.example/a', method: 'GET' },
    });
    applyCdpEvent(store, 'Network.loadingFailed', {
      requestId: 'bad',
      errorText: 'net::ERR_FAILED',
      canceled: false,
    });

    expect(listNetwork(store, { failedOnly: true })).toEqual([
      expect.objectContaining({ requestId: 'bad', failed: true, errorText: 'net::ERR_FAILED' }),
    ]);
    expect(listNetwork(store, { urlIncludes: 'ok.example' })).toHaveLength(1);
    expect(listNetwork(store, { method: 'POST' })).toHaveLength(0);
  });

  it('hides data and extension URLs unless includeNoise is set', () => {
    const store = createDevtoolsStore();
    applyCdpEvent(store, 'Network.requestWillBeSent', {
      requestId: 'data',
      request: { url: 'data:text/plain,hi', method: 'GET' },
    });
    applyCdpEvent(store, 'Network.requestWillBeSent', {
      requestId: 'page',
      request: { url: 'https://example.com/', method: 'GET' },
    });
    expect(listNetwork(store).map((item) => item.requestId)).toEqual(['page']);
    expect(listNetwork(store, { includeNoise: true })).toHaveLength(2);
  });

  it('captures console, exceptions and browser logs', () => {
    const store = createDevtoolsStore();
    applyCdpEvent(store, 'Runtime.consoleAPICalled', {
      type: 'warning',
      args: [{ type: 'string', value: 'slow' }, { type: 'object', description: 'Object' }],
      stackTrace: { callFrames: [{ url: 'https://app.example/app.js', lineNumber: 9 }] },
    });
    applyCdpEvent(store, 'Runtime.exceptionThrown', {
      exceptionDetails: {
        text: 'Uncaught',
        url: 'https://app.example/app.js',
        lineNumber: 21,
        exception: { description: 'TypeError: x is not a function' },
      },
    });
    applyCdpEvent(store, 'Log.entryAdded', {
      entry: { level: 'error', text: 'CORS blocked', url: 'https://api.example.com' },
    });
    applyCdpEvent(store, 'Page.frameNavigated', {});

    expect(listConsole(store)).toEqual([
      expect.objectContaining({ id: 'c1', level: 'warning', source: 'console', text: 'slow Object' }),
      expect.objectContaining({ source: 'exception', text: expect.stringContaining('TypeError') }),
      expect.objectContaining({ source: 'browser', text: 'CORS blocked' }),
    ]);
    expect(listConsole(store, { level: 'warning' })).toHaveLength(1);
    expect(listConsole(store, { textIncludes: 'cors' })).toHaveLength(1);
  });

  it('evicts oldest network entries when the ring is full', () => {
    const store = createDevtoolsStore();
    for (let i = 0; i < MAX_NETWORK_ENTRIES + 5; i += 1) {
      applyCdpEvent(store, 'Network.requestWillBeSent', {
        requestId: `r${i}`,
        request: { url: `https://example.com/${i}`, method: 'GET' },
      });
    }
    expect(store.networkOrder).toHaveLength(MAX_NETWORK_ENTRIES);
    expect(getNetworkEntry(store, 'r0')).toBeUndefined();
    expect(getNetworkEntry(store, `r${MAX_NETWORK_ENTRIES + 4}`)).toBeTruthy();
  });

  it('redacts sensitive headers and recognizes textual mime types', () => {
    expect(redactHeaders({ Cookie: 'a=1', Accept: '*/*' })).toEqual({
      Cookie: '[redacted]',
      Accept: '*/*',
    });
    expect(isTextualMime('application/json')).toBe(true);
    expect(isTextualMime('image/png')).toBe(false);
  });
});
