import type { Component } from 'vue'
import { EditPen } from '@element-plus/icons-vue'
import FormScene from './FormScene.vue'

export interface PlaygroundScene {
  id: string
  title: string
  description: string
  icon: Component
  component: Component
}

export const scenes: PlaygroundScene[] = [
  {
    id: 'form',
    title: '表单场景',
    description: '活动报名表，覆盖输入、选择、日期、开关与校验提交',
    icon: EditPen,
    component: FormScene,
  },
]
