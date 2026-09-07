import type { Article, ArticleBlock, CategoryMeta } from './types'

export const categories: CategoryMeta[] = [
  {
    key: 'product',
    label: '产品与需求',
    tagType: 'primary',
    description: '产品规划、需求文档与发布计划',
  },
  {
    key: 'tech',
    label: '技术架构',
    tagType: 'warning',
    description: '架构决策、API 演进与性能工程',
  },
  {
    key: 'data',
    label: '数据与运营',
    tagType: 'success',
    description: '增长分析、用户研究与反馈洞察',
  },
  {
    key: 'process',
    label: '制度与流程',
    tagType: 'info',
    description: '会议纪要、预算流程与团队规范',
  },
]

const ARCH_IMAGE =
  'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=clean%20minimal%20cloud%20collaboration%20architecture%20diagram%2C%20connected%20nodes%2C%20blue%20tones%2C%20technical%20illustration&image_size=landscape_16_9'

const GROWTH_IMAGE =
  'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20analytics%20dashboard%20illustration%20with%20rising%20bar%20chart%20and%20line%20graph%2C%20soft%20gradients%2C%20business%20style&image_size=landscape_16_9'

const blocks = (...items: ArticleBlock[]): ArticleBlock[] => items

export const articles: Article[] = [
  {
    slug: 'product-requirements-v3',
    title: '星澜云 3.0 核心需求文档（PRD）',
    category: 'product',
    author: '林晚晴',
    role: '产品负责人',
    date: '2026-08-12',
    readMins: 12,
    views: 3842,
    tags: ['PRD', '3.0', '需求'],
    summary:
      '星澜云 3.0 的 P0 需求范围、非目标与成功指标定义，是本次大版本所有工作的基准文档。',
    related: ['release-plan', 'architecture-decision'],
    blocks: blocks(
      { type: 'heading', level: 2, text: '版本定位' },
      {
        type: 'paragraph',
        text: '星澜云 3.0 围绕「多人实时协作的知识库」这一定位展开。2.x 版本以个人文档为核心，3.0 将协作能力升级为一级能力，覆盖文档、表格与评论全链路。发布节奏见 [[release-plan|3.0 发布计划与里程碑]]。',
      },
      { type: 'heading', level: 2, text: 'P0 需求范围' },
      {
        type: 'table',
        headers: ['需求编号', '需求名称', '负责人', '交付物'],
        caption: 'P0 需求清单（3.0 必交付）',
        rows: [
          ['REQ-301', '文档中心改版', '林晚晴', '全新的分类树与全文检索首页'],
          ['REQ-302', '实时协作引擎', '顾北辰', '多人同时编辑、光标与选区同步'],
          ['REQ-303', '移动端重构', '陈以宁', '响应式阅读视图与基础编辑'],
        ],
      },
      { type: 'heading', level: 2, text: '非目标' },
      {
        type: 'list',
        ordered: false,
        items: [
          '不做离线编辑与冲突手动合并（延后至 3.1）',
          '不做第三方应用市场与插件体系',
          '不做私有化部署版本',
        ],
      },
      { type: 'heading', level: 2, text: '成功指标' },
      {
        type: 'callout',
        kind: 'success',
        title: '验收口径',
        text: '发布后 30 天：NPS ≥ 45，协作功能渗透率 ≥ 60%（即 60% 的活跃团队在同一文档中产生多人编辑行为）。',
      },
      {
        type: 'paragraph',
        text: '协作引擎的技术实现与选型结论详见 [[architecture-decision|ADR-017 实时协作引擎技术选型]]，相关性能基线由压测报告提供。',
      },
    ),
  },
  {
    slug: 'release-plan',
    title: '星澜云 3.0 发布计划与里程碑',
    category: 'product',
    author: '沈亦舟',
    role: '项目经理',
    date: '2026-08-20',
    readMins: 8,
    views: 2917,
    tags: ['3.0', '里程碑', '发布'],
    summary:
      '3.0 版本的关键里程碑时间表、灰度放量节奏与回滚预案，全团队发布工作的唯一时间基准。',
    related: ['product-requirements-v3', 'api-changelog', 'meeting-standup-0901'],
    blocks: blocks(
      { type: 'heading', level: 2, text: '关键里程碑' },
      {
        type: 'table',
        headers: ['里程碑', '日期', '出口标准'],
        caption: '3.0 里程碑时间表',
        rows: [
          ['需求冻结', '2026-09-05', 'P0 需求全部评审通过并锁定范围'],
          ['Beta 发布', '2026-09-12', '内部团队与 20 家种子客户可用'],
          ['RC 候选', '2026-09-26', '全量回归通过，P0 缺陷清零'],
          ['全量发布', '2026-10-15', '灰度 10% 起步并按节奏放量'],
        ],
      },
      { type: 'heading', level: 2, text: '灰度放量节奏' },
      {
        type: 'callout',
        kind: 'info',
        title: '灰度计划',
        text: '10-15 起对 10% 用户开放；10-22 提升至 50%；10-29 达到 100% 全量。每个阶段观察 48 小时，崩溃率超过 0.1% 即暂停放量。',
      },
      { type: 'heading', level: 2, text: '回滚预案' },
      {
        type: 'list',
        ordered: true,
        items: [
          '任一灰度阶段出现 P0/P1 缺陷，立即冻结当前比例并评估',
          '30 分钟内无法修复则回滚至 2.9 稳定版本',
          '回滚后 24 小时内输出复盘报告并同步至周会',
        ],
      },
      {
        type: 'paragraph',
        text: '伴随 3.0 发布，开放平台将同步升级，v2 接口停服时间见 [[api-changelog|开放 API v3 变更说明]]。需求范围以 [[product-requirements-v3|3.0 核心需求文档]] 为准。',
      },
    ),
  },
  {
    slug: 'architecture-decision',
    title: 'ADR-017：实时协作引擎技术选型',
    category: 'tech',
    author: '顾北辰',
    role: '架构师',
    date: '2026-08-18',
    readMins: 15,
    views: 4106,
    tags: ['架构', 'CRDT', '协作'],
    summary:
      '对比 OT、CRDT 与操作广播三种方案的取舍，最终决策采用 CRDT（Yjs）作为 3.0 协作引擎内核。',
    related: ['product-requirements-v3', 'performance-benchmark'],
    blocks: blocks(
      { type: 'heading', level: 2, text: '背景' },
      {
        type: 'paragraph',
        text: 'REQ-302 要求多人同时编辑同一文档且光标、选区实时同步。候选方案有三：操作变换（OT）、CRDT 与简单操作广播。',
      },
      { type: 'heading', level: 2, text: '方案对比' },
      {
        type: 'table',
        headers: ['维度', 'OT', 'CRDT（Yjs）', '操作广播'],
        caption: '协作引擎候选方案对比',
        rows: [
          ['并发冲突处理', '需服务端集中变换', '客户端自主合并', '最后写入胜出'],
          ['离线支持', '弱', '强', '无'],
          ['实现复杂度', '高', '中', '低'],
          ['成熟生态', '一般', '好（ProseMirror/Yjs 成熟集成）', '—'],
        ],
      },
      { type: 'heading', level: 2, text: '决策' },
      {
        type: 'callout',
        kind: 'success',
        title: '结论',
        text: '采用 CRDT 方案，内核选用 Yjs，编辑器内核为 ProseMirror（与 Tiptap 同源）。性能目标：协同操作端到端延迟 P95 < 180ms，单文档支持 200 人并发编辑。',
      },
      { type: 'heading', level: 2, text: '整体架构' },
      {
        type: 'image',
        src: ARCH_IMAGE,
        caption: '3.0 实时协作引擎整体架构示意',
      },
      {
        type: 'paragraph',
        text: '决策落地后的实测数据见 [[performance-benchmark|核心链路性能压测报告]]。',
      },
    ),
  },
  {
    slug: 'api-changelog',
    title: '开放 API v3 变更说明与迁移指引',
    category: 'tech',
    author: '苏婉宁',
    role: '平台工程师',
    date: '2026-08-25',
    readMins: 10,
    views: 3388,
    tags: ['API', 'v3', '迁移'],
    summary:
      'v3 鉴权与接口变更、v2 弃用时间表与迁移示例，所有集成方需在 11-30 前完成迁移。',
    related: ['release-plan', 'naming-conventions'],
    blocks: blocks(
      { type: 'heading', level: 2, text: '鉴权变更' },
      {
        type: 'paragraph',
        text: 'v3 将会话鉴权从自研 Session Token 切换为 JWT。原 `/v2/session` 接口由 `/v3/auth` 取代，令牌有效期 2 小时，支持刷新。',
      },
      { type: 'heading', level: 2, text: 'v2 弃用时间表' },
      {
        type: 'table',
        headers: ['时间节点', '事件'],
        caption: 'v2 接口弃用节奏',
        rows: [
          ['2026-09-15', 'v3 转为默认版本，新接入方不再发放 v2 凭证'],
          ['2026-10-15', 'v2 进入维护期，仅修复安全问题'],
          ['2026-11-30', 'v2 正式停服，未迁移调用将返回 410'],
        ],
      },
      { type: 'heading', level: 2, text: '迁移示例' },
      {
        type: 'code',
        lang: 'bash',
        caption: '将文档列表调用从 v2 迁移到 v3',
        code: `# v2（将于 2026-11-30 停服）
curl -H "X-Session-Token: <token>" \\
  https://api.xinglanyun.com/v2/docs

# v3（JWT 鉴权）
curl -H "Authorization: Bearer <jwt>" \\
  https://api.xinglanyun.com/v3/docs`,
      },
      { type: 'heading', level: 2, text: '限流说明' },
      {
        type: 'callout',
        kind: 'warning',
        title: '限流策略调整',
        text: 'v3 单应用限流为 600 req/min，超限返回 429 并携带 Retry-After 头。v2 的 300 req/min 限额不再适用。',
      },
    ),
  },
  {
    slug: 'performance-benchmark',
    title: '3.0 核心链路性能压测报告',
    category: 'tech',
    author: '顾北辰',
    role: '架构师',
    date: '2026-09-01',
    readMins: 9,
    views: 1875,
    tags: ['性能', '压测', '3.0'],
    summary:
      '协同编辑、文档打开与全文检索三条核心链路的压测结果，全部指标满足 ADR-017 设定的目标。',
    related: ['architecture-decision', 'user-feedback-analysis'],
    blocks: blocks(
      { type: 'heading', level: 2, text: '压测环境' },
      {
        type: 'paragraph',
        text: '生产同构集群（8 节点），压测时长 2 小时，数据集为 50 万文档采样。目标值来自 [[architecture-decision|ADR-017 技术选型]]。',
      },
      { type: 'heading', level: 2, text: '压测结果' },
      {
        type: 'table',
        headers: ['链路', 'QPS', 'P95 延迟', '错误率'],
        caption: '核心链路压测结果（目标 P95 < 180ms）',
        rows: [
          ['协同编辑', '12,400', '156ms', '0.03%'],
          ['文档打开', '8,600', '210ms', '0.05%'],
          ['全文检索', '5,200', '340ms', '0.02%'],
        ],
      },
      { type: 'heading', level: 2, text: '结论' },
      {
        type: 'list',
        ordered: false,
        items: [
          '协同编辑 156ms 满足 P95 < 180ms 目标，200 人并发通过验证',
          '文档打开与全文检索超出 180ms，但两者不在 ADR-017 约束范围内，按 3.1 优化项跟踪',
          '错误率全部低于 0.1% 灰度暂停阈值',
        ],
      },
    ),
  },
  {
    slug: 'q3-growth-report',
    title: '2026 Q3 增长数据报告',
    category: 'data',
    author: '何晓萌',
    role: '数据分析师',
    date: '2026-09-02',
    readMins: 11,
    views: 2560,
    tags: ['增长', 'Q3', '数据'],
    summary:
      'Q3 核心指标全面复盘：DAU、MAU、留存、付费转化与 NPS 同比变化，以及渠道结构分析。',
    related: ['user-feedback-analysis', 'budget-approval'],
    blocks: blocks(
      { type: 'heading', level: 2, text: '核心指标' },
      {
        type: 'table',
        headers: ['指标', 'Q3 数值', '环比变化'],
        caption: '2026 Q3 核心增长指标',
        rows: [
          ['DAU', '48.6 万', '+12.4%'],
          ['MAU', '162 万', '+9.1%'],
          ['次日留存', '58.3%', '+1.8pp'],
          ['付费转化率', '4.7%', '+0.6pp'],
          ['NPS', '47', '+5'],
        ],
      },
      { type: 'heading', level: 2, text: '趋势' },
      {
        type: 'image',
        src: GROWTH_IMAGE,
        caption: 'Q3 用户增长与付费转化趋势示意',
      },
      { type: 'heading', level: 2, text: '渠道结构' },
      {
        type: 'table',
        headers: ['获客渠道', '新增占比'],
        caption: 'Q3 新增用户渠道分布',
        rows: [
          ['自然流量', '46%'],
          ['口碑推荐', '33%'],
          ['付费投放', '21%'],
        ],
      },
      { type: 'heading', level: 2, text: '风险提示' },
      {
        type: 'callout',
        kind: 'warning',
        title: '投放 ROI 连续两月下滑',
        text: '付费投放 ROI 从 1.8 降至 1.4，Q4 预算申报时建议压缩投放占比，将资源向口碑推荐倾斜（见 [[budget-approval|Q4 预算审批说明]]）。',
      },
    ),
  },
  {
    slug: 'user-feedback-analysis',
    title: '3.0 Beta 用户反馈聚类分析',
    category: 'data',
    author: '何晓萌',
    role: '数据分析师',
    date: '2026-09-03',
    readMins: 7,
    views: 1420,
    tags: ['Beta', '用户反馈', '3.0'],
    summary:
      '对 Beta 阶段 1,842 条反馈进行聚类，Top 问题集中在光标冲突、移动端加载与导出格式。',
    related: ['q3-growth-report', 'performance-benchmark'],
    blocks: blocks(
      { type: 'heading', level: 2, text: '样本概况' },
      {
        type: 'paragraph',
        text: '本报告覆盖 Beta 提前体验通道开启以来的共 1,842 条有效反馈，来源包括应用内反馈、客服工单与客户成功回访。',
      },
      { type: 'heading', level: 2, text: 'Top 问题分布' },
      {
        type: 'table',
        headers: ['问题', '占比', '趋势'],
        caption: '反馈问题聚类 Top 3',
        rows: [
          ['多人编辑时光标冲突', '38%', '上升'],
          ['移动端加载慢', '27%', '持平'],
          ['导出格式缺失（如 PDF 批注）', '15%', '下降'],
        ],
      },
      { type: 'heading', level: 2, text: '用户原声' },
      {
        type: 'quote',
        text: '三个人同时改一段话的时候，光标会互相“打架”，希望能在设置里关掉别人的光标显示。',
        cite: '种子客户 · 某互联网公司知识管理负责人',
      },
      {
        type: 'quote',
        text: '手机上打开大文档要五六秒，通勤路上基本没法用，希望至少先做好阅读体验。',
        cite: 'Beta 用户 · 独立咨询顾问',
      },
      {
        type: 'paragraph',
        text: '光标冲突问题与协作引擎实现相关，压测基线见 [[performance-benchmark|核心链路性能压测报告]]；整体留存影响已并入 [[q3-growth-report|Q3 增长数据报告]] 的下季度观察项。',
      },
    ),
  },
  {
    slug: 'meeting-standup-0901',
    title: '产品周会纪要（2026-09-01）',
    category: 'process',
    author: '沈亦舟',
    role: '项目经理',
    date: '2026-09-01',
    readMins: 6,
    views: 968,
    tags: ['周会', '纪要', '行动项'],
    summary:
      '本周对齐 3.0 发布风险、性能专项收尾与 Q4 预算申报节奏，形成 3 项行动项。',
    related: ['release-plan', 'budget-approval'],
    blocks: blocks(
      { type: 'heading', level: 2, text: '本周结论' },
      {
        type: 'paragraph',
        text: '会议确认 [[release-plan|3.0 发布计划]] 整体可控：需求冻结（09-05）按期，Beta（09-12）风险项仅剩光标冲突修复。Q4 预算申报进入审批流程，见 [[budget-approval|Q4 预算审批说明]]。',
      },
      { type: 'heading', level: 2, text: '行动项' },
      {
        type: 'table',
        headers: ['行动项', '负责人', '截止时间'],
        caption: '本周行动项清单',
        rows: [
          ['文档中心改版验收', '林晚晴', '2026-09-08'],
          ['性能专项收尾与压测复核', '顾北辰', '2026-09-15'],
          ['灰度放量演练', '沈亦舟', '2026-09-19'],
        ],
      },
      { type: 'heading', level: 2, text: '遗留讨论' },
      {
        type: 'list',
        ordered: false,
        items: [
          '移动端重构（REQ-303）人力缺口，下周与客户端团队对齐',
          '导出 PDF 批注能力评估是否纳入 3.1',
        ],
      },
    ),
  },
  {
    slug: 'budget-approval',
    title: 'Q4 预算审批说明',
    category: 'process',
    author: '沈亦舟',
    role: '项目经理',
    date: '2026-09-04',
    readMins: 5,
    views: 742,
    tags: ['预算', 'Q4', '审批'],
    summary:
      'Q4 总预算 860 万元的分配明细与审批截止时间，各单位需在 09-10 前完成确认。',
    related: ['q3-growth-report', 'meeting-standup-0901'],
    blocks: blocks(
      { type: 'heading', level: 2, text: '预算总额' },
      {
        type: 'callout',
        kind: 'info',
        title: '总额',
        text: '2026 年 Q4 总预算 860 万元人民币，较 Q3 增长 6.2%，主要增量来自 3.0 发布期的市场投入。',
      },
      { type: 'heading', level: 2, text: '分配明细' },
      {
        type: 'table',
        headers: ['科目', '金额（万元）', '占比'],
        caption: 'Q4 预算分配明细',
        rows: [
          ['服务器与带宽', '320', '37.2%'],
          ['市场推广', '280', '32.6%'],
          ['人力补充', '180', '20.9%'],
          ['应急预备金', '80', '9.3%'],
        ],
      },
      { type: 'heading', level: 2, text: '审批要求' },
      {
        type: 'callout',
        kind: 'warning',
        title: '截止时间',
        text: '各单位负责人需在 2026-09-10 前完成预算确认，逾期视为同意默认分配，后续调整需走季度追加流程。',
      },
      {
        type: 'paragraph',
        text: '市场推广科目的具体投放结构建议参考 [[q3-growth-report|Q3 增长数据报告]] 中的渠道 ROI 分析。',
      },
    ),
  },
  {
    slug: 'naming-conventions',
    title: '知识库文档命名与分类规范',
    category: 'process',
    author: '苏婉宁',
    role: '平台工程师',
    date: '2026-07-30',
    readMins: 6,
    views: 1189,
    tags: ['规范', '命名', '知识库'],
    summary:
      '统一的文档命名格式、分类归属与反例清单，帮助团队保持知识库结构清晰可检索。',
    related: ['api-changelog'],
    blocks: blocks(
      { type: 'heading', level: 2, text: '命名格式' },
      {
        type: 'list',
        ordered: true,
        items: [
          '技术文档使用「域-主题-版本」三段式，例如 tech-coauth-v3',
          '会议纪要使用「会议类型-日期」，例如 standup-0901',
          '禁止使用「新建文档」「未命名」等占位标题',
        ],
      },
      { type: 'heading', level: 2, text: '正反例' },
      {
        type: 'code',
        lang: 'text',
        caption: '命名正反例对照',
        code: `✅ tech-api-auth-v3.md
✅ standup-0901.md
❌ 新建文档 (3).md
❌ final_final_v2_真最终版.md`,
      },
      { type: 'heading', level: 2, text: '分类归属' },
      {
        type: 'paragraph',
        text: '文档创建时必须选择唯一主分类；跨主题内容以「最接近的读者意图」为准。接口类文档的路径规范另见 [[api-changelog|开放 API v3 变更说明]] 附录。',
      },
    ),
  },
]

export function getArticle(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug)
}
