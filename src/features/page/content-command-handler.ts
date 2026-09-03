import { pageObserver } from './observer';
import {
  clearElement,
  clickElement,
  dblclickElement,
  focusElement,
  highlight,
  hoverElement,
  pressKey,
  runNamedScript,
  scrollPage,
  selectOption,
  typeText,
  waitFor,
  dragElement,
} from './actions';
import { getRememberedSelection } from './selection';
import { searchPageText } from './search';
import { getPageSource } from './source';
import type { NamedScript, SourceType } from '@/shared/contracts/page';
import {
  pageChangeTracker,
  type PageChangeSnapshot,
} from './change-tracker';

export function handleContentCommand(name: string, payload: Record<string, unknown>) {
  switch (name) {
    case 'ui.toggle':
    case 'ui.open':
    case 'ui.hide':
    case 'ui.capture.start':
    case 'ui.capture.end':
      return { ok: true, uiCommand: name };
    case 'dom.observe':
      return pageObserver.observe(document, Number(payload.maxElements ?? 140));
    case 'dom.changes.start':
      return pageChangeTracker.snapshot(Number(payload.maxNodes ?? 400));
    case 'dom.changes.read':
      return pageChangeTracker.read(payload.baseline as PageChangeSnapshot, {
        timeoutMs: payload.timeoutMs as number | undefined,
        quietMs: payload.quietMs as number | undefined,
        maxChanges: payload.maxChanges as number | undefined,
      });
    case 'dom.search':
      return searchPageText(String(payload.query ?? ''), {
        caseSensitive: Boolean(payload.caseSensitive),
        maxResults: payload.maxResults as number | undefined,
      });
    case 'dom.click':
      return clickElement(String(payload.elementId), payload.revision as number | undefined);
    case 'dom.dblclick':
      return dblclickElement(String(payload.elementId), payload.revision as number | undefined);
    case 'dom.hover':
      return hoverElement(String(payload.elementId), payload.revision as number | undefined);
    case 'dom.focus':
      return focusElement(String(payload.elementId), payload.revision as number | undefined);
    case 'dom.highlight': {
      const el = pageObserver.getElement(
        String(payload.elementId),
        payload.revision as number | undefined,
      );
      highlight(el);
      return { ok: true };
    }
    case 'dom.type':
      return typeText(String(payload.elementId), String(payload.text ?? ''), {
        clear: Boolean(payload.clear),
        submit: Boolean(payload.submit),
        revision: payload.revision as number | undefined,
      });
    case 'dom.clear':
      return clearElement(String(payload.elementId), payload.revision as number | undefined);
    case 'dom.select':
      return selectOption(
        String(payload.elementId),
        String(payload.value ?? ''),
        payload.revision as number | undefined,
      );
    case 'dom.press':
      return pressKey(String(payload.key ?? 'Enter'));
    case 'dom.drag':
      return dragElement(
        String(payload.elementId),
        String(payload.targetId),
        payload.revision as number | undefined,
      );
    case 'dom.scroll':
      return scrollPage({
        elementId: payload.elementId ? String(payload.elementId) : undefined,
        direction: payload.direction as 'up' | 'down' | undefined,
        amount: payload.amount as number | undefined,
        revision: payload.revision as number | undefined,
      });
    case 'dom.wait':
      return waitFor({
        ms: payload.ms as number | undefined,
        text: payload.text as string | undefined,
        elementId: payload.elementId as string | undefined,
        urlIncludes: payload.urlIncludes as string | undefined,
      });
    case 'dom.script':
      return runNamedScript(payload.name as NamedScript);
    case 'page.info':
      return {
        url: location.href,
        title: document.title,
        selection: getRememberedSelection(),
        revision: pageObserver.revision,
      };
    case 'page.source':
      return getPageSource({
        type: payload.type as SourceType | undefined,
        grep: payload.grep ? String(payload.grep) : undefined,
        regex: payload.regex as boolean | undefined,
        caseSensitive: payload.caseSensitive as boolean | undefined,
        limit: payload.limit as number | undefined,
        offset: payload.offset as number | undefined,
      });
    default:
      throw new Error(`未知内容命令：${name}`);
  }
}
