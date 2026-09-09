import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/shared/ui/select';

// @ts-expect-error test environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Select toggle and dismissal behavior', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    window.HTMLElement.prototype.setPointerCapture = vi.fn();
    window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('toggles open and closed across multiple click cycles without flashing or auto-closing', async () => {
    const root = createRoot(container);
    let openState = false;

    function TestComponent() {
      return (
        <Select
          onOpenChange={(next) => {
            openState = next;
          }}
        >
          <SelectTrigger data-testid="trigger">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="model-a">Model A</SelectItem>
            <SelectItem value="model-b">Model B</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    await act(async () => {
      root.render(<TestComponent />);
    });

    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute('data-state')).toBe('closed');

    // Cycle 1: Click 1 -> opens and STAYS open (no flash/instant close)
    await act(async () => {
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
    });
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(trigger.getAttribute('data-state')).toBe('open');
    expect(openState).toBe(true);

    // Cycle 1: Click 2 on trigger -> toggles CLOSED
    await act(async () => {
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
    });
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(trigger.getAttribute('data-state')).toBe('closed');
    expect(openState).toBe(false);

    // Cycle 2: Click 3 on trigger -> opens again and STAYS open
    await act(async () => {
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
    });
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(trigger.getAttribute('data-state')).toBe('open');
    expect(openState).toBe(true);

    // Cycle 2: Click 4 on trigger -> closes again
    await act(async () => {
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
    });
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(trigger.getAttribute('data-state')).toBe('closed');
    expect(openState).toBe(false);
  });

  it('closes when clicking outside the select', async () => {
    const root = createRoot(container);

    function TestComponent() {
      return (
        <div>
          <button id="outside-button">Outside</button>
          <Select>
            <SelectTrigger data-testid="trigger">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="model-a">Model A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    await act(async () => {
      root.render(<TestComponent />);
    });

    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLButtonElement;
    const outsideBtn = container.querySelector('#outside-button') as HTMLButtonElement;

    // Open it
    await act(async () => {
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
    });
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(trigger.getAttribute('data-state')).toBe('open');

    // Click outside
    await act(async () => {
      outsideBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    });

    expect(trigger.getAttribute('data-state')).toBe('closed');
  });

  it('closes on Space or Enter keydown on trigger when already open', async () => {
    const root = createRoot(container);

    function TestComponent() {
      return (
        <Select>
          <SelectTrigger data-testid="trigger">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="model-a">Model A</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    await act(async () => {
      root.render(<TestComponent />);
    });

    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLButtonElement;

    // Open via pointerdown
    await act(async () => {
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
    });
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(trigger.getAttribute('data-state')).toBe('open');

    // Keydown Enter when open
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    expect(trigger.getAttribute('data-state')).toBe('closed');
  });
});
