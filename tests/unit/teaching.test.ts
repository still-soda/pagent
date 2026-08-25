import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTeachingRecorder,
  sanitizeRecordedUrl,
  stableSelector,
} from '@/features/teaching/content/recorder';
import {
  commandKey,
  createDetailedFallbackDraft,
} from '@/features/teaching/background/flow-summarizer';
import {
  clearTeachingSession,
  loadCommands,
  loadTeachingSession,
  saveCommand,
  saveTeachingSession,
} from '@/features/teaching/storage';
import { resetSessionStorageForTests } from '@/shared/storage/storage';
import type { SavedCommand, TeachingSession } from '@/shared/contracts/teaching';

describe('teaching recorder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/form?token=secret&view=all');
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('removes credentials and sensitive query values from recorded URLs', () => {
    expect(sanitizeRecordedUrl('https://me:pass@example.com/a?token=abc&view=all')).toBe(
      'https://example.com/a?token=%5Bredacted%5D&view=all',
    );
  });

  it('prefers semantic attributes for stable selectors', () => {
    const button = document.createElement('button');
    button.dataset.testid = 'save';
    document.body.append(button);
    expect(stableSelector(button)).toBe('button[data-testid="save"]');
  });

  it('records clicks and hides password input values', async () => {
    const emitted: Array<{ kind: string; value?: string; redacted?: boolean }> = [];
    const recorder = createTeachingRecorder((actions) => emitted.push(...actions));
    const button = document.createElement('button');
    button.textContent = '保存';
    const password = document.createElement('input');
    password.type = 'password';
    password.value = 'very-secret';
    document.body.append(button, password);

    recorder.start();
    button.click();
    password.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(700);
    recorder.stop();

    expect(emitted).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'click' }),
      expect.objectContaining({ kind: 'input', value: '[redacted]', redacted: true }),
    ]));
  });
});

describe('teaching storage', () => {
  beforeEach(resetSessionStorageForTests);
  afterEach(resetSessionStorageForTests);

  it('persists an active session across content reloads', async () => {
    const session: TeachingSession = {
      id: 'teach-1',
      status: 'recording',
      originTabId: 2,
      originUrl: 'https://example.com/start',
      originDomain: 'example.com',
      tabIds: [2],
      actions: [],
      startedAt: 1,
      updatedAt: 1,
    };
    await saveTeachingSession(session);
    await expect(loadTeachingSession()).resolves.toEqual(session);
    await clearTeachingSession();
    await expect(loadTeachingSession()).resolves.toBeNull();
  });

  it('keeps saved commands isolated by origin vault domain', async () => {
    const command: SavedCommand = {
      id: 'cmd-1',
      vaultDomain: 'example.com',
      originUrl: 'https://example.com/start',
      name: '提交日报',
      key: 'daily-report',
      desc: '提交日报表单',
      prompt: '请协助我提交日报。',
      steps: [],
      createdAt: 1,
      updatedAt: 1,
    };
    await saveCommand(command);
    await expect(loadCommands('example.com')).resolves.toEqual([command]);
    await expect(loadCommands('other.example')).resolves.toEqual([]);
  });
});

describe('teaching command keys', () => {
  it('normalizes generated slash command keys', () => {
    expect(commandKey(' Daily_Report! ')).toBe('daily-report');
    expect(commandKey('填写 日报')).toBe('填写-日报');
  });

  it('keeps page, target and entered value details in fallback summaries', () => {
    const draft = createDetailedFallbackDraft({
      id: 'teach-detailed',
      status: 'summarizing',
      originTabId: 1,
      originUrl: 'https://example.com/form',
      originDomain: 'example.com',
      tabIds: [1],
      actions: [{
        id: 'a1',
        at: 1,
        kind: 'input',
        page: { url: 'https://example.com/form', title: '申请表' },
        target: {
          tag: 'input',
          name: '项目名称',
          placeholder: '请输入项目名',
          selector: 'input[name="project"]',
        },
        value: 'Pagent',
      }],
      startedAt: 1,
      updatedAt: 2,
    });
    expect(draft.steps[0]?.detail).toContain('项目名称');
    expect(draft.steps[0]?.detail).toContain('https://example.com/form');
    expect(draft.steps[0]?.detail).toContain('值=Pagent');
    expect(draft.steps[0]?.detail).toContain('input[name="project"]');
  });
});
