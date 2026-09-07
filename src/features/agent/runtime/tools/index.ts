import type { PageChangeSnapshot } from '@/features/page/change-tracker';
import type { ToolBridge } from './types';
import { createObservationTools } from './observation';
import { createInteractionTools } from './interaction';
import { createNavigationTools } from './navigation';
import { createCdpTools } from './cdp';
import { createMemoryTools } from './memory';
import { createMcpAgentTools } from './mcp';

export * from './types';
export { createObservationTools } from './observation';
export { createInteractionTools } from './interaction';
export { createNavigationTools } from './navigation';
export { createCdpTools } from './cdp';
export { createMemoryTools } from './memory';
export { createMcpAgentTools } from './mcp';

/** 内置工具名集合，MCP 工具展示名与其冲突时自动加服务器前缀 */
export const BUILTIN_TOOL_NAMES: ReadonlySet<string> = new Set([
  'observe_page',
  'observe_page_changes',
  'search_page_text',
  'capture_screenshot',
  'click_element',
  'dblclick_element',
  'hover_element',
  'type_text',
  'clear_field',
  'select_option',
  'interact_elements',
  'drag_element',
  'press_key',
  'scroll_page',
  'wait_for',
  'navigate',
  'go_back',
  'go_forward',
  'reload_page',
  'page_info',
  'get_source',
  'list_tabs',
  'open_tab',
  'switch_tab',
  'close_tab',
  'extract_interactions',
  'inspect_element_tree',
  'find_common_ancestor',
  'execute_named_script',
  'execute_cdp_script',
  'execute_cdp_command',
  'cdp_click_xy',
  'get_network_log',
  'get_console_log',
  'get_network_request',
  'memory_search',
  'memory_write',
]);

export async function createAgentTools(bridge: ToolBridge) {
  const changeWatches = new Map<string, PageChangeSnapshot>();
  let lastWatchId: string | undefined;

  const startChangeWatch = async () => {
    const baseline = await bridge.content<PageChangeSnapshot>('dom.changes.start');
    changeWatches.set(baseline.watchId, baseline);
    lastWatchId = baseline.watchId;
    while (changeWatches.size > 8) {
      const oldest = changeWatches.keys().next().value as string | undefined;
      if (!oldest) break;
      changeWatches.delete(oldest);
    }
    return baseline;
  };

  const trackAction = async <T>(action: () => Promise<T>): Promise<T> => {
    await startChangeWatch();
    return action();
  };

  const observationTools = createObservationTools(
    bridge,
    changeWatches,
    () => lastWatchId,
    (id) => {
      lastWatchId = id;
    },
    startChangeWatch,
  );
  const interactionTools = createInteractionTools(bridge, trackAction);
  const navigationTools = createNavigationTools(bridge, trackAction);
  const cdpTools = createCdpTools(bridge, trackAction);
  const memoryTools = bridge.settings.memory.enabled ? createMemoryTools(bridge) : [];

  const builtinTools = [
    ...observationTools,
    ...interactionTools,
    ...navigationTools,
    ...cdpTools,
    ...memoryTools,
  ];

  const disabledBuiltinTools = new Set(bridge.settings.disabledBuiltinTools ?? []);
  return [
    ...builtinTools.filter((builtinTool) => !disabledBuiltinTools.has(builtinTool.name)),
    ...(await createMcpAgentTools(bridge)),
  ];
}
