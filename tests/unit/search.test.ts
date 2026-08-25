import { describe, expect, it, beforeEach } from 'vitest';
import { PageObserver, pageObserver } from '../../entrypoints/content/observer';
import { searchPageText } from '../../entrypoints/content/search';

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
});
