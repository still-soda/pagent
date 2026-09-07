# Web Playground「知识库写作」测试场景（/knowledge-base）实施计划

## 一、概述

在 `tests/web-playground` 中新增第 4 个测试场景 `knowledge-base`：一个「星澜知识库」写作平台站点（类 Notion/语雀）。测试目标是让 Pagent **跨多个链接（/knowledge-base → /knowledge-base/articles/...）收集分散在多篇文章中的关键信息，汇总后到独立写作页 `/knowledge-base/write` 的 WYSIWYG 编辑器中撰写结构化简报并保存**。

- 场景 id / 根路径：`knowledge-base`（用户原话中的 `/example` 仅为示例占位；与现有 `preferences`/`form`/`chart` 命名风格一致）
- 编辑器：**tiptap v3**（`@tiptap/vue-3`，ProseMirror 内核，Notion 同源技术栈）
- 保存：**localStorage** 持久化（key: `pagent-knowledge-base-docs`），保存后出现在「我的文档」列表，刷新不丢失
- 任务提示：复用全局 [SceneTaskPanel.vue](file:///Users/still-soda/CodeLib.localized/project/pagent/tests/web-playground/src/components/SceneTaskPanel.vue)（可关闭），通过 scene 定义自动生效

## 二、现状分析

- 场景注册：[scenes/index.ts](file:///Users/still-soda/CodeLib.localized/project/pagent/tests/web-playground/src/scenes/index.ts) 中 `PlaygroundScene` 接口（id/title/description/task/icon/component）
- 路由：[router.ts](file:///Users/still-soda/CodeLib.localized/project/pagent/tests/web-playground/src/router.ts) 将每个 scene 映射为**单一顶级路由** `/{scene.id}`，`meta.sceneId` 供 [App.vue](file:///Users/still-soda/CodeLib.localized/project/pagent/tests/web-playground/src/App.vue) 匹配当前场景（header + 任务面板 + 抽屉菜单）
- 技术栈：Vue 3.5 + Element Plus 2.14 + Vue Router 4 + Vite 8；`tests/web-playground` 是独立 pnpm 包（自己的 `pnpm-lock.yaml`，root tsconfig 已 exclude），root 提供 `pnpm dev:playground` 脚本
- **无富文本编辑器依赖**，且路由生成逻辑不支持子路由 —— 两处均需扩展

## 三、Agent 任务设计（scene.task，可关闭面板展示）

```
1. 浏览「星澜知识库」，依次阅读：3.0 发布计划与里程碑、ADR-017 实时协作引擎技术选型、开放 API v3 变更说明、2026 Q3 增长数据报告、产品周会纪要（09-01）、Q4 预算审批说明。
2. 收集关键信息：发布里程碑与灰度节奏、架构选型结论、v2 API 停服时间、Q3 核心指标（DAU/MAU/留存/付费转化/NPS）、行动项负责人与截止时间、Q4 预算总额及分配。
3. 进入「写作中心」（/knowledge-base/write）新建文档，标题为「星澜云 3.0 发布评审简报」。
4. 正文需包含：概述段落、Q3 核心指标表格、API 变更与弃用时间列表、风险与决策要点、行动项清单（含负责人与截止时间）、Q4 预算摘要。
5. 为文档添加至少 2 个标签，保存并确认文档出现在「我的文档」列表中。
```

## 四、实施方案

### 4.1 依赖安装

```bash
pnpm --dir tests/web-playground add @tiptap/vue-3@^3.31.3 @tiptap/starter-kit@^3.31.3 @tiptap/extension-table@^3.31.3 @tiptap/extensions@^3.31.3
```

说明：tiptap v3 中 `StarterKit` 已含 bold/italic/strike/heading/列表/引用/代码块/分割线/undoRedo/link；`@tiptap/extension-table` 导出 `TableKit`（含 row/cell/header）；`@tiptap/extensions` 导出 `Placeholder`/`TaskList`/`TaskItem`。

### 4.2 路由与场景注册扩展

**[router.ts](file:///Users/still-soda/CodeLib.localized/project/pagent/tests/web-playground/src/router.ts)**：`PlaygroundScene` 增加可选 `routes?: RouteRecordRaw[]`；路由生成改为 flatMap：

```ts
...scenes.flatMap((scene) =>
  scene.routes?.length
    ? scene.routes
    : [{ path: `/${scene.id}`, name: scene.id, component: scene.component, meta: { sceneId: scene.id } }],
),
```

knowledge-base 场景路由（父布局 + 子路由，父/子均带 `meta.sceneId: 'knowledge-base'`）：

| 路径 | name | 组件 | 说明 |
|---|---|---|---|
| `/knowledge-base` | `knowledge-base`（'' 子路由） | `ExampleHome`→`KbHome` | 知识库首页（菜单跳转依赖 name=`knowledge-base`） |
| `/knowledge-base/articles/:slug` | `knowledge-base-article` | `KbArticlePage` | 文章详情 |
| `/knowledge-base/write` | `knowledge-base-write` | `KbWritePage` | 写作中心（编辑器 + 我的文档） |

父路由 component 为 `KbLayout`（含 `<router-view />`）。其余 3 个场景走原逻辑不受影响。

### 4.3 目录与文件结构（全部新增于 `tests/web-playground/src/scenes/knowledge-base/`）

```
scenes/knowledge-base/
├── index.ts          # 导出 knowledgeBaseScene（PlaygroundScene 定义 + routes）
├── types.ts          # Article / ArticleBlock 类型
├── data.ts           # 4 分类 + 10 篇文章的完整数据（含关键事实）
├── store.ts          # useDocsStore：localStorage 文档存取（列表/保存/删除/查询）
├── layout/KbLayout.vue        # 左侧栏（分类树+新建按钮+最近更新）+ router-view
├── pages/KbHome.vue           # 首页：搜索、分类过滤、文章卡片、写作入口横幅
├── pages/KbArticlePage.vue    # 文章：面包屑、meta、TOC、正文、相关文档、上下篇
├── pages/KbWritePage.vue      # 写作：标题/标签/编辑器/保存/我的文档列表
├── components/BlockRenderer.vue # 渲染 ArticleBlock 联合类型 + [[slug|文本]] 内链解析
├── components/ArticleCard.vue  # 首页文章卡片
└── components/DocEditor.vue    # tiptap 编辑器封装（工具栏 + EditorContent）
```

**修改**：`scenes/index.ts`（追加 knowledgeBaseScene）、`router.ts`（见 4.2）、`package.json`（自动）。

### 4.4 数据模型（types.ts / data.ts）

```ts
interface Article {
  slug: string; title: string; category: string        // category key
  author: string; role: string; date: string            // YYYY-MM-DD
  readMins: number; views: number; tags: string[]; summary: string
  blocks: ArticleBlock[]; related: string[]             // related slugs
}

type ArticleBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }                 // 支持 [[slug|显示文本]] 内联链接
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][]; caption?: string }
  | { type: 'code'; lang: string; code: string; caption?: string }
  | { type: 'quote'; text: string; cite?: string }
  | { type: 'callout'; kind: 'info' | 'warning' | 'success'; title?: string; text: string }
  | { type: 'image'; src: string; caption?: string }
  | { type: 'divider' }
```

**分类（4 个）**：`product` 产品与需求（primary）、`tech` 技术架构（warning）、`data` 数据与运营（success）、`process` 制度与流程（info）。

**文章（10 篇）与必须包含的关键事实**（执行时按此写成完整文章，每篇 8~15 个 block，自然使用表格/列表/引用/callout/代码块）：

| # | slug | 标题 | 分类/作者 | 关键事实（分散的数据点） |
|---|---|---|---|---|
| 1 | `product-requirements-v3` | 星澜云 3.0 核心需求文档（PRD） | product / 林晚晴·产品负责人 / 08-12 | P0 需求表格：文档中心改版、实时协作引擎、移动端重构；非目标列表；成功指标 NPS≥45、协作渗透率≥60% |
| 2 | `release-plan` | 星澜云 3.0 发布计划与里程碑 | product / 沈亦舟·项目经理 / 08-20 | 里程碑表：需求冻结 09-05、Beta 09-12、RC 09-26、全量发布 10-15；灰度 callout：10-15 起 10%→10-22 50%→10-29 100%；含内链 [[api-changelog]]、[[product-requirements-v3]] |
| 3 | `architecture-decision` | ADR-017：实时协作引擎技术选型 | tech / 顾北辰·架构师 / 08-18 | OT/CRDT/广播三方案对比表；决策选 CRDT（Yjs）；性能目标 P95<180ms、单文档 200 人并发；含架构配图 |
| 4 | `api-changelog` | 开放 API v3 变更说明与迁移指引 | tech / 苏婉宁·平台工程师 / 08-25 | `/v2/session`→`/v3/auth`（改 JWT）；弃用时间表：09-15 v3 默认、**11-30 v2 停服**；迁移 curl 代码块；限流 600 req/min warning callout |
| 5 | `performance-benchmark` | 3.0 核心链路性能压测报告 | tech / 顾北辰 / 09-01 | 压测表格：协同编辑 QPS 12,400/P95 156ms/错误率 0.03%；文档打开 8,600/210ms；全文检索 5,200/340ms |
| 6 | `q3-growth-report` | 2026 Q3 增长数据报告 | data / 何晓萌·数据分析师 / 09-02 | 指标表：DAU 48.6万(+12.4%)、MAU 162万(+9.1%)、次日留存 58.3%、付费转化 4.7%(+0.6pp)、NPS 47；渠道表：自然 46%/口碑 33%/投放 21%；投放 ROI 下滑 warning；含趋势配图 |
| 7 | `user-feedback-analysis` | 3.0 Beta 用户反馈聚类分析 | data / 何晓萌 / 09-03 | 样本 1,842 条；Top 问题表：光标冲突 38%、移动端加载慢 27%、导出格式缺失 15%；用户原话引用块×2 |
| 8 | `meeting-standup-0901` | 产品周会纪要（2026-09-01） | process / 沈亦舟 / 09-01 | 行动项表：文档中心验收-林晚晴-09-08、性能专项收尾-顾北辰-09-15、灰度演练-沈亦舟-09-19；含内链 [[budget-approval]]、[[release-plan]] |
| 9 | `budget-approval` | Q4 预算审批说明 | process / 沈亦舟 / 09-04 | 总额 860 万明细表：服务器 320 万/市场 280 万/人力 180 万/预备金 80 万；审批截止 09-10 warning callout |
| 10 | `naming-conventions` | 知识库文档命名与分类规范 | process / 苏婉宁 / 07-30 | 干扰项：命名规则列表 + 正反例代码块，无任务关键数据 |

**内链要求**：至少 5 篇正文含 `[[slug|显示文本]]` 内链（上表已标注部分），`related` 字段互相指向，形成真实交叉引用网。

**图片（2 张，遵守项目图片规范，使用 text_to_image API）**：
- 架构图（#3 内）：`https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=<URL编码>&image_size=landscape_16_9`，prompt 类似 "clean minimal cloud collaboration architecture diagram, connected nodes, blue tones, technical illustration"
- 增长趋势图（#6 内）：prompt 类似 "modern analytics dashboard illustration with rising bar chart and line graph, soft gradients, business style"

### 4.5 页面设计

**KbLayout.vue**（父路由）
- 左侧栏（约 240px，sticky）：知识库名「星澜知识库」+ 简介；`el-menu` 分类树（全部文档 + 4 分类，带数量徽标，点击 → `/knowledge-base?category=xxx`）；「+ 新建文档」按钮 → `/knowledge-base/write`；「最近更新」列表（按日期 top5 → 文章链接）
- 主区：`<router-view />`

**KbHome.vue**（`/knowledge-base`）
- 顶部横幅：知识库说明 + 统计（10 篇文档 · 4 个分类）+ 搜索框（客户端过滤标题/摘要/标签，与 `?category=` query 组合）
- 「汇总写作」入口卡片 → `/knowledge-base/write`（文案：跨文档收集资料，撰写汇总简报）
- 文章卡片网格（ArticleCard）：标题、摘要、作者、日期、阅读时长、分类 tag、标签；点击 → `/knowledge-base/articles/:slug`

**KbArticlePage.vue**（`/knowledge-base/articles/:slug`）
- 面包屑（知识库 / 分类 / 标题）；标题 + meta 行（作者·职位、日期、阅读时长、阅读量、标签）
- 右侧 sticky TOC：从 heading blocks 生成锚点列表，点击 scrollIntoView；heading 渲染时生成 id（文本 slug 化）
- 正文：BlockRenderer 渲染全部 block；`[[slug|文本]]` 用正则解析为 `<router-link>`
- 文末：相关文档链接卡片 + 上一篇/下一篇（按 data 数组顺序）；未知 slug → `el-empty` + 返回知识库按钮

**KbWritePage.vue**（`/knowledge-base/write`）
- 主区：文档标题输入（大号 input，placeholder「请输入文档标题」）；标签 `el-select` multiple allow-create（预置标签池：发布、评审、简报、3.0、数据、风险…）；`DocEditor`；底部状态栏（字数统计、未保存/已保存时间、「保存文档」primary 按钮）
- 保存校验：标题非空且 ≥2 字符、正文（editor.getText() 去空白）≥50 字符，不满足 `ElMessage.error`（如「请先填写文档标题」「正文内容过短，至少 50 字」）；通过则 store.save + `ElMessage.success('文档已保存')`
- 右侧栏「我的文档」：SavedDoc 列表（标题、更新时间、字数）；操作：编辑（载入编辑器，支持 `?doc=<id>` 直达并回填）/ 删除（`ElMessageBox.confirm`）
- 编辑态：载入后保存为更新同一 id（updatedAt 刷新）；仅展示「未保存更改」状态条，**不做路由离开守卫**（避免阻断 agent）

**DocEditor.vue**（tiptap 封装）
- `useEditor`：extensions = `StarterKit` + `TableKit` + `Placeholder`（placeholder：「开始撰写文档，支持标题、列表、表格与待办清单…」）+ `TaskList` + `TaskItem.configure({ nested: true })`
- 工具栏（`el-button` 组，均带中文 `aria-label`/`title`，active 态高亮）：撤销/重做 ｜ H1/H2/H3 ｜ 加粗/斜体/删除线 ｜ 有序/无序列表 ｜ 任务清单 ｜ 引用 ｜ 代码块 ｜ 插入表格（3×3，TableKit）｜ 分割线 ｜ 清除格式
- 对外：`emit('update', { html, text, wordCount })`；`defineExpose` 载入内容方法（editor.commands.setContent）；编辑器容器 `.tiptap`（contenteditable，agent 可直接点击输入）
- 自定义 CSS（tiptap 无头需自写）：标题/列表/引用/代码块/表格边框/任务清单复选框/placeholder 样式，全部使用 Element Plus `var(--el-*)` 设计变量

**BlockRenderer.vue**：按 block 类型渲染（table → 原生 table + 边框样式；callout → `el-alert`；code → `<pre><code>`；quote → `<blockquote>`；image → `<figure><img><figcaption>`），并实现内链解析。

### 4.6 存储（store.ts）

```ts
interface SavedDoc { id: string; title: string; tags: string[]; html: string; text: string; wordCount: number; createdAt: number; updatedAt: number }
```
- key：`pagent-knowledge-base-docs`；composable `useDocsStore()`：响应式 `docs` ref，初始化时 `JSON.parse` 读取；`save(doc)`（upsert）、`remove(id)`、`get(id)`，每次变更后写回 localStorage

### 4.7 场景注册（scenes/knowledge-base/index.ts）

```ts
export const knowledgeBaseScene: PlaygroundScene = {
  id: 'knowledge-base', title: '知识库写作', description: '跨文档信息收集与汇总写作',
  task: [/* 第三节的 5 步 */], icon: Notebook,           // @element-plus/icons-vue
  component: KbLayout, routes: [/* 4.2 的三条路由 */],
}
```

追加进 `scenes/index.ts` 的 `scenes` 数组末尾。

## 五、验证步骤

1. `pnpm --dir tests/web-playground add @tiptap/vue-3@^3.31.3 @tiptap/starter-kit@^3.31.3 @tiptap/extension-table@^3.31.3 @tiptap/extensions@^3.31.3`
2. `pnpm --dir tests/web-playground dev`，打开 `http://localhost:5173/knowledge-base`：
   - 首页：搜索/分类过滤正常；卡片点击进入文章；「汇总写作」入口可达
   - 文章页：全部 block 类型渲染正确（表格/代码/引用/callout/图片/内链）；TOC 锚点滚动；相关文档与上/下一篇可用；未知 slug 空态
   - 写作页：标题/标签/正文输入；工具栏各按钮生效（含插入表格、任务清单）；保存校验与成功提示；「我的文档」出现新文档；**刷新页面后仍存在**；编辑回填、删除确认
   - 任务面板：`/knowledge-base` 及全部子路由均显示当前任务，可关闭，切换场景互不影响；抽屉菜单「知识库写作」可跳回 `/knowledge-base`
3. `pnpm --dir tests/web-playground build`（vue-tsc 类型检查通过）
4. （可选）用 browser-use 按第三节任务走通全流程，确认 agent 可完成

## 六、假设与决策

- 场景 id / 根路径为 `knowledge-base`（`/example` 仅为用户示例占位）；数据纯前端静态，无后端
- 保存持久化用 localStorage；图片仅 2 张且必须走 `text_to_image` API URL
- 不做路由离开守卫与自动保存（保留「未保存」提示即可，降低 agent 被弹窗阻断的风险）
- `naming-conventions` 为刻意设计的干扰项文章；全部关键数据分散于 6 篇任务相关文章中，其余为背景内容
- 其余 3 个场景（preferences/form/chart）行为不变（router 改造向后兼容）
