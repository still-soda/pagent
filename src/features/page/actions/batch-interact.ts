import { activeInteractionContext, pageObserver } from '../observer';
import { selectOption, observedState } from './interactions';
import {
  asHtml,
  dispatchPointerPrelude,
  nextPaint,
  rawElementValue,
  settleInteraction,
  visibleTextValue,
} from './utils';
import type { InteractionResult, InteractionStep } from '@/shared/contracts/page';

export async function interactElements(steps: InteractionStep[]): Promise<InteractionResult[]> {
  const results: InteractionResult[] = [];
  for (const step of steps) {
    const beforeElement = pageObserver.describe(
      pageObserver.getElement(step.elementId, step.revision),
    );
    const before = observedState(beforeElement);
    try {
      await applyInteraction(step);
      await settleInteraction();
      const target = pageObserver.getElement(step.elementId);
      const satisfied = interactionSatisfiedRaw(step, target);
      const afterElement = pageObserver.describe(target);
      const after = observedState(afterElement);
      results.push({
        elementId: step.elementId,
        intent: step.intent,
        ok: true,
        changed: JSON.stringify(before) !== JSON.stringify(after),
        satisfied,
        before,
        after,
      });
    } catch (error) {
      results.push({
        elementId: step.elementId,
        intent: step.intent,
        ok: false,
        changed: false,
        satisfied: false,
        before,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

async function applyInteraction(step: InteractionStep): Promise<void> {
  const element = pageObserver.getElement(step.elementId, step.revision);
  switch (step.intent) {
    case 'activate':
      dispatchPointerPrelude(element);
      asHtml(element).click();
      return;
    case 'set-value':
      setElementValue(element, step.value);
      return;
    case 'set-checked':
      setElementChecked(element, Boolean(step.value));
      return;
    case 'choose-option':
      await chooseElementOption(element, String(step.value ?? ''));
      return;
  }
}

function setElementValue(element: Element, value: InteractionStep['value']): void {
  const text = String(value ?? '');
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, text);
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertReplacementText',
      data: text,
    }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (asHtml(element).isContentEditable) {
    element.textContent = text;
    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
    return;
  }
  if (element.getAttribute('role') === 'slider') {
    setAriaSlider(element, Number(value));
    return;
  }
  throw new Error('目标不支持设置值');
}

function setElementChecked(element: Element, checked: boolean): void {
  if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)) {
    if (element.checked !== checked) {
      dispatchPointerPrelude(element);
      element.click();
    }
    return;
  }
  const current = element.getAttribute('aria-checked') === 'true';
  if (current !== checked) {
    dispatchPointerPrelude(element);
    asHtml(element).click();
  }
}

async function chooseElementOption(element: Element, target: string): Promise<void> {
  if (element instanceof HTMLSelectElement) {
    selectOption(pageObserver.register(element), target);
    return;
  }
  dispatchPointerPrelude(element);
  asHtml(element).click();
  await nextPaint();
  const controlled = element.getAttribute('aria-controls');
  const scope = controlled
    ? element.ownerDocument.getElementById(controlled)
    : activeInteractionContext(element.ownerDocument);
  if (!scope) throw new Error('选项上下文未打开');
  const options = Array.from(scope?.querySelectorAll('option,[role="option"]') ?? []);
  const option = options.find((item) => {
    const value = item instanceof HTMLOptionElement ? item.value : item.getAttribute('data-value');
    return value === target || (item.textContent ?? '').replace(/\s+/g, ' ').trim() === target;
  });
  if (!option) throw new Error(`找不到选项：${target}`);
  dispatchPointerPrelude(option);
  asHtml(option).click();
}

function setAriaSlider(element: Element, target: number): void {
  if (!Number.isFinite(target)) throw new Error('滑块目标值无效');
  const min = Number(element.getAttribute('aria-valuemin') ?? 0);
  const max = Number(element.getAttribute('aria-valuemax') ?? 100);
  const current = Number(element.getAttribute('aria-valuenow') ?? min);
  const clamped = Math.max(min, Math.min(max, target));
  const direction = clamped >= current ? 'ArrowRight' : 'ArrowLeft';
  const inferredStep = Number(element.getAttribute('step') ?? 1) || 1;
  const count = Math.min(200, Math.round(Math.abs(clamped - current) / inferredStep));
  asHtml(element).focus();
  for (let index = 0; index < count; index += 1) {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: direction, bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: direction, bubbles: true }));
  }
}

function interactionSatisfiedRaw(step: InteractionStep, element: Element): boolean {
  if (step.intent === 'activate') return true;
  if (step.intent === 'set-checked') {
    const checked = element instanceof HTMLInputElement
      ? element.checked
      : element.getAttribute('aria-checked') === 'true';
    return checked === Boolean(step.value);
  }
  const target = String(step.value ?? '');
  if (step.intent === 'choose-option') {
    if (element instanceof HTMLSelectElement) {
      return element.value === target
        || Array.from(element.selectedOptions).some((option) =>
          option.value === target || visibleTextValue(option) === target);
    }
    const controls = element.getAttribute('aria-controls');
    const scope = controls
      ? element.ownerDocument.getElementById(controls)
      : activeInteractionContext(element.ownerDocument);
    const selected = scope?.querySelector('[role="option"][aria-selected="true"]');
    return rawElementValue(element) === target
      || (selected ? visibleTextValue(selected) === target : false);
  }
  return rawElementValue(element) === target;
}
