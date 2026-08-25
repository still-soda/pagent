import { describe, expect, it } from 'vitest';
import { assertNavigableUrl, isRepeatedAction, redactText } from '../../lib/shared/policy';
import { DEFAULT_SETTINGS } from '../../lib/shared/types';

describe('redactText', () => {
  it('redacts emails and keys', () => {
    const text = redactText('contact me@example.com with sk-abcdefghijklmnopqrstuvwxyz');
    expect(text).toContain('[redacted-email]');
    expect(text).toContain('[redacted-key]');
    expect(text).not.toContain('me@example.com');
  });
});

describe('assertNavigableUrl', () => {
  it('allows https pages', () => {
    expect(() => assertNavigableUrl('https://example.com/docs')).not.toThrow();
  });

  it('blocks chrome and payment paths', () => {
    expect(() => assertNavigableUrl('chrome://settings')).toThrow();
    expect(() => assertNavigableUrl('https://shop.example/checkout')).toThrow();
  });

  it('blocks non-localhost http without cross-origin', () => {
    expect(() =>
      assertNavigableUrl('http://example.com', { ...DEFAULT_SETTINGS, allowCrossOrigin: false }),
    ).toThrow();
  });
});

describe('isRepeatedAction', () => {
  it('detects three identical tail actions', () => {
    const history = [
      { name: 'click_element', args: '{"elementId":"a"}' },
      { name: 'click_element', args: '{"elementId":"a"}' },
      { name: 'click_element', args: '{"elementId":"a"}' },
    ];
    expect(isRepeatedAction(history, 'click_element', { elementId: 'a' })).toBe(true);
  });
});
