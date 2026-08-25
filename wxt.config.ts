import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  outDir: 'dist',
  outDirTemplate: '.',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Pagent',
    description: '页面内浏览器 Agent，可观测并操作当前网页',
    minimum_chrome_version: '125',
    permissions: ['storage', 'unlimitedStorage', 'scripting', 'activeTab', 'debugger'] as unknown as (
      | 'storage'
      | 'unlimitedStorage'
      | 'scripting'
      | 'activeTab'
    )[],
    optional_permissions: ['tabs', 'downloads'],
    optional_host_permissions: [
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
      'https://generativelanguage.googleapis.com/*',
      'https://api.deepseek.com/*',
    ],
    host_permissions: ['https://*/*', 'http://*/*'],
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
    action: {
      default_title: 'Pagent',
      default_icon: {
        16: 'icon-16.png',
        32: 'icon-32.png',
        48: 'icon-48.png',
        128: 'icon-128.png',
      },
    },
    options_ui: {
      open_in_tab: true,
    },
    commands: {
      'toggle-pagent': {
        suggested_key: {
          default: 'Alt+P',
          mac: 'Alt+P',
        },
        description: '显示或隐藏 Pagent',
      },
    },
  },
});
