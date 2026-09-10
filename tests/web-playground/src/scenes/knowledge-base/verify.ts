import { assert, unknown } from '../../oracle/checks'
import type { CheckOutcome } from '../../oracle/types'
import type { SavedDoc } from './types'

export const BRIEFING_TITLE = '星澜云 3.0 发布评审简报'

const SECTION_CHECKS: Array<{ id: string; label: string; pattern: RegExp }> = [
  { id: 'overview', label: '正文含概述', pattern: /概述|简报|发布节奏|灰度/ },
  { id: 'q3', label: '正文含 Q3 核心指标', pattern: /Q3|DAU|MAU|留存|NPS|付费转化/ },
  { id: 'api', label: '正文含 API 变更或停服时间', pattern: /API|停服|弃用/ },
  { id: 'risk', label: '正文含风险或决策要点', pattern: /风险|决策/ },
  { id: 'actions', label: '正文含行动项', pattern: /行动项|负责人|截止/ },
  { id: 'budget', label: '正文含 Q4 预算', pattern: /预算|Q4/ },
]

export interface KnowledgeSnapshot {
  docs: SavedDoc[]
}

export function findBriefingDoc(docs: SavedDoc[]): SavedDoc | undefined {
  return docs.find((doc) => doc.title.includes(BRIEFING_TITLE))
}

export function verifyKnowledgeBase(snapshot: KnowledgeSnapshot): CheckOutcome[] {
  const doc = findBriefingDoc(snapshot.docs)
  const body = `${doc?.title ?? ''}\n${doc?.text ?? ''}\n${doc?.html ?? ''}`

  return [
    unknown('browse', '浏览指定知识库文档并收集关键信息', '阅读过程无法由页面终态判定'),
    assert(
      'title',
      '已保存标题含「星澜云 3.0 发布评审简报」的文档',
      doc != null,
      BRIEFING_TITLE,
      doc?.title ?? '未找到匹配文档',
    ),
    assert(
      'tags',
      '文档至少 2 个标签',
      (doc?.tags.length ?? 0) >= 2,
      '≥ 2',
      doc ? String(doc.tags.length) : '无文档',
    ),
    ...SECTION_CHECKS.map((item) =>
      assert(
        item.id,
        item.label,
        Boolean(doc && item.pattern.test(body)),
        '正文命中关键词',
        doc ? (item.pattern.test(body) ? '已覆盖' : '未覆盖') : '无文档',
      ),
    ),
  ]
}
