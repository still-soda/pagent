import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../lib/markdown';

describe('renderMarkdown', () => {
  it('renders common agent formatting', () => {
    const html = renderMarkdown('**用量**是 `12`\n\n- 今天\n- 昨天');
    expect(html).toContain('<strong>用量</strong>');
    expect(html).toContain('<code>12</code>');
    expect(html).toContain('<li>今天</li>');
  });

  it('opens http links safely and drops javascript urls', () => {
    const html = renderMarkdown('[文档](https://example.com) [坏链](javascript:alert(1))');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noreferrer noopener"');
    expect(html).not.toContain('javascript:');
  });

  it('strips raw script tags', () => {
    const html = renderMarkdown('hello <script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('hello');
  });

  it('renders GFM tables even when the delimiter has fewer columns', () => {
    const html = renderMarkdown('|XX|XX|XX|\n|---|---|\n|a|b|c|');
    expect(html).toContain('<table>');
    expect(html).toContain('<th>XX</th>');
    expect(html).toContain('<td>a</td>');
    expect(html).not.toContain('|---|');
  });

  it('still renders well-formed tables', () => {
    const html = renderMarkdown('| A | B |\n| --- | --- |\n| 1 | 2 |');
    expect(html).toContain('<th>A</th>');
    expect(html).toContain('<td>1</td>');
  });

  it('does not rewrite table-like text inside fenced code', () => {
    const html = renderMarkdown('```\n|XX|XX|XX|\n|---|---|\n```');
    expect(html).toContain('|XX|XX|XX|');
    expect(html).not.toContain('<table>');
  });
});
