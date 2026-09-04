import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyConversation } from '@/features/agent/session/conversations';
import {
  chromeSessionItemsForTests,
  clearTabUi,
  loadPageConversations,
  loadTabConversations,
  loadTabUi,
  loadVault,
  listPersistedConversations,
  resetSessionReadyForTests,
  resetSessionStorageForTests,
  savePageConversations,
  saveTabUi,
  saveVaultFromStore,
} from '@/shared/storage/storage';
import type { PageConversationStore } from '@/shared/contracts/session';

function storeOf(title: string, domain = 'example.com'): PageConversationStore {
  const item = emptyConversation(title, [domain]);
  item.messages = [{ id: 'm1', role: 'user', content: '还在' }];
  return { activeId: item.id, conversations: [item] };
}

describe('IndexedDB session storage', () => {
  beforeEach(async () => {
    await resetSessionStorageForTests();
  });

  afterEach(async () => {
    await resetSessionStorageForTests();
  });

  it('saves and loads a tab conversation without rewriting the whole map', async () => {
    const store = storeOf('当前标签');
    await savePageConversations('tab:7', store);
    await expect(loadPageConversations('tab:7')).resolves.toMatchObject({
      activeId: store.activeId,
    });
    await expect(loadTabConversations(7)).resolves.toMatchObject({ activeId: store.activeId });
    await expect(loadTabConversations(8)).resolves.toBeNull();
  });

  it('does not let a stale tab snapshot overwrite a newer revision', async () => {
    const newer = storeOf('新快照');
    newer.revision = 8;
    const stale = storeOf('旧快照');
    stale.revision = 3;
    await savePageConversations('tab:7', newer);
    await savePageConversations('tab:7', stale);
    await expect(loadTabConversations(7)).resolves.toMatchObject({
      activeId: newer.activeId,
      revision: 8,
    });
  });

  it('persists domain vaults independently of tab-scoped live stores', async () => {
    const store = storeOf('文档会话', 'docs.example.com');
    await saveVaultFromStore('https://docs.example.com/guide', store);
    const vault = await loadVault('docs.example.com');
    expect(vault?.conversations[0]?.title).toBe('文档会话');
    expect(vault?.conversations[0]?.vaults).toContain('docs.example.com');
  });

  it('keeps tab UI in the session database', async () => {
    await saveTabUi(3, { panelOpen: true });
    await expect(loadTabUi(3)).resolves.toEqual({ panelOpen: true });
    await clearTabUi(3);
    await expect(loadTabUi(3)).resolves.toBeNull();
  });

  it('migrates legacy chrome.storage conversations and vaults into IndexedDB', async () => {
    const live = storeOf('旧会话');
    const archived = emptyConversation('归档', ['legacy.com']);
    archived.messages = [{ id: 'm2', role: 'user', content: '历史' }];
    await chromeSessionItemsForTests.pageConversationsItem.setValue({ 'tab:11': live });
    await chromeSessionItemsForTests.vaultsItem.setValue({
      'legacy.com': {
        domain: 'legacy.com',
        updatedAt: Date.now(),
        activeId: archived.id,
        conversations: [archived],
      },
    });

    await expect(loadTabConversations(11)).resolves.toMatchObject({ activeId: live.activeId });
    await expect(loadVault('legacy.com')).resolves.toMatchObject({ activeId: archived.id });
    await expect(chromeSessionItemsForTests.pageConversationsItem.getValue()).resolves.toEqual({});
    await expect(chromeSessionItemsForTests.vaultsItem.getValue()).resolves.toEqual({});
  });

  it('drops tab-scoped stores after a new browser session but keeps vaults', async () => {
    const live = storeOf('标签里的会话');
    await savePageConversations('tab:4', live);
    await saveVaultFromStore('https://example.com/a', live);
    await saveTabUi(4, { panelOpen: true });

    await chromeSessionItemsForTests.sessionScopeItem.setValue('');
    resetSessionReadyForTests();

    await expect(loadTabConversations(4)).resolves.toBeNull();
    await expect(loadTabUi(4)).resolves.toBeNull();
    await expect(loadVault('example.com')).resolves.toMatchObject({
      conversations: [expect.objectContaining({ title: '标签里的会话' })],
    });
  });

  it('lists persisted conversations across vaults and live stores', async () => {
    const docs = storeOf('文档会话', 'docs.example.com');
    const live = storeOf('当前标签', 'app.example.com');
    await saveVaultFromStore('https://docs.example.com/guide', docs);
    await savePageConversations('tab:9', live);
    const items = await listPersistedConversations();
    expect(items.map((item) => item.title).sort()).toEqual(['当前标签', '文档会话']);
  });
});
