import { useEffect, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { rpc } from '@/shared/extension/rpc-client';
import { requestPermissions } from '@/shared/browser/permissions';
import {
  DEFAULT_SETTINGS,
  PROVIDER_IDS,
  PROVIDER_PRESETS,
  modelsForProvider,
  resolveCatalogModel,
  providerSupportsResponsesApi,
  type AgentSettings,
  type ApiProtocol,
  type PermissionState,
  type ProviderId,
} from '@/shared/contracts/settings';

async function requestOptionalPermissions(options: {
  debugger?: boolean;
  tabs?: boolean;
  allSites?: boolean;
}): Promise<PermissionState> {
  try {
    return await requestPermissions(options);
  } catch {
    return (await rpc('permissions.request', options)) as PermissionState;
  }
}

function SettingRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="min-w-0 flex-1 leading-5 text-ink-2">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}

export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: AgentSettings;
  onChange: (settings: AgentSettings) => void;
}) {
  const [key, setKey] = useState('');
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [permissions, setPermissions] = useState<PermissionState>();
  const [status, setStatus] = useState('');

  const refresh = async () => {
    const [has, perms] = await Promise.all([
      rpc('secrets.has', {}) as Promise<Record<string, boolean>>,
      rpc('permissions.get', {}) as Promise<PermissionState>,
    ]);
    setKeys(has);
    setPermissions(perms);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const patch = async (next: Partial<AgentSettings>) => {
    const saved = (await rpc('settings.set', next)) as AgentSettings;
    onChange(saved);
  };

  return (
    <div className="space-y-3 text-sm text-ink">
      <section className="space-y-2.5 rounded-card border border-line bg-surface p-3">
        <h3 className="text-xs font-semibold tracking-wide text-ink-2">模型</h3>
        <div className="space-y-1.5">
          <Label htmlFor="provider">服务商</Label>
          <Select
            value={settings.model.provider}
            onValueChange={(provider) => {
              const next = provider as ProviderId;
              const preset = PROVIDER_PRESETS[next];
              void patch({
                model: {
                  ...settings.model,
                  provider: next,
                  model: preset.model,
                  apiProtocol: preset.apiProtocol,
                  baseURL:
                    preset.baseURL ??
                    (next === 'openai-compatible' ? settings.model.baseURL : undefined),
                },
              });
            }}
          >
            <SelectTrigger id="provider" aria-label="服务商" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {PROVIDER_PRESETS[id].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="model-name">模型</Label>
          <Select
            value={settings.model.model}
            onValueChange={(model) => {
              const next = resolveCatalogModel(settings.model.provider, model);
              void patch({
                model: { ...settings.model, model: next.id, apiProtocol: next.apiProtocol },
              });
            }}
          >
            <SelectTrigger id="model-name" aria-label="模型" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modelsForProvider(settings.model.provider).map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
              {!modelsForProvider(settings.model.provider).some((item) => item.id === settings.model.model) && (
                <SelectItem value={settings.model.model}>{settings.model.model}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        {providerSupportsResponsesApi(settings.model.provider) && (
          <div className="space-y-1.5">
            <Label htmlFor="api-protocol">接口协议</Label>
            <Select
              value={settings.model.apiProtocol ?? 'chat-completions'}
              onValueChange={(value) => {
                const apiProtocol = value as ApiProtocol;
                const nextModel =
                  settings.model.provider === 'deepseek'
                    ? apiProtocol === 'responses'
                      ? 'deepseek-v4-flash'
                      : settings.model.model.startsWith('deepseek-v4')
                        ? 'deepseek-chat'
                        : settings.model.model
                    : settings.model.model;
                void patch({ model: { ...settings.model, apiProtocol, model: nextModel } });
              }}
            >
              <SelectTrigger id="api-protocol" aria-label="接口协议" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chat-completions">Chat Completions（/chat/completions）</SelectItem>
                <SelectItem value="responses">Responses（/responses）</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {(settings.model.provider === 'openai-compatible' || settings.model.provider === 'deepseek') && (
          <div className="space-y-1.5">
            <Label htmlFor="base-url">Base URL</Label>
            <Input
              id="base-url"
              value={settings.model.baseURL ?? ''}
              onChange={(event) =>
                void patch({ model: { ...settings.model, baseURL: event.target.value } })
              }
              placeholder={
                settings.model.provider === 'deepseek'
                  ? 'https://api.deepseek.com'
                  : 'https://your-endpoint/v1'
              }
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="api-key">API Key</Label>
          <Input
            id="api-key"
            type="password"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder={keys[settings.model.provider] ? '已保存密钥，输入新值覆盖' : 'API Key'}
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={async () => {
              if (!key.trim()) return;
              await rpc('secrets.set', { provider: settings.model.provider, apiKey: key.trim() });
              setKey('');
              setStatus('密钥已保存到本地');
              await refresh();
            }}
          >
            保存密钥
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              setStatus('正在测试连接…');
              try {
                const result = (await rpc('llm.test', {
                  provider: settings.model.provider,
                  model: settings.model.model,
                  baseURL: settings.model.baseURL,
                  apiProtocol: settings.model.apiProtocol,
                })) as { preview?: string };
                setStatus(`连接成功：${result.preview ?? 'ok'}`);
              } catch (error) {
                setStatus(error instanceof Error ? error.message : String(error));
              }
            }}
          >
            测试连接
          </Button>
        </div>
      </section>

      <section className="space-y-2.5 rounded-card border border-line bg-surface p-3">
        <h3 className="text-xs font-semibold tracking-wide text-ink-2">执行</h3>
        <SettingRow
          label="使用 CDP 高级输入 / 整页截图"
          checked={settings.executionMode === 'cdp'}
          onCheckedChange={(enabled) => {
            const executionMode = enabled ? 'cdp' : 'dom';
            onChange({ ...settings, executionMode });
            void (async () => {
              let granted = permissions?.debugger ?? false;
              if (enabled && !granted) {
                try {
                  const state = await requestOptionalPermissions({ debugger: true });
                  setPermissions(state);
                  granted = state.debugger;
                } catch (error) {
                  setStatus(error instanceof Error ? error.message : '申请调试器权限失败');
                }
              }
              await patch({ executionMode });
              setStatus(
                enabled && !granted
                  ? '已开启 CDP。若浏览器未弹出授权，请点击下方「授予调试器权限」。'
                  : '',
              );
              await refresh();
            })();
          }}
        />
        {(settings.executionMode === 'cdp' || settings.captureDevtools) && !permissions?.debugger ? (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                const state = await requestOptionalPermissions({ debugger: true });
                setPermissions(state);
                setStatus(state.debugger ? '已授予调试器权限' : '未授予调试器权限，高级输入/整页截图仍不可用');
              } catch {
                await browser.runtime.openOptionsPage();
                setStatus('请在扩展设置页授予调试器权限');
              }
              await refresh();
            }}
          >
            授予调试器权限
          </Button>
        ) : null}
        <SettingRow
          label="允许 CDP 执行模型表达式"
          checked={settings.allowCdpScript}
          onCheckedChange={(allowCdpScript) => void patch({ allowCdpScript })}
        />
        <SettingRow
          label="发送截图给模型"
          checked={settings.captureScreenshots}
          onCheckedChange={(captureScreenshots) => void patch({ captureScreenshots })}
        />
        <SettingRow
          label="采集网络请求和控制台日志"
          checked={settings.captureDevtools}
          onCheckedChange={(enabled) => {
            onChange({ ...settings, captureDevtools: enabled });
            void (async () => {
              if (enabled && !permissions?.debugger) {
                try {
                  const state = await requestOptionalPermissions({ debugger: true });
                  setPermissions(state);
                } catch (error) {
                  setStatus(error instanceof Error ? error.message : '申请调试器权限失败');
                }
              }
              await patch({ captureDevtools: enabled });
              await refresh();
            })();
          }}
        />
        <SettingRow
          label="允许更宽的跨站导航"
          checked={settings.allowCrossOrigin}
          onCheckedChange={(allowCrossOrigin) => void patch({ allowCrossOrigin })}
        />
      </section>

      <section className="space-y-2.5 rounded-card border border-line bg-surface p-3">
        <h3 className="text-xs font-semibold tracking-wide text-ink-2">快捷键</h3>
        <p className="text-[12.5px] leading-5 text-ink-2">
          <kbd className="rounded-chip bg-inset px-1.5 py-0.5 font-mono text-[11.5px] text-ink">Alt+P</kbd>
          {' '}
          显示或隐藏面板。可在
          {' '}
          <span className="font-mono text-[11.5px]">chrome://extensions/shortcuts</span>
          {' '}
          修改。
        </p>
      </section>

      <section className="space-y-2.5 rounded-card border border-line bg-surface p-3">
        <h3 className="text-xs font-semibold tracking-wide text-ink-2">外观</h3>
        <div className="space-y-1.5">
          <Label htmlFor="theme">主题</Label>
          <Select
            value={settings.theme}
            onValueChange={(theme) => void patch({ theme: theme as AgentSettings['theme'] })}
          >
            <SelectTrigger id="theme" aria-label="主题" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">跟随系统</SelectItem>
              <SelectItem value="light">浅色</SelectItem>
              <SelectItem value="dark">深色</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="space-y-2.5 rounded-card border border-line bg-surface p-3">
        <h3 className="text-xs font-semibold tracking-wide text-ink-2">权限</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await requestOptionalPermissions({ allSites: true });
              await refresh();
            }}
          >
            {permissions?.allSites ? '已授予全站权限' : '授予全部网站'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await requestOptionalPermissions({ tabs: true });
              await refresh();
            }}
          >
            {permissions?.tabs ? '已授予标签页' : '授予标签页读取'}
          </Button>
        </div>
      </section>

      <p className="text-[11px] leading-5 text-ink-3">
        密钥保存在本地扩展存储中，关闭浏览器后仍可用。页面内容与截图会发送到你配置的模型服务。CDP
        会显示浏览器调试提示。验证码、支付、原生权限弹窗无法保证自动化。
        {status && <span className="mt-1 block text-ink-2">{status}</span>}
      </p>
      <Button size="sm" variant="ghost" onClick={() => void patch(DEFAULT_SETTINGS)}>
        恢复默认
      </Button>
    </div>
  );
}
