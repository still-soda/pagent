import { beforeEach, describe, expect, it } from 'vitest';
import { applySettingsPatch, DEFAULT_SETTINGS } from '@/shared/contracts/settings';
import { loadSettings, saveSettings, settingsItem } from '@/shared/storage/storage';

describe('applySettingsPatch', () => {
  it('keeps custom model, URL and protocol when switching providers and back', () => {
    const customized = applySettingsPatch(DEFAULT_SETTINGS, {
      model: {
        provider: 'openai',
        model: 'gpt-4.1',
        baseURL: 'https://proxy.example/v1',
        apiProtocol: 'responses',
      },
    });
    const other = applySettingsPatch(customized, { model: { provider: 'anthropic' } });
    expect(other.model).toMatchObject({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
    });
    expect(other.model.baseURL).toBeUndefined();
    expect(other.providerProfiles.openai).toEqual({
      model: 'gpt-4.1',
      baseURL: 'https://proxy.example/v1',
      apiProtocol: 'responses',
    });

    const restored = applySettingsPatch(other, { model: { provider: 'openai' } });
    expect(restored.model).toMatchObject({
      provider: 'openai',
      model: 'gpt-4.1',
      baseURL: 'https://proxy.example/v1',
      apiProtocol: 'responses',
    });
  });

  it('uses the provider preset the first time a provider is selected', () => {
    const next = applySettingsPatch(DEFAULT_SETTINGS, { model: { provider: 'moonshot' } });
    expect(next.model).toMatchObject({
      provider: 'moonshot',
      model: 'kimi-k2-0711-preview',
      apiProtocol: 'chat-completions',
    });
    expect(next.model.baseURL).toBeUndefined();
  });

  it('updates the active provider profile when URL changes', () => {
    const next = applySettingsPatch(DEFAULT_SETTINGS, {
      model: { baseURL: 'https://custom.openai/v1' },
    });
    expect(next.model.baseURL).toBe('https://custom.openai/v1');
    expect(next.providerProfiles.openai?.baseURL).toBe('https://custom.openai/v1');
  });

  it('clears custom profiles when restoring defaults', () => {
    const customized = applySettingsPatch(DEFAULT_SETTINGS, {
      model: { provider: 'ollama', model: 'llama3.1:8b', baseURL: 'http://127.0.0.1:11434/v1' },
    });
    const reset = applySettingsPatch(customized, {
      ...DEFAULT_SETTINGS,
      model: { ...DEFAULT_SETTINGS.model, baseURL: undefined },
      providerProfiles: {},
    });
    expect(reset.model).toEqual(DEFAULT_SETTINGS.model);
    expect(reset.providerProfiles).toEqual({
      openai: { model: 'gpt-4o-mini', apiProtocol: 'chat-completions' },
    });
  });

  it('does not leak the previous provider URL onto a native SDK provider', () => {
    const withUrl = applySettingsPatch(DEFAULT_SETTINGS, {
      model: { baseURL: 'https://proxy.example/v1' },
    });
    const anthropic = applySettingsPatch(withUrl, { model: { provider: 'anthropic' } });
    expect(anthropic.model.baseURL).toBeUndefined();
  });
});

describe('settings persistence', () => {
  beforeEach(async () => {
    await settingsItem.setValue(DEFAULT_SETTINGS);
  });

  it('persists per-provider model settings across save/load', async () => {
    await saveSettings({
      model: { model: 'gpt-4o', baseURL: 'https://gateway.example/v1', apiProtocol: 'responses' },
    });
    await saveSettings({ model: { provider: 'ollama' } });
    await saveSettings({ model: { model: 'qwen3:8b', baseURL: 'http://127.0.0.1:11434/v1' } });

    const ollama = await loadSettings();
    expect(ollama.model).toMatchObject({
      provider: 'ollama',
      model: 'qwen3:8b',
      baseURL: 'http://127.0.0.1:11434/v1',
    });

    await saveSettings({ model: { provider: 'openai' } });
    const openai = await loadSettings();
    expect(openai.model).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o',
      baseURL: 'https://gateway.example/v1',
      apiProtocol: 'responses',
    });
  });

  it('seeds the current provider profile from existing stored model settings', async () => {
    await settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      model: {
        provider: 'qwen',
        model: 'qwen-max',
        baseURL: 'https://dashscope.example/v1',
        apiProtocol: 'chat-completions',
        persistKey: true,
      },
      providerProfiles: {},
    });
    const loaded = await loadSettings();
    expect(loaded.providerProfiles.qwen).toEqual({
      model: 'qwen-max',
      baseURL: 'https://dashscope.example/v1',
      apiProtocol: 'chat-completions',
    });
  });
});
