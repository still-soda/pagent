export type PageBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ObservedElement = {
  id: string;
  tag: string;
  role: string;
  name: string;
  type?: string;
  value?: string;
  href?: string;
  placeholder?: string;
  visible: boolean;
  clickable: boolean;
  disabled?: boolean;
  checked?: boolean;
  box?: PageBox;
  /** 通过 addEventListener 登记过且仍生效的事件类型（页面主世界 document_start 注入追踪） */
  listenerEvents?: string[];
  /** 元素携带的内联事件属性对应的事件类型（如 onclick → ['click']） */
  inlineHandlers?: string[];
};

export type PageObservation = {
  url: string;
  title: string;
  revision: number;
  documentId: string;
  viewport: {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
  };
  selection: string;
  headings: string[];
  frames: Array<{
    index: number;
    sameOrigin: boolean;
    url?: string;
  }>;
  elements: ObservedElement[];
  textPreview: string;
};

export const NAMED_SCRIPTS = [
  'extract_links',
  'extract_headings',
  'extract_forms',
  'extract_meta',
  'page_stats',
  'get_selection',
] as const;

export type NamedScript = (typeof NAMED_SCRIPTS)[number];

export const SOURCE_TYPES = [
  'dom',
  'page',
  'url',
  'title',
  'text',
  'links',
  'scripts',
  'stylesheets',
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];
