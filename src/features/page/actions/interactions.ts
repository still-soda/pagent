import { pageObserver } from '../observer';
import {
  asHtml,
  dispatchHoverPrelude,
  dispatchPointerPrelude,
  highlight,
  settleInteraction,
} from './utils';
import type { ObservedElement } from '@/shared/contracts/page';

export function observedState(element: ObservedElement | null) {
  if (!element) return undefined;
  return {
    value: element.value,
    valueText: element.valueText,
    checked: element.checked,
    selected: element.selected,
    expanded: element.expanded,
  };
}

export async function clickElement(elementId: string, revision?: number) {
  const el = pageObserver.getElement(elementId, revision);
  const before = observedState(pageObserver.describe(el));
  highlight(el);
  dispatchHoverPrelude(el);
  dispatchPointerPrelude(el);
  asHtml(el).click();
  await settleInteraction();
  const after = el.isConnected ? observedState(pageObserver.describe(el)) : undefined;
  return {
    ok: true,
    elementId,
    changed: !el.isConnected || JSON.stringify(before) !== JSON.stringify(after),
    before,
    after,
  };
}

export function dblclickElement(elementId: string, revision?: number) {
  const el = pageObserver.getElement(elementId, revision);
  highlight(el);
  el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window }));
  return { ok: true, elementId };
}

export function hoverElement(elementId: string, revision?: number) {
  const el = pageObserver.getElement(elementId, revision);
  highlight(el);
  dispatchHoverPrelude(el);
  return { ok: true, elementId };
}

export function focusElement(elementId: string, revision?: number) {
  const el = pageObserver.getElement(elementId, revision);
  asHtml(el).focus();
  return { ok: true, elementId };
}

export async function typeText(
  elementId: string,
  text: string,
  options: {
    mode?: 'replace' | 'append';
    clear?: boolean;
    submit?: boolean;
    revision?: number;
  } = {},
) {
  const el = pageObserver.getElement(elementId, options.revision);
  const input = el as HTMLInputElement | HTMLTextAreaElement;
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
    throw new Error('目标不是可编辑输入框');
  }
  const before = input.value;
  const replace = options.mode ? options.mode === 'replace' : options.clear !== false;
  const nextValue = `${replace ? '' : input.value}${text}`;
  input.focus();
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(input, nextValue);
  input.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    inputType: replace ? 'insertReplacementText' : 'insertText',
    data: text,
  }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  if (options.submit) {
    input.form?.requestSubmit();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }
  await settleInteraction();
  return {
    ok: true,
    elementId,
    changed: before !== input.value,
    satisfied: input.value === nextValue,
    value: input.value,
  };
}

export function clearElement(elementId: string, revision?: number) {
  return typeText(elementId, '', { clear: true, revision });
}

export function selectOption(elementId: string, value: string, revision?: number) {
  const el = pageObserver.getElement(elementId, revision);
  if (!(el instanceof HTMLSelectElement)) throw new Error('目标不是下拉框');
  const before = el.value;
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return {
    ok: true,
    elementId,
    changed: before !== el.value,
    satisfied: el.value === value,
    value: el.value,
  };
}

export function dragElement(
  elementId: string,
  targetId: string,
  revision?: number,
) {
  const source = pageObserver.getElement(elementId, revision);
  const target = pageObserver.getElement(targetId, revision);
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const start = { clientX: from.x + from.width / 2, clientY: from.y + from.height / 2 };
  const end = { clientX: to.x + to.width / 2, clientY: to.y + to.height / 2 };
  source.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, ...start }));
  source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, ...start }));
  target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, ...end }));
  target.dispatchEvent(new DragEvent('drop', { bubbles: true, ...end }));
  target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, ...end }));
  return { ok: true, elementId, targetId };
}

export function pressKey(key: string) {
  const active = document.activeElement ?? document.body;
  active.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  active.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
  return { ok: true, key };
}
