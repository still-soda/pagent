export type PageBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const ELEMENT_ACTIONS = [
  'activate',
  'set-value',
  'set-checked',
  'choose-option',
] as const;

export type ElementAction = (typeof ELEMENT_ACTIONS)[number];

export type ObservedOption = {
  label: string;
  value?: string;
  selected?: boolean;
  disabled?: boolean;
  elementId?: string;
};

export type ObservedElement = {
  id: string;
  tag: string;
  role: string;
  name: string;
  label?: string;
  description?: string;
  type?: string;
  value?: string;
  valueText?: string;
  href?: string;
  placeholder?: string;
  visible: boolean;
  visibility: 'visible' | 'offscreen';
  clickable: boolean;
  actionable: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  checked?: boolean;
  selected?: boolean;
  expanded?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: ObservedOption[];
  actions: ElementAction[];
  box?: PageBox;
};

export type InteractionContext = {
  id: string;
  role: string;
  name: string;
};

export type ObservationScope = 'auto' | 'page' | 'interaction';

export type ElementTreeFields = {
  text?: boolean;
  coordinates?: boolean;
  attributes?: string[];
};

export type ElementTreeOptions = {
  fields?: ElementTreeFields;
  maxDepth?: number;
  maxLength?: number;
  revision?: number;
};

export type LightweightElementTree = {
  rootElementId: string;
  totalLabels: number;
  emittedLabels: number;
  truncated: boolean;
  tree: string;
};

export type PageObservation = {
  url: string;
  title: string;
  revision: number;
  documentId: string;
  scope: 'page' | 'interaction-context';
  scopeReason: string;
  fallbackApplied: boolean;
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
  interactionContext?: InteractionContext;
  elements: ObservedElement[];
  totalElements: number;
  truncated: boolean;
  textPreview: string;
};

export type InteractionStep = {
  elementId: string;
  intent: ElementAction;
  value?: string | boolean | number;
  revision?: number;
};

export type InteractionResult = {
  elementId: string;
  intent: ElementAction;
  ok: boolean;
  changed: boolean;
  satisfied: boolean;
  before?: Pick<ObservedElement, 'value' | 'valueText' | 'checked' | 'selected' | 'expanded'>;
  after?: Pick<ObservedElement, 'value' | 'valueText' | 'checked' | 'selected' | 'expanded'>;
  error?: string;
};

export const NAMED_SCRIPTS = [
  'extract_links',
  'extract_headings',
  'extract_forms',
  'extract_interactions',
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
