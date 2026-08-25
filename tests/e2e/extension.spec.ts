import { test, expect, chromium } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const extensionPath = path.resolve('dist');

test('production build includes the content script and permissions', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8'),
  ) as {
    manifest_version: number;
    content_scripts?: Array<{ js?: string[]; matches?: string[] }>;
    permissions?: string[];
    host_permissions?: string[];
  };
  expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(['storage', 'unlimitedStorage', 'scripting', 'activeTab', 'debugger']),
    );
  expect(manifest.host_permissions).toEqual(expect.arrayContaining(['<all_urls>']));
  expect(manifest.content_scripts?.[0]?.js).toEqual(expect.arrayContaining(['content-scripts/content.js']));
  expect(fs.existsSync(path.join(extensionPath, 'content-scripts/content.js'))).toBe(true);
  expect(fs.existsSync(path.join(extensionPath, 'background.js'))).toBe(true);
});

test('opens an empty composer at its collapsed height', async ({ baseURL }) => {
  test.skip(!baseURL, '需要本地 fixture 服务');
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pagent-e2e-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 15_000 }));
    const page = await context.newPage();
    await page.goto(`${baseURL}/static.html`);
    await expect(page.locator('pagent-root')).toBeAttached({ timeout: 15_000 });
    await page.getByLabel('打开 Pagent').click();

    const prompt = page.getByLabel('Prompt');
    await expect(prompt).toBeVisible();
    const promptBox = await prompt.boundingBox();
    const composerBox = await prompt.locator('..').locator('..').boundingBox();
    expect(promptBox?.height).toBe(28);
    expect(composerBox?.height).toBeLessThanOrEqual(44);

    await page.getByLabel('添加内容').click();
    await page.getByText('标记屏幕', { exact: true }).click();
    await expect(page.getByLabel('屏幕标记画布')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('确认标记')).toBeEnabled();
    await page.getByLabel('取消标记').click();
    await expect(prompt).toBeVisible();
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test('loads the in-page agent on a static page', async ({ baseURL }) => {
  test.skip(!baseURL, '需要本地 fixture 服务');
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pagent-e2e-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const worker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 15_000 }));
    expect(worker.url()).toContain('chrome-extension://');

    const page = await context.newPage();
    await page.goto(`${baseURL}/static.html`);
    const host = page.locator('pagent-root');
    await expect(host).toBeAttached({ timeout: 15_000 });
    await expect(page.getByLabel('打开 Pagent')).toBeVisible();
    await expect(page.getByLabel('Prompt')).not.toBeVisible();
    await page.locator('#hello').click();
    await expect(page.locator('#out')).toHaveText('你好，世界');
    await page.getByLabel('打开 Pagent').click();
    await expect(host).toContainText('会话 1');
    await page.getByLabel('新建会话').click();
    await expect(host).toContainText('会话 2');
    await page.waitForTimeout(200);
    await page.reload();
    await expect(page.locator('pagent-root')).toContainText('会话 2', { timeout: 15_000 });
    await page.getByLabel('历史会话').click();
    await expect(host).toContainText('历史会话');
    await expect(host).toContainText('会话 1');
    await page.getByLabel('关闭历史').first().click();
    await page.getByLabel('设置').click();
    await expect(host).toContainText('模型');
    await expect(host).toContainText('发送截图给模型');
    await expect(host).toContainText('采集网络请求和控制台日志');
    await expect(page.getByLabel('服务商')).toBeVisible();
    await page.getByLabel('服务商').click();
    await expect(page.getByRole('option', { name: 'DeepSeek' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.screenshot({
      path: 'test-results/settings-switches.png',
      fullPage: true,
    });
    const switches = page.getByRole('switch');
    await expect(switches).toHaveCount(5);
    for (const item of await switches.all()) {
      const box = await item.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.width).toBeGreaterThanOrEqual(36);
      expect(box!.height).toBeGreaterThanOrEqual(20);
    }
    await page.getByLabel('关闭', { exact: true }).click();
    await expect(page.getByLabel('打开 Pagent')).toBeVisible();
    await expect(page.getByLabel('Prompt')).not.toBeVisible();
    await page.locator('input[name="name"]').fill('Pagent');
    await page.locator('#hello').click();
    await expect(page.locator('#out')).toHaveText('你好，Pagent');
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test('records a teaching flow across reload and saves a vault command', async ({ baseURL }) => {
  test.skip(!baseURL, '需要本地 fixture 服务');
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pagent-teaching-e2e-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 15_000 }));
    const page = await context.newPage();
    await page.goto(`${baseURL}/static.html`);
    await expect(page.locator('pagent-root')).toBeAttached({ timeout: 15_000 });
    await page.getByLabel('打开 Pagent').click();
    await page.getByLabel('添加内容').click();
    await page.getByText('开始示教', { exact: true }).click();

    const orb = page.getByLabel('打开示教控制');
    await expect(orb).toBeVisible();
    await page.locator('input[name="name"]').fill('示教用户');
    await page.locator('#hello').click();
    await page.reload();
    await expect(page.getByLabel('打开示教控制')).toBeVisible({ timeout: 15_000 });

    await page.getByLabel('打开示教控制').click();
    await page.getByText('结束并总结', { exact: true }).click();
    await expect(page.getByLabel('示教流程确认')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/条记录/)).toBeVisible();

    const prompt = page.getByLabel('Prompt');
    await prompt.fill('把流程名称改得更简短');
    await prompt.press('Enter');
    await expect(page.getByText(/已调整/)).toBeVisible({ timeout: 15_000 });
    await page.getByText('确认并固化', { exact: true }).click();
    const savedAlert = page.getByText(/已固化到当前网站 Vault/);
    await expect(savedAlert).toBeVisible();
    await expect(savedAlert).not.toBeVisible({ timeout: 7_000 });

    await prompt.fill('/');
    const commandRow = page.getByText('操作流程', { exact: false }).first();
    await expect(commandRow).toBeVisible();
    await commandRow.click();
    await expect(prompt).toHaveValue('');
    await expect(page.getByLabel(/移除命令/)).toBeVisible();
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
