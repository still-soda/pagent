import PromptBar from '@/shared/ui/beautiful-ui/primitives/PromptBar';
import { rpc } from '@/shared/extension/rpc-client';
import { modelsForProvider, resolveCatalogModel, type AgentSettings } from '@/shared/contracts/settings';
import type { ObservedElement } from '@/shared/contracts/page';

export function Composer({
  settings,
  running,
  onSubmit,
  onStop,
  onSettingsChange,
  imageDataUrl,
  onMarkScreen,
  onRemoveImage,
  selectedElement,
  selectingElement,
  onSelectElement,
  onRemoveElement,
  onStartTeaching,
  placeholder,
}: {
  settings: AgentSettings;
  running: boolean;
  onSubmit: (prompt: string, context?: string, imageDataUrl?: string) => void;
  onStop: () => void;
  onSettingsChange: (settings: AgentSettings) => void;
  imageDataUrl?: string;
  onMarkScreen: () => void;
  onRemoveImage: () => void;
  selectedElement?: ObservedElement;
  selectingElement: boolean;
  onSelectElement: () => void;
  onRemoveElement: () => void;
  onStartTeaching: () => void;
  placeholder?: string;
}) {
  return (
    <div className="mt-auto shrink-0 border-t border-line bg-page p-2">
      <PromptBar
        demo={false}
        placeholder={placeholder ?? "给当前页面下达任务…"}
        running={running}
        onSend={onSubmit}
        onStop={onStop}
        imageDataUrl={imageDataUrl}
        onMarkScreen={onMarkScreen}
        onRemoveImage={onRemoveImage}
        selectedElement={selectedElement}
        selectingElement={selectingElement}
        onSelectElement={onSelectElement}
        onRemoveElement={onRemoveElement}
        onStartTeaching={onStartTeaching}
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
