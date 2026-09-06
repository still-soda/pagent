import { describe, expect, it } from 'vitest';
import {
  clickElement,
  findCommonAncestor,
  inspectElementTree,
  interactElements,
  typeText,
} from '@/features/page/actions';
import { PageObserver, pageObserver } from '@/features/page/observer';

describe('generic element interactions', () => {
  it('sets values and checked state with postconditions', async () => {
    document.body.innerHTML = `
      <label for="name">姓名</label>
      <input id="name" value="" />
      <label><input id="notify" type="checkbox" />接收通知</label>
    `;
    const observation = pageObserver.observe();
    const name = observation.elements.find((item) => item.label === '姓名')!;
    const notify = observation.elements.find((item) => item.id !== name.id && item.role === 'checkbox')!;

    const results = await interactElements([
      { elementId: name.id, intent: 'set-value', value: '测试用户' },
      { elementId: notify.id, intent: 'set-checked', value: true },
    ]);

    expect(results).toEqual([
      expect.objectContaining({ ok: true, changed: true, satisfied: true }),
      expect.objectContaining({ ok: true, changed: true, satisfied: true }),
    ]);
    expect((document.getElementById('name') as HTMLInputElement).value).toBe('测试用户');
    expect((document.getElementById('notify') as HTMLInputElement).checked).toBe(true);
  });

  it('chooses native options without component-specific knowledge', async () => {
    document.body.innerHTML = `
      <select id="city" aria-label="城市">
        <option value="bj">北京</option>
        <option value="sh">上海</option>
      </select>
    `;
    const observer = new PageObserver();
    const city = observer.observe().elements.find((item) => item.name === '城市')!;
    // interactElements 使用共享观察器注册的 id。
    const sharedCity = pageObserver.observe().elements.find((item) => item.name === '城市')!;
    expect(city.options).toHaveLength(2);

    const [result] = await interactElements([
      { elementId: sharedCity.id, intent: 'choose-option', value: 'sh' },
    ]);

    expect(result).toMatchObject({ ok: true, changed: true, satisfied: true });
    expect((document.getElementById('city') as HTMLSelectElement).value).toBe('sh');
  });

  it('replaces text atomically by default and only appends explicitly', async () => {
    document.body.innerHTML = '<input id="time" value="16:14" />';
    const field = pageObserver.observe().elements.find((item) => item.tag === 'input')!;

    const replaced = await typeText(field.id, '14:30');
    expect(replaced).toMatchObject({ changed: true, satisfied: true, value: '14:30' });

    const appended = await typeText(field.id, ' UTC', { mode: 'append' });
    expect(appended).toMatchObject({ satisfied: true, value: '14:30 UTC' });
  });

  it('checks sensitive values before observation output is redacted', async () => {
    document.body.innerHTML = '<input aria-label="邮箱" type="email" />';
    const field = pageObserver.observe().elements.find((item) => item.name === '邮箱')!;

    const [result] = await interactElements([
      { elementId: field.id, intent: 'set-value', value: 'person@example.com' },
    ]);

    expect(result?.satisfied).toBe(true);
    expect((document.querySelector('input') as HTMLInputElement).value).toBe('person@example.com');
  });

  it('reports activation progress only when the target state changes', async () => {
    document.body.innerHTML = '<button aria-expanded="false">展开</button>';
    const button = document.querySelector('button')!;
    button.addEventListener('click', () => button.setAttribute('aria-expanded', 'true'));
    const target = pageObserver.observe().elements.find((item) => item.name === '展开')!;

    await expect(clickElement(target.id)).resolves.toMatchObject({
      ok: true,
      changed: true,
      after: expect.objectContaining({ expanded: true }),
    });
  });

  it('serializes a lightweight element tree with selected fields and depth truncation', () => {
    document.body.innerHTML = `
      <section data-testid="usage">根节点
        <div role="group">容器
          <span><em>深层文本</em></span>
        </div>
      </section>
    `;
    const root = document.querySelector('section') as HTMLElement;
    root.getBoundingClientRect = () => ({
      x: 10, y: 20, top: 20, left: 10, right: 310, bottom: 220,
      width: 300, height: 200, toJSON: () => ({}),
    });
    const elementId = pageObserver.register(root);

    const result = inspectElementTree(elementId, {
      fields: {
        text: true,
        coordinates: true,
        attributes: ['data-testid'],
      },
      maxDepth: 1,
      maxLength: 20,
    });

    expect(result.tree).toContain('section text="根节点" box="10,20,300,200" data-testid="usage"');
    expect(result.tree).toContain('  div role="group" text="容器"');
    expect(result.tree).toContain('    more-level remaining-levels=2');
    expect(result.truncated).toBe(true);
  });

  it('uses a more-label marker when the label limit is exceeded', () => {
    document.body.innerHTML = '<div><span>A</span><span>B</span><span>C</span></div>';
    const elementId = pageObserver.register(document.querySelector('div')!);

    const result = inspectElementTree(elementId, {
      fields: { text: true },
      maxDepth: 4,
      maxLength: 3,
    });

    expect(result.emittedLabels).toBe(3);
    expect(result.tree.split('\n')).toHaveLength(3);
    expect(result.tree).toContain('more-label remaining-labels=2');
  });
});

describe('findCommonAncestor', () => {
  it('finds the nearest common ancestor of two elements', () => {
    document.body.innerHTML = `
      <section id="card" aria-label="用户卡片">
        <div class="row"><button id="a">A</button></div>
        <div class="row"><span><button id="b">B</button></span></div>
      </section>
    `;
    const card = document.querySelector('#card')!;
    const idA = pageObserver.register(document.querySelector('#a')!);
    const idB = pageObserver.register(document.querySelector('#b')!);

    const result = findCommonAncestor([idA, idB]);

    expect(result.elementId).toBe(pageObserver.register(card));
    expect(result.tag).toBe('section');
    expect(result.name).toBe('用户卡片');
    expect(result.sameElement).toBe(false);
    expect(result.depths).toEqual([2, 3]);
  });

  it('finds the nearest common ancestor of three or more elements', () => {
    document.body.innerHTML = `
      <form id="form">
        <fieldset id="group">
          <input id="x" />
          <input id="y" />
        </fieldset>
        <button id="submit">提交</button>
      </form>
    `;
    const idX = pageObserver.register(document.querySelector('#x')!);
    const idY = pageObserver.register(document.querySelector('#y')!);
    const idSubmit = pageObserver.register(document.querySelector('#submit')!);

    const partial = findCommonAncestor([idX, idY]);
    expect(partial.elementId).toBe(pageObserver.register(document.querySelector('#group')!));
    expect(partial.depths).toEqual([1, 1]);

    const all = findCommonAncestor([idX, idY, idSubmit]);
    expect(all.elementId).toBe(pageObserver.register(document.querySelector('#form')!));
    expect(all.depths).toEqual([2, 2, 1]);
  });

  it('returns the element itself when all ids point to the same element', () => {
    document.body.innerHTML = '<div><button id="solo">S</button></div>';
    const id = pageObserver.register(document.querySelector('#solo')!);

    const result = findCommonAncestor([id, id, id]);

    expect(result.sameElement).toBe(true);
    expect(result.depths).toEqual([0, 0, 0]);
    expect(result.elementId).toBe(id);
  });

  it('crosses shadow roots when computing ancestors', () => {
    document.body.innerHTML = '<div id="host"></div><button id="outside">O</button>';
    const host = document.querySelector('#host')!;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button id="inner">I</button>';
    const idInner = pageObserver.register(shadow.querySelector('#inner')!);
    const idOutside = pageObserver.register(document.querySelector('#outside')!);

    const result = findCommonAncestor([idInner, idOutside]);

    expect(result.elementId).toBe(pageObserver.register(document.body));
    expect(result.tag).toBe('body');
  });

  it('rejects fewer than two elements', () => {
    document.body.innerHTML = '<button id="only">O</button>';
    const id = pageObserver.register(document.querySelector('#only')!);

    expect(() => findCommonAncestor([id])).toThrow('至少需要两个元素');
  });
});
