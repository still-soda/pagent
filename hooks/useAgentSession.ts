import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHANNEL } from '../lib/shared/channel';
import { rpc } from '../lib/rpc-client';
import {
  conversationTabKey,
  createPageStore,
  emptyConversation,
  nextConversationTitle,
  normalizePageStore,
  restoreConversationStore,
  settleFinishedConversation,
  titleFromPrompt,
  mergeConversationStores,
} from '../lib/conversations';
import {
  SESSION_ACTIVE_POLL_MS,
  SESSION_HIDDEN_POLL_MS,
  SESSION_IDLE_POLL_MS,
  sessionIsOnTab,
  shouldRestoreLiveSession,
} from '../lib/session-live';
import { conversationVaultKey } from '../lib/vault';
import {
  DEFAULT_SETTINGS,
  type AgentEvent,
  type AgentSettings,
  type PageConversation,
  type PageConversationStore,
  type SessionContext,
} from '../lib/shared/types';
import { nowId } from '../lib/utils';
import {
  applyAssistantThinking,
  applyAssistantToken,
  applyAssistantToolResult,
  applyAssistantToolStart,
  applyAssistantFinalText,
  applyAssistantUsage,
} from '../lib/messages';
import {
  clearRememberedSelection,
  getRememberedSelection,
  installPageSelectionTracker,
  subscribePageSelection,
} from '../entrypoints/content/selection';
import { PAGE_NAVIGATION_EVENT } from '../lib/page-navigation';
import { startClientKeepAlive } from '../lib/keepalive';

const STREAM_RENDER_INTERVAL_MS = 50;
const STORE_SAVE_DEBOUNCE_MS = 400;

function patchConversation(
  list: PageConversation[],
  id: string,
  patch: (current: PageConversation) => PageConversation,
) {
  return list.map((item) =>
    item.id === id
      ? { ...patch(item), revision: (item.revision ?? 0) + 1, updatedAt: Date.now() }
      : item,
  );
}

function lastAssistantId(item: PageConversation): string | undefined {
  return [...item.messages].reverse().find((message) => message.role === 'assistant')?.id;
}

export function useAgentSession() {
  const [view, setView] = useState<'chat' | 'settings'>('chat');
  const [settings, setSettings] = useState<AgentSettings>(DEFAULT_SETTINGS);
  const [page, setPage] = useState({
    url: location.href,
    title: document.title,
    selection: '',
  });
  const vaultKey = conversationVaultKey(page.url) ?? undefined;
  const initial = createPageStore(vaultKey);
  const [conversations, setConversations] = useState<PageConversation[]>(initial.conversations);
  const [activeId, setActiveId] = useState(initial.activeId);
  const [revision, setRevision] = useState(initial.revision ?? 0);
  const [sessionId, setSessionId] = useState(initial.sessionId);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [restorePanel, setRestorePanel] = useState(false);
  const [attachKey, setAttachKey] = useState(0);
  const [workingOnThisPage, setWorkingOnThisPage] = useState(false);
  const [agentActive, setAgentActive] = useState(false);
  const runningIdRef = useRef<string | null>(null);
  const activeIdRef = useRef(activeId);
  const conversationsRef = useRef(conversations);
  const pageUrlRef = useRef(page.url);
  const revisionRef = useRef(revision);
  const sessionIdRef = useRef(sessionId);
  const deletedConversationIdsRef = useRef(new Set<string>());
  activeIdRef.current = activeId;
  conversationsRef.current = conversations;
  pageUrlRef.current = page.url;
  revisionRef.current = revision;
  sessionIdRef.current = sessionId;

  const bumpRevision = useCallback(() => {
    const next = revisionRef.current + 1;
    revisionRef.current = next;
    setRevision(next);
    return next;
  }, []);

  useEffect(() => {
    void rpc('settings.get', {}).then((value) => setSettings(value as AgentSettings));
  }, []);

  useEffect(() => {
    installPageSelectionTracker();
    const sync = () =>
      setPage({
        url: location.href,
        title: document.title,
        selection: getRememberedSelection(),
      });
    sync();
    const unsubscribe = subscribePageSelection(sync);
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const onNavigate = () => queueMicrotask(sync);
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    window.addEventListener(PAGE_NAVIGATION_EVENT, sync);
    navigation?.addEventListener('navigatesuccess', onNavigate);
    return () => {
      unsubscribe();
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
      window.removeEventListener(PAGE_NAVIGATION_EVENT, sync);
      navigation?.removeEventListener('navigatesuccess', onNavigate);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let hydrated = false;
    let pulling = false;
    let timer: number | undefined;

    const applyContext = (context: SessionContext, initial: boolean) => {
      const onThisPage = sessionIsOnTab(context);
      setWorkingOnThisPage(onThisPage);
      setAgentActive(Boolean(context.agentActive ?? context.running));
      const contextRevision = context.store?.revision ?? context.revision ?? 0;

      if (shouldRestoreLiveSession({
          alreadyAttached: Boolean(runningIdRef.current),
          attachedConversationId: runningIdRef.current ?? undefined,
          context,
        })
      ) {
        const incoming = restoreConversationStore(normalizePageStore(context.store, vaultKey), {
          running: true,
          conversationId: context.conversationId,
        });
        const local = {
          activeId: activeIdRef.current,
          conversations: conversationsRef.current,
        };
        const next = hydrated ? mergeConversationStores(local, incoming) : incoming;
        runningIdRef.current = next.activeId;
        revisionRef.current = contextRevision;
        sessionIdRef.current = context.sessionId ?? context.store?.sessionId;
        setConversations(next.conversations);
        setActiveId(next.activeId);
        setRevision(contextRevision);
        setSessionId(sessionIdRef.current);
        setRestorePanel(true);
        if (!initial) setAttachKey((value) => value + 1);
        setReadyKey(`${conversationTabKey(context.tabId)}:${vaultKey ?? 'unknown'}`);
        hydrated = true;
        return;
      }

      if (hydrated && context.store && contextRevision > revisionRef.current) {
        const next = restoreConversationStore(normalizePageStore(context.store, vaultKey), {
          running: context.running,
          conversationId: context.conversationId,
        });
        revisionRef.current = contextRevision;
        sessionIdRef.current = context.sessionId ?? context.store.sessionId;
        if (context.running) runningIdRef.current = next.activeId;
        setConversations(next.conversations);
        setActiveId(next.activeId);
        setRevision(contextRevision);
        setSessionId(sessionIdRef.current);
        return;
      }

      if (!context.running && runningIdRef.current) {
        runningIdRef.current = null;
        setConversations((current) =>
          current.map((item) => (item.running ? settleFinishedConversation(item) : item)),
        );
      }

      if (!hydrated) {
        const next = restoreConversationStore(normalizePageStore(context.store, vaultKey), {
          running: context.running,
          conversationId: context.conversationId,
        });
        if (context.running) runningIdRef.current = next.activeId;
        revisionRef.current = contextRevision;
        sessionIdRef.current = context.sessionId ?? context.store?.sessionId;
        setConversations(next.conversations);
        setActiveId(next.activeId);
        setRevision(contextRevision);
        setSessionId(sessionIdRef.current);
        setRestorePanel(Boolean(context.panelOpen || context.running));
        setReadyKey(`${conversationTabKey(context.tabId)}:${vaultKey ?? 'unknown'}`);
        hydrated = true;
      }
    };

    const pull = async (initial: boolean) => {
      if (pulling) return;
      pulling = true;
      try {
        const value = await rpc('session.context', { url: pageUrlRef.current });
        if (cancelled) return;
        applyContext(value as SessionContext, initial);
      } catch {
        // background may be restarting
      } finally {
        pulling = false;
      }
    };

    const schedule = () => {
      if (cancelled) return;
      const delay =
        document.visibilityState !== 'visible'
          ? SESSION_HIDDEN_POLL_MS
          : runningIdRef.current
            ? SESSION_ACTIVE_POLL_MS
            : SESSION_IDLE_POLL_MS;
      timer = window.setTimeout(async () => {
        await pull(false);
        schedule();
      }, delay);
    };

    void pull(true);
    schedule();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (timer != null) window.clearTimeout(timer);
      void pull(false).finally(schedule);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [vaultKey]);

  useEffect(() => {
    if (!readyKey || runningIdRef.current) return;
    const timer = window.setTimeout(() => {
      void rpc('session.saveStore', {
        activeId,
        conversations,
        url: pageUrlRef.current,
        revision,
        sessionId,
        deletedConversationIds: [...deletedConversationIdsRef.current],
      }).catch(() => {});
    }, STORE_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [readyKey, activeId, conversations, revision, sessionId]);

  useEffect(() => {
    if (!workingOnThisPage) return;
    return startClientKeepAlive();
  }, [workingOnThisPage]);

  useEffect(() => {
    const flush = () => {
      if (!readyKey) return;
      void rpc('session.saveStore', {
        activeId: activeIdRef.current,
        conversations: conversationsRef.current,
        url: pageUrlRef.current,
        revision: revisionRef.current,
        sessionId: sessionIdRef.current,
        deletedConversationIds: [...deletedConversationIdsRef.current],
      });
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [readyKey]);

  useEffect(() => {
    let streamTimer: number | undefined;
    let pendingStream:
      | { targetId: string; token: string; reasoning: string }
      | undefined;

    const flushPendingStream = () => {
      if (streamTimer != null) {
        window.clearTimeout(streamTimer);
        streamTimer = undefined;
      }
      const pending = pendingStream;
      pendingStream = undefined;
      if (!pending) return;
      setConversations((current) =>
        patchConversation(current, pending.targetId, (item) => {
          let messages = item.messages;
          if (pending.reasoning) {
            messages = applyAssistantThinking(messages, pending.reasoning, nowId('m'));
          }
          if (pending.token) {
            messages = applyAssistantToken(messages, pending.token, nowId('m'));
          }
          return {
            ...item,
            thinking: pending.reasoning ? '正在思考…' : item.thinking,
            messages,
          };
        }),
      );
    };

    const enqueueStream = (targetId: string, type: 'token' | 'reasoning', text: string) => {
      if (pendingStream && pendingStream.targetId !== targetId) flushPendingStream();
      pendingStream ??= { targetId, token: '', reasoning: '' };
      pendingStream[type] += text;
      if (streamTimer == null) {
        streamTimer = window.setTimeout(flushPendingStream, STREAM_RENDER_INTERVAL_MS);
      }
    };

    const onMessage = (message: {
      channel?: string;
      kind?: string;
      event?: AgentEvent;
      revision?: number;
      sessionId?: string;
      conversationId?: string;
      store?: PageConversationStore;
    }) => {
      if (message.channel !== CHANNEL || message.kind !== 'agent-event' || !message.event) return;
      const event = message.event;
      const targetId = runningIdRef.current;
      if ((event.type === 'token' || event.type === 'reasoning') && targetId) {
        enqueueStream(targetId, event.type, event.text);
        return;
      }
      flushPendingStream();
      if (event.type === 'error' || event.type === 'done') {
        runningIdRef.current = null;
      }
      if (message.store && (message.revision ?? 0) > revisionRef.current) {
        const incoming = message.store;
        revisionRef.current = incoming.revision ?? message.revision ?? 0;
        sessionIdRef.current = message.sessionId ?? incoming.sessionId;
        runningIdRef.current = message.conversationId ?? incoming.activeId;
        conversationsRef.current = incoming.conversations;
        setConversations(incoming.conversations);
        setActiveId(incoming.activeId);
        setRevision(revisionRef.current);
        setSessionId(sessionIdRef.current);
        const liveHere = incoming.conversations.some(
          (item) => item.id === runningIdRef.current && item.running,
        );
        setWorkingOnThisPage(liveHere);
        setAgentActive(liveHere);
        return;
      }
      if (!targetId) return;

      if (event.type === 'thinking') {
        setConversations((current) =>
          patchConversation(current, targetId, (item) => ({ ...item, thinking: event.text })),
        );
      }
      if (event.type === 'tool-start') {
        setConversations((current) =>
          patchConversation(current, targetId, (item) => {
            const tool = {
              id: event.id,
              name: event.name,
              args: event.args,
              status: 'running' as const,
            };
            const argsDetail =
              event.args == null
                ? undefined
                : typeof event.args === 'string'
                  ? event.args
                  : JSON.stringify(event.args);
            return {
              ...item,
              messages: applyAssistantToolStart(item.messages, tool, nowId('m')),
              tasks: item.tasks.some((task) => task.id === event.id)
                ? item.tasks.map((task) =>
                    task.id === event.id
                      ? {
                          ...task,
                          title: event.name || task.title,
                          detail:
                            argsDetail && argsDetail !== '{}' && argsDetail !== '[]'
                              ? argsDetail
                              : task.detail,
                          status: 'running' as const,
                        }
                      : task,
                  )
                : [
                    ...item.tasks,
                    {
                      id: event.id,
                      title: event.name,
                      detail: argsDetail,
                      status: 'running' as const,
                    },
                  ],
            };
          }),
        );
      }
      if (event.type === 'tool-end' || event.type === 'tool-error') {
        setConversations((current) =>
          patchConversation(current, targetId, (item) => ({
            ...item,
            tasks: item.tasks.map((task) =>
              task.id === event.id
                ? {
                    ...task,
                    status: event.type === 'tool-end' ? 'done' : 'error',
                    detail: event.output,
                  }
                : task,
            ),
            messages: applyAssistantToolResult(
              item.messages,
              event.id,
              event.type === 'tool-end' ? 'done' : 'error',
              event.output,
            ),
          })),
        );
      }
      if (event.type === 'budget') {
        setConversations((current) =>
          patchConversation(current, targetId, (item) => ({
            ...item,
            budget: { modelCalls: event.modelCalls, toolCalls: event.toolCalls },
          })),
        );
      }
      if (event.type === 'error') {
        runningIdRef.current = null;
        setWorkingOnThisPage(false);
        setAgentActive(false);
        setConversations((current) =>
          patchConversation(current, targetId, (item) => ({
            ...settleFinishedConversation(item),
            error: event.message,
          })),
        );
      }
      if (event.type === 'message') {
        setConversations((current) =>
          patchConversation(current, targetId, (item) => ({
            ...item,
            messages: applyAssistantFinalText(item.messages, event.content, lastAssistantId(item) ?? nowId('m')),
          })),
        );
      }
      if (event.type === 'usage') {
        setConversations((current) =>
          patchConversation(current, targetId, (item) => ({
            ...item,
            messages: applyAssistantUsage(item.messages, event.usage, lastAssistantId(item) ?? nowId('m')),
          })),
        );
      }
      if (event.type === 'done') {
        runningIdRef.current = null;
        setWorkingOnThisPage(false);
        setAgentActive(false);
        setConversations((current) =>
          patchConversation(current, targetId, (item) => settleFinishedConversation(item)),
        );
      }
    };
    browser.runtime.onMessage.addListener(onMessage);
    return () => {
      if (streamTimer != null) window.clearTimeout(streamTimer);
      browser.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  const active = conversations.find((item) => item.id === activeId) ?? conversations[0];

  const send = useCallback(async (prompt: string, context?: string) => {
    const id = activeIdRef.current;
    runningIdRef.current = id;
    setWorkingOnThisPage(true);
    setAgentActive(true);
    setView('chat');
    const nextRevision = bumpRevision();
    const current = conversationsRef.current.find((item) => item.id === id);
    const history = current?.messages ?? [];
    const nextConversations = patchConversation(conversationsRef.current, id, (item) => ({
      ...item,
      error: '',
      running: true,
      thinking: '正在调用模型…',
      title: titleFromPrompt(item.title, prompt),
      messages: [...item.messages, { id: nowId('m'), role: 'user', content: prompt }],
    }));
    conversationsRef.current = nextConversations;
    setConversations(nextConversations);
    void rpc('session.saveStore', {
      activeId: id,
      conversations: nextConversations,
      url: pageUrlRef.current,
      revision: nextRevision,
      sessionId: sessionIdRef.current,
      deletedConversationIds: [...deletedConversationIdsRef.current],
    });
    await rpc('agent.start', { prompt, context, conversationId: id, history });
  }, [bumpRevision]);

  const stop = useCallback(async () => {
    await rpc('agent.stop', {});
    setWorkingOnThisPage(false);
    setAgentActive(false);
    setConversations((current) =>
      current.map((item) => (item.running ? settleFinishedConversation(item) : item)),
    );
  }, []);

  const clear = useCallback(() => {
    const id = activeIdRef.current;
    bumpRevision();
    setConversations((current) =>
      patchConversation(current, id, (item) => ({
        ...item,
        messages: [],
        tasks: [],
        error: '',
        thinking: '',
        budget: { modelCalls: 0, toolCalls: 0 },
      })),
    );
  }, [bumpRevision]);

  const createConversation = useCallback(() => {
    const domain = conversationVaultKey(pageUrlRef.current);
    bumpRevision();
    setConversations((current) => {
      const next = emptyConversation(
        nextConversationTitle(current.map((item) => item.title)),
        domain ? [domain] : [],
      );
      setActiveId(next.id);
      setView('chat');
      return [...current, next];
    });
  }, [bumpRevision]);

  const selectConversation = useCallback((id: string) => {
    bumpRevision();
    setActiveId(id);
    setView('chat');
  }, [bumpRevision]);

  const closeConversation = useCallback((id: string) => {
    bumpRevision();
    deletedConversationIdsRef.current.add(id);
    setConversations((current) => {
      if (current.length <= 1) {
        const domain = conversationVaultKey(pageUrlRef.current);
        const reset = emptyConversation('会话 1', domain ? [domain] : []);
        setActiveId(reset.id);
        setView('chat');
        return [reset];
      }
      const next = current.filter((item) => item.id !== id);
      if (activeIdRef.current === id) {
        setActiveId(next.at(-1)!.id);
        setView('chat');
      }
      return next;
    });
  }, [bumpRevision]);

  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setSystemDark(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const themeClass = useMemo(() => {
    if (settings.theme === 'dark') return 'dark';
    if (settings.theme === 'light') return '';
    return systemDark ? 'dark' : '';
  }, [settings.theme, systemDark]);

  return {
    view,
    setView,
    settings,
    setSettings,
    conversations,
    activeId: active?.id ?? activeId,
    messages: active?.messages ?? [],
    tasks: active?.tasks ?? [],
    running: Boolean(active?.running),
    thinking: active?.thinking ?? '',
    error: active?.error ?? '',
    page,
    clearSelection: clearRememberedSelection,
    send,
    stop,
    clear,
    createConversation,
    selectConversation,
    closeConversation,
    themeClass,
    ready: Boolean(readyKey),
    restorePanel,
    attachKey,
    workingOnThisPage,
    agentActive,
  };
}
