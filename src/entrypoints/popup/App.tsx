import { useEffect, useState } from 'react';
import { IconSparkles } from '@tabler/icons-react';
import { Button } from '@/shared/ui/button';
import { rpc } from '@/shared/extension/rpc-client';
import { applyDocumentTheme, resolveThemeClass } from '@/shared/extension/theme';
import type { AgentSettings } from '@/shared/contracts/settings';

export function PopupApp() {
  const [settings, setSettings] = useState<AgentSettings>();
  const [error, setError] = useState('');

  useEffect(() => {
    void rpc('settings.get', {}).then((value) => setSettings(value as AgentSettings));
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () =>
      applyDocumentTheme(resolveThemeClass(settings?.theme ?? 'system', media.matches));
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [settings?.theme]);

  return (
    <div className="w-[320px] bg-page p-4 text-ink">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <IconSparkles className="size-4" />
        </span>
        <div>
          <div className="text-sm font-semibold">Pagent</div>
          <div className="text-[11px] text-ink-3">
            {settings ? `${settings.model.provider} · ${settings.model.model}` : '页面内 Agent'}
          </div>
        </div>
      </div>
      <p className="mb-3 text-xs leading-5 text-ink-2">
        Agent 生活在当前网页中。按 Alt+P 可呼出或隐藏面板，也可在 chrome://extensions/shortcuts 改快捷键。
      </p>
      <div className="flex flex-col gap-2">
        <Button
          onClick={async () => {
            try {
              await rpc('agent.toggle', {});
              window.close();
            } catch (item) {
              setError(item instanceof Error ? item.message : String(item));
            }
          }}
        >
          在当前页面打开
        </Button>
        <Button variant="outline" onClick={() => void browser.runtime.openOptionsPage()}>
          打开设置
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-red">{error}</p>}
    </div>
  );
}
