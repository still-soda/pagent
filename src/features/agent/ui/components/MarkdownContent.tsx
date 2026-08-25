import { renderMarkdown } from '@/shared/utils/markdown';
import { cn } from '@/shared/utils/utils';

export function MarkdownContent({
  text,
  streaming,
}: {
  text: string;
  streaming?: boolean;
}) {
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none text-[13px] leading-[1.45] text-ink [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-inset [&_pre]:p-2 [&_code]:text-[12px]',
        streaming && 'pagent-streaming',
      )}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  );
}
