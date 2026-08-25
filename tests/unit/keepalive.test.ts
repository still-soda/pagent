import { describe, expect, it } from 'vitest';
import { isTransientRuntimeError, shouldRetryRpc } from '../../lib/keepalive';

describe('service worker keepalive', () => {
  it('retries only when the background worker was asleep', () => {
    expect(isTransientRuntimeError(new Error('Could not establish connection. Receiving end does not exist.'))).toBe(
      true,
    );
    expect(isTransientRuntimeError(new Error('The message port closed before a response was received.'))).toBe(
      true,
    );
    expect(isTransientRuntimeError(new Error('密钥未配置'))).toBe(false);
  });

  it('does not retry agent start/stop even if the port closed', () => {
    const closed = new Error('The message port closed before a response was received.');
    expect(shouldRetryRpc('agent.start', closed)).toBe(false);
    expect(shouldRetryRpc('agent.stop', closed)).toBe(false);
    expect(shouldRetryRpc('settings.get', closed)).toBe(true);
  });
});
