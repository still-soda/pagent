import { IconCheck, IconCommand } from '@tabler/icons-react';
import type { SavedCommand } from '@/shared/contracts/teaching';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';

export function CommandSavedAlert({ command }: { command: SavedCommand }) {
  return (
    <Alert className="animate-in fade-in slide-in-from-bottom-1 border-green/25 bg-green-tint">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-green text-white">
        <IconCheck size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <AlertTitle>命令已保存</AlertTitle>
        <AlertDescription>已固化到当前网站 Vault</AlertDescription>
      </div>
      <Badge variant="outline" className="shrink-0 bg-surface/70">
        <IconCommand size={11} />/{command.key}
      </Badge>
    </Alert>
  );
}
