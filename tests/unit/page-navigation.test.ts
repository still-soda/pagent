import { describe, expect, it, vi } from 'vitest';
import {
  installPageNavigationEvents,
  PAGE_NAVIGATION_EVENT,
} from '../../lib/page-navigation';

describe('page navigation events', () => {
  it('notifies after pushState and replaceState commit the new URL', async () => {
    const urls: string[] = [];
    window.addEventListener(PAGE_NAVIGATION_EVENT, () => urls.push(location.href));
    installPageNavigationEvents();

    history.pushState({}, '', '/first');
    await vi.waitFor(() => expect(urls.at(-1)).toContain('/first'));
    history.replaceState({}, '', '/second');
    await vi.waitFor(() => expect(urls.at(-1)).toContain('/second'));
  });
});
