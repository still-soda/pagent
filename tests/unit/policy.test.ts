import { describe, expect, it } from 'vitest';
import {
  assertNavigableUrl,
  isRepeatedAction,
  redactText,
  redactValue,
} from '@/shared/contracts/policy';
import { DEFAULT_SETTINGS } from '@/shared/contracts/settings';

describe('redactText', () => {
  it('redacts emails and keys', () => {
    const text = redactText('contact me@example.com or 13812345678 with sk-abcdefghijklmnopqrstuvwxyz');
    expect(text).toContain('[redacted-email]');
    expect(text).toContain('[redacted-key]');
    expect(text).not.toContain('me@example.com');
    expect(text).toContain('[redacted-phone]');
  });

  it('redacts nested tool payloads', () => {
    expect(redactValue({ steps: [{ value: 'me@example.com' }] })).toEqual({
      steps: [{ value: '[redacted-email]' }],
    });
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
