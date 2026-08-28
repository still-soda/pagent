import { beforeAll, describe, expect, it } from 'vitest';
import {
  installListenerTracker,
  LISTENER_ATTR,
  listenerEventsOf,
} from '@/features/page/listener-tracker';

/**
 * happy-dom 的元素走内部独立的 EventTarget 原型，直接给元素调用 addEventListener
 * 不会命中我们替换的全局 EventTarget.prototype。因此这里用 .call(el, ...) 直接调用
 * 劫持后的原型方法，验证劫持包装器的完整逻辑（登记、计数、摘除标记）。
 * 真实浏览器主世界中事件监听正是通过该原型解析的。
 */
let originalAdd: EventTarget['addEventListener'];
let originalRemove: EventTarget['removeEventListener'];
let patchedAdd: EventTarget['addEventListener'];
let patchedRemove: EventTarget['removeEventListener'];

function add(el: Element, type: string, listener: () => void, options?: boolean | AddEventListenerOptions) {
  patchedAdd.call(el, type, listener, options);
}

function remove(el: Element, type: string, listener: () => void, options?: boolean | EventListenerOptions) {
  patchedRemove.call(el, type, listener, options);
}

describe('listener tracker', () => {
  beforeAll(() => {
    originalAdd = EventTarget.prototype.addEventListener;
    originalRemove = EventTarget.prototype.removeEventListener;
    installListenerTracker();
    patchedAdd = EventTarget.prototype.addEventListener;
    patchedRemove = EventTarget.prototype.removeEventListener;
  });

  it('replaces the prototype methods and is idempotent', () => {
    expect(patchedAdd).not.toBe(originalAdd);
    expect(patchedRemove).not.toBe(originalRemove);
    // 再次安装不应重复包装
    installListenerTracker();
    expect(EventTarget.prototype.addEventListener).toBe(patchedAdd);
  });

  it('records elements registering listeners and removes unregistered ones', () => {
    const button = document.createElement('button');
    document.body.append(button);
    const onClick = () => {};
    const onKey = () => {};

    add(button, 'click', onClick);
    add(button, 'keydown', onKey);
    expect(listenerEventsOf(button)).toEqual(['click', 'keydown']);
    expect(button.getAttribute(LISTENER_ATTR)).toBe('click,keydown');

    // 移除其中一个，标记保留剩余事件
    remove(button, 'click', onClick);
    expect(listenerEventsOf(button)).toEqual(['keydown']);

    // 移除最后一个，标记自动摘除
    remove(button, 'keydown', onKey);
    expect(button.hasAttribute(LISTENER_ATTR)).toBe(false);
    expect(listenerEventsOf(button)).toEqual([]);
  });

  it('tracks capture flags separately', () => {
    const div = document.createElement('div');
    document.body.append(div);
    const fn = () => {};

    add(div, 'click', fn, { capture: true });
    add(div, 'click', fn, { capture: false });
    expect(listenerEventsOf(div)).toEqual(['click']);

    remove(div, 'click', fn, { capture: true });
    // 冒泡版本仍在
    expect(listenerEventsOf(div)).toEqual(['click']);

    remove(div, 'click', fn);
    expect(div.hasAttribute(LISTENER_ATTR)).toBe(false);
  });

  it('ignores non-element targets', () => {
    const text = document.createTextNode('text');
    const fn = () => {};
    patchedAdd.call(text, 'click', fn);
    expect(document.querySelectorAll(`[${LISTENER_ATTR}]`).length).toBe(0);
    patchedRemove.call(text, 'click', fn);
  });

  it('removes marker when the element itself is removed from the DOM', () => {
    const div = document.createElement('div');
    div.setAttribute('data-x', '1');
    add(div, 'click', () => {});
    expect(div.hasAttribute(LISTENER_ATTR)).toBe(true);
    document.body.append(div);
    div.remove();
    expect(document.querySelectorAll(`[${LISTENER_ATTR}]`).length).toBe(0);
  });
});
