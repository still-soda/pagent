export type ArticleCategory = 'product' | 'tech' | 'data' | 'process'

export interface CategoryMeta {
  key: ArticleCategory
  label: string
  tagType: 'primary' | 'warning' | 'success' | 'info'
  description: string
}

export type ArticleBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][]; caption?: string }
  | { type: 'code'; lang: string; code: string; caption?: string }
  | { type: 'quote'; text: string; cite?: string }
  | { type: 'callout'; kind: 'info' | 'warning' | 'success'; title?: string; text: string }
  | { type: 'image'; src: string; caption?: string }
  | { type: 'divider' }

export interface Article {
  slug: string
  title: string
  category: ArticleCategory
  author: string
  role: string
  date: string
  readMins: number
  views: number
  tags: string[]
  summary: string
  blocks: ArticleBlock[]
  related: string[]
}

export interface SavedDoc {
  id: string
  title: string
  tags: string[]
  html: string
  text: string
  wordCount: number
  createdAt: number
  updatedAt: number
}
