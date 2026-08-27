import { tool } from 'langchain';
import { z } from 'zod';
import { assertNavigableUrl } from '@/shared/contracts/policy';
import { isolateUntrustedPage } from '@/features/agent/runtime/middleware';
import { jsonSchemaToZod } from '@/features/mcp/json-schema-to-zod';
import { safeJson, truncate } from '@/shared/utils/utils';
import type { AgentSettings } from '@/shared/contracts/settings';
import type { McpToolMeta } from '@/shared/contracts/mcp';
import type { MemoryScope } from '@/shared/contracts/memory';

export type ToolBridge = {
  tabId: number;
  settings: AgentSettings;
  content: <T>(name: string, payload?: unknown) => Promise<T>;
  screenshot: (fullPage?: boolean) => Promise<string>;
  navigate: (url: string) => Promise<unknown>;
  back: () => Promise<unknown>;
  forward: () => Promise<unknown>;
  reload: () => Promise<unknown>;
  tabs: {
    query: () => Promise<unknown>;
    create: (url?: string) => Promise<unknown>;
    switch: (tabId: number) => Promise<unknown>;
    close: (tabId: number) => Promise<unknown>;
  };
  cdp: {
    script: (expression: string, awaitPromise?: boolean) => Promise<unknown>;
    input: (payload: { x: number; y: number; type?: string; text?: string }) => Promise<unknown>;
    screenshot: (fullPage?: boolean) => Promise<string>;
    network: (filter?: {
      urlIncludes?: string;
      method?: string;
      resourceType?: string;
      failedOnly?: boolean;
      includeNoise?: boolean;
      limit?: number;
    }) => Promise<unknown>;
    console: (filter?: {
      level?: string;
      textIncludes?: string;
      limit?: number;
    }) => Promise<unknown>;
    request: (requestId: string, includeBody?: boolean) => Promise<unknown>;
  };
  mcp: {
    listTools: () => Promise<McpToolMeta[]>;
    callTool: (name: string, args: unknown) => Promise<string>;
  };
  memory: {
    search: (query: string, limit?: number) => Promise<unknown>;
    write: (content: string, scope: MemoryScope, memoryId?: string) => Promise<unknown>;
  };
};

/** 内置工具名集合，MCP 工具展示名与其冲突时自动加服务器前缀 */
export const BUILTIN_TOOL_NAMES: ReadonlySet<string> = new Set([
  'observe_page',
  'search_page_text',
  'capture_screenshot',
  'click_element',
  'dblclick_element',
  'hover_element',
  'type_text',
  'clear_field',
  'select_option',
  'drag_element',
  'press_key',
  'scroll_page',
  'wait_for',
  'highlight_element',
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
  'execute_named_script',
  'execute_cdp_script',
  'cdp_click_xy',
  'get_network_log',
  'get_console_log',
  'get_network_request',
  'memory_search',
  'memory_write',
]);

export async function createAgentTools(bridge: ToolBridge) {
  const observe = tool(
    async ({ reason, maxElements }) => {
      const observation = await bridge.content('dom.observe', { reason, maxElements });
      return isolateUntrustedPage(safeJson(observation));
    },
    {
      name: 'observe_page',
      description: '观测当前页面的语义 DOM、可见元素、选区和文本预览。操作前或页面变化后必须调用。',
      schema: z.object({
        reason: z.string().optional().describe('为什么需要重新观测'),
        maxElements: z.number().int().min(10).max(300).optional(),
      }),
    },
  );

  const search = tool(
    async ({ query, caseSensitive, maxResults }) =>
      isolateUntrustedPage(
        safeJson(await bridge.content('dom.search', { query, caseSensitive, maxResults })),
      ),
    {
      name: 'search_page_text',
      description:
        '在当前页面全文搜索文本（类似查找）。返回 snippet、elementId、可见性和坐标。适合 locate observe_page 没列全的正文、按钮或输入值。找到后可用 click_element / scroll_page / highlight_element。',
      schema: z.object({
        query: z.string().min(1).max(200),
        caseSensitive: z.boolean().optional(),
        maxResults: z.number().int().min(1).max(80).optional(),
      }),
    },
  );

  const screenshot = tool(
    async ({ fullPage }) => {
      if (!bridge.settings.captureScreenshots) return '用户已关闭截图。';
      if (bridge.settings.executionMode === 'cdp') {
        return await bridge.cdp.screenshot(fullPage);
      }
      return await bridge.screenshot(fullPage);
    },
    {
      name: 'capture_screenshot',
      description: '截取当前标签页可见区域或整页截图，返回 data URL。',
      schema: z.object({ fullPage: z.boolean().optional() }),
    },
  );

  const click = tool(
    async ({ elementId, revision }) =>
      safeJson(await bridge.content('dom.click', { elementId, revision })),
    {
      name: 'click_element',
      description: '点击 observe_page 返回的 elementId。',
      schema: z.object({
        elementId: z.string(),
        revision: z.number().optional(),
      }),
    },
  );

  const dblclick = tool(
    async ({ elementId, revision }) =>
      safeJson(await bridge.content('dom.dblclick', { elementId, revision })),
    {
      name: 'dblclick_element',
      description: '双击指定元素。',
      schema: z.object({
        elementId: z.string(),
        revision: z.number().optional(),
      }),
    },
  );

  const hover = tool(
    async ({ elementId, revision }) =>
      safeJson(await bridge.content('dom.hover', { elementId, revision })),
    {
      name: 'hover_element',
      description: '悬停在指定元素上，用于展开菜单。',
      schema: z.object({
        elementId: z.string(),
        revision: z.number().optional(),
      }),
    },
  );

  const typeText = tool(
    async ({ elementId, text, clear, submit, revision }) =>
      safeJson(await bridge.content('dom.type', { elementId, text, clear, submit, revision })),
    {
      name: 'type_text',
      description: '向输入框输入文本。',
      schema: z.object({
        elementId: z.string(),
        text: z.string(),
        clear: z.boolean().optional(),
        submit: z.boolean().optional(),
        revision: z.number().optional(),
      }),
    },
  );

  const clear = tool(
    async ({ elementId, revision }) =>
      safeJson(await bridge.content('dom.clear', { elementId, revision })),
    {
      name: 'clear_field',
      description: '清空输入框。',
      schema: z.object({
        elementId: z.string(),
        revision: z.number().optional(),
      }),
    },
  );

  const select = tool(
    async ({ elementId, value, revision }) =>
      safeJson(await bridge.content('dom.select', { elementId, value, revision })),
    {
      name: 'select_option',
      description: '选择下拉框选项。',
      schema: z.object({
        elementId: z.string(),
        value: z.string(),
        revision: z.number().optional(),
      }),
    },
  );

  const drag = tool(
    async ({ elementId, targetId, revision }) =>
      safeJson(await bridge.content('dom.drag', { elementId, targetId, revision })),
    {
      name: 'drag_element',
      description: '把一个元素拖到另一个元素上。',
      schema: z.object({
        elementId: z.string(),
        targetId: z.string(),
        revision: z.number().optional(),
      }),
    },
  );

  const press = tool(
    async ({ key }) => safeJson(await bridge.content('dom.press', { key })),
    {
      name: 'press_key',
      description: '向当前焦点发送按键，例如 Enter、Escape、Tab。',
      schema: z.object({ key: z.string() }),
    },
  );

  const scroll = tool(
    async (payload) => safeJson(await bridge.content('dom.scroll', payload)),
    {
      name: 'scroll_page',
      description: '滚动页面或滚到某个元素。',
      schema: z.object({
        elementId: z.string().optional(),
        direction: z.enum(['up', 'down', 'left', 'right', 'top', 'bottom']).optional(),
        amount: z.number().optional(),
        revision: z.number().optional(),
      }),
    },
  );

  const wait = tool(
    async (payload) => safeJson(await bridge.content('dom.wait', payload)),
    {
      name: 'wait_for',
      description: '等待文本、元素或 URL 变化。',
      schema: z.object({
        ms: z.number().optional(),
        text: z.string().optional(),
        elementId: z.string().optional(),
        urlIncludes: z.string().optional(),
      }),
    },
  );

  const highlight = tool(
    async ({ elementId, revision }) =>
      safeJson(await bridge.content('dom.highlight', { elementId, revision })),
    {
      name: 'highlight_element',
      description: '高亮元素以便确认目标。',
      schema: z.object({
        elementId: z.string(),
        revision: z.number().optional(),
      }),
    },
  );

  const navigate = tool(
    async ({ url }) => {
      assertNavigableUrl(url, bridge.settings);
      return safeJson(await bridge.navigate(url));
    },
    {
      name: 'navigate',
      description: '导航当前标签页到指定 http/https URL。',
      schema: z.object({ url: z.string() }),
    },
  );

  const back = tool(async () => safeJson(await bridge.back()), {
    name: 'go_back',
    description: '浏览器后退。',
    schema: z.object({}),
  });

  const forward = tool(async () => safeJson(await bridge.forward()), {
    name: 'go_forward',
    description: '浏览器前进。',
    schema: z.object({}),
  });

  const reload = tool(async () => safeJson(await bridge.reload()), {
    name: 'reload_page',
    description: '刷新当前页面。',
    schema: z.object({}),
  });

  const pageInfo = tool(async () => safeJson(await bridge.content('page.info')), {
    name: 'page_info',
    description: '读取当前标签页 URL、标题和选区。',
    schema: z.object({}),
  });

  const getSource = tool(
    async (payload) =>
      isolateUntrustedPage(safeJson(await bridge.content('page.source', payload), 12_000)),
    {
      name: 'get_source',
      description:
        '读取当前网站源码或结构化资源。type=dom 为实时 HTML，page 为原始 HTML，url/title/text 为地址标题和可见正文，links/scripts/stylesheets 为资源列表。可用 grep 过滤（regex 视为正则）。结果默认分页，过大时用 offset 继续取下一页。',
      schema: z.object({
        type: z
          .enum(['dom', 'page', 'url', 'title', 'text', 'links', 'scripts', 'stylesheets'])
          .optional()
          .describe('默认 dom'),
        grep: z.string().min(1).max(300).optional().describe('子串或正则，用于过滤源码/资源'),
        regex: z.boolean().optional().describe('把 grep 当作正则'),
        caseSensitive: z.boolean().optional(),
        limit: z.number().int().min(1).max(400).optional().describe('本页条数或字符数'),
        offset: z.number().int().min(0).optional().describe('从 0 开始的偏移，配合 hasMore/nextOffset 翻页'),
      }),
    },
  );

  const listTabs = tool(async () => safeJson(await bridge.tabs.query()), {
    name: 'list_tabs',
    description: '列出当前窗口标签页。需要 tabs 权限才能看到完整 URL。',
    schema: z.object({}),
  });

  const openTab = tool(
    async ({ url }) => {
      if (url) assertNavigableUrl(url, bridge.settings);
      return safeJson(await bridge.tabs.create(url));
    },
    {
      name: 'open_tab',
      description: '打开新标签页。',
      schema: z.object({ url: z.string().optional() }),
    },
  );

  const switchTab = tool(
    async ({ tabId }) => safeJson(await bridge.tabs.switch(tabId)),
    {
      name: 'switch_tab',
      description: '切换到指定标签页。',
      schema: z.object({ tabId: z.number() }),
    },
  );

  const closeTab = tool(
    async ({ tabId }) => safeJson(await bridge.tabs.close(tabId)),
    {
      name: 'close_tab',
      description: '关闭指定标签页。',
      schema: z.object({ tabId: z.number() }),
    },
  );

  const namedScript = tool(
    async ({ name }) => safeJson(await bridge.content('dom.script', { name })),
    {
      name: 'execute_named_script',
      description:
        '执行扩展内置只读脚本：extract_links、extract_headings、extract_forms、extract_meta、page_stats、get_selection。',
      schema: z.object({
        name: z.enum([
          'extract_links',
          'extract_headings',
          'extract_forms',
          'extract_meta',
          'page_stats',
          'get_selection',
        ]),
      }),
    },
  );

  const cdpScript = tool(
    async ({ expression, awaitPromise }) => {
      if (!bridge.settings.allowCdpScript) {
        return '用户未启用 CDP 任意表达式执行。请改用 observe_page 或 execute_named_script。';
      }
      return truncate(safeJson(await bridge.cdp.script(expression, awaitPromise)), 6000);
    },
    {
      name: 'execute_cdp_script',
      description: '仅在用户启用后，通过 CDP Runtime.evaluate 在当前被调试页面执行表达式。',
      schema: z.object({
        expression: z.string(),
        awaitPromise: z.boolean().optional(),
      }),
    },
  );

  const cdpClick = tool(
    async ({ x, y, text }) => {
      if (bridge.settings.executionMode !== 'cdp') {
        return '当前为 DOM 模式。如需坐标级输入，请在设置中切换到 CDP。';
      }
      return safeJson(await bridge.cdp.input({ x, y, type: 'click', text }));
    },
    {
      name: 'cdp_click_xy',
      description: '使用 CDP 在视口坐标点击，更接近真实输入。',
      schema: z.object({
        x: z.number(),
        y: z.number(),
        text: z.string().optional(),
      }),
    },
  );

  const networkLog = tool(
    async (filter) => {
      if (!bridge.settings.captureDevtools) {
        return '用户已关闭网络/控制台采集。';
      }
      return isolateUntrustedPage(safeJson(await bridge.cdp.network(filter)));
    },
    {
      name: 'get_network_log',
      description:
        '读取当前标签页在调试器 attach 之后的网络请求摘要（方法、URL、状态码、类型、耗时）。Cookie/Authorization 等敏感头已脱敏。需要看响应体时再用 get_network_request。若刚开始采集、缓冲为空，请复现操作或刷新后再查。',
      schema: z.object({
        urlIncludes: z.string().optional(),
        method: z.string().optional(),
        resourceType: z.string().optional().describe('例如 Document、XHR、Fetch、Script'),
        failedOnly: z.boolean().optional(),
        includeNoise: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      }),
    },
  );

  const consoleLog = tool(
    async (filter) => {
      if (!bridge.settings.captureDevtools) {
        return '用户已关闭网络/控制台采集。';
      }
      return isolateUntrustedPage(safeJson(await bridge.cdp.console(filter)));
    },
    {
      name: 'get_console_log',
      description:
        '读取当前标签页在调试器 attach 之后的控制台输出、未捕获异常和浏览器日志。只能看到 attach 之后的记录。',
      schema: z.object({
        level: z.string().optional().describe('例如 log、info、warning、error'),
        textIncludes: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      }),
    },
  );

  const networkRequest = tool(
    async ({ requestId, includeBody }) => {
      if (!bridge.settings.captureDevtools) {
        return '用户已关闭网络/控制台采集。';
      }
      return isolateUntrustedPage(
        truncate(safeJson(await bridge.cdp.request(requestId, includeBody)), 8000),
      );
    },
    {
      name: 'get_network_request',
      description:
        '读取单条网络请求的请求/响应头（已脱敏）。includeBody 仅对文本/JSON 响应尝试读取正文。',
      schema: z.object({
        requestId: z.string(),
        includeBody: z.boolean().optional(),
      }),
    },
  );

  const memorySearch = tool(
    async ({ query, limit }) => safeJson(await bridge.memory.search(query, limit)),
    {
      name: 'memory_search',
      description:
        '主动检索与当前任务相关的长期记忆。会同时搜索全局记忆和当前域名的局部记忆，返回记忆 ID 供后续修改。',
      schema: z.object({
        query: z.string().min(1).max(4000),
        limit: z.number().int().min(1).max(20).optional(),
      }),
    },
  );

  const memoryWrite = tool(
    async ({ content, scope, memoryId }) =>
      safeJson(await bridge.memory.write(content, scope, memoryId)),
    {
      name: 'memory_write',
      description:
        '写入长期记忆。scope=global 适用于跨网站经验，scope=local 仅用于当前域名并自动记录脱敏 URL。传 memoryId 可修改已有记忆。',
      schema: z.object({
        content: z.string().min(1).max(8000),
        scope: z.enum(['global', 'local']),
        memoryId: z.string().optional().describe('修改 memory_search 返回的已有记忆 ID'),
      }),
    },
  );

  const builtinTools = [
    observe,
    search,
    screenshot,
    click,
    dblclick,
    hover,
    typeText,
    clear,
    select,
    drag,
    press,
    scroll,
    wait,
    highlight,
    navigate,
    back,
    forward,
    reload,
    pageInfo,
    getSource,
    listTabs,
    openTab,
    switchTab,
    closeTab,
    namedScript,
    cdpScript,
    cdpClick,
    networkLog,
    consoleLog,
    networkRequest,
    ...(bridge.settings.memory.enabled ? [memorySearch, memoryWrite] : []),
  ];
  const disabledBuiltinTools = new Set(bridge.settings.disabledBuiltinTools ?? []);
  return [
    ...builtinTools.filter((builtinTool) => !disabledBuiltinTools.has(builtinTool.name)),
    ...(await createMcpAgentTools(bridge)),
  ];
}

async function createMcpAgentTools(bridge: ToolBridge) {
  let listed: McpToolMeta[] = [];
  try {
    listed = await bridge.mcp.listTools();
  } catch (error) {
    listed = [];
  }
  return listed.map((meta) =>
    tool(
      async (args) =>
        isolateUntrustedPage(truncate(await bridge.mcp.callTool(meta.name, args), 12_000)),
      {
        name: meta.name,
        description: meta.description
          ? truncate(meta.description, 800)
          : '外部 MCP 服务器提供的工具',
        schema: jsonSchemaToZod(meta.inputSchema),
      },
    ),
  );
}
