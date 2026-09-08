import { describe, expect, it } from 'vitest';
import { runNamedScript } from '@/features/page/actions/scripts';
import type { ObservedElement } from '@/shared/contracts/page';

function stubBoundingBox(el: Element, width = 100, height = 40) {
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 10,
      y: 10,
      top: 10,
      left: 10,
      right: 10 + width,
      bottom: 10 + height,
      width,
      height,
      toJSON: () => ({}),
    }),
  });
}

describe('extract_interactions with cursor detection', () => {
  it('extracts non-semantic elements with cursor: pointer as actionable targets', () => {
    document.body.innerHTML = `
      <div id="btn-card" style="cursor: pointer">自定义卡片</div>
      <span id="btn-tag" style="cursor: pointer">标签按钮</span>
      <div id="plain-text">普通文本</div>
    `;
    stubBoundingBox(document.getElementById('btn-card')!);
    stubBoundingBox(document.getElementById('btn-tag')!);
    stubBoundingBox(document.getElementById('plain-text')!);

    const result = runNamedScript('extract_interactions') as {
      elements: ObservedElement[];
      total: number;
    };

    const card = result.elements.find((el) => el.name === '自定义卡片');
    const tag = result.elements.find((el) => el.name === '标签按钮');
    const plain = result.elements.find((el) => el.name === '普通文本');

    expect(card).toBeDefined();
    expect(card).toMatchObject({
      tag: 'div',
      clickable: true,
      actionable: true,
      cursor: 'pointer',
      actions: expect.arrayContaining(['activate']),
    });

    expect(tag).toBeDefined();
    expect(tag).toMatchObject({
      tag: 'span',
      clickable: true,
      actionable: true,
      cursor: 'pointer',
      actions: expect.arrayContaining(['activate']),
    });

    expect(plain).toBeUndefined();
  });

  it('recognizes other interactive cursor types like grab, zoom-in, col-resize', () => {
    document.body.innerHTML = `
      <div id="drag-handle" style="cursor: grab">拖拽排序</div>
      <div id="zoom-img" style="cursor: zoom-in">放大查看</div>
      <div id="resizer" style="cursor: col-resize">调整列宽</div>
    `;
    stubBoundingBox(document.getElementById('drag-handle')!);
    stubBoundingBox(document.getElementById('zoom-img')!);
    stubBoundingBox(document.getElementById('resizer')!);

    const result = runNamedScript('extract_interactions') as {
      elements: ObservedElement[];
    };

    const drag = result.elements.find((el) => el.name === '拖拽排序');
    const zoom = result.elements.find((el) => el.name === '放大查看');
    const resize = result.elements.find((el) => el.name === '调整列宽');

    expect(drag).toMatchObject({
      clickable: true,
      actionable: true,
      cursor: 'grab',
      actions: expect.arrayContaining(['activate']),
    });
    expect(zoom).toMatchObject({
      clickable: true,
      actionable: true,
      cursor: 'zoom-in',
    });
    expect(resize).toMatchObject({
      clickable: true,
      actionable: true,
      cursor: 'col-resize',
    });
  });

  it('ignores non-interactive cursor types like default, text, and not-allowed', () => {
    document.body.innerHTML = `
      <div id="default-box" style="cursor: default">默认光标</div>
      <div id="text-box" style="cursor: text">文本光标</div>
      <div id="disabled-box" style="cursor: not-allowed">禁用光标</div>
    `;
    stubBoundingBox(document.getElementById('default-box')!);
    stubBoundingBox(document.getElementById('text-box')!);
    stubBoundingBox(document.getElementById('disabled-box')!);

    const result = runNamedScript('extract_interactions') as {
      elements: ObservedElement[];
    };

    expect(result.elements.some((el) => el.name === '默认光标')).toBe(false);
    expect(result.elements.some((el) => el.name === '文本光标')).toBe(false);
    expect(result.elements.some((el) => el.name === '禁用光标')).toBe(false);
  });

  it('deduplicates inherited cursors and only collects the origin container', () => {
    document.body.innerHTML = `
      <div id="card" style="cursor: pointer">
        <h3>卡片标题</h3>
        <p>卡片说明文字 <span>标签</span></p>
      </div>
    `;
    stubBoundingBox(document.getElementById('card')!);
    stubBoundingBox(document.querySelector('h3')!);
    stubBoundingBox(document.querySelector('p')!);
    stubBoundingBox(document.querySelector('span')!);

    const result = runNamedScript('extract_interactions') as {
      elements: ObservedElement[];
    };

    // 只有顶层定义了 cursor: pointer 的卡片容器被收入
    expect(result.elements.some((el) => el.tag === 'div' && el.cursor === 'pointer')).toBe(true);
    // 子元素即使继承了 computedStyle.cursor === 'pointer'，也不被重复录入
    expect(result.elements.some((el) => el.tag === 'h3')).toBe(false);
    expect(result.elements.some((el) => el.tag === 'p')).toBe(false);
    expect(result.elements.some((el) => el.tag === 'span')).toBe(false);
  });

  it('collects nested elements if they explicitly declare interactive cursor or are interactive controls', () => {
    document.body.innerHTML = `
      <div id="container" style="cursor: pointer">
        <span id="title">商品详情</span>
        <button id="buy">购买</button>
        <span id="action" style="cursor: pointer">收藏</span>
      </div>
    `;
    stubBoundingBox(document.getElementById('container')!);
    stubBoundingBox(document.getElementById('title')!);
    stubBoundingBox(document.getElementById('buy')!);
    stubBoundingBox(document.getElementById('action')!);

    const result = runNamedScript('extract_interactions') as {
      elements: ObservedElement[];
    };

    // 容器被收入
    expect(result.elements.some((el) => el.id.length > 0 && el.tag === 'div')).toBe(true);
    // 普通子元素 span#title 仅继承光标，被去重排除
    expect(result.elements.some((el) => el.name === '商品详情')).toBe(false);
    // 原生按钮被收入
    expect(result.elements.some((el) => el.name === '购买' && el.tag === 'button')).toBe(true);
    // 显式声明了 cursor: pointer 的内层 span#action 被收入
    expect(result.elements.some((el) => el.name === '收藏' && el.tag === 'span')).toBe(true);
  });
});
