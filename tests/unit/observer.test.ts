import { describe, expect, it } from 'vitest';
import { implicitRole, PageObserver, visibleText } from '@/features/page/observer';
import { LISTENER_ATTR } from '@/features/page/listener-tracker';

function mockVisibleRect(el: Element) {
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value: () =>
      ({
        x: 0,
        y: 0,
        width: 120,
        height: 40,
        top: 0,
        left: 0,
        bottom: 40,
        right: 120,
        toJSON: () => ({}),
      }) as DOMRect,
  });
}

function mockOffscreenRect(el: Element) {
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value: () =>
      ({
        x: 0,
        y: -2000,
        width: 120,
        height: 40,
        top: -2000,
        left: 0,
        bottom: -1960,
        right: 120,
        toJSON: () => ({}),
      }) as DOMRect,
  });
}

describe('PageObserver', () => {
  it('assigns stable ids and revisions', () => {
    document.body.innerHTML = `
      <button id="go">提交</button>
      <input aria-label="邮箱" />
      <a href="https://example.com">文档</a>
    `;
    const observer = new PageObserver();
    const first = observer.observe();
    expect(first.revision).toBe(1);
    expect(first.elements.length).toBeGreaterThan(0);
    const button = first.elements.find((item) => item.name.includes('提交'));
    expect(button).toBeTruthy();
    const node = observer.getElement(button!.id, first.revision);
    expect(node.textContent).toContain('提交');
    observer.bump();
    expect(() => observer.getElement(button!.id, first.revision)).toThrow(/过期/);
  });

  it('reads visible text and implicit roles', () => {
    const link = document.createElement('a');
    link.textContent = '  打开 文档  ';
    expect(visibleText(link)).toBe('打开 文档');
    expect(implicitRole(link)).toBe('link');
  });

  it('includes visible elements with registered listeners and onclick handlers', () => {
    document.body.innerHTML = `
      <div id="panel">点击面板</div>
      <div id="hidden" style="display:none">隐藏面板</div>
      <div id="offview">视口外</div>
    `;
    const panel = document.getElementById('panel')!;
    const hidden = document.getElementById('hidden')!;
    const offview = document.getElementById('offview')!;
    panel.setAttribute(LISTENER_ATTR, 'click,keydown');
    panel.setAttribute('onclick', 'go()');
    hidden.setAttribute(LISTENER_ATTR, 'click');
    hidden.setAttribute('onclick', 'go()');
    offview.setAttribute(LISTENER_ATTR, 'click');
    mockVisibleRect(panel);
    mockOffscreenRect(offview);

    const observer = new PageObserver();
    const result = observer.observe();

    const panelRecord = result.elements.find((item) => item.name.includes('点击面板'));
    expect(panelRecord).toBeTruthy();
    expect(panelRecord?.listenerEvents).toEqual(['click', 'keydown']);
    expect(panelRecord?.inlineHandlers).toEqual(['click']);
    // 有 click 监听/内联处理器的元素视为可点击
    expect(panelRecord?.clickable).toBe(true);

    // display:none 与视口外（可见性为假）的元素不进入监听/onclick 补充列表
    expect(result.elements.some((item) => item.name.includes('隐藏面板'))).toBe(false);
    expect(result.elements.some((item) => item.name.includes('视口外'))).toBe(false);
  });

  it('exposes listener events on interactive elements too', () => {
    document.body.innerHTML = '<button id="btn">提交</button>';
    const button = document.getElementById('btn')!;
    button.setAttribute(LISTENER_ATTR, 'click');
    mockVisibleRect(button);
    const observer = new PageObserver();
    const record = observer
      .observe()
      .elements.find((item) => item.name.includes('提交'));
    expect(record?.listenerEvents).toEqual(['click']);
  });
});
