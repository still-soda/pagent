import { nowId, truncate } from '@/shared/utils/utils';
import { redactText } from '@/shared/contracts/policy';
import type {
  ElementAction,
  ObservationScope,
  ObservedElement,
  ObservedOption,
  PageObservation,
} from '@/shared/contracts/page';
import { getRememberedSelection } from './selection';

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
  '[role="option"]',
  '[role="listbox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="switch"]',
  '[role="menuitem"]',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const SKIP = 'script, style, noscript, svg, path, pagent-root, [data-pagent-ui]';

export const INTERACTIVE_CURSORS = new Set([
  'pointer',
  'grab',
  'grabbing',
  'zoom-in',
  'zoom-out',
  'copy',
  'move',
  'crosshair',
  'col-resize',
  'row-resize',
]);

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

  observe(
    root: Document = document,
    maxElements = 140,
    requestedScope: ObservationScope = 'auto',
  ): PageObservation {
    this.prune();
    let context = requestedScope === 'page' ? null : activeInteractionContext(root);
    let fallbackApplied = false;
    const scan = (activeContext: Element | null) => {
      const records: ObservedElement[] = [];
      const seen = new Set<Element>();
      const scanRoot = activeContext ?? root;
      const candidates = collectInteractiveCandidates(scanRoot, activeContext)
        .filter((el) => !el.closest(SKIP))
        .sort((left, right) => interactionScore(right) - interactionScore(left));

      for (const el of candidates) {
        if (seen.has(el) || el.closest(SKIP)) continue;
        if (el instanceof HTMLLabelElement && associatedControl(el)) continue;
        seen.add(el);
        const record = this.serialize(el);
        if (!record) continue;
        if (activeContext && (!record.visible && !isOffscreenFormControl(el))) continue;
        if (!activeContext && isInInactiveInteractionSurface(el)) continue;
        if (activeContext && !record.actionable && !isOffscreenFormControl(el)) continue;
        records.push(record);
        if (records.length >= maxElements) break;
      }
      return { records, seen, candidateCount: candidates.length };
    };

    let scanned = scan(context);
    if (context && scanned.records.length === 0) {
      context = null;
      fallbackApplied = true;
      scanned = scan(null);
    }

    const elements = scanned.records;
    const seen = scanned.seen;
    if (!context && elements.length < maxElements) {
      for (const el of collectAcrossRoots(root, 'h1,h2,h3,p,li,td,th')) {
        if (seen.has(el) || el.closest(SKIP)) continue;
        const text = visibleText(el);
        if (!text || text.length < 8) continue;
        seen.add(el);
        const record = this.serialize(el);
        if (record) elements.push(record);
        if (elements.length >= maxElements) break;
      }
    }
    const totalElements = scanned.candidateCount;

    return {
      url: location.href,
      title: document.title,
      revision: this.revision,
      documentId: this.documentId,
      scope: context ? 'interaction-context' : 'page',
      scopeReason: context
        ? '检测到可见且包含可操作目标的临时交互层'
        : requestedScope === 'page'
          ? '已按请求强制扫描整页'
        : fallbackApplied
          ? '临时交互层没有可操作目标，已自动回退整页'
          : '未检测到活动的临时交互层',
      fallbackApplied,
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
      interactionContext: context
        ? {
          id: this.ensureId(context),
          role: context.getAttribute('role') || implicitRole(context),
          name: redactText(truncate(
            context.getAttribute('aria-label') || referencedText(context, 'aria-labelledby') || visibleText(context),
            160,
          )),
        }
        : undefined,
      elements,
      totalElements,
      truncated: totalElements > elements.length,
      textPreview: redactText(truncate(document.body?.innerText ?? '', 2500)),
    };
  }

  private serialize(el: Element): ObservedElement | null {
    const rect = el.getBoundingClientRect();
    const view = el.ownerDocument.defaultView;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return null;
    const visible = rect.width > 1
      && rect.height > 1
      && rect.bottom > 0
      && rect.right > 0
      && rect.top < (view?.innerHeight ?? Number.POSITIVE_INFINITY)
      && rect.left < (view?.innerWidth ?? Number.POSITIVE_INFINITY)
      && isVisuallyRendered(el, style);

    const id = this.ensureId(el);
    const html = el as HTMLElement;
    const label = associatedLabel(el);
    const labelledBy = referencedText(el, 'aria-labelledby');
    const description = referencedText(el, 'aria-describedby');
    const role = html.getAttribute('role') || implicitRole(el);
    const name = redactText(
      html.getAttribute('aria-label') ||
        label ||
        labelledBy ||
        html.getAttribute('alt') ||
        visibleText(el) ||
        html.getAttribute('name') ||
        html.getAttribute('placeholder') ||
        '',
    );
    const disabled = 'disabled' in html
      ? Boolean((html as HTMLInputElement).disabled)
      : html.getAttribute('aria-disabled') === 'true';
    const actions = supportedActions(el, role, disabled, style);
    const cursor = isCursorOrigin(el, style) ? style.cursor : undefined;
    const value = 'value' in html
      ? redactText(truncate(String((html as HTMLInputElement).value ?? ''), 80))
      : undefined;
    const valueText = observedValueText(el, role, value);

    return {
      id,
      tag: el.tagName.toLowerCase(),
      role,
      name: truncate(name, 120),
      label: label ? redactText(truncate(label, 120)) : undefined,
      description: description ? redactText(truncate(description, 160)) : undefined,
      type: html.getAttribute('type') ?? undefined,
      cursor,
      value,
      valueText: valueText ? redactText(truncate(valueText, 120)) : undefined,
      href: html instanceof HTMLAnchorElement ? html.href : undefined,
      placeholder: html.getAttribute('placeholder') ?? undefined,
      visible,
      visibility: visible ? 'visible' : 'offscreen',
      clickable: isClickCapable(el, role, style),
      actionable: !disabled && actions.length > 0,
      disabled,
      readOnly: 'readOnly' in html ? Boolean((html as HTMLInputElement).readOnly) : undefined,
      required: 'required' in html
        ? Boolean((html as HTMLInputElement).required)
        : html.getAttribute('aria-required') === 'true',
      checked: 'checked' in html ? Boolean((html as HTMLInputElement).checked) : undefined,
      selected: el instanceof HTMLOptionElement
        ? el.selected
        : html.getAttribute('aria-selected') === 'true' || undefined,
      expanded: html.hasAttribute('aria-expanded')
        ? html.getAttribute('aria-expanded') === 'true'
        : undefined,
      min: numericAttribute(el, 'min', 'aria-valuemin'),
      max: numericAttribute(el, 'max', 'aria-valuemax'),
      step: numericAttribute(el, 'step'),
      options: this.readOptions(el),
      actions,
      box: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  }

  private readOptions(el: Element): ObservedOption[] | undefined {
    let options: Element[] = [];
    if (el instanceof HTMLSelectElement) {
      options = Array.from(el.options);
    } else {
      const controls = el.getAttribute('aria-controls');
      const list = controls ? el.ownerDocument.getElementById(controls) : null;
      if (list) options = Array.from(list.querySelectorAll('[role="option"],option'));
    }
    if (!options.length) return undefined;
    return options.slice(0, 40).map((option) => ({
      label: redactText(truncate(visibleText(option) || option.getAttribute('label') || '', 100)),
      value: option instanceof HTMLOptionElement ? option.value : option.getAttribute('data-value') ?? undefined,
      selected: option instanceof HTMLOptionElement
        ? option.selected
        : option.getAttribute('aria-selected') === 'true',
      disabled: option instanceof HTMLOptionElement
        ? option.disabled
        : option.getAttribute('aria-disabled') === 'true',
      elementId: this.ensureId(option),
    }));
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

function isVisuallyRendered(el: Element, style: CSSStyleDeclaration): boolean {
  const check = (el as Element & {
    checkVisibility?: (options?: { checkOpacity?: boolean; checkVisibilityCSS?: boolean }) => boolean;
  }).checkVisibility;
  if (typeof check === 'function') {
    return check.call(el, { checkOpacity: true, checkVisibilityCSS: true });
  }
  const opacity = Number.parseFloat(style.opacity ?? '1');
  return Number.isNaN(opacity) || opacity > 0;
}

export function implicitRole(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'a') return 'link';
  if (tag === 'button') return 'button';
  if (tag === 'input') {
    const type = (el as HTMLInputElement).type;
    if (type === 'checkbox' || type === 'radio') return type;
    if (type === 'range') return 'slider';
    if (type === 'number') return 'spinbutton';
    if (type === 'button' || type === 'submit' || type === 'reset') return 'button';
    return 'textbox';
  }
  if (tag === 'textarea') return 'textbox';
  if (tag === 'select') return 'combobox';
  if (tag === 'img') return 'img';
  return tag;
}

function collectAcrossRoots(root: Document | ShadowRoot | Element, selector: string): Element[] {
  const found: Element[] = [];
  const visit = (current: Document | ShadowRoot | Element) => {
    if (current instanceof Element && current.matches(selector)) found.push(current);
    for (const element of Array.from(current.querySelectorAll(selector))) found.push(element);
    for (const host of Array.from(current.querySelectorAll('*'))) {
      if (host.shadowRoot) visit(host.shadowRoot);
    }
  };
  visit(root);
  return found;
}

export function isCursorOrigin(el: Element, style?: CSSStyleDeclaration): boolean {
  const doc = el.ownerDocument;
  if (!doc || el === doc.body || el === doc.documentElement) return false;
  const view = doc.defaultView ?? (typeof window !== 'undefined' ? window : undefined);
  const computed = style ?? view?.getComputedStyle(el);
  const cursor = computed?.cursor;
  if (!cursor || !INTERACTIVE_CURSORS.has(cursor)) return false;

  const parent = el.parentElement;
  if (!parent) return true;

  const html = el as HTMLElement;
  if (html.style && html.style.cursor && INTERACTIVE_CURSORS.has(html.style.cursor)) {
    return true;
  }

  const parentStyle = view?.getComputedStyle(parent);
  return parentStyle?.cursor !== cursor;
}

function collectInteractiveCandidates(
  scanRoot: Document | ShadowRoot | Element,
  activeContext: Element | null,
): Element[] {
  const baseSelector = activeContext ? `${INTERACTIVE},li,td` : INTERACTIVE;
  const semantic = collectAcrossRoots(scanRoot, baseSelector);
  const seen = new Set(semantic);
  const additional: Element[] = [];

  const extraSelector = '[style*="cursor"],[class*="cursor"],[class*="pointer"],[onclick],div,span,li,td,th,tr,p,i,img,article,section';
  const potentialCursorElements = collectAcrossRoots(scanRoot, extraSelector);
  for (const el of potentialCursorElements) {
    if (seen.has(el) || el.closest(SKIP)) continue;
    if (isCursorOrigin(el)) {
      seen.add(el);
      additional.push(el);
    }
  }

  return [...semantic, ...additional];
}

function interactionScore(el: Element): number {
  const role = el.getAttribute('role') || implicitRole(el);
  if (/^(input|textarea|select|button)$/i.test(el.tagName)) return 5;
  if (['textbox', 'combobox', 'checkbox', 'radio', 'slider', 'spinbutton', 'switch'].includes(role)) return 4;
  if (['button', 'link', 'option', 'menuitem'].includes(role)) return 3;
  if (el instanceof HTMLLabelElement) return 1;
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (style?.cursor && INTERACTIVE_CURSORS.has(style.cursor)) return 3;
  return 2;
}

function associatedControl(label: HTMLLabelElement): Element | null {
  return label.control ?? label.querySelector('input,textarea,select,button,[role]');
}

function associatedLabel(el: Element): string {
  if ('labels' in el) {
    const labels = Array.from((el as HTMLInputElement).labels ?? []);
    const text = labels.map(visibleText).filter(Boolean).join(' ');
    if (text) return text;
  }
  const wrapping = el.closest('label');
  if (wrapping) return visibleText(wrapping);
  return referencedText(el, 'aria-labelledby');
}

function referencedText(el: Element, attribute: string): string {
  return (el.getAttribute(attribute) ?? '')
    .split(/\s+/)
    .map((id) => el.ownerDocument.getElementById(id))
    .filter((node): node is HTMLElement => Boolean(node))
    .map(visibleText)
    .filter(Boolean)
    .join(' ');
}

function observedValueText(el: Element, role: string, value?: string): string | undefined {
  const aria = el.getAttribute('aria-valuetext');
  if (aria) return aria;
  if (el instanceof HTMLSelectElement) {
    return Array.from(el.selectedOptions).map((option) => visibleText(option) || option.label).join(', ');
  }
  if (value) return value;
  if (role === 'combobox') {
    const activeId = el.getAttribute('aria-activedescendant');
    const active = activeId ? el.ownerDocument.getElementById(activeId) : null;
    if (active) return visibleText(active);
    let parent = el.parentElement;
    for (let depth = 0; parent && depth < 3; depth += 1, parent = parent.parentElement) {
      const selected = parent.querySelector('[aria-selected="true"]');
      if (selected) return visibleText(selected);
      const text = Array.from(parent.querySelectorAll('span'))
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.width > 1 && rect.height > 1 && !node.hasAttribute('aria-hidden');
        })
        .map(visibleText)
        .find((item) => item && item !== el.getAttribute('placeholder'));
      if (text) return text;
    }
  }
  if (role === 'slider' || role === 'spinbutton') return el.getAttribute('aria-valuenow') ?? undefined;
  return undefined;
}

function numericAttribute(el: Element, ...names: string[]): number | undefined {
  for (const name of names) {
    const raw = el.getAttribute(name);
    if (raw == null || raw === '') continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function supportedActions(
  el: Element,
  role: string,
  disabled: boolean,
  style?: CSSStyleDeclaration,
): ElementAction[] {
  if (disabled) return [];
  const actions: ElementAction[] = [];
  if (
    el instanceof HTMLInputElement
    || el instanceof HTMLTextAreaElement
    || role === 'textbox'
    || role === 'spinbutton'
    || role === 'slider'
  ) actions.push('set-value');
  if (el instanceof HTMLSelectElement || role === 'combobox' || role === 'listbox') {
    actions.push('choose-option');
  }
  if (
    (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio'))
    || role === 'checkbox'
    || role === 'radio'
    || role === 'switch'
  ) actions.push('set-checked');
  if (isClickCapable(el, role, style)) actions.push('activate');
  return [...new Set(actions)];
}

function isClickCapable(el: Element, role: string, style = el.ownerDocument.defaultView?.getComputedStyle(el)): boolean {
  const html = el as HTMLElement;
  return /^(a|button|input|select|textarea|label|summary|option)$/i.test(el.tagName)
    || ['button', 'link', 'option', 'menuitem', 'tab'].includes(role)
    || asTabIndex(el) >= 0
    || typeof html.onclick === 'function'
    || html.hasAttribute('onclick')
    || isCursorOrigin(el, style);
}

function isOffscreenFormControl(el: Element): boolean {
  return el instanceof HTMLInputElement
    || el instanceof HTMLTextAreaElement
    || el instanceof HTMLSelectElement;
}

function isInInactiveInteractionSurface(el: Element): boolean {
  const surface = el.closest(
    '[role="dialog"],[role="listbox"],[role="menu"],[aria-modal="true"],dialog,[popover]',
  );
  if (!surface) return false;
  const rect = surface.getBoundingClientRect();
  const style = surface.ownerDocument.defaultView?.getComputedStyle(surface);
  return rect.width <= 1
    || rect.height <= 1
    || style?.display === 'none'
    || style?.visibility === 'hidden'
    || surface.getAttribute('aria-hidden') === 'true';
}

export function activeInteractionContext(root: Document = document): Element | null {
  const candidates = Array.from(root.querySelectorAll(
    '[role="dialog"],[role="listbox"],[role="menu"],[aria-modal="true"],dialog[open],[popover]',
  )).filter((element) => {
    if (element.closest(SKIP)) return false;
    const rect = element.getBoundingClientRect();
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    return rect.width > 1
      && rect.height > 1
      && style?.display !== 'none'
      && style?.visibility !== 'hidden'
      && element.getAttribute('aria-hidden') !== 'true'
      && isTransientInteractionSurface(element, root, style)
      && Boolean(element.querySelector(`${INTERACTIVE},li,td,[style*="cursor"],[class*="cursor"],[class*="pointer"]`));
  });
  return candidates
    .map((element) => ({ element, score: interactionContextScore(element) }))
    .sort((left, right) => right.score - left.score)[0]?.element ?? null;
}

function isTransientInteractionSurface(
  element: Element,
  root: Document,
  style?: CSSStyleDeclaration,
): boolean {
  const role = element.getAttribute('role') || implicitRole(element);
  if (role !== 'menu') return true;
  if (element.closest('nav,aside,[role="navigation"]')) return false;
  if (element.matches('[aria-modal="true"]') || element.hasAttribute('popover')) return true;
  if (element.contains(root.activeElement)) return true;

  const id = element.id;
  if (id) {
    const controller = Array.from(root.querySelectorAll('[aria-expanded="true"][aria-controls]'))
      .some((candidate) =>
        (candidate.getAttribute('aria-controls') ?? '').split(/\s+/).includes(id));
    if (controller) return true;
  }

  return style?.position === 'absolute' || style?.position === 'fixed';
}

function interactionContextScore(element: Element): number {
  const role = element.getAttribute('role') || implicitRole(element);
  let score = role === 'dialog' ? 100 : role === 'listbox' ? 80 : role === 'menu' ? 60 : 40;
  if (element.matches('[aria-modal="true"],dialog[open]') || element.hasAttribute('popover')) score += 30;
  if (element.contains(element.ownerDocument.activeElement)) score += 20;
  const position = element.ownerDocument.defaultView?.getComputedStyle(element).position;
  if (position === 'fixed' || position === 'absolute') score += 10;
  return score;
}

function asTabIndex(el: Element): number {
  return 'tabIndex' in el ? Number((el as HTMLElement).tabIndex) : -1;
}

function canReadFrame(frame: HTMLIFrameElement): boolean {
  try {
    return Boolean(frame.contentDocument);
  } catch {
    return false;
  }
}

export const pageObserver = new PageObserver();
