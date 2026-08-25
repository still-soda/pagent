import { CHANNEL } from '@/shared/contracts/channel';
import type { RpcName, RpcRequest, RpcResponse } from '@/shared/contracts/rpc';
import { shouldRetryRpc } from '@/shared/extension/keepalive';
import { nowId } from '@/shared/utils/utils';

async function sendRpc<K extends RpcName>(
  name: K,
  payload: RpcRequest<K>['payload'],
): Promise<RpcResponse> {
  const request: RpcRequest<K> = {
    channel: CHANNEL,
    kind: 'rpc',
    id: nowId('rpc'),
    name,
    payload,
  };
  const response = (await browser.runtime.sendMessage(request)) as RpcResponse | undefined;
  if (!response) {
    throw new Error('Could not establish connection. Receiving end does not exist.');
  }
  return response;
}

export async function rpc<K extends RpcName>(
  name: K,
  payload: RpcRequest<K>['payload'] = {} as RpcRequest<K>['payload'],
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await sendRpc(name, payload);
      if (!response.ok) {
        throw new Error(response.error?.message ?? `RPC 失败：${name}`);
      }
      return response.result;
    } catch (error) {
      lastError = error;
      if (!shouldRetryRpc(name, error) || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 80 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`RPC 失败：${name}`);
}
