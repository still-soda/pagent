import { describe, expect, it } from 'vitest';
import {
  diffPageChanges,
  PageChangeTracker,
  type PageChangeSnapshot,
} from '@/features/page/change-tracker';
import { pageObserver } from '@/features/page/observer';

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
});
