import { useCallback } from 'react';
import { rpc } from '@/shared/extension/rpc-client';
import {
  emptyConversation,
  nextConversationTitle,
  settleFinishedConversation,
  titleFromPrompt,
} from '@/features/agent/session/conversations';
import { conversationVaultKey } from '@/features/agent/session/vault';
import type { PageConversation } from '@/shared/contracts/session';
import { nowId } from '@/shared/utils/utils';
import { patchConversation } from './agent-session-reducer';

export function useConversationActions(options: {
  runningIdRef: React.MutableRefObject<string | null>;
  activeIdRef: React.MutableRefObject<string>;
  conversationsRef: React.MutableRefObject<PageConversation[]>;
  pageUrlRef: React.MutableRefObject<string>;
  revisionRef: React.MutableRefObject<number>;
  sessionIdRef: React.MutableRefObject<string | undefined>;
  deletedConversationIdsRef: React.MutableRefObject<Set<string>>;
  setConversations: React.Dispatch<React.SetStateAction<PageConversation[]>>;
  setActiveId: React.Dispatch<React.SetStateAction<string>>;
  setRevision: React.Dispatch<React.SetStateAction<number>>;
  setWorkingOnThisPage: React.Dispatch<React.SetStateAction<boolean>>;
  setAgentActive: React.Dispatch<React.SetStateAction<boolean>>;
  setView: React.Dispatch<React.SetStateAction<'chat' | 'settings'>>;
  bumpRevision: () => number;
}) {
  const {
    runningIdRef,
    activeIdRef,
    conversationsRef,
    pageUrlRef,
    revisionRef,
    sessionIdRef,
    deletedConversationIdsRef,
    setConversations,
    setActiveId,
    setWorkingOnThisPage,
    setAgentActive,
    setView,
    bumpRevision,
  } = options;

  const send = useCallback(async (prompt: string, context?: string, imageDataUrl?: string) => {
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
      messages: [
        ...item.messages,
        { id: nowId('m'), role: 'user', content: prompt, imageDataUrl },
      ],
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
    await rpc('agent.start', {
      prompt,
      context,
      imageDataUrl,
      conversationId: id,
      history,
    });
  }, [
    activeIdRef,
    bumpRevision,
    conversationsRef,
    deletedConversationIdsRef,
    pageUrlRef,
    runningIdRef,
    sessionIdRef,
    setAgentActive,
    setConversations,
    setView,
    setWorkingOnThisPage,
  ]);

  const stop = useCallback(async () => {
    await rpc('agent.stop', {});
    setWorkingOnThisPage(false);
    setAgentActive(false);
    setConversations((current) =>
      current.map((item) => (item.running ? settleFinishedConversation(item) : item)),
    );
  }, [setAgentActive, setConversations, setWorkingOnThisPage]);

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
  }, [activeIdRef, bumpRevision, setConversations]);

  const createConversation = useCallback(async () => {
    const domain = conversationVaultKey(pageUrlRef.current);
    const nextRevision = bumpRevision();
    const current = conversationsRef.current;
    const next = emptyConversation(
      nextConversationTitle(current.map((item) => item.title)),
      domain ? [domain] : [],
    );
    const nextConversations = [...current, next];
    await rpc('session.saveStore', {
      activeId: next.id,
      conversations: nextConversations,
      url: pageUrlRef.current,
      revision: nextRevision,
      sessionId: sessionIdRef.current,
      deletedConversationIds: [...deletedConversationIdsRef.current],
    });
    activeIdRef.current = next.id;
    conversationsRef.current = nextConversations;
    setActiveId(next.id);
    setConversations(nextConversations);
    setView('chat');
  }, [activeIdRef, bumpRevision, conversationsRef, deletedConversationIdsRef, pageUrlRef, sessionIdRef, setActiveId, setConversations, setView]);

  const selectConversation = useCallback(
    (id: string) => {
      bumpRevision();
      setActiveId(id);
      setView('chat');
    },
    [bumpRevision, setActiveId, setView],
  );

  const closeConversation = useCallback(
    (id: string) => {
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
    },
    [activeIdRef, bumpRevision, deletedConversationIdsRef, pageUrlRef, setActiveId, setConversations, setView],
  );

  return { send, stop, clear, createConversation, selectConversation, closeConversation };
}
