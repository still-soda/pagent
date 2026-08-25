import { describe, expect, it } from 'vitest';
import {
  isEditableTarget,
  restoreRememberedSelection,
  retainPageSelectionOnPointerDown,
  shouldPreservePagentFocus,
} from '../../entrypoints/content/selection';

describe('page selection retain', () => {
  it('treats form fields as editable', () => {
    const input = document.createElement('input');
    const wrap = document.createElement('div');
    wrap.append(input);
    document.body.append(wrap);
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(wrap)).toBe(false);
  });

  it('does not steal pointer events from switches', () => {
    const toggle = document.createElement('button');
    toggle.setAttribute('role', 'switch');
    let prevented = false;
    retainPageSelectionOnPointerDown({
      target: toggle,
      preventDefault: () => {
        prevented = true;
      },
    });
    expect(prevented).toBe(false);
  });

  it('prevents default on chrome clicks but not on inputs', () => {
    const button = document.createElement('button');
    const input = document.createElement('textarea');
    let prevented = false;
    retainPageSelectionOnPointerDown({
      target: button,
      preventDefault: () => {
        prevented = true;
      },
    });
    expect(prevented).toBe(true);

    prevented = false;
    retainPageSelectionOnPointerDown({
      target: input,
      preventDefault: () => {
        prevented = true;
      },
    });
    expect(prevented).toBe(false);
  });

  it('keeps composer focus instead of restoring the page selection', () => {
    const input = document.createElement('textarea');
    document.body.append(input);
    input.focus();
    expect(shouldPreservePagentFocus(input)).toBe(true);
    restoreRememberedSelection({ target: input });
    expect(document.activeElement).toBe(input);

    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    expect(shouldPreservePagentFocus(button)).toBe(false);
  });
});
