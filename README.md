# Pagent

页面内浏览器 Agent。它以 Shadow DOM 悬浮面板的形式生活在当前网页中，使用 LangChain.js 调用你本地配置的模型，并对页面执行观测、点击、输入、滚动、导航、截图和可选的 CDP 高级操作。

## 技术栈

- Chromium Manifest V3 + [WXT](https://wxt.dev/)
- React + TypeScript + Tailwind CSS + shadcn 风格组件
- UI 直接使用 [Beautiful UI](https://www.beautifului.dev/) 的 Chat、Prompt Bar、Thinking、Streaming Text、Tool Chips、Task Rows、Context Cards 等 MIT 示例组件
- LangChain.js `createAgent` + Zod 工具

## 目录结构

```
src/
  entrypoints/          # WXT 入口（background、content、options、popup）
  features/
    agent/              # Agent 后台、runtime、会话领域、UI
    page/               # 页面观测/操作与 content 命令
    settings/           # 设置面板
  shared/
    browser/            # tabs、CDP、截图、权限
    contracts/          # RPC schema 与领域类型（settings/page/session/agent）
    extension/          # rpc、keepalive、theme、hotkey 等扩展基础设施
    storage/            # chrome.storage 与 IndexedDB
    ui/                 # 通用 UI 与 Beautiful UI 原语
    utils/
  assets/               # 样式与静态资源
public/                 # WXT public（图标等，保持根目录）
tests/unit              # 单元测试
tests/e2e               # Playwright E2E（fixtures 在 tests/e2e/fixtures）
```

## 开发

```bash
pnpm install
pnpm dev
```

Chrome 会打开并自动加载扩展。也可手动打开 `chrome://extensions`，启用开发者模式，加载 `dist`。

```bash
pnpm compile
pnpm test
pnpm build   # 产物输出到 dist/
pnpm test:e2e
```

## 首次使用

1. 打开任意 http/https 页面，右下角会出现 Pagent。按 `Alt+P` 可呼出或隐藏面板，也可在 `chrome://extensions/shortcuts` 修改快捷键。
2. 在设置中选择 OpenAI / Anthropic / Google / DeepSeek / OpenAI Compatible，写入 API Key。OpenAI 和兼容端点可切换 Chat Completions 或 `/responses` API；DeepSeek 使用 Chat Completions 以保留流式思考内容。
3. 密钥写入 `chrome.storage.local`，关闭浏览器后仍保留。
4. 直接发送任务即可全自动执行。面板顶部始终保留停止按钮。

## 能力

- 语义 DOM 观测、页面源码（DOM/原始 HTML/正文/链接/脚本/样式表，支持 grep 与分页）、页面文本搜索、选区、iframe 标记、元素 `elementId` + revision
- 会话按网站域名写入本地 Vault：会话期间导航到的每个域名都会归档当前会话，且只有对应站点的 Vault 能看到这些会话；会话与 Vault 存在 IndexedDB，扩展更新或浏览器重启后仍保留
- 同一标签页内跳转会继续当前任务；新页面只展示当前域名 Vault 里的会话
- 点击、双击、悬停、输入、清空、选择、按键、滚动、等待、高亮
- 导航、前进后退、刷新、标签页创建/切换/关闭
- 可见区域截图；启用 CDP 后支持整页截图和坐标级输入
- 网络请求与控制台日志（CDP `Network` / `Runtime` / `Log`，任务开始时 attach 并缓冲）
- 内置命名脚本：链接、标题、表单、meta、页面统计、选区
- 可选 `execute_cdp_script`，仅在设置中明确开启

## 权限与边界

- 基础权限：`storage`、`unlimitedStorage`、`scripting`、`activeTab`、`debugger`，以及页面注入所需的 http/https 主机权限
- 可选权限：`tabs`、`downloads`
- 无法注入 `chrome://`、扩展商店等受保护页面
- 验证码、支付、密码页、文件选择器和浏览器原生弹窗无法保证自动化
- 网页文本会被当作不可信观察数据，不会当作指令执行
- MV3 禁止扩展自身 `eval` 远程代码；任意表达式只通过用户启用的 CDP 在当前被调试页面执行，并会显示浏览器调试提示

## 手动验收

- [ ] 普通网页显示悬浮按钮和面板
- [ ] 未配置密钥时给出明确错误
- [ ] 配置密钥后能观察页面并点击/输入
- [ ] 停止按钮能中断当前任务
- [ ] 设置页可申请 CDP / 标签页权限
- [ ] 开启采集后，Agent 能读到页面网络请求和控制台输出
- [ ] 刷新后会话检查点可恢复最近状态
- [ ] 点击站内链接跳转后，同一标签页仍保留会话且任务能继续
- [ ] 会话里导航到另一个域名后，两边的 Vault 都能看到该会话
- [ ] 从未访问过的网站看不到其他站点的会话
- [ ] 重启浏览器或重新加载扩展后，当前网站 Vault 里的会话仍在

## 许可

项目代码默认按仓库许可分发。Beautiful UI 示例源码遵循 MIT，版权声明见 [LICENSES/beautiful-ui.txt](LICENSES/beautiful-ui.txt)。
