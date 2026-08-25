import { pageObserver } from './observer';
import { getRememberedSelection } from './selection';
import type { NamedScript } from '../../lib/shared/types';

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

export function clickElement(elementId: string, revision?: number) {
  const el = pageObserver.getElement(elementId, revision);
  highlight(el);
  asHtml(el).click();
  return { ok: true, elementId };
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

export function typeText(
  elementId: string,
  text: string,
  options: { clear?: boolean; submit?: boolean; revision?: number } = {},
) {
  const el = pageObserver.getElement(elementId, options.revision);
  const input = el as HTMLInputElement | HTMLTextAreaElement;
  input.focus();
  if (options.clear) input.value = '';
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(input, `${options.clear ? '' : input.value}${text}`);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  if (options.submit) {
    input.form?.requestSubmit();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }
  return { ok: true, elementId, value: input.value };
}

export function clearElement(elementId: string, revision?: number) {
  return typeText(elementId, '', { clear: true, revision });
}

export function selectOption(elementId: string, value: string, revision?: number) {
  const el = pageObserver.getElement(elementId, revision);
  if (!(el instanceof HTMLSelectElement)) throw new Error('目标不是下拉框');
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true, elementId, value };
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
    pageObserver.getElement(payload.elementId, payload.revision).scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    });
    return { ok: true };
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
  window.scrollBy({ left: x, top: y, behavior: 'smooth' });
  return { ok: true, scrollY: window.scrollY };
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

export function runNamedScript(name: NamedScript) {
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
