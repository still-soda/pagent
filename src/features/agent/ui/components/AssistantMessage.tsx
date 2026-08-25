import ToolChips from '@/shared/ui/beautiful-ui/primitives/ToolChips';
import ThinkingState from '@/shared/ui/beautiful-ui/primitives/ThinkingState';
import { MarkdownContent } from './MarkdownContent';
import { messageBlocks, shouldHoldToolGroupOpen } from '@/features/agent/session/messages';
import { toolChip, toolDetailLines, toolKind, toolLabel, toolUsesMono } from '@/features/agent/session/tool-display';
import { formatTurnUsageParts, hasTurnUsage } from '@/features/agent/runtime/usage';
import type { ChatMessage, TurnUsage } from '@/shared/contracts/session-messages';

function hasAssistantOutput(message?: ChatMessage) {
  return message?.role === 'assistant' && messageBlocks(message).length > 0;
}

export function AssistantMessage({
  message,
  streaming,
}: {
  message: ChatMessage;
  streaming: boolean;
}) {
  const blocks = messageBlocks(message);
  const lastTextIndex = blocks.findLastIndex((block) => block.type === 'text');

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === 'thinking') {
          return (
            <ThinkingState
              key={`${message.id}-thinking-${index}`}
              variant="Reasoning"
              working={streaming && index === blocks.length - 1}
              text={block.text}
              active="正在思考"
              done="思考完成"
            />
          );
        }
        if (block.type === 'text') {
          return (
            <MarkdownContent
              key={`${message.id}-text-${index}`}
              text={block.text}
              streaming={streaming && index === lastTextIndex && lastTextIndex === blocks.length - 1}
            />
          );
        }
        return (
          <ToolChips
            key={`${message.id}-block-${index}`}
            holdOpen={shouldHoldToolGroupOpen(streaming, blocks.slice(index + 1))}
            summary={
              block.tools.length === 1
                ? toolLabel(block.tools[0]!.name)
                : `${block.tools.length} 个操作`
            }
            calls={block.tools.map((tool) => ({
              id: tool.id,
              label: toolLabel(tool.name),
              chip: toolChip(tool.name, tool.args, tool.status),
              icon: toolKind(tool.name),
              mono: toolUsesMono(tool.name),
              detailMono: true,
              detail: toolDetailLines(tool.args, tool.output, tool.status),
              status: tool.status,
            }))}
          />
        );
      })}
      {!streaming && hasTurnUsage(message.usage) ? <TurnUsageBar usage={message.usage!} /> : null}
    </div>
  );
}

function TurnUsageBar({ usage }: { usage: TurnUsage }) {
  const parts = formatTurnUsageParts(usage);
  if (!parts.length) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] tabular-nums text-ink-3"
      aria-label={`本轮用量：${parts.join(' · ')}`}
    >
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="inline-flex items-center gap-1.5">
          {index > 0 ? <span aria-hidden className="text-ink-3/70">·</span> : null}
          {part}
        </span>
      ))}
    </div>
  );
}

export { hasAssistantOutput };
