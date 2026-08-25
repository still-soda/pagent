import { useMemo } from 'react';
import { renderMarkdown } from '../../lib/markdown';
import { cn } from '../../lib/utils';

export function MarkdownContent({
  text,
  streaming = false,
  className,
}: {
  text: string;
  streaming?: boolean;
  className?: string;
}) {
  const html = useMemo(() => renderMarkdown(text), [text]);

  return (
    <div
      className={cn('pagent-md', streaming && 'is-streaming', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
