import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageObserver, pageObserver } from '../../entrypoints/content/observer';
import { compileMatcher, getPageSource, serializeLiveDom } from '../../entrypoints/content/source';

describe('getPageSource', () => {
  beforeEach(() => {
    document.title = 'Pagent 源码测试';
    document.body.innerHTML = '';
    for (const node of Array.from(document.head.querySelectorAll('link[rel~="stylesheet"]'))) {
      node.remove();
    }
    Object.assign(pageObserver, new PageObserver());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reads url and title', async () => {
    const url = await getPageSource({ type: 'url' });
    expect(url.value).toContain(location.href);
    expect(url.total).toBe(1);

    const title = await getPageSource({ type: 'title' });
    expect(title.value).toBe('Pagent 源码测试');
  });

  it('returns live DOM without the extension UI', async () => {
    document.body.innerHTML = `
      <main id="app"><h1>首页</h1></main>
      <pagent-root><div data-pagent-ui="true">Pagent secret</div></pagent-root>
    `;
    const result = await getPageSource({ type: 'dom' });
    expect(result.content).toContain('<main id="app">');
    expect(result.content).toContain('首页');
    expect(result.content).not.toContain('Pagent secret');
    expect(result.content).not.toContain('pagent-root');
  });

  it('reads visible text and skips scripts and extension UI', async () => {
    document.body.innerHTML = `
      <p>可见正文 hello@site.com</p>
      <script>const secret = 'sk-abcdefghijklmnopqrstuvwxyz';</script>
      <pagent-root>面板文字</pagent-root>
    `;
    const result = await getPageSource({ type: 'text' });
    expect(result.content).toContain('可见正文');
    expect(result.content).toContain('[redacted-email]');
    expect(result.content).not.toContain('面板文字');
    expect(result.content).not.toContain('sk-abcdefghijklmnopqrstuvwxyz');
  });

  it('extracts links, scripts and stylesheets', async () => {
    document.body.innerHTML = `
      <a href="https://example.com/docs">文档</a>
      <script>window.__boot = true;</script>
      <style>.hero { color: red; }</style>
    `;
    const script = document.createElement('script');
    script.type = 'text/plain';
    script.setAttribute('src', '/app.js');
    document.body.append(script);
    const link = document.createElement('link');
    link.rel = 'alternate stylesheet';
    link.setAttribute('href', '/app.css');
    document.head.append(link);

    const links = await getPageSource({ type: 'links' });
    expect(links.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ href: expect.stringContaining('/docs'), text: '文档' })]),
    );

    const scripts = await getPageSource({ type: 'scripts' });
    expect(scripts.total).toBe(2);
    expect(scripts.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ inline: false, href: expect.stringContaining('/app.js') }),
        expect.objectContaining({ inline: true, preview: expect.stringContaining('__boot') }),
      ]),
    );
    expect(scripts.items?.every((item) => typeof item === 'object' && !('body' in item))).toBe(true);

    const styles = await getPageSource({ type: 'stylesheets' });
    expect(styles.total).toBe(2);
    expect(styles.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ inline: false, href: expect.stringContaining('/app.css') }),
        expect.objectContaining({ inline: true, preview: expect.stringContaining('.hero') }),
      ]),
    );
  });

  it('filters with grep, regex and case sensitivity', async () => {
    document.body.innerHTML = `
      <a href="https://example.com/login">登录</a>
      <a href="https://example.com/docs">文档</a>
      <script>function LoginForm() {}</script>
    `;

    const links = await getPageSource({ type: 'links', grep: 'login' });
    expect(links.total).toBe(1);
    expect(links.items?.[0]).toMatchObject({ href: expect.stringContaining('/login') });

    const caseSensitive = await getPageSource({
      type: 'scripts',
      grep: 'loginform',
      caseSensitive: true,
    });
    expect(caseSensitive.total).toBe(0);

    const regex = await getPageSource({
      type: 'dom',
      grep: '登[录錄]',
      regex: true,
    });
    expect(regex.matches?.some((item) => item.match.includes('登录'))).toBe(true);
  });

  it('paginates large text by default and continues from nextOffset', async () => {
    document.body.innerHTML = `<pre>${'A'.repeat(9_000)}</pre>`;
    const first = await getPageSource({ type: 'text' });
    expect(first.total).toBeGreaterThan(4_000);
    expect(first.limit).toBe(4_000);
    expect(first.hasMore).toBe(true);
    expect(first.nextOffset).toBe(first.offset + first.count);
    expect(first.content?.length).toBe(first.count);

    const second = await getPageSource({ type: 'text', offset: first.nextOffset, limit: 4_000 });
    expect(second.offset).toBe(first.nextOffset);
    expect(second.content?.length).toBeGreaterThan(0);

    const last = await getPageSource({ type: 'text', offset: first.total, limit: 4_000 });
    expect(last.hasMore).toBe(false);
    expect(last.count).toBe(0);
  });

  it('paginates grep matches and list items', async () => {
    document.body.innerHTML = `<pre>${Array.from({ length: 12 }, (_, index) => `token-${index} token`).join('\n')}</pre>`;
    const first = await getPageSource({ type: 'text', grep: 'token', limit: 5 });
    expect(first.total).toBe(12);
    expect(first.count).toBe(5);
    expect(first.hasMore).toBe(true);
    expect(first.nextOffset).toBe(5);

    const second = await getPageSource({ type: 'text', grep: 'token', offset: 5, limit: 5 });
    expect(second.count).toBe(5);
    expect(second.hasMore).toBe(true);

    document.body.innerHTML = Array.from(
      { length: 8 },
      (_, index) => `<a href="/item-${index}">item ${index}</a>`,
    ).join('');
    const links = await getPageSource({ type: 'links', grep: 'item', limit: 3 });
    expect(links.total).toBe(8);
    expect(links.count).toBe(3);
    expect(links.nextOffset).toBe(3);
  });

  it('falls back to live DOM when original HTML cannot be fetched', async () => {
    document.body.innerHTML = '<article>原始失败时用实时 DOM</article>';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network');
      }),
    );
    const result = await getPageSource({ type: 'page' });
    expect(result.content).toContain('原始失败时用实时 DOM');
  });

  it('uses fetched HTML for type=page when available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () => '<!DOCTYPE html><html><body>fetched source</body></html>',
      })),
    );
    const result = await getPageSource({ type: 'page', grep: 'fetched' });
    expect(result.matches?.[0]?.snippet).toContain('fetched source');
  });

  it('rejects invalid regular expressions', () => {
    expect(() => compileMatcher({ grep: '(unclosed', regex: true })).toThrow(/非法正则/);
  });

  it('serializes a doctype when the document has one', () => {
    const html = serializeLiveDom(document);
    expect(html).toContain('<html');
  });
});
