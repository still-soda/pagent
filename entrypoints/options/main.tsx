import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../../assets/tailwind.css';
import { SettingsPanel } from '../../components/settings/SettingsPanel';
import { rpc } from '../../lib/rpc-client';
import { applyDocumentTheme, resolveThemeClass } from '../../lib/theme';
import { DEFAULT_SETTINGS, type AgentSettings } from '../../lib/shared/types';

function OptionsApp() {
  const [settings, setSettings] = useState<AgentSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    void rpc('settings.get', {}).then((value) => setSettings(value as AgentSettings));
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () =>
      applyDocumentTheme(resolveThemeClass(settings.theme, media.matches));
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [settings.theme]);

  return (
    <div className="min-h-screen bg-canvas p-8 text-ink">
      <div className="pagent-window mx-auto max-w-xl p-6">
        <h1 className="mb-1 text-xl font-semibold">Pagent 设置</h1>
        <p className="mb-5 text-sm text-ink-2">配置模型和权限。</p>
        <SettingsPanel settings={settings} onChange={setSettings} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
);
