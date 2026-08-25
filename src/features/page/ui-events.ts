export const uiEvents = new EventTarget();

export type UiCommand = 'ui.toggle' | 'ui.open' | 'ui.hide';

export function dispatchUiCommand(name: UiCommand) {
  if (name === 'ui.toggle') uiEvents.dispatchEvent(new CustomEvent('toggle'));
  if (name === 'ui.open') uiEvents.dispatchEvent(new CustomEvent('open'));
  if (name === 'ui.hide') uiEvents.dispatchEvent(new CustomEvent('hide'));
}
