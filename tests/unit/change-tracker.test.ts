import { describe, expect, it } from 'vitest';
import {
  diffPageChanges,
  PageChangeTracker,
  type PageChangeSnapshot,
} from '@/features/page/change-tracker';
import { pageObserver } from '@/features/page/observer';

function stubBox(el: Element, visible = true) {
  const rect = visible
    ? { x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 50, width: 200, height: 50 }
    : { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ ...rect, toJSON: () => rect }),
    configurable: true,
  });
}

function snapshot(
  nodes: PageChangeSnapshot['nodes'],
  overrides: Partial<PageChangeSnapshot> = {},
): PageChangeSnapshot {
  return {
    watchId: 'watch-1',
    documentId: 'doc-1',
    cursor: 1,
    mutationCount: 1,
    maxNodes: 400,
    url: 'https://example.com/',
    title: 'Example',
    viewport: { scrollX: 0, scrollY: 0 },
    nodes,
    ...overrides,
  };
}

describe('PageChangeTracker', () => {
  it('summarizes semantic node changes', () => {
    const baseline = snapshot([
      {
        id: 'button-1',
        tag: 'button',
        role: 'button',
        name: '提交',
        visible: true,
        disabled: true,
      },
    ]);
    const current = snapshot(
      [
        {
          id: 'button-1',
          tag: 'button',
          role: 'button',
          name: '提交订单',
          visible: true,
          disabled: false,
        },
        {
          id: 'status-1',
          tag: 'p',
          role: 'status',
          name: '保存成功',
          visible: true,
        },
      ],
      { cursor: 2, mutationCount: 4 },
    );

    const result = diffPageChanges(baseline, current);
    expect(result.changed).toBe(true);
    expect(result.mutationCount).toBe(3);
    expect(result.changes.map((change) => change.kind)).toEqual([
      'text_changed',
      'state_changed',
      'added',
    ]);
    expect(result.summary).toContain('新增 1 处');
  });

  it('records DOM and form value changes without expiring element revisions', async () => {
    document.body.innerHTML = '<input aria-label="邮箱" value="">';
    const tracker = new PageChangeTracker();
    const release = tracker.install();
    const baseline = tracker.snapshot();
    const revision = pageObserver.revision;
    const input = document.querySelector('input')!;
    input.value = 'hello@example.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const result = await tracker.read(baseline, { timeoutMs: 250, quietMs: 50 });
    release();

    expect(result.settled).toBe(true);
    expect(result.changes.some((change) => change.kind === 'state_changed')).toBe(true);
    expect(pageObserver.revision).toBe(revision);
  });

  it('does not expose password values', () => {
    document.body.innerHTML = '<input type="password" value="super-secret">';
    const value = new PageChangeTracker().snapshot().nodes[0]?.value;
    expect(value).toBe('[redacted-present]');
    expect(value).not.toContain('super-secret');
  });

  it('reports navigation across documents', () => {
    const baseline = snapshot([]);
    const current = snapshot([], {
      documentId: 'doc-2',
      url: 'https://example.com/next',
      title: 'Next',
    });
    expect(diffPageChanges(baseline, current).changes[0]).toMatchObject({
      kind: 'navigation',
      before: { url: 'https://example.com/' },
      after: { url: 'https://example.com/next' },
    });
  });

  it('tracks container elements like div and span', () => {
    document.body.innerHTML = '<div><span>已保存</span></div>';
    stubBox(document.querySelector('div')!);
    stubBox(document.querySelector('span')!);
    const nodes = new PageChangeTracker().snapshot().nodes;
    expect(nodes.some((node) => node.tag === 'span' && node.name === '已保存' && node.visible)).toBe(true);
    expect(nodes.some((node) => node.tag === 'div')).toBe(true);
  });

  it('detects opacity-driven visibility flips on containers', async () => {
    document.body.innerHTML = '<div><span id="chip" style="opacity: 0">已保存</span></div>';
    const chip = document.getElementById('chip')!;
    stubBox(chip);
    const tracker = new PageChangeTracker();
    const release = tracker.install();
    const baseline = tracker.snapshot();
    expect(baseline.nodes.some((node) => node.tag === 'span' && !node.visible)).toBe(true);

    chip.style.opacity = '1';
    const result = await tracker.read(baseline, { timeoutMs: 500, quietMs: 50 });
    release();

    expect(result.settled).toBe(true);
    expect(result.changes).toContainEqual(
      expect.objectContaining({ kind: 'visibility_changed', before: false, after: true }),
    );
  });

  it('detects elements revealed via inline style display', async () => {
    document.body.innerHTML = '<div id="panel" style="display: none">面板内容</div>';
    const panel = document.getElementById('panel')!;
    stubBox(panel);
    const tracker = new PageChangeTracker();
    const release = tracker.install();
    const baseline = tracker.snapshot();
    expect(baseline.nodes.some((node) => node.name === '面板内容')).toBe(false);

    panel.style.display = 'block';
    const result = await tracker.read(baseline, { timeoutMs: 500, quietMs: 50 });
    release();

    expect(result.settled).toBe(true);
    expect(result.changes.some((change) => change.kind === 'added' && change.target?.name === '面板内容')).toBe(true);
  });
});
