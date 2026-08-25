import { useEffect, useState } from 'react';
import { IconEye, IconEyeOff, IconSettings, IconSparkles } from '@tabler/icons-react';
import { rpc } from '@/shared/extension/rpc-client';
import { applyDocumentTheme, resolveThemeClass } from '@/shared/extension/theme';
import type { AgentSettings } from '@/shared/contracts/settings';

export function PopupApp() {
  const [settings, setSettings] = useState<AgentSettings>();
  const [permanentlyHidden, setPermanentlyHidden] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([rpc('settings.get', {}), rpc('menu.getState', {})])
      .then(([settingsValue, menuValue]) => {
        setSettings(settingsValue as AgentSettings);
        setPermanentlyHidden(
          Boolean((menuValue as { permanentlyHidden?: boolean }).permanentlyHidden),
        );
      })
      .catch((item) => setError(item instanceof Error ? item.message : String(item)));
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () =>
      applyDocumentTheme(resolveThemeClass(settings?.theme ?? 'system', media.matches));
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [settings?.theme]);

  const run = async (name: string, action: () => Promise<unknown>, close = true) => {
    setBusy(name);
    setError('');
    try {
      await action();
      if (close) window.close();
    } catch (item) {
      setError(item instanceof Error ? item.message : String(item));
    } finally {
      setBusy('');
    }
  };

  return (
    <main className="w-89 bg-page p-3 text-ink">
      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-window bg-primary text-primary-foreground shadow-hairline">
            <IconSparkles className="size-4.5" stroke={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[14px] font-semibold tracking-[-0.01em]">Pagent</h1>
            <p className="truncate text-[11px] text-ink-3">
              {settings ? `${settings.model.provider} · ${settings.model.model}` : '页面内智能 Agent'}
            </p>
          </div>
          <button
            type="button"
            aria-label="打开设置"
            className="grid size-8 place-items-center rounded-card text-ink-3 transition-colors hover:bg-hover hover:text-ink"
            onClick={() => void browser.runtime.openOptionsPage()}
          >
            <IconSettings className="size-4.25" stroke={1.9} />
          </button>
        </header>

        <div className="p-3">
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void run('open', () => rpc('menu.openCurrent', {}))}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-hairline transition-[transform,opacity] hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
          >
            <IconSparkles className="size-4" stroke={2.2} />
            {busy === 'open' ? '正在打开…' : '在当前页面打开'}
          </button>

          <div className="my-3 h-px bg-line" />

          <div className="mb-1 px-1 text-[10px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
            显示设置
          </div>
          <button
            type="button"
            disabled={Boolean(busy) || permanentlyHidden}
            onClick={() => void run('current', () => rpc('menu.hideCurrent', {}))}
            className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-hover disabled:opacity-45"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-card bg-inset text-ink-2">
              <IconEyeOff className="size-4" stroke={1.9} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-medium">在当前页面隐藏</span>
              <span className="mt-0.5 block text-[10.5px] leading-4 text-ink-3">刷新页面后自动恢复显示</span>
            </span>
          </button>

          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() =>
              void run(
                'permanent',
                async () => {
                  const next = !permanentlyHidden;
                  await rpc('menu.setPermanentlyHidden', { hidden: next });
                  setPermanentlyHidden(next);
                },
              )
            }
            className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-hover disabled:opacity-45"
          >
            <span className={`grid size-8 shrink-0 place-items-center rounded-card ${
              permanentlyHidden ? 'bg-primary text-primary-foreground' : 'bg-inset text-ink-2'
            }`}>
              {permanentlyHidden
                ? <IconEye className="size-4" stroke={1.9} />
                : <IconEyeOff className="size-4" stroke={1.9} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-medium">
                {permanentlyHidden ? '恢复悬浮入口' : '永久隐藏悬浮入口'}
              </span>
              <span className="mt-0.5 block text-[10.5px] leading-4 text-ink-3">
                {permanentlyHidden ? '在所有网页重新显示 Pagent' : '在所有网页隐藏，可随时从此处恢复'}
              </span>
            </span>
          </button>
        </div>
      </section>

      <footer className="flex items-center justify-between px-2 pt-2.5 pb-0.5 text-[10px] text-ink-3">
        <span>快捷键 Alt + P</span>
        <button
          type="button"
          className="transition-colors hover:text-ink"
          onClick={() => void browser.runtime.openOptionsPage()}
        >
          设置与模型
        </button>
      </footer>

      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-red-tint px-3 py-2 text-[11px] leading-4 text-red">
          {error}
        </p>
      )}
    </main>
  );
}
