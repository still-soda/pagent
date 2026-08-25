import { CHANNEL, isRpcRequest } from '@/shared/contracts/rpc';
import { toErrorMessage } from '@/shared/contracts/errors';
import { clearTabUi, migrateLegacyPageStores } from '@/shared/storage/storage';
import { getActiveTab } from '@/shared/browser/tabs';
import { TOGGLE_PANEL_COMMAND } from '@/shared/extension/hotkey';
import { installServiceWorkerKeepAlive } from '@/shared/extension/keepalive';
import { archiveTabNavigation, clearTabStoreState } from '@/features/agent/background/tab-store';
import { running, stopAgentForTab } from '@/features/agent/background/agent-controller';
import { handleRpc } from '@/features/agent/background/rpc-router';
import { recoverInterruptedSessions } from '@/features/agent/background/session-recovery';
import { togglePanel } from '@/features/agent/background/content-bridge';

export default defineBackground(() => {
  installServiceWorkerKeepAlive();
  void migrateLegacyPageStores().catch(() => {});
  void recoverInterruptedSessions().catch(() => {});

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo.url) return;
    void archiveTabNavigation(tabId, changeInfo.url).catch(() => {});
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    stopAgentForTab(tabId);
    clearTabStoreState(tabId);
    running.delete(tabId);
    void clearTabUi(tabId).catch(() => {});
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.channel !== CHANNEL) return;
    if (message.kind === 'ping') {
      sendResponse({ ok: true });
      return;
    }
    if (!isRpcRequest(message)) return;
    const tabId = sender.tab?.id;
    handleRpc(message.name, message.payload, tabId)
      .then((result) => sendResponse({ channel: CHANNEL, kind: 'rpc-result', id: message.id, ok: true, result }))
      .catch((error) =>
        sendResponse({
          channel: CHANNEL,
          kind: 'rpc-result',
          id: message.id,
          ok: false,
          error: { code: 'rpc_error', message: toErrorMessage(error) },
        }),
      );
    return true;
  });

  browser.action.onClicked.addListener(async (tab) => {
    if (!tab.id) return;
    try {
      await togglePanel(tab.id);
    } catch (error) {
      console.warn('Pagent inject failed', error);
    }
  });

  browser.commands.onCommand.addListener(async (command, tab) => {
    if (command !== TOGGLE_PANEL_COMMAND) return;
    try {
      const tabId = tab?.id ?? (await getActiveTab()).id;
      if (!tabId) return;
      await togglePanel(tabId);
    } catch (error) {
      console.warn('Pagent shortcut failed', error);
    }
  });
});
