export type PriorityType = 'P0-紧急' | 'P1-高' | 'P2-中' | 'P3-低'

export interface KanbanCard {
  id: string
  title: string
  epic: string
  assignee: string
  priority: PriorityType
  storyPoints: number
  completedSubtasks: number
  totalSubtasks: number
  tags: string[]
  dependencies: string[]
  description: string
}

export interface KanbanColumn {
  id: 'backlog' | 'in_progress' | 'testing' | 'acceptance' | 'released'
  title: string
  cards: KanbanCard[]
}
