import { describe, expect, it } from 'vitest';
import { implicitRole, PageObserver, visibleText } from '@/features/page/observer';

describe('PageObserver', () => {
  it('assigns stable ids and revisions', () => {
    document.body.innerHTML = `
      <button id="go">提交</button>
      <input aria-label="邮箱" />
      <a href="https://example.com">文档</a>
    `;
    const observer = new PageObserver();
    const first = observer.observe();
    expect(first.revision).toBe(1);
    expect(first.elements.length).toBeGreaterThan(0);
    const button = first.elements.find((item) => item.name.includes('提交'));
    expect(button).toBeTruthy();
    const node = observer.getElement(button!.id, first.revision);
    expect(node.textContent).toContain('提交');
    observer.bump();
    expect(() => observer.getElement(button!.id, first.revision)).toThrow(/过期/);
  });

  it('reads visible text and implicit roles', () => {
    const link = document.createElement('a');
    link.textContent = '  打开 文档  ';
    expect(visibleText(link)).toBe('打开 文档');
    expect(implicitRole(link)).toBe('link');
  });

  it('builds compact control semantics from native labels and constraints', () => {
    document.body.innerHTML = `
      <label for="city">城市</label>
      <select id="city" required>
        <option value="bj">北京</option>
        <option value="sh" selected>上海</option>
      </select>
      <input id="budget" type="range" min="0" max="1000" step="50" value="400" />
    `;
    const result = new PageObserver().observe();
    const city = result.elements.find((item) => item.label === '城市');
    const budget = result.elements.find((item) => item.role === 'slider');

    expect(city).toMatchObject({
      role: 'combobox',
      value: 'sh',
      valueText: '上海',
      required: true,
      actionable: true,
    });
    expect(city?.options?.find((option) => option.selected)?.label).toBe('上海');
    expect(budget).toMatchObject({
      min: 0,
      max: 1000,
      step: 50,
      actions: expect.arrayContaining(['set-value']),
    });
    expect(result.totalElements).toBeGreaterThanOrEqual(2);
  });

  it('observes controls inside open shadow roots', () => {
    document.body.innerHTML = '<div id="host"></div>';
    const shadow = document.getElementById('host')!.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button aria-label="影子按钮">确认</button>';
    const result = new PageObserver().observe();
    expect(result.elements.some((item) => item.name === '影子按钮')).toBe(true);
  });

  it('scopes an open temporary interaction context and recognizes pointer targets', () => {
    document.body.innerHTML = `
      <button>页面外操作</button>
      <div role="dialog" aria-label="临时选择">
        <ul><li id="choice" style="cursor: pointer">选项 A</li></ul>
        <button>确定</button>
      </div>
    `;
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    dialog.getBoundingClientRect = () => ({
      x: 10, y: 10, top: 10, left: 10, right: 210, bottom: 210, width: 200, height: 200,
      toJSON: () => ({}),
    });
    const choice = document.getElementById('choice') as HTMLElement;
    choice.tabIndex = -1;
    choice.getBoundingClientRect = () => ({
      x: 20, y: 20, top: 20, left: 20, right: 120, bottom: 52, width: 100, height: 32,
      toJSON: () => ({}),
    });

    const result = new PageObserver().observe();

    expect(result.interactionContext?.name).toBe('临时选择');
    expect(result.scope).toBe('interaction-context');
    expect(result.fallbackApplied).toBe(false);
    expect(result.elements.some((item) => item.name === '页面外操作')).toBe(false);
    expect(result.elements.find((item) => item.name === '选项 A')).toMatchObject({
      clickable: true,
      actionable: true,
      visibility: 'visible',
      actions: expect.arrayContaining(['activate']),
    });
  });

  it('never treats the extension UI as page interaction context', () => {
    document.body.innerHTML = `
      <button>页面按钮</button>
      <pagent-root popover><button>扩展按钮</button></pagent-root>
    `;
    const extensionRoot = document.querySelector('pagent-root') as HTMLElement;
    extensionRoot.getBoundingClientRect = () => ({
      x: 10, y: 10, top: 10, left: 10, right: 210, bottom: 210, width: 200, height: 200,
      toJSON: () => ({}),
    });

    const result = new PageObserver().observe();

    expect(result.scope).toBe('page');
    expect(result.interactionContext).toBeUndefined();
    expect(result.elements.some((item) => item.name === '页面按钮')).toBe(true);
    expect(result.elements.some((item) => item.name === '扩展按钮')).toBe(false);
  });

  it('does not treat a persistent navigation menu as a temporary context', () => {
    document.body.innerHTML = `
      <aside><div role="menu"><a role="menuitem" href="/usage">用量信息</a></div></aside>
      <main><button>时间维度 今天</button></main>
    `;
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    menu.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, left: 0, right: 236, bottom: 800, width: 236, height: 800,
      toJSON: () => ({}),
    });

    const result = new PageObserver().observe();

    expect(result.scope).toBe('page');
    expect(result.interactionContext).toBeUndefined();
    expect(result.elements.some((item) => item.name === '时间维度 今天')).toBe(true);
  });

  it('allows callers to force a full-page scan', () => {
    document.body.innerHTML = `
      <button>页面外操作</button>
      <div role="dialog" aria-label="临时选择"><button>确定</button></div>
    `;
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    dialog.getBoundingClientRect = () => ({
      x: 10, y: 10, top: 10, left: 10, right: 210, bottom: 210, width: 200, height: 200,
      toJSON: () => ({}),
    });

    const result = new PageObserver().observe(document, 140, 'page');

    expect(result.scope).toBe('page');
    expect(result.scopeReason).toContain('强制扫描整页');
    expect(result.elements.some((item) => item.name === '页面外操作')).toBe(true);
  });

  it('falls back to the page when a temporary context has no actionable targets', () => {
    document.body.innerHTML = `
      <button>页面按钮</button>
      <div role="dialog" aria-label="空提示"><li>只有说明文字</li></div>
    `;
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    dialog.getBoundingClientRect = () => ({
      x: 10, y: 10, top: 10, left: 10, right: 210, bottom: 210, width: 200, height: 200,
      toJSON: () => ({}),
    });

    const result = new PageObserver().observe();

    expect(result.scope).toBe('page');
    expect(result.fallbackApplied).toBe(true);
    expect(result.scopeReason).toContain('自动回退');
    expect(result.elements.some((item) => item.name === '页面按钮')).toBe(true);
  });

  it('records cursor property on observed elements and recognizes full-page cursor targets', () => {
    document.body.innerHTML = `
      <div id="clickable-card" style="cursor: pointer">
        <span>卡片标题</span>
      </div>
      <div id="drag-slider" style="cursor: grab">拖拽条</div>
    `;
    const card = document.getElementById('clickable-card')!;
    const slider = document.getElementById('drag-slider')!;
    card.getBoundingClientRect = () => ({
      x: 10, y: 10, top: 10, left: 10, right: 210, bottom: 60, width: 200, height: 50,
      toJSON: () => ({}),
    });
    slider.getBoundingClientRect = () => ({
      x: 10, y: 70, top: 70, left: 10, right: 210, bottom: 110, width: 200, height: 40,
      toJSON: () => ({}),
    });

    const result = new PageObserver().observe();
    const observedCard = result.elements.find((item) => item.name === '卡片标题');
    const observedSlider = result.elements.find((item) => item.name === '拖拽条');

    expect(observedCard).toMatchObject({
      clickable: true,
      actionable: true,
      cursor: 'pointer',
      actions: expect.arrayContaining(['activate']),
    });
    expect(observedSlider).toMatchObject({
      clickable: true,
      actionable: true,
      cursor: 'grab',
      actions: expect.arrayContaining(['activate']),
    });
  });
});
