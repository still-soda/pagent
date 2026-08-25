import { describe, expect, it } from 'vitest';
import { isProtectedUrl, toErrorMessage, toUserErrorMessage } from '../../lib/shared/errors';

describe('errors', () => {
  it('marks browser internal pages as protected', () => {
    expect(isProtectedUrl('chrome://extensions')).toBe(true);
    expect(isProtectedUrl('https://example.com')).toBe(false);
  });

  it('stringifies unknown errors', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom');
    expect(toErrorMessage('x')).toBe('x');
  });

  it('explains a missing debugger API', () => {
    expect(toUserErrorMessage(new Error('当前环境不支持 chrome.debugger'))).toContain('重新加载');
  });
});
