import type { Component } from 'vue'
import { EditPen, Setting, TrendCharts } from '@element-plus/icons-vue'
import ChartScene from './ChartScene.vue'
import FormScene from './FormScene.vue'
import PreferenceScene from './PreferenceScene.vue'

export interface PlaygroundScene {
  id: string
  title: string
  description: string
  task: string[]
  icon: Component
  component: Component
}

export const scenes: PlaygroundScene[] = [
  {
    id: 'preferences',
    title: '偏好设置',
    description: '账户偏好、通知与安全设置',
    task: [
      '界面语言改为 English，主题改为「深色」，时区改为东京时间。',
      '通知仅保留「营销活动」。',
      '静默时段调整为 23:00 至 07:00，摘要推送改为每周一。',
      '完成一次安全验证。',
      '下线位于北京的登录设备。',
      '开启实验功能「自动摘要」。',
      '汇报 09-02 的账户操作记录。',
      '保存以上设置。',
    ],
    icon: Setting,
    component: PreferenceScene,
  },
  {
    id: 'form',
    title: '活动报名',
    description: '技术沙龙报名信息填写与提交',
    task: [
      '为林晚晴完成第 12 期技术沙龙报名：linwanqing@example.com / 13912345678。',
      '城市杭州，岗位设计，性别女。',
      '兴趣方向为设计与产品。',
      '出生日期 1996-04-18，到场时间 14:30。',
      '同行 3 人，不接收通知。',
      '期待程度 5 分，预算 600 元，备注「素食餐食」。',
      '提交报名并核对结果。',
    ],
    icon: EditPen,
    component: FormScene,
  },
  {
    id: 'chart',
    title: '数据看板',
    description: '销售数据筛选与趋势分析',
    task: [
      '统计 2024 年线上商城渠道的总销售额、总订单量、平均客单价与在售产品数。',
      '对比线下门店渠道的总销售额差异。',
      '查询「休闲运动鞋」在服饰品类下的销售排名。',
      '找出 2024 年全渠道销售额最高的月份。',
      '输出简短的分析结论。',
    ],
    icon: TrendCharts,
    component: ChartScene,
  },
]
