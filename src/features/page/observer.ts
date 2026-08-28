import { nowId, truncate } from '@/shared/utils/utils';
import { redactText } from '@/shared/contracts/policy';
import type { ObservedElement, PageObservation } from '@/shared/contracts/page';
import { getRememberedSelection } from './selection';
import { LISTENER_ATTR, listenerEventsOf } from './listener-tracker';

const INTERACTIVE = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'option',
  'summary',
  'label',
  '[role="button"]',
  '[role="link"]',
  '[role="textbox"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="combobox"]',
  '[role="menuitem"]',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const SKIP = 'script, style, noscript, svg, path, pagent-root, [data-pagent-ui]';

export class PageObserver {
  revision = 1;
  documentId = nowId('doc');
  private nodes = new Map<string, WeakRef<Element>>();
  private reverse = new WeakMap<Element, string>();

  bump(): number {
    this.revision += 1;
    this.documentId = nowId('doc');
    return this.revision;
  }

  getElement(id: string, revision?: number): Element {
    if (revision != null && revision !== this.revision) {
      throw new Error(`页面已变化（revision ${this.revision}），元素 ${id} 已过期`);
    }
    const node = this.nodes.get(id)?.deref();
    if (!node || !node.isConnected) {
      throw new Error(`找不到元素 ${id}，请先重新观测页面`);
    }
    return node;
  }

  register(el: Element): string {
    return this.ensureId(el);
  }

  describe(el: Element): ObservedElement | null {
    return this.serialize(el);
  }

  prune() {
    for (const [id, ref] of this.nodes) {
      const node = ref.deref();
      if (!node || !node.isConnected) this.nodes.delete(id);
    }
  }

  observe(root: Document = document, maxElements = 140): PageObservation {
    this.prune();
    const elements: ObservedElement[] = [];
    const seen = new Set<Element>();
    const candidates = Array.from(root.querySelectorAll(INTERACTIVE));
    // 登记过 addEventListener 的元素（document_start 主世界追踪器标记）与携带 onclick 的元素，仅取可见部分
    const listenerCandidates = Array.from(root.querySelectorAll(`[${LISTENER_ATTR}]`));
    const onclickCandidates = Array.from(root.querySelectorAll('[onclick]'));

    const groups: Array<{ els: Element[]; visibleOnly: boolean }> = [
      { els: candidates, visibleOnly: false },
      { els: listenerCandidates, visibleOnly: true },
      { els: onclickCandidates, visibleOnly: true },
    ];

    scan: for (const group of groups) {
      for (const el of group.els) {
        if (seen.has(el) || el.closest(SKIP)) continue;
        if (group.visibleOnly && (el.tagName === 'HTML' || el.tagName === 'BODY')) continue;
        seen.add(el);
        const record = this.serialize(el);
        if (!record) continue;
        if (group.visibleOnly && !record.visible) continue;
        elements.push(record);
        if (elements.length >= maxElements) break scan;
      }
    }

    if (elements.length < maxElements) {
      for (const el of Array.from(root.querySelectorAll('h1,h2,h3,p,li,td,th'))) {
        if (seen.has(el) || el.closest(SKIP)) continue;
        const text = visibleText(el);
        if (!text || text.length < 8) continue;
        seen.add(el);
        const record = this.serialize(el);
        if (record) elements.push(record);
        if (elements.length >= maxElements) break;
      }
    }

    return {
      url: location.href,
      title: document.title,
      revision: this.revision,
      documentId: this.documentId,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      },
      selection: redactText(getRememberedSelection().trim()),
      headings: Array.from(document.querySelectorAll('h1,h2,h3'))
        .map((node) => visibleText(node))
        .filter(Boolean)
        .slice(0, 20),
      frames: Array.from(document.querySelectorAll('iframe')).map((frame, index) => ({
        index,
        sameOrigin: canReadFrame(frame),
        url: canReadFrame(frame) ? frame.contentDocument?.location.href : undefined,
      })),
      elements,
      textPreview: redactText(truncate(document.body?.innerText ?? '', 2500)),
    };
  }

  private serialize(el: Element): ObservedElement | null {
    const rect = el.getBoundingClientRect();
    const visible = rect.width > 1 && rect.height > 1 && rect.bottom > 0 && rect.right > 0;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return null;

    const id = this.ensureId(el);
    const html = el as HTMLElement;
    const name = redactText(
      html.getAttribute('aria-label') ||
        html.getAttribute('name') ||
        html.getAttribute('alt') ||
        visibleText(el) ||
        html.getAttribute('placeholder') ||
        '',
    );

    const listenerEvents = listenerEventsOf(el);
    const inlineHandlers = el.hasAttribute('onclick') ? ['click'] : [];
    const hasClickHandler = listenerEvents.includes('click') || inlineHandlers.includes('click');

    return {
      id,
      tag: el.tagName.toLowerCase(),
      role: html.getAttribute('role') || implicitRole(el),
      name: truncate(name, 120),
      type: html.getAttribute('type') ?? undefined,
      value: 'value' in html ? redactText(truncate(String((html as HTMLInputElement).value ?? ''), 80)) : undefined,
      href: html instanceof HTMLAnchorElement ? html.href : undefined,
      placeholder: html.getAttribute('placeholder') ?? undefined,
      visible,
      clickable: html.tabIndex >= 0 || /^(a|button|input|select|textarea)$/i.test(el.tagName) || hasClickHandler,
      disabled: 'disabled' in html ? Boolean((html as HTMLInputElement).disabled) : undefined,
      checked: 'checked' in html ? Boolean((html as HTMLInputElement).checked) : undefined,
      box: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      listenerEvents: listenerEvents.length > 0 ? listenerEvents : undefined,
      inlineHandlers: inlineHandlers.length > 0 ? inlineHandlers : undefined,
    };
  }

  private ensureId(el: Element): string {
    const existing = this.reverse.get(el);
    if (existing) {
      this.nodes.set(existing, new WeakRef(el));
      return existing;
    }
    const id = nowId('el');
    this.reverse.set(el, id);
    this.nodes.set(id, new WeakRef(el));
    return id;
  }
}

export function visibleText(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function implicitRole(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'a') return 'link';
  if (tag === 'button') return 'button';
  if (tag === 'input') return (el as HTMLInputElement).type || 'textbox';
  if (tag === 'textarea') return 'textbox';
  if (tag === 'select') return 'combobox';
  if (tag === 'img') return 'img';
  return tag;
}

function canReadFrame(frame: HTMLIFrameElement): boolean {
  try {
    return Boolean(frame.contentDocument);
  } catch {
    return false;
  }
}

export const pageObserver = new PageObserver();
