import { Notebook } from '@element-plus/icons-vue'
import type { PlaygroundScene } from '../index'
import KbArticlePage from './pages/KbArticlePage.vue'
import KbHome from './pages/KbHome.vue'
import KbWritePage from './pages/KbWritePage.vue'
import KbLayout from './layout/KbLayout.vue'

export const knowledgeBaseScene: PlaygroundScene = {
  id: 'knowledge-base',
  title: '知识库写作',
  description: '跨文档信息收集与汇总写作',
  task: [
    '浏览「星澜知识库」，依次阅读：3.0 发布计划与里程碑、ADR-017 实时协作引擎技术选型、开放 API v3 变更说明、2026 Q3 增长数据报告、产品周会纪要（09-01）、Q4 预算审批说明。',
    '收集关键信息：发布里程碑与灰度节奏、架构选型结论、v2 API 停服时间、Q3 核心指标（DAU/MAU/留存/付费转化/NPS）、行动项负责人与截止时间、Q4 预算总额及分配。',
    '进入「写作中心」新建文档，标题为「星澜云 3.0 发布评审简报」。',
    '正文需包含：概述段落、Q3 核心指标表格、API 变更与弃用时间列表、风险与决策要点、行动项清单（含负责人与截止时间）、Q4 预算摘要。',
    '为文档添加至少 2 个标签，保存并确认文档出现在「我的文档」列表中。',
  ],
  icon: Notebook,
  component: KbLayout,
  routes: [
    {
      path: '/knowledge-base',
      component: KbLayout,
      meta: { sceneId: 'knowledge-base' },
      children: [
        { path: '', name: 'knowledge-base', component: KbHome },
        {
          path: 'articles/:slug',
          name: 'knowledge-base-article',
          component: KbArticlePage,
        },
        { path: 'write', name: 'knowledge-base-write', component: KbWritePage },
      ],
    },
  ],
}
