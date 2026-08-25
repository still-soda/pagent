import { describe, expect, it } from 'vitest';
import { implicitRole, PageObserver, visibleText } from '../../entrypoints/content/observer';

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
});
