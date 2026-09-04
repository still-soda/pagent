import { describe, expect, it } from 'vitest';
import { emptyConversation } from '@/features/agent/session/conversations';
import {
  buildExportBundle,
  conversationPreview,
  conversationToMarkdown,
  conversationsToJsonl,
  exportFilename,
  flattenStoredConversations,
  listVaultSummaries,
  toConversationSummary,
  toExportedConversation,
} from '@/features/settings/conversation-archive';
import type { PageConversationStore, VaultMap } from '@/shared/contracts/session';

function filled(title: string, vaults: string[], content = '帮我看一下这个页面') {
  const item = emptyConversation(title, vaults);
  item.messages = [{ id: 'm1', role: 'user', content }];
  return item;
}

describe('conversation archive', () => {
  it('flattens vaults and live stores, keeping the richer copy', () => {
    const shared = filled('跨站任务', ['github.com']);
    const richer = {
      ...shared,
      revision: 2,
      messages: [
        { id: 'm1', role: 'user' as const, content: '打开文档' },
        { id: 'm2', role: 'assistant' as const, content: '已经打开' },
      ],
    };
    const onlyLocal = filled('仅本地', ['example.com'], '本地草稿');
    const sparse = emptyConversation('空会话', ['example.com']);
    const vaults: VaultMap = {
      'github.com': {
        domain: 'github.com',
        updatedAt: 20,
        conversations: [shared],
      },
      'example.com': {
        domain: 'example.com',
        updatedAt: 10,
        conversations: [onlyLocal, sparse],
      },
    };
    const stores: Record<string, PageConversationStore> = {
      'tab:3': { activeId: richer.id, conversations: [richer] },
    };

    const items = flattenStoredConversations(vaults, stores);
    expect(items.map((item) => item.id).sort()).toEqual([onlyLocal.id, shared.id].sort());
    expect(items.find((item) => item.id === shared.id)?.messages).toHaveLength(2);
  });

  it('summarizes a conversation for the archive list', () => {
    const item = filled('填写表单', ['localhost:5173'], `请帮我填表。${'详细说明。'.repeat(20)}`);
    const summary = toConversationSummary(item);
    expect(summary).toMatchObject({
      id: item.id,
      title: '填写表单',
      vaults: ['localhost:5173'],
      messageCount: 1,
    });
    expect(summary.preview.endsWith('…')).toBe(true);
    expect(conversationPreview(emptyConversation('空', ['a']))).toBe('');
  });

  it('lists non-empty vaults by domain', () => {
    const item = filled('文档', ['docs.example.com']);
    expect(
      listVaultSummaries({
        'docs.example.com': { domain: 'docs.example.com', updatedAt: 1, conversations: [item] },
        'empty.com': { domain: 'empty.com', updatedAt: 2, conversations: [emptyConversation('空', ['empty.com'])] },
      }),
    ).toEqual([{ domain: 'docs.example.com', conversationCount: 1, updatedAt: 1 }]);
  });

  it('exports a transcript without image payloads by default', () => {
    const item = filled('带图', ['example.com'], '看看这张图');
    item.messages.push({
      id: 'm2',
      role: 'assistant',
      content: '看到了',
      thinking: '先观察',
      tools: [{ id: 't1', name: 'observe_page', status: 'done', output: '标题：示例' }],
      imageDataUrl: 'data:image/png;base64,abc',
    });
    const exported = toExportedConversation(item);
    expect(exported.transcript[1]).toMatchObject({
      text: '看到了',
      thinking: '先观察',
      hasImage: true,
    });
    expect(exported.transcript[1]?.imageDataUrl).toBeUndefined();
    expect(exported.transcript[1]?.tools?.[0]).toMatchObject({ name: 'observe_page', label: '观察页面' });

    const withImage = toExportedConversation(item, { includeImages: true });
    expect(withImage.transcript[1]?.imageDataUrl).toBe('data:image/png;base64,abc');
  });

  it('aggregates turn budgets and redacts archived tool data', () => {
    const item = filled('隐私', ['example.com'], '联系 13812345678');
    item.budget = { modelCalls: 1, toolCalls: 0 };
    item.messages.push({
      id: 'm2',
      role: 'assistant',
      content: '已填写 me@example.com',
      tools: [{
        id: 't1',
        name: 'type_text',
        status: 'done',
        args: { text: 'me@example.com' },
        output: '{"value":"13812345678"}',
      }],
      usage: {
        inputTokens: 10,
        outputTokens: 2,
        totalTokens: 12,
        cachedTokens: 0,
        reasoningTokens: 0,
        durationMs: 100,
        modelCalls: 4,
        toolCalls: 7,
      },
    });
    const exported = toExportedConversation(item);
    expect(exported.budget).toEqual({ modelCalls: 4, toolCalls: 7 });
    expect(JSON.stringify(exported)).not.toContain('me@example.com');
    expect(JSON.stringify(exported)).not.toContain('13812345678');
  });

  it('writes JSON, JSONL and Markdown that keep the task text', () => {
    const item = filled('导出样本', ['example.com'], '总结这个页面');
    item.messages.push({
      id: 'm2',
      role: 'assistant',
      content: '页面是一份表单',
      thinking: '需要先读标题',
    });
    const bundle = buildExportBundle([item]);
    expect(bundle.source).toBe('pagent');
    expect(bundle.conversationCount).toBe(1);
    expect(bundle.conversations[0]?.title).toBe('导出样本');

    const jsonl = conversationsToJsonl([item]);
    expect(jsonl).toContain('"title":"导出样本"');
    expect(jsonl.trim().split('\n')).toHaveLength(1);

    const markdown = conversationToMarkdown(item);
    expect(markdown).toContain('# 导出样本');
    expect(markdown).toContain('总结这个页面');
    expect(markdown).toContain('页面是一份表单');
    expect(markdown).toContain('> 思考');
  });

  it('names the download file with a local timestamp', () => {
    expect(exportFilename('json', new Date(2026, 8, 3, 19, 8))).toBe('pagent-conversations-20260903-1908.json');
    expect(exportFilename('md', new Date(2026, 0, 2, 3, 4))).toBe('pagent-conversations-20260102-0304.md');
  });
});
