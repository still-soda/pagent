import type { PointerEvent } from 'react';
import ChatComposer from '../beautiful-ui/primitives/ChatComposer';
import type { AgentSettings, ChatMessage, TaskRow } from '../../lib/shared/types';

export function AgentPanel(props: {
  settings: AgentSettings;
  messages: ChatMessage[];
  tasks: TaskRow[];
  running: boolean;
  workingOnThisPage?: boolean;
  thinking: string;
  error: string;
  page: { url: string; title: string; selection: string };
  conversations: Array<{ id: string; title: string; updatedAt?: number }>;
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  onCreateConversation: () => void;
  onCloseConversation: (id: string) => void;
  view: 'chat' | 'settings';
  onViewChange: (view: 'chat' | 'settings') => void;
  onClose: () => void;
  onSubmit: (prompt: string, context?: string) => void;
  onStop: () => void;
  onClear: () => void;
  onClearSelection: () => void;
  onSettingsChange: (settings: AgentSettings) => void;
  onHeaderPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
}) {
  return <ChatComposer {...props} />;
}
