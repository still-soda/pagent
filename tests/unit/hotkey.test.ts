import { describe, expect, it } from 'vitest';
import { isTogglePanelHotkey } from '../../lib/hotkey';

describe('isTogglePanelHotkey', () => {
  it('matches Alt+P', () => {
    expect(
      isTogglePanelHotkey({
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        code: 'KeyP',
        key: 'p',
      }),
    ).toBe(true);
  });

  it('matches Option+P even when the typed character is not p', () => {
    expect(
      isTogglePanelHotkey({
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        code: 'KeyP',
        key: 'π',
      }),
    ).toBe(true);
  });

  it('ignores other modifiers and keys', () => {
    expect(
      isTogglePanelHotkey({
        altKey: true,
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        code: 'KeyP',
        key: 'p',
      }),
    ).toBe(false);
    expect(
      isTogglePanelHotkey({
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        code: 'KeyO',
        key: 'o',
      }),
    ).toBe(false);
  });
});
