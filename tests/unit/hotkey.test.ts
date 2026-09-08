import { describe, expect, it } from 'vitest';
import {
  isTeachingCommentDirectHotkey,
  isTeachingCommentElementHotkey,
  isTogglePanelHotkey,
} from '@/shared/extension/hotkey';

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

describe('teaching hotkeys', () => {
  it('matches Alt+X for element comment', () => {
    expect(
      isTeachingCommentElementHotkey({
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        code: 'KeyX',
        key: 'x',
      }),
    ).toBe(true);
    expect(
      isTeachingCommentElementHotkey({
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        code: 'KeyX',
        key: '≈',
      }),
    ).toBe(true);
    expect(
      isTeachingCommentElementHotkey({
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        code: 'KeyX',
        key: 'x',
      }),
    ).toBe(false);
  });

  it('matches Alt+C for direct comment', () => {
    expect(
      isTeachingCommentDirectHotkey({
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        code: 'KeyC',
        key: 'c',
      }),
    ).toBe(true);
    expect(
      isTeachingCommentDirectHotkey({
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        code: 'KeyC',
        key: 'ç',
      }),
    ).toBe(true);
    expect(
      isTeachingCommentDirectHotkey({
        altKey: true,
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        code: 'KeyC',
        key: 'c',
      }),
    ).toBe(false);
  });
});
