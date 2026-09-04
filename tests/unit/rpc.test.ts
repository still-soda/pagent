import { describe, expect, it } from 'vitest';
import { isRpcRequest, parseRpcPayload } from '@/shared/contracts/rpc';

describe('rpc schemas', () => {
  it('parses search payload', () => {
    expect(parseRpcPayload('dom.search', { query: 'Pagent', maxResults: 10 })).toEqual({
      query: 'Pagent',
      maxResults: 10,
    });
    expect(() => parseRpcPayload('dom.search', { query: '' })).toThrow();
  });

  it('parses observe payload', () => {
    expect(parseRpcPayload('dom.observe', {
      reason: 'init',
      maxElements: 80,
      scope: 'page',
    })).toEqual({
      reason: 'init',
      maxElements: 80,
      scope: 'page',
    });
  });

  it('parses lightweight element tree options', () => {
    expect(parseRpcPayload('dom.elementTree', {
      elementId: 'el_1',
      fields: {
        text: true,
        coordinates: true,
        attributes: ['aria-label', 'data-testid'],
      },
      maxDepth: 5,
      maxLength: 100,
    })).toEqual({
      elementId: 'el_1',
      fields: {
        text: true,
        coordinates: true,
        attributes: ['aria-label', 'data-testid'],
      },
      maxDepth: 5,
      maxLength: 100,
    });
    expect(() => parseRpcPayload('dom.elementTree', {
      elementId: 'el_1',
      fields: { attributes: ['not valid'] },
    })).toThrow();
  });

  it('rejects unknown named scripts', () => {
    expect(() => parseRpcPayload('dom.script', { name: 'eval' })).toThrow();
  });

  it('parses page source filters and pagination', () => {
    expect(
      parseRpcPayload('page.source', {
        type: 'scripts',
        grep: 'analytics',
        regex: true,
        limit: 20,
        offset: 40,
      }),
    ).toEqual({
      type: 'scripts',
      grep: 'analytics',
      regex: true,
      limit: 20,
      offset: 40,
    });
    expect(() => parseRpcPayload('page.source', { type: 'css' })).toThrow();
    expect(() => parseRpcPayload('page.source', { grep: '' })).toThrow();
  });

  it('parses network and console log filters', () => {
    expect(parseRpcPayload('cdp.network', { urlIncludes: '/api', failedOnly: true, limit: 20 })).toEqual({
      urlIncludes: '/api',
      failedOnly: true,
      limit: 20,
    });
    expect(parseRpcPayload('cdp.console', { level: 'error', textIncludes: 'TypeError' })).toEqual({
      level: 'error',
      textIncludes: 'TypeError',
    });
    expect(parseRpcPayload('cdp.networkRequest', { requestId: 'r1', includeBody: true })).toEqual({
      requestId: 'r1',
      includeBody: true,
    });
  });

  it('accepts hidden context for mentioned tabs when starting an agent', () => {
    expect(
      parseRpcPayload('agent.start', {
        prompt: '总结这个页面',
        context: '用户通过 @ 附加了这些浏览器标签页。',
        conversationId: 'c1',
      }),
    ).toMatchObject({
      prompt: '总结这个页面',
      context: '用户通过 @ 附加了这些浏览器标签页。',
      conversationId: 'c1',
    });
  });

  it('accepts raw screenshots and image attachments', () => {
    expect(parseRpcPayload('screenshot.capture', { raw: true })).toEqual({ raw: true });
    expect(
      parseRpcPayload('agent.start', {
        prompt: '查看标记',
        imageDataUrl: 'data:image/png;base64,abc',
      }),
    ).toMatchObject({
      prompt: '查看标记',
      imageDataUrl: 'data:image/png;base64,abc',
    });
    expect(() =>
      parseRpcPayload('agent.start', {
        prompt: '查看标记',
        imageDataUrl: 'https://example.com/image.png',
      }),
    ).toThrow();
  });

  it('limits the tabs requested for mention snapshots', () => {
    expect(parseRpcPayload('tabs.snapshot', { tabIds: [2, 5] })).toEqual({ tabIds: [2, 5] });
    expect(() => parseRpcPayload('tabs.snapshot', { tabIds: [] })).toThrow();
    expect(() =>
      parseRpcPayload('tabs.snapshot', { tabIds: Array.from({ length: 9 }, (_, index) => index + 1) }),
    ).toThrow();
  });

  it('accepts prior conversation history when starting an agent', () => {
    expect(
      parseRpcPayload('agent.start', {
        prompt: '然后填邮箱',
        conversationId: 'c1',
        history: [{ id: 'm1', role: 'user', content: '先观察页面' }],
      }),
    ).toMatchObject({
      prompt: '然后填邮箱',
      conversationId: 'c1',
      history: [{ id: 'm1', role: 'user', content: '先观察页面' }],
    });
  });

  it('accepts a page url when saving the session store', () => {
    expect(
      parseRpcPayload('session.saveStore', {
        activeId: 'c1',
        conversations: [],
        url: 'https://example.com/docs',
      }),
    ).toMatchObject({
      activeId: 'c1',
      url: 'https://example.com/docs',
    });
  });

  it('validates teaching and vault command payloads', () => {
    expect(parseRpcPayload('teaching.start', {
      url: 'https://example.com/form',
      conversationId: 'c1',
    })).toEqual({
      url: 'https://example.com/form',
      conversationId: 'c1',
    });
    expect(parseRpcPayload('teaching.revise', { request: '合并前两步' })).toEqual({
      request: '合并前两步',
    });
    expect(parseRpcPayload('commands.list', { url: 'https://example.com' })).toEqual({
      url: 'https://example.com',
    });
    expect(() => parseRpcPayload('teaching.start', { url: 'not-a-url' })).toThrow();
    expect(() => parseRpcPayload('teaching.revise', { request: '' })).toThrow();
  });

  it('parses conversation archive payloads', () => {
    expect(parseRpcPayload('conversations.list', {})).toEqual({});
    expect(
      parseRpcPayload('conversations.get', { ids: ['c1', 'c2'], includeImages: true }),
    ).toEqual({
      ids: ['c1', 'c2'],
      includeImages: true,
    });
    expect(() => parseRpcPayload('conversations.get', { ids: [] })).toThrow();
    expect(() => parseRpcPayload('conversations.get', { ids: [''] })).toThrow();
  });

  it('identifies rpc envelopes', () => {
    expect(
      isRpcRequest({
        channel: 'pagent',
        kind: 'rpc',
        id: '1',
        name: 'settings.get',
        payload: {},
      }),
    ).toBe(true);
    expect(isRpcRequest({ kind: 'rpc' })).toBe(false);
  });
});
