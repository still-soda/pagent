import { describe, expect, it } from 'vitest';
import {
  applyComposerInsertion,
  clampMentionMenuHeight,
  composerNeedsFullWidth,
  filterBrowserTabs,
  filterSlashCommands,
  mentionedTabsContext,
  MENTION_MENU_MAX_HEIGHT,
  normalizeBrowserTabs,
  parseComposerToken,
  SLASH_COMMANDS,
  tabHost,
  visiblePrompt,
} from '../../lib/composer';

describe('composer tokens', () => {
  it('parses @ and / at the start or after whitespace, including Chinese queries', () => {
    expect(parseComposerToken('@git')).toEqual({ kind: 'at', query: 'git', start: 0 });
    expect(parseComposerToken('请看 @文档')).toEqual({ kind: 'at', query: '文档', start: 3 });
    expect(parseComposerToken('/observe')).toEqual({ kind: 'slash', query: 'observe', start: 0 });
    expect(parseComposerToken('然后 /sum')).toEqual({ kind: 'slash', query: 'sum', start: 3 });
    expect(parseComposerToken('hello@site.com')).toBeNull();
    expect(parseComposerToken('总结当前页面。')).toBeNull();
  });

  it('replaces the active token with a command or clears an @ mention', () => {
    expect(applyComposerInsertion('请看 @git', parseComposerToken('请看 @git'), '')).toBe('请看 ');
    expect(applyComposerInsertion('/sum', parseComposerToken('/sum'), '总结当前页面')).toBe('总结当前页面 ');
  });
});

describe('composer layout', () => {
  it('keeps an empty composer collapsed even before the panel has width', () => {
    expect(composerNeedsFullWidth('', 0, 0, 0)).toBe(false);
  });

  it('expands only when non-empty text wraps or contains a newline', () => {
    expect(composerNeedsFullWidth('短消息', 40, 360, 100)).toBe(false);
    expect(composerNeedsFullWidth('一段很长的消息', 240, 360, 100)).toBe(true);
    expect(composerNeedsFullWidth('第一行\n第二行', 40, 360, 100)).toBe(true);
  });
});

describe('slash commands', () => {
  it('filters by command name or Chinese description', () => {
    const names = filterSlashCommands(SLASH_COMMANDS, 'sum').map((item) => item.key);
    expect(names).toEqual(['summarize']);
    expect(filterSlashCommands(SLASH_COMMANDS, '标签').map((item) => item.key)).toEqual(['tabs']);
    expect(filterSlashCommands(SLASH_COMMANDS, '').length).toBe(SLASH_COMMANDS.length);
  });

  it('shows Chinese labels without a leading slash', () => {
    expect(SLASH_COMMANDS.every((command) => !command.name.startsWith('/'))).toBe(true);
    expect(SLASH_COMMANDS.map((command) => command.name)).toContain('观测页面');
  });
});

describe('browser tabs', () => {
  const tabs = [
    { id: 1, title: 'GitHub', url: 'https://github.com/pagent', active: true },
    { id: 2, title: '文档中心', url: 'https://docs.example.com/guide' },
  ];

  it('normalizes tab query results and skips invalid rows', () => {
    expect(
      normalizeBrowserTabs([
        { id: 8, title: '  Inbox  ', url: 'https://mail.example.com', active: true, windowId: 1 },
        { title: 'missing id' },
        null,
      ]),
    ).toEqual([{ id: 8, title: 'Inbox', url: 'https://mail.example.com', active: true }]);
    expect(normalizeBrowserTabs({ tabs: [] })).toEqual([]);
  });

  it('filters tabs by title, host, or url', () => {
    expect(filterBrowserTabs(tabs, '文档').map((tab) => tab.id)).toEqual([2]);
    expect(filterBrowserTabs(tabs, 'github.com').map((tab) => tab.id)).toEqual([1]);
    expect(tabHost('https://docs.example.com/guide')).toBe('docs.example.com');
    expect(tabHost('')).toBe('未知地址');
  });

  it('keeps mentioned tabs out of the visible user prompt', () => {
    expect(visiblePrompt('总结这个页面', [tabs[0]!])).toBe('总结这个页面');
    expect(visiblePrompt('   ', [tabs[1]!])).toBe('请查看这些标签页。');
    expect(visiblePrompt('只看当前页', [])).toBe('只看当前页');
    expect(mentionedTabsContext([tabs[0]!])).toContain('tabId=1 「GitHub」 https://github.com/pagent（当前）');
    expect(mentionedTabsContext([tabs[0]!])).not.toContain('总结这个页面');
    const context = mentionedTabsContext([tabs[1]!], [
      {
        tabId: 2,
        title: '文档中心',
        url: 'https://docs.example.com/guide',
        content: '安装方式与快速开始',
        truncated: false,
      },
    ]);
    expect(context).toContain('发送消息时预读取的页面快照');
    expect(context).toContain('安装方式与快速开始');
    expect(context).toContain('"tabId":2');
    expect(mentionedTabsContext([])).toBe('');
  });

  it('caps the @ menu so it does not fill the chat panel', () => {
    expect(clampMentionMenuHeight(640)).toBe(MENTION_MENU_MAX_HEIGHT);
    expect(clampMentionMenuHeight(180)).toBe(180);
    expect(clampMentionMenuHeight(-20)).toBe(0);
  });
});
