import { tool } from 'langchain';
import { z } from 'zod';
import { assertNavigableUrl } from '@/shared/contracts/policy';
import { isolateUntrustedPage } from '@/features/agent/runtime/middleware';
import { jsonSchemaToZod } from '@/features/mcp/json-schema-to-zod';
import { safeJson, truncate } from '@/shared/utils/utils';
import type { AgentSettings } from '@/shared/contracts/settings';
import type { McpToolMeta } from '@/shared/contracts/mcp';
import type { MemoryScope } from '@/shared/contracts/memory';
import type { PageChangeSnapshot } from '@/features/page/change-tracker';

export type ToolBridge = {
  tabId: number;
  settings: AgentSettings;
  content: <T>(name: string, payload?: unknown) => Promise<T>;
  /** raw=true 时返回完整未截断的 data URL（供作为图片传给模型） */
  screenshot: (fullPage?: boolean, raw?: boolean) => Promise<string>;
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
    command: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
    input: (payload: { x: number; y: number; type?: string; text?: string }) => Promise<unknown>;
    screenshot: (fullPage?: boolean, raw?: boolean) => Promise<string>;
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

  const observe = tool(
    async ({ reason, maxElements, scope }) => {
      const observation = await bridge.content('dom.observe', { reason, maxElements, scope });
      return isolateUntrustedPage(safeJson(observation, 24_000));
    },
    {
      name: 'observe_page',
      description:
        '建立当前页面的精简语义快照。首次了解页面、页面大范围变化或元素过期时调用；普通操作后优先使用后置条件或 observe_page_changes，不要重复全页观测。scope=auto 时自动聚焦临时交互层；误判常驻导航时用 scope=page 强制整页扫描。',
      schema: z.object({
        reason: z.string().optional().describe('为什么需要重新观测'),
        maxElements: z.number().int().min(10).max(300).optional(),
        scope: z.enum(['auto', 'page', 'interaction']).optional().describe('默认 auto'),
      }),
    },
  );

  const observeChanges = tool(
    async ({ action, watchId, timeoutMs, quietMs, maxChanges }) => {
      if (action === 'start') {
        const baseline = await startChangeWatch();
        return safeJson({
          watchId: baseline.watchId,
          cursor: baseline.cursor,
          message: '已开始观测；执行操作后用同一工具读取变化。',
        });
      }
      const targetId = watchId ?? lastWatchId;
      if (!targetId) {
        return '尚无变化观测基线。请先以 action=start 调用本工具，或先执行一个页面操作。';
      }
      const baseline = changeWatches.get(targetId);
      if (!baseline) return `变化观测 ${targetId} 已过期，请重新开始观测。`;
      const result = await bridge.content('dom.changes.read', {
        baseline,
        timeoutMs,
        quietMs,
        maxChanges,
      });
      changeWatches.delete(targetId);
      if (lastWatchId === targetId) lastWatchId = undefined;
      return isolateUntrustedPage(safeJson(result));
    },
    {
      name: 'observe_page_changes',
      description:
        '读取最近一次页面操作造成的语义变化，包括新增/移除元素、文本、表单状态、可见性、滚动和导航。默认读取最近操作的变化；观测外部异步变化时先用 action=start 留下基线，之后用 action=read。',
      schema: z.object({
        action: z.enum(['start', 'read']).optional().describe('默认 read'),
        watchId: z.string().optional().describe('action=start 返回的观测 ID'),
        timeoutMs: z.number().int().min(0).max(10_000).optional(),
        quietMs: z.number().int().min(50).max(2_000).optional(),
        maxChanges: z.number().int().min(1).max(100).optional(),
      }),
    },
  );

  const search = tool(
    async ({ query, caseSensitive, maxResults, scope }) =>
      isolateUntrustedPage(
        safeJson(await bridge.content('dom.search', {
          query,
          caseSensitive,
          maxResults,
          scope,
        })),
      ),
    {
      name: 'search_page_text',
      description:
        '在当前页面全文搜索文本（类似查找）。返回 snippet、elementId、可见性和坐标。适合 locate observe_page 没列全的正文、按钮或输入值。找到后可用 click_element / scroll_page / highlight_element。',
      schema: z.object({
        query: z.string().min(1).max(200),
        caseSensitive: z.boolean().optional(),
        maxResults: z.number().int().min(1).max(80).optional(),
        scope: z.enum(['auto', 'page', 'interaction']).optional().describe('默认 auto'),
      }),
    },
  );

  const screenshot = tool(
    async ({ fullPage }) => {
      if (!bridge.settings.captureScreenshots) return '用户已关闭截图。';
      // 以图片形式传给模型时取完整（未截断）data URL；否则沿用旧的截断文本返回
      const raw = bridge.settings.screenshotAsImage;
      const dataUrl =
        bridge.settings.executionMode === 'cdp'
          ? await bridge.cdp.screenshot(fullPage, raw)
          : await bridge.screenshot(fullPage, raw);
      if (!bridge.settings.screenshotAsImage) return dataUrl;
      return [
        { type: 'text', text: '截图完成（图片已随本结果提供，可直接查看）。' },
        { type: 'image_url', image_url: { url: dataUrl } },
      ];
    },
    {
      name: 'capture_screenshot',
      description: '截取当前标签页可见区域或整页截图，以图片形式返回（模型可直接查看截图内容）。',
      schema: z.object({ fullPage: z.boolean().optional() }),
    },
  );

  const click = tool(
    async ({ elementId, revision }) =>
      safeJson(await trackAction(() => bridge.content('dom.click', { elementId, revision }))),
    {
      name: 'click_element',
      description: '点击 observe_page 返回的 elementId。点击前会先派发完整的 hover 事件序列（pointerover/mouseover/mouseenter/mousemove），可触发依赖悬停展开的菜单或控件。',
      schema: z.object({
        elementId: z.string(),
        revision: z.number().optional(),
      }),
    },
  );

  const dblclick = tool(
    async ({ elementId, revision }) =>
      safeJson(await trackAction(() => bridge.content('dom.dblclick', { elementId, revision }))),
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
      safeJson(await trackAction(() => bridge.content('dom.hover', { elementId, revision }))),
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
    async ({ elementId, text, mode, submit, revision }) =>
      safeJson(await trackAction(() =>
        bridge.content('dom.type', { elementId, text, mode, submit, revision }),
      )),
    {
      name: 'type_text',
      description:
        '原子设置输入框文本并返回 changed/satisfied。默认 replace，避免“先清空再输入”的竞态；只有明确需要保留原值时才使用 append。',
      schema: z.object({
        elementId: z.string(),
        text: z.string(),
        mode: z.enum(['replace', 'append']).default('replace'),
        submit: z.boolean().optional(),
        revision: z.number().optional(),
      }),
    },
  );

  const clear = tool(
    async ({ elementId, revision }) =>
      safeJson(await trackAction(() => bridge.content('dom.clear', { elementId, revision }))),
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
      safeJson(await trackAction(() =>
        bridge.content('dom.select', { elementId, value, revision }),
      )),
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

  const interact = tool(
    async ({ steps }) =>
      safeJson(await trackAction(() => bridge.content('dom.interact', { steps })), 16_000),
    {
      name: 'interact_elements',
      description:
        '批量执行通用元素交互，并逐项返回 before/after/changed/satisfied。适用于设置值、切换状态、选择选项和激活元素；优先用于多个已知目标，避免逐项往返。',
      schema: z.object({
        steps: z.array(z.object({
          elementId: z.string(),
          intent: z.enum(['activate', 'set-value', 'set-checked', 'choose-option']),
          value: z.union([z.string(), z.boolean(), z.number()]).optional(),
          revision: z.number().int().nonnegative().optional(),
        })).min(1).max(30),
      }),
    },
  );

  const drag = tool(
    async ({ elementId, targetId, revision }) =>
      safeJson(await trackAction(() =>
        bridge.content('dom.drag', { elementId, targetId, revision }),
      )),
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
    async ({ key }) =>
      safeJson(await trackAction(() => bridge.content('dom.press', { key }))),
    {
      name: 'press_key',
      description: '向当前焦点发送按键，例如 Enter、Escape、Tab。',
      schema: z.object({ key: z.string() }),
    },
  );

  const scroll = tool(
    async (payload) =>
      safeJson(await trackAction(() => bridge.content('dom.scroll', payload))),
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
      return safeJson(await trackAction(() => bridge.navigate(url)));
    },
    {
      name: 'navigate',
      description: '导航当前标签页到指定 http/https URL。',
      schema: z.object({ url: z.string() }),
    },
  );

  const back = tool(async () => safeJson(await trackAction(() => bridge.back())), {
    name: 'go_back',
    description: '浏览器后退。',
    schema: z.object({}),
  });

  const forward = tool(async () => safeJson(await trackAction(() => bridge.forward())), {
    name: 'go_forward',
    description: '浏览器前进。',
    schema: z.object({}),
  });

  const reload = tool(async () => safeJson(await trackAction(() => bridge.reload())), {
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
        '执行扩展内置只读脚本：extract_links、extract_headings、extract_forms、extract_meta、page_stats、get_selection。交互目标请直接调用 extract_interactions，不要从这里重复提取。',
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

  const extractInteractions = tool(
    async ({ scope }) => isolateUntrustedPage(
      safeJson(await bridge.content('dom.script', {
        name: 'extract_interactions',
        scope,
      }), 16_000),
    ),
    {
      name: 'extract_interactions',
      description:
        '提取当前页面或已打开临时交互上下文中的可操作目标、当前状态、可用动作和选项，适合在多字段任务开始时一次建立目标账本。临时层被误判时用 scope=page。',
      schema: z.object({
        scope: z.enum(['auto', 'page', 'interaction']).optional().describe('默认 auto'),
      }),
    },
  );

  const inspectElementTree = tool(
    async (payload) => isolateUntrustedPage(
      safeJson(await bridge.content('dom.elementTree', payload), 48_000),
    ),
    {
      name: 'inspect_element_tree',
      description:
        '把 observe_page 返回的根 elementId 转成轻量缩进文本树。每行只标注标签和语义角色；fields 可选择附带直接文本、视口坐标或指定 DOM 属性。maxDepth 超出的子树以 more-level 标注剩余层数，maxLength 超出的标签以 more-label 标注剩余标签数。',
      schema: z.object({
        elementId: z.string().describe('observe_page 或 search_page_text 返回的元素 ID'),
        revision: z.number().int().nonnegative().optional(),
        fields: z.object({
          text: z.boolean().optional().describe('附带元素的直接文本，叶子元素附带完整文本'),
          coordinates: z.boolean().optional().describe('附带 x,y,width,height 视口坐标'),
          attributes: z.array(
            z.string().regex(/^[A-Za-z_:][A-Za-z0-9:._-]*$/),
          ).max(20).optional().describe('要附带的 DOM 属性名，如 aria-label、data-testid'),
        }).optional(),
        maxDepth: z.number().int().min(0).max(20).optional().describe('最大深度，根元素为第 0 层，默认 4'),
        maxLength: z.number().int().min(2).max(2_000).optional().describe('最大输出标签数，默认 120'),
      }),
    },
  );

  const commonAncestor = tool(
    async ({ elementIds, revision }) =>
      safeJson(await bridge.content('dom.commonAncestor', { elementIds, revision })),
    {
      name: 'find_common_ancestor',
      description:
        '传入多个 elementId，快速返回它们在 DOM 树（含 Shadow DOM）中的最近共同祖先元素。返回的 elementId 已注册，可直接配合 inspect_element_tree 查看该共同容器的局部结构，适合定位多个控件共同的表单、卡片或弹窗容器。',
      schema: z.object({
        elementIds: z.array(z.string()).min(2).max(20).describe('两个或更多元素 ID'),
        revision: z.number().int().nonnegative().optional(),
      }),
    },
  );

  const cdpScript = tool(
    async ({ expression, awaitPromise }) =>
      truncate(
        safeJson(await trackAction(() => bridge.cdp.script(expression, awaitPromise))),
        6000,
      ),
    {
      name: 'execute_cdp_script',
      description:
        '通过 CDP Runtime.evaluate 在当前标签页执行 JavaScript 表达式，可 awaitPromise。结构化工具（observe_page、extract_interactions 等）满足需求时优先用结构化工具。',
      schema: z.object({
        expression: z.string(),
        awaitPromise: z.boolean().optional(),
      }),
    },
  );

  const cdpCommand = tool(
    async ({ method, params }) =>
      truncate(
        safeJson(await trackAction(() => bridge.cdp.command(method, params))),
        8000,
      ),
    {
      name: 'execute_cdp_command',
      description:
        '直接向当前标签页发送任意 Chrome DevTools Protocol 命令（method + params，如 DOM.getDocument、Emulation.setDeviceMetricsOverride、Input.dispatchMouseEvent 等），返回 CDP 结果。需要 debugger 权限；结构化工具满足需求时优先用结构化工具。',
      schema: z.object({
        method: z.string().regex(/^[A-Za-z]+\.[A-Za-z]+$/).describe('CDP 域和方法名，例如 Page.captureScreenshot'),
        params: z.record(z.string(), z.unknown()).optional().describe('该方法对应的 CDP 参数对象'),
      }),
    },
  );

  const cdpClick = tool(
    async ({ x, y }) => {
      if (bridge.settings.executionMode !== 'cdp') {
        return '当前为 DOM 模式。如需坐标级输入，请在设置中切换到 CDP。';
      }
      return safeJson(
        await trackAction(() => bridge.cdp.input({ x, y, type: 'click' })),
      );
    },
    {
      name: 'cdp_click_xy',
      description: '使用 CDP 在视口坐标点击，更接近真实输入。',
      schema: z.object({
        x: z.number(),
        y: z.number(),
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
        '主动检索与当前任务相关的长期记忆。会同时搜索全局记忆和当前域名的局部记忆，返回记忆 ID 供后续修改。query 应使用一个完整自然语言问题，不要使用空格分隔的关键词串。',
      schema: z.object({
        query: z.string().min(1).max(4000).describe('一个完整自然语言问题'),
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
        '以 QA 格式写入一条长期记忆：“Q: 一个完整问题”后接“A: 答案或经验”。每次调用只能包含一组 QA；多个问题必须分别调用本工具，创建多条独立记忆。scope=global 适用于跨网站经验，scope=local 仅用于当前域名并自动记录脱敏 URL。传 memoryId 可修改已有记忆。',
      schema: z.object({
        content: z.string().min(1).max(8000).describe('仅一组 QA：Q: 一个完整问题，后接 A: 答案或经验'),
        scope: z.enum(['global', 'local']),
        memoryId: z.string().optional().describe('修改 memory_search 返回的已有记忆 ID'),
      }),
    },
  );

  const builtinTools = [
    observe,
    observeChanges,
    search,
    screenshot,
    click,
    dblclick,
    hover,
    typeText,
    clear,
    select,
    interact,
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
    extractInteractions,
    inspectElementTree,
    commonAncestor,
    namedScript,
    cdpScript,
    cdpCommand,
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
