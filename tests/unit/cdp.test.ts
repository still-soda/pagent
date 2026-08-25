import { describe, expect, it } from 'vitest';
import { resolveDebuggerApi } from '@/shared/browser/cdp';

describe('resolveDebuggerApi', () => {
  it('reads chrome.debugger at call time', () => {
    const api = {
      attach() {},
      detach() {},
      sendCommand() {},
      onDetach: { addListener() {} },
      onEvent: { addListener() {} },
    };
    expect(resolveDebuggerApi({ chrome: { debugger: api } })).toBe(api);
  });

  it('falls back to browser.debugger', () => {
    const api = { attach() {}, detach() {}, sendCommand() {}, onDetach: { addListener() {} } };
    expect(resolveDebuggerApi({ browser: { debugger: api } })).toBe(api);
  });

  it('returns undefined when the API is absent', () => {
    expect(resolveDebuggerApi({})).toBeUndefined();
  });
});
