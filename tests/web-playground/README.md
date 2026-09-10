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

判定函数的单元测试：

```bash
pnpm --dir tests/web-playground test
```

## 任务判定

任务提示（自然指令 + 验收步骤）是阅后即焚：复制发给 Agent 后关掉即可，避免 Agent 看到答案。判定入口藏在左上角菜单抽屉底部：打开「星澜工作台」侧栏，用 **验证完成情况** / **重置场景**。判定只看页面终态，分条给出通过 / 失败 / 无法判定。不要让 Agent 去点这两个按钮。

脚本入口（当前页）：

```js
window.__pagentOracle.getSceneId()
window.__pagentOracle.verify()
window.__pagentOracle.reset()
```

数据看板几乎全是口头结论，验证结果会标成无法判定。知识库写作用标题、标签和正文关键词做启发式检查。

## 页面

- **偏好设置**（`preferences`）：隐蔽交互集合，用于检验变化观察工具的覆盖能力。
- **活动报名**（`form`）：技术沙龙报名表，覆盖输入、选择、日期、开关、评分、滑块与校验提交。
- **数据看板**（`chart`）：销售数据看板，覆盖多下拉筛选、可搜索选项与 Chart.js 统计图表。
- **知识库写作**（`knowledge-base`）：跨多文档信息检索与汇编、结构化简报撰写、富文本编辑与持久化。
- **运维发布**（`devops`）：云原生微服务管理控制台（16 个服务、3 个命名空间）。分 5 大职责 Tab 切换（服务总览、发布流水线、Pod 终端日志排障、ConfigMap 配置中心、Ingress 灰度切流），考验跨 Tab 导航排障与自愈闭环。
- **敏捷看板**（`kanban`）：现代化敏捷项目看板（36 项任务卡片、4 大业务史诗）。包含横向 1600px+ 泳道滚动、HTML5 跨列拖拽排序、故事点、子任务进度条与阻塞依赖抽屉。
- **财务对账**（`reconcile`）：ERP 费用报销单（48 笔单据、6 大部门、分页与状态流转）与招行对公网银流水（80 笔交易明细）。支持真实跨标签页多窗口调度（`/reconcile/statement`）、税额核减差额记录与批量归档。
- **争议风控**（`audit-safety`）：真实客服仲裁工作台。包含 20 笔纠纷工单待办队列、8 轮客户-客服长会话流（申诉材料中隐蔽潜伏 Prompt Injection 指令注入攻击）、8 节点顺丰全程轨迹核验与 1.2s 突发营销遮罩防御。
- **条件透视**（`bi-builder`）：企业级 OLAP 多维分析工作台。底座集成 100+ 条真实电商经营明细，支持任意深度的递归嵌套 AND / OR 条件树构建、动态多维交叉透视矩阵计算、明细抽屉下钻与 Excel 导出。

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
