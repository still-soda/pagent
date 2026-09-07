import { tool } from 'langchain';
import { z } from 'zod';
import { safeJson } from '@/shared/utils/utils';
import type { ToolBridge, TrackActionFn } from './types';

export function createInteractionTools(bridge: ToolBridge, trackAction: TrackActionFn) {
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

  return [
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
  ];
}
