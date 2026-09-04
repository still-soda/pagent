import { activeInteractionContext, implicitRole, pageObserver } from './observer';
import { getRememberedSelection } from './selection';
import { redactText } from '@/shared/contracts/policy';
import { truncate } from '@/shared/utils/utils';
import type {
  ElementTreeOptions,
  InteractionResult,
  InteractionStep,
  LightweightElementTree,
  NamedScript,
  ObservationScope,
  ObservedElement,
} from '@/shared/contracts/page';

function asHtml(el: Element): HTMLElement {
  return el as HTMLElement;
}

export function highlight(el: Element) {
  const html = asHtml(el);
  const previous = html.style.outline;
  html.style.outline = '2px solid #1f6b57';
  html.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  window.setTimeout(() => {
    html.style.outline = previous;
  }, 1200);
}

export async function clickElement(elementId: string, revision?: number) {
  const el = pageObserver.getElement(elementId, revision);
  const before = observedState(pageObserver.describe(el));
  highlight(el);
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
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
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

export function scrollPage(payload: {
  elementId?: string;
  direction?: 'up' | 'down' | 'left' | 'right' | 'top' | 'bottom';
  amount?: number;
  revision?: number;
}) {
  const amount = payload.amount ?? 480;
  if (payload.elementId) {
    const element = pageObserver.getElement(payload.elementId, payload.revision);
    const scroller = nearestScroller(element);
    const before = scrollPosition(scroller);
    element.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    });
    const after = scrollPosition(scroller);
    return { ok: true, scroller: describeScroller(scroller), before, after };
  }
  const map = {
    up: [0, -amount],
    down: [0, amount],
    left: [-amount, 0],
    right: [amount, 0],
    top: [0, -document.body.scrollHeight],
    bottom: [0, document.body.scrollHeight],
  } as const;
  const [x, y] = map[payload.direction ?? 'down'];
  const scroller = activeScroller();
  const before = scrollPosition(scroller);
  if (scroller === window) {
    window.scrollBy({ left: x, top: y, behavior: 'smooth' });
  } else {
    scroller.scrollBy({ left: x, top: y, behavior: 'smooth' });
  }
  const after = scrollPosition(scroller);
  return {
    ok: true,
    changed: before.x !== after.x || before.y !== after.y,
    scroller: describeScroller(scroller),
    before,
    after,
  };
}

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

function observedState(element: ObservedElement | null) {
  if (!element) return undefined;
  return {
    value: element.value,
    valueText: element.valueText,
    checked: element.checked,
    selected: element.selected,
    expanded: element.expanded,
  };
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

export async function waitFor(payload: {
  ms?: number;
  text?: string;
  elementId?: string;
  urlIncludes?: string;
}) {
  const timeout = payload.ms ?? 4000;
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (payload.text && document.body.innerText.includes(payload.text)) return { ok: true };
    if (payload.urlIncludes && location.href.includes(payload.urlIncludes)) return { ok: true };
    if (payload.elementId) {
      try {
        pageObserver.getElement(payload.elementId);
        return { ok: true };
      } catch {
        // keep waiting
      }
    }
    if (!payload.text && !payload.elementId && !payload.urlIncludes) {
      await sleep(timeout);
      return { ok: true };
    }
    await sleep(200);
  }
  throw new Error('等待条件超时');
}

type TreeLabel = {
  depth: number;
  value: string;
};

const ELEMENT_TREE_SKIP = 'script,style,noscript,pagent-root,[data-pagent-ui]';
const ELEMENT_TREE_ATOMIC = 'svg,canvas,video,audio,iframe';

export function inspectElementTree(
  elementId: string,
  options: ElementTreeOptions = {},
): LightweightElementTree {
  const root = pageObserver.getElement(elementId, options.revision);
  const maxDepth = Math.max(0, Math.min(20, Math.trunc(options.maxDepth ?? 4)));
  const maxLength = Math.max(2, Math.min(2_000, Math.trunc(options.maxLength ?? 120)));
  const labels: TreeLabel[] = [];

  const visit = (element: Element, depth: number) => {
    labels.push({
      depth,
      value: elementTreeLabel(element, options.fields),
    });
    const children = elementTreeChildren(element);
    if (children.length === 0) return;
    if (depth >= maxDepth) {
      labels.push({
        depth: depth + 1,
        value: `more-level remaining-levels=${maxDescendantLevels(element)}`,
      });
      return;
    }
    for (const child of children) visit(child, depth + 1);
  };

  visit(root, 0);
  const totalLabels = labels.length;
  let emitted = labels;
  if (totalLabels > maxLength) {
    const kept = labels.slice(0, maxLength - 1);
    const firstOmitted = labels[kept.length];
    emitted = [
      ...kept,
      {
        depth: firstOmitted?.depth ?? 0,
        value: `more-label remaining-labels=${totalLabels - kept.length}`,
      },
    ];
  }

  return {
    rootElementId: elementId,
    totalLabels,
    emittedLabels: emitted.length,
    truncated: totalLabels > emitted.length || labels.some((label) => label.value.startsWith('more-level ')),
    tree: emitted.map((label) => `${'  '.repeat(label.depth)}${label.value}`).join('\n'),
  };
}

function elementTreeLabel(
  element: Element,
  fields: ElementTreeOptions['fields'],
): string {
  const tag = element.tagName.toLowerCase();
  const parts = [tag];
  const explicitRole = element.getAttribute('role');
  const role = explicitRole || implicitRole(element);
  if (explicitRole || (role && role !== tag)) parts.push(`role=${quoteTreeValue(role)}`);

  if (fields?.text) {
    const text = directElementText(element);
    if (text) parts.push(`text=${quoteTreeValue(text)}`);
  }
  if (fields?.coordinates) {
    const rect = element.getBoundingClientRect();
    parts.push(
      `box=${quoteTreeValue([
        Math.round(rect.x),
        Math.round(rect.y),
        Math.round(rect.width),
        Math.round(rect.height),
      ].join(','))}`,
    );
  }
  for (const name of fields?.attributes ?? []) {
    const value = element.getAttribute(name);
    if (value != null) parts.push(`${name}=${quoteTreeValue(value)}`);
  }
  return parts.join(' ');
}

function directElementText(element: Element): string {
  const direct = Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const text = direct || (elementTreeChildren(element).length === 0 ? element.textContent ?? '' : '');
  return redactText(truncate(text.replace(/\s+/g, ' ').trim(), 160));
}

function quoteTreeValue(value: string): string {
  return JSON.stringify(redactText(truncate(value, 160)));
}

function elementTreeChildren(element: Element): Element[] {
  if (element.matches(ELEMENT_TREE_ATOMIC)) return [];
  const children = [
    ...Array.from(element.children),
    ...Array.from(element.shadowRoot?.children ?? []),
  ];
  return children.filter((child) => !child.matches(ELEMENT_TREE_SKIP));
}

function maxDescendantLevels(root: Element): number {
  let maximum = 0;
  const pending = elementTreeChildren(root).map((element) => ({ element, level: 1 }));
  while (pending.length > 0) {
    const current = pending.pop()!;
    maximum = Math.max(maximum, current.level);
    for (const child of elementTreeChildren(current.element)) {
      pending.push({ element: child, level: current.level + 1 });
    }
  }
  return maximum;
}

export function runNamedScript(
  name: NamedScript,
  options: { scope?: ObservationScope } = {},
) {
  switch (name) {
    case 'extract_links':
      return Array.from(document.links)
        .slice(0, 80)
        .map((link) => ({ text: link.textContent?.trim(), href: link.href }));
    case 'extract_headings':
      return Array.from(document.querySelectorAll('h1,h2,h3,h4')).map((node) => ({
        tag: node.tagName.toLowerCase(),
        text: node.textContent?.trim(),
      }));
    case 'extract_forms':
      return Array.from(document.forms).map((form, index) => ({
        index,
        action: form.action,
        method: form.method,
        fields: Array.from(form.elements).map((el) => ({
          tag: el.tagName.toLowerCase(),
          name: (el as HTMLInputElement).name,
          type: (el as HTMLInputElement).type,
        })),
      }));
    case 'extract_interactions': {
      const observation = pageObserver.observe(document, 400, options.scope);
      return {
        url: observation.url,
        title: observation.title,
        revision: observation.revision,
        scope: observation.scope,
        scopeReason: observation.scopeReason,
        fallbackApplied: observation.fallbackApplied,
        interactionContext: observation.interactionContext,
        total: observation.totalElements,
        truncated: observation.truncated,
        elements: observation.elements.filter((element) => element.actionable),
      };
    }
    case 'extract_meta':
      return {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
        language: document.documentElement.lang,
        canonical: (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)?.href,
      };
    case 'page_stats':
      return {
        url: location.href,
        buttons: document.querySelectorAll('button').length,
        links: document.links.length,
        inputs: document.querySelectorAll('input,textarea,select').length,
        images: document.images.length,
        textLength: document.body.innerText.length,
      };
    case 'get_selection':
      return { selection: getRememberedSelection() };
    default:
      throw new Error(`未知命名脚本：${name}`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function dispatchPointerPrelude(element: Element): void {
  const rect = element.getBoundingClientRect();
  const init = {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };
  if (typeof PointerEvent !== 'undefined') {
    element.dispatchEvent(new PointerEvent('pointerdown', init));
    element.dispatchEvent(new PointerEvent('pointerup', init));
  }
  element.dispatchEvent(new MouseEvent('mousedown', init));
  element.dispatchEvent(new MouseEvent('mouseup', init));
}

function nearestScroller(element: Element): HTMLElement | Window {
  let current = element.parentElement;
  while (current) {
    const style = getComputedStyle(current);
    const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY)
      && current.scrollHeight > current.clientHeight;
    const canScrollX = /(auto|scroll|overlay)/.test(style.overflowX)
      && current.scrollWidth > current.clientWidth;
    if (canScrollY || canScrollX) return current;
    current = current.parentElement;
  }
  return window;
}

function activeScroller(): HTMLElement | Window {
  const focused = document.activeElement;
  if (focused) {
    const nearest = nearestScroller(focused);
    if (nearest !== window) return nearest;
  }
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('body *'))
    .filter((element) => {
      const style = getComputedStyle(element);
      return /(auto|scroll|overlay)/.test(`${style.overflowX} ${style.overflowY}`)
        && (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth);
    })
    .sort((left, right) =>
      (right.clientWidth * right.clientHeight) - (left.clientWidth * left.clientHeight));
  return candidates[0] ?? window;
}

function scrollPosition(scroller: HTMLElement | Window) {
  if (scroller instanceof HTMLElement) {
    return { x: scroller.scrollLeft, y: scroller.scrollTop };
  }
  return { x: window.scrollX, y: window.scrollY };
}

function describeScroller(scroller: HTMLElement | Window): string {
  if (!(scroller instanceof HTMLElement)) return 'window';
  return scroller.id ? `#${scroller.id}` : scroller.tagName.toLowerCase();
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function settleInteraction(): Promise<void> {
  await Promise.resolve();
  await nextPaint();
  await nextPaint();
}

function rawElementValue(element: Element): string {
  if ('value' in element) return String((element as HTMLInputElement).value ?? '');
  return element.getAttribute('aria-valuenow')
    ?? element.getAttribute('aria-valuetext')
    ?? element.textContent
    ?? '';
}

function visibleTextValue(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}
