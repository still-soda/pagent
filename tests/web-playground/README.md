# Pagent Web Playground

独立的 Vue + Vite 页面，用于在真实网页里演练 Pagent。

组件库为 Element Plus，图标来自 `@element-plus/icons-vue`。

> 页面本身伪装为普通业务站点「星澜工作台」：侧边栏已改为左上角菜单按钮 + 抽屉，
> 页面标题、场景名称与文案均已业务化，避免被测 agent 识别出测试环境。

## 启动

在仓库根目录：

```bash
pnpm dev:playground
```

或在本目录：

```bash
pnpm install
pnpm dev
```

默认打开 [http://localhost:5173](http://localhost:5173)。

## 页面

- **偏好设置**（`preferences`）：隐蔽交互集合，用于检验变化观察工具的覆盖能力。
- **活动报名**（`form`）：技术沙龙报名表，覆盖输入、选择、日期、开关、评分、滑块与校验提交。
- **数据看板**（`chart`）：销售数据看板，覆盖多下拉筛选、可搜索选项与 Chart.js 统计图表。

## 偏好设置页的隐蔽交互清单

| # | 交互 | 隐藏方式 | 预期检测路径 |
|---|------|----------|--------------|
| 1 | 语言下拉菜单 | `opacity: 0` + `pointer-events: none`，DOM 常驻，class 切换 | `visibility_changed`（opacity 检测） |
| 2 | 主题下拉菜单 | `visibility: hidden`，DOM 常驻 | 展开后 `added`（serialize 返回 null → 有记录） |
| 3 | 时区面板 | `max-height: 0` + `overflow: hidden` 折叠 | `visibility_changed`（rect 高度为 0） |
| 4 | 通知开关 | checkbox `opacity: 0` 尺寸 0，label 可见 | 快照中不可见 checkbox + `state_changed` |
| 5 | 高级规则面板 | `max-height: 0` 折叠 + `aria-expanded` | `visibility_changed` + `expanded` 状态变化 |
| 6 | 验证结果条 | `opacity: 0` + `translateY(-8px)`，延迟 1.2s 淡入 | `visibility_changed`（含定时器延迟） |
| 7 | 设备「下线」按钮 | 行内按钮 `opacity: 0`，仅 hover 出现 | 需 hover 后可见；下线后 `removed` |
| 8 | 验证码按钮 | 倒计时期间 `disabled` + 文本每秒变化 | `state_changed` + `text_changed` 流 |
| 9 | 搜索建议面板 | `opacity: 0` + `visibility: hidden`，聚焦出现 | 展开后 `added` |
| 10 | 实验功能开启 | 未勾选风险协议时按钮 `disabled` | `state_changed`（disabled → enabled） |
| 11 | 实验功能面板 | `v-show`（`display: none`） | 开启后 `added` |
| 12 | 活动日志 | IntersectionObserver 懒加载分页 | 滚动后 `added`（新增 li） |
