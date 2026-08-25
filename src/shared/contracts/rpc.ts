import { z } from 'zod';
import { API_PROTOCOLS, PROVIDER_IDS } from './settings';
import { NAMED_SCRIPTS, SOURCE_TYPES } from './page';
import { CHANNEL } from './channel';

export { CHANNEL } from './channel';

export const elementRefSchema = z.object({
  elementId: z.string(),
  revision: z.number().int().nonnegative().optional(),
});

export const observePayloadSchema = z.object({
  reason: z.string().optional(),
  maxElements: z.number().int().min(1).max(400).optional(),
});

export const searchPayloadSchema = z.object({
  query: z.string().min(1).max(200),
  caseSensitive: z.boolean().optional(),
  maxResults: z.number().int().min(1).max(80).optional(),
});

export const typePayloadSchema = elementRefSchema.extend({
  text: z.string(),
  clear: z.boolean().optional(),
  submit: z.boolean().optional(),
});

export const keyPayloadSchema = z.object({
  key: z.string().min(1),
  revision: z.number().int().nonnegative().optional(),
});

export const scrollPayloadSchema = z.object({
  elementId: z.string().optional(),
  direction: z.enum(['up', 'down', 'left', 'right', 'top', 'bottom']).optional(),
  amount: z.number().optional(),
  revision: z.number().int().nonnegative().optional(),
});

export const waitPayloadSchema = z.object({
  ms: z.number().int().min(0).max(30_000).optional(),
  text: z.string().optional(),
  elementId: z.string().optional(),
  urlIncludes: z.string().optional(),
});

export const namedScriptPayloadSchema = z.object({
  name: z.enum(NAMED_SCRIPTS),
});

export const sourcePayloadSchema = z.object({
  type: z.enum(SOURCE_TYPES).optional(),
  grep: z.string().min(1).max(300).optional(),
  regex: z.boolean().optional(),
  caseSensitive: z.boolean().optional(),
  limit: z.number().int().min(1).max(400).optional(),
  offset: z.number().int().min(0).max(1_000_000).optional(),
});

export const navigatePayloadSchema = z.object({
  url: z.string().min(1),
});

export const tabPayloadSchema = z.object({
  tabId: z.number().int().optional(),
  url: z.string().optional(),
});

export const cdpScriptPayloadSchema = z.object({
  expression: z.string().min(1).max(20_000),
  awaitPromise: z.boolean().optional(),
});

export const cdpInputPayloadSchema = z.object({
  x: z.number(),
  y: z.number(),
  type: z.enum(['click', 'move', 'down', 'up']).default('click'),
  button: z.enum(['left', 'right', 'middle']).optional(),
  text: z.string().optional(),
});

export const networkLogPayloadSchema = z.object({
  urlIncludes: z.string().optional(),
  method: z.string().optional(),
  resourceType: z.string().optional(),
  failedOnly: z.boolean().optional(),
  includeNoise: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const consoleLogPayloadSchema = z.object({
  level: z.string().optional(),
  textIncludes: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const networkRequestPayloadSchema = z.object({
  requestId: z.string().min(1),
  includeBody: z.boolean().optional(),
});

export const llmTestPayloadSchema = z.object({
  provider: z.enum(PROVIDER_IDS),
  model: z.string(),
  baseURL: z.string().optional(),
  apiProtocol: z.enum(API_PROTOCOLS).optional(),
});

export const rpcSchemas = {
  'dom.observe': observePayloadSchema,
  'dom.search': searchPayloadSchema,
  'dom.click': elementRefSchema,
  'dom.dblclick': elementRefSchema,
  'dom.hover': elementRefSchema,
  'dom.focus': elementRefSchema,
  'dom.highlight': elementRefSchema,
  'dom.type': typePayloadSchema,
  'dom.clear': elementRefSchema,
  'dom.select': elementRefSchema.extend({ value: z.string() }),
  'dom.drag': elementRefSchema.extend({ targetId: z.string() }),
  'dom.press': keyPayloadSchema,
  'dom.scroll': scrollPayloadSchema,
  'dom.wait': waitPayloadSchema,
  'dom.script': namedScriptPayloadSchema,
  'page.info': z.object({}),
  'page.source': sourcePayloadSchema,
  'page.navigate': navigatePayloadSchema,
  'page.back': z.object({}),
  'page.forward': z.object({}),
  'page.reload': z.object({}),
  'tabs.query': z.object({}),
  'tabs.snapshot': z.object({
    tabIds: z.array(z.number().int()).min(1).max(8),
  }),
  'tabs.create': z.object({ url: z.string().optional() }),
  'tabs.switch': tabPayloadSchema,
  'tabs.close': tabPayloadSchema,
  'screenshot.capture': z.object({
    fullPage: z.boolean().optional(),
    raw: z.boolean().optional(),
  }),
  'permissions.get': z.object({}),
  'permissions.request': z.object({
    allSites: z.boolean().optional(),
    debugger: z.boolean().optional(),
    tabs: z.boolean().optional(),
    origins: z.array(z.string()).optional(),
  }),
  'cdp.attach': z.object({}),
  'cdp.detach': z.object({}),
  'cdp.script': cdpScriptPayloadSchema,
  'cdp.input': cdpInputPayloadSchema,
  'cdp.screenshot': z.object({ fullPage: z.boolean().optional() }),
  'cdp.network': networkLogPayloadSchema,
  'cdp.console': consoleLogPayloadSchema,
  'cdp.networkRequest': networkRequestPayloadSchema,
  'settings.get': z.object({}),
  'settings.set': z.object({}).passthrough(),
  'secrets.set': z.object({
    provider: z.enum(PROVIDER_IDS),
    apiKey: z.string(),
  }),
  'secrets.clear': z.object({
    provider: z.enum(PROVIDER_IDS).optional(),
  }),
  'secrets.has': z.object({}),
  'llm.test': llmTestPayloadSchema,
  'agent.start': z.object({
    prompt: z.string().min(1),
    context: z.string().optional(),
    imageDataUrl: z.string().startsWith('data:image/').optional(),
    tabId: z.number().int().optional(),
    conversationId: z.string().optional(),
    history: z.array(z.any()).optional(),
  }),
  'agent.stop': z.object({
    tabId: z.number().int().optional(),
  }),
  'agent.toggle': z.object({}),
  'session.context': z.object({
    url: z.string().optional(),
  }),
  'session.setUi': z.object({
    panelOpen: z.boolean(),
  }),
  'session.saveStore': z.object({
    activeId: z.string(),
    conversations: z.array(z.any()),
    panelOpen: z.boolean().optional(),
    sessionId: z.string().optional(),
    revision: z.number().int().nonnegative().optional(),
    deletedConversationIds: z.array(z.string()).optional(),
    url: z.string().optional(),
  }),
} as const;

export type RpcName = keyof typeof rpcSchemas;

export type RpcRequest<K extends RpcName = RpcName> = {
  channel: typeof CHANNEL;
  kind: 'rpc';
  id: string;
  name: K;
  payload: z.infer<(typeof rpcSchemas)[K]>;
};

export type RpcResponse = {
  channel: typeof CHANNEL;
  kind: 'rpc-result';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: { code: string; message: string };
};

export function parseRpcPayload<K extends RpcName>(
  name: K,
  payload: unknown,
): z.infer<(typeof rpcSchemas)[K]> {
  return rpcSchemas[name].parse(payload) as z.infer<(typeof rpcSchemas)[K]>;
}

export function isRpcRequest(value: unknown): value is RpcRequest {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return item.channel === CHANNEL && item.kind === 'rpc' && typeof item.name === 'string';
}
