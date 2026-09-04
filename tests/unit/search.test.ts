import { describe, expect, it, beforeEach } from 'vitest';
import { PageObserver, pageObserver } from '@/features/page/observer';
import { searchPageText } from '@/features/page/search';

describe('searchPageText', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.assign(pageObserver, new PageObserver());
  });

  it('finds visible text and returns a usable elementId', () => {
    document.body.innerHTML = `
      <p>欢迎使用 Pagent 页面助手</p>
      <button>提交订单</button>
    `;
    const result = searchPageText('Pagent');
    expect(result.total).toBe(1);
    expect(result.hits[0]).toMatchObject({
      match: 'Pagent',
      tag: 'p',
    });
    expect(result.hits[0]?.snippet).toContain('Pagent');
    const node = pageObserver.getElement(result.hits[0]!.elementId, result.revision);
    expect(node.textContent).toContain('Pagent');
  });

  it('searches input values and respects case sensitivity', () => {
    document.body.innerHTML = '<input value="HelloPagent" />';
    expect(searchPageText('hellopagent').total).toBe(1);
    expect(searchPageText('hellopagent', { caseSensitive: true }).total).toBe(0);
    expect(searchPageText('HelloPagent', { caseSensitive: true }).total).toBe(1);
  });

  it('searches element ids and names for structural lookup', () => {
    document.body.innerHTML = '<input id="birthday" name="birthDate" />';
    expect(searchPageText('birthday').hits[0]).toMatchObject({ tag: 'input' });
    expect(searchPageText('birthDate').hits[0]).toMatchObject({ tag: 'input' });
  });

  it('skips the extension UI and caps results', () => {
    document.body.innerHTML = `
      <pagent-root><p>Pagent secret</p></pagent-root>
      <p>one Pagent</p>
      <p>two Pagent</p>
      <p>three Pagent</p>
    `;
    const result = searchPageText('Pagent', { maxResults: 2 });
    expect(result.hits.every((hit) => !hit.snippet.includes('secret'))).toBe(true);
    expect(result.count).toBe(2);
    expect(result.truncated).toBe(true);
    expect(result.total).toBeGreaterThan(2);
  });

  it('can bypass an active interaction context with page scope', () => {
    document.body.innerHTML = `
      <p>页面正文里的统计结果</p>
      <div role="dialog"><button>确定</button></div>
    `;
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    dialog.getBoundingClientRect = () => ({
      x: 10, y: 10, top: 10, left: 10, right: 210, bottom: 210, width: 200, height: 200,
      toJSON: () => ({}),
    });

    expect(searchPageText('统计结果').total).toBe(0);
    expect(searchPageText('统计结果', { scope: 'page' }).total).toBe(1);
  });
});
