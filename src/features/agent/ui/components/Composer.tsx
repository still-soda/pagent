import PromptBar from '@/shared/ui/beautiful-ui/primitives/PromptBar';
import { rpc } from '@/shared/extension/rpc-client';
import { modelsForProvider, resolveCatalogModel, type AgentSettings } from '@/shared/contracts/settings';

export function Composer({
  settings,
  onSubmit,
  onSettingsChange,
}: {
  settings: AgentSettings;
  onSubmit: (prompt: string, context?: string) => void;
  onSettingsChange: (settings: AgentSettings) => void;
}) {
  return (
    <div className="mt-auto shrink-0 border-t border-line bg-page p-2">
      <PromptBar
        demo={false}
        placeholder="给当前页面下达任务…"
        onSend={onSubmit}
        modelKey={settings.model.model}
        models={modelsForProvider(settings.model.provider).map((item) => ({
          key: item.id,
          name: item.label,
          tag: item.tag,
        }))}
        onModelChange={(id) => {
          const next = resolveCatalogModel(settings.model.provider, id);
          void rpc('settings.set', {
            model: {
              ...settings.model,
              model: next.id,
              apiProtocol: next.apiProtocol,
            },
          }).then((saved) => onSettingsChange(saved as AgentSettings));
        }}
      />
    </div>
  );
}
