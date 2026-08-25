import { describe, expect, it } from 'vitest';
import { emptyConversation } from '@/features/agent/session/conversations';
import {
  applyVaultStoreUpdate,
  archiveActiveConversations,
  conversationInVault,
  conversationVaultKey,
  filterStoreForVault,
  removeConversationFromVaults,
  viewForVault,
} from '@/features/agent/session/vault';
import type { PageConversationStore, VaultMap } from '@/shared/contracts/session';

function storeOf(...items: ReturnType<typeof emptyConversation>[]): PageConversationStore {
  return { activeId: items[0]!.id, conversations: items };
}

describe('domain vaults', () => {
  it('keys a vault by hostname and keeps non-default ports', () => {
    expect(conversationVaultKey('https://Docs.Example.com/path?q=1#hash')).toBe('docs.example.com');
    expect(conversationVaultKey('https://example.com:443/a')).toBe('example.com');
    expect(conversationVaultKey('http://localhost:3000/app')).toBe('localhost:3000');
    expect(conversationVaultKey('chrome://extensions')).toBeNull();
  });

  it('archives the active session to every domain visited in the session', () => {
    const active = emptyConversation('跨站任务', ['github.com']);
    active.messages = [{ id: 'm1', role: 'user', content: '打开文档' }];
    const idle = emptyConversation('只在 GitHub', ['github.com']);
    idle.messages = [{ id: 'm2', role: 'user', content: '本地草稿' }];
    const archived = archiveActiveConversations(storeOf(active, idle), 'developer.mozilla.org');

    expect(archived.conversations[0]?.vaults).toEqual(['github.com', 'developer.mozilla.org']);
    expect(archived.conversations[1]?.vaults).toEqual(['github.com']);
  });

  it('lets a vault see only its own sessions', () => {
    const shared = emptyConversation('共享', ['github.com', 'example.com']);
    const local = emptyConversation('仅 GitHub', ['github.com']);
    const viewed = filterStoreForVault(storeOf(shared, local), 'example.com');

    expect(viewed.conversations.map((item) => item.id)).toEqual([shared.id]);
    expect(viewed.conversations.every((item) => conversationInVault(item, 'example.com'))).toBe(true);
  });

  it('keeps a session in the previous vault after it is closed on another site', () => {
    const shared = emptyConversation('共享', ['github.com', 'example.com']);
    shared.messages = [{ id: 'm1', role: 'user', content: '跨站' }];
    const onlyExample = emptyConversation('仅 Example', ['example.com']);
    onlyExample.messages = [{ id: 'm2', role: 'user', content: '本地' }];
    const all: VaultMap = applyVaultStoreUpdate(
      {},
      'example.com',
      storeOf(shared, onlyExample),
    );

    expect(all['github.com']?.conversations.map((item) => item.id)).toEqual([shared.id]);
    expect(all['example.com']?.conversations).toHaveLength(2);

    const afterClose = applyVaultStoreUpdate(all, 'example.com', storeOf(onlyExample));
    expect(afterClose['example.com']?.conversations.map((item) => item.id)).toEqual([onlyExample.id]);
    expect(afterClose['github.com']?.conversations.map((item) => item.id)).toEqual([shared.id]);
    expect(afterClose['github.com']?.conversations[0]?.vaults).toEqual(['github.com']);
  });

  it('keeps vault history after re-entry and points at the active session', () => {
    const older = emptyConversation('旧会话', ['example.com']);
    older.messages = [{ id: 'm0', role: 'user', content: '旧' }];
    const active = emptyConversation('当前', ['example.com']);
    active.messages = [{ id: 'm1', role: 'user', content: '新' }];
    const persisted = applyVaultStoreUpdate({}, 'example.com', {
      activeId: active.id,
      conversations: [older, active],
    });

    const restored = viewForVault('example.com', persisted['example.com'], null);
    expect(restored.activeId).toBe(active.id);
    expect(restored.conversations.map((item) => item.id).sort()).toEqual([older.id, active.id].sort());
  });

  it('does not restore panelOpen from a vault onto a new visit', () => {
    const session = emptyConversation('工作', ['example.com']);
    session.messages = [{ id: 'm1', role: 'user', content: '还在' }];
    const persisted = applyVaultStoreUpdate({}, 'example.com', {
      activeId: session.id,
      conversations: [session],
      panelOpen: true,
    });

    expect(viewForVault('example.com', persisted['example.com'], null).panelOpen).toBeFalsy();
    expect(viewForVault('github.com', persisted['github.com'], null).panelOpen).toBeFalsy();
    expect(
      viewForVault('github.com', persisted['github.com'], {
        activeId: session.id,
        conversations: [session],
        panelOpen: true,
      }).panelOpen,
    ).toBe(true);
  });

  it('rebuilds a vault view after a simulated restart', () => {
    const session = emptyConversation('重启后仍在', ['example.com']);
    session.messages = [{ id: 'm1', role: 'user', content: '还在' }];
    const persisted = applyVaultStoreUpdate({}, 'example.com', storeOf(session));

    const restored = viewForVault('example.com', persisted['example.com'], null);
    expect(restored.conversations).toHaveLength(1);
    expect(restored.conversations[0]?.messages[0]?.content).toBe('还在');

    const otherSite = viewForVault('github.com', persisted['github.com'], null);
    expect(otherSite.conversations[0]?.messages).toEqual([]);
    expect(conversationInVault(otherSite.conversations[0]!, 'github.com')).toBe(true);
  });

  it('does not delete other vault sessions when only archiving a navigation', () => {
    const existing = emptyConversation('旧会话', ['example.com']);
    existing.messages = [{ id: 'm0', role: 'user', content: '旧' }];
    const incoming = emptyConversation('新来的', ['github.com']);
    incoming.messages = [{ id: 'm1', role: 'user', content: '导航过来' }];
    const all = applyVaultStoreUpdate({}, 'example.com', storeOf(existing));
    const next = applyVaultStoreUpdate(all, 'example.com', storeOf(incoming), { deleteMissing: false });

    expect(next['example.com']?.conversations.map((item) => item.title).sort()).toEqual(['新来的', '旧会话']);
  });

  it('removes a conversation from one vault without dropping the map entry', () => {
    const item = emptyConversation('待删', ['a.com']);
    const all: VaultMap = {
      'a.com': { domain: 'a.com', updatedAt: 1, conversations: [item], activeId: item.id },
    };
    const next = removeConversationFromVaults(all, 'a.com', item.id);
    expect(next['a.com']?.conversations).toEqual([]);
  });
});
