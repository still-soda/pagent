import { describe, expect, it } from 'vitest';
import {
  createPageStore,
  emptyConversation,
  mergeConversationStores,
  nextConversationTitle,
} from '@/features/agent/session/conversations';
import {
  archiveActiveConversations,
  conversationInVault,
  conversationVaultKey,
  filterStoreForVault,
  vaultToStore,
  viewForVault,
} from '@/features/agent/session/vault';
import { adoptTabStore } from '@/features/agent/session/conversations';

describe('session persistence merge', () => {
  it('keeps the newly created active conversation after vault merge', () => {
    const url = 'http://127.0.0.1:4177/static.html';
    const domain = conversationVaultKey(url)!;
    const initial = createPageStore(domain);
    const second = emptyConversation(nextConversationTitle(initial.conversations.map((c) => c.title)), [domain]);
    const saved = adoptTabStore(
      {
        activeId: second.id,
        conversations: [...initial.conversations, second],
        revision: 1,
        panelOpen: true,
      },
      initial,
    );
    const fromVault = vaultToStore(null, domain);
    const archived = archiveActiveConversations(saved, domain);
    const merged = mergeConversationStores(
      { ...fromVault, panelOpen: undefined },
      { ...archived, panelOpen: undefined },
    );
    expect(saved.conversations).toHaveLength(2);
    expect(merged.conversations.length).toBeGreaterThanOrEqual(2);
    expect(merged.conversations.every((item) => conversationInVault(item, domain))).toBe(true);
    expect(merged.activeId).toBe(second.id);
    const viewed = filterStoreForVault(merged, domain);
    expect(viewed.conversations.length).toBe(2);
    expect(viewForVault(domain, null, saved).activeId).toBe(second.id);
  });
});
