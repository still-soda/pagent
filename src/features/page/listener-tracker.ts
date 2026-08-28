/**
 * 页面主世界的事件监听追踪器。
 *
 * 在 document_start（主世界）劫持 EventTarget.prototype.addEventListener /
 * removeEventListener，把「登记过事件的元素」用 data-pagent-listener 属性标记在
 * 元素上（属性值是该元素当前仍生效的事件类型，逗号分隔、去重排序）。
 * 元素所有监听被移除后自动摘掉标记，供观察器（隔离世界）读取同一份 DOM。
 *
 * 注意：该模块必须保持零依赖、不引用 browser/chrome API，因为它运行在页面主世界。
 */

export const LISTENER_ATTR = 'data-pagent-listener';

const INSTALL_FLAG = '__pagentListenerTrackerInstalled__';

/** 元素 -> (事件类型:capture -> 该监听剩余数量) */
const listenerCounts = new WeakMap<Element, Map<string, number>>();

function captureOf(options?: boolean | AddEventListenerOptions): boolean {
  if (options === true) return true;
  if (typeof options === 'object' && options !== null) {
    return (options as AddEventListenerOptions).capture === true;
  }
  return false;
}

function syncMarker(el: Element): void {
  const map = listenerCounts.get(el);
  if (!map || map.size === 0) {
    if (el.hasAttribute(LISTENER_ATTR)) el.removeAttribute(LISTENER_ATTR);
    if (map) listenerCounts.delete(el);
    return;
  }
  const types = Array.from(
    new Set(Array.from(map.keys()).map((key) => key.split(':')[0] ?? '').filter(Boolean)),
  ).sort();
  const value = types.join(',');
  if (el.getAttribute(LISTENER_ATTR) !== value) el.setAttribute(LISTENER_ATTR, value);
}

/** 在页面主世界安装监听追踪；重复调用是幂等的。 */
export function installListenerTracker(): void {
  const proto = EventTarget.prototype as EventTarget & Record<string, unknown>;
  if (proto[INSTALL_FLAG]) return;
  proto[INSTALL_FLAG] = true;

  const originalAdd = proto.addEventListener;
  const originalRemove = proto.removeEventListener;

  proto.addEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    originalAdd.call(this, type, listener, options);
    if (this instanceof Element && typeof type === 'string') {
      const key = `${type}:${captureOf(options) ? '1' : '0'}`;
      let map = listenerCounts.get(this);
      if (!map) {
        map = new Map();
        listenerCounts.set(this, map);
      }
      map.set(key, (map.get(key) ?? 0) + 1);
      syncMarker(this);
    }
  };

  proto.removeEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ) {
    originalRemove.call(this, type, listener, options);
    if (this instanceof Element && typeof type === 'string') {
      const map = listenerCounts.get(this);
      if (map) {
        const key = `${type}:${captureOf(options) ? '1' : '0'}`;
        const count = map.get(key);
        if (count != null) {
          if (count <= 1) map.delete(key);
          else map.set(key, count - 1);
        }
        syncMarker(this);
      }
    }
  };
}

/** 读取元素当前登记的事件类型（供隔离世界的观察器使用）。 */
export function listenerEventsOf(el: Element): string[] {
  const value = el.getAttribute(LISTENER_ATTR);
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
