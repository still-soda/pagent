export const uiEvents = new EventTarget();

export function dispatchUiCommand(name: 'ui.toggle' | 'ui.open') {
  if (name === 'ui.toggle') uiEvents.dispatchEvent(new CustomEvent('toggle'));
  if (name === 'ui.open') uiEvents.dispatchEvent(new CustomEvent('open'));
}
