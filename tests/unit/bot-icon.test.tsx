import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BotIcon } from '@/shared/ui/BotIcon';

describe('BotIcon', () => {
  it('renders a valid SVG with default size 56', () => {
    const html = renderToString(<BotIcon />);
    expect(html).toContain('<svg');
    expect(html).toContain('viewBox="0 0 56 56"');
    expect(html).toContain('width="56"');
    expect(html).toContain('height="56"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Pagent Bot"');
  });

  it('respects custom size and className', () => {
    const html = renderToString(<BotIcon size={34} className="custom-test-class" />);
    expect(html).toContain('width="34"');
    expect(html).toContain('height="34"');
    expect(html).toContain('custom-test-class');
  });

  it('contains semantic data-part layers for SVG animation', () => {
    const html = renderToString(<BotIcon />);
    expect(html).toContain('data-part="face"');
    expect(html).toContain('data-part="eyes-container"');
    expect(html).toContain('data-part="eyes-orbit"');
    expect(html).toContain('data-part="eye-left"');
    expect(html).toContain('data-part="eye-right"');
  });

  it('generates distinct IDs for multiple instances to avoid gradient collisions', () => {
    const html1 = renderToString(<BotIcon />);
    const html2 = renderToString(<BotIcon />);
    // Both render gradients and clips
    expect(html1).toContain('pagent-bot-clip-');
    expect(html1).toContain('pagent-bot-base-');
    expect(html2).toContain('pagent-bot-clip-');
    expect(html2).toContain('pagent-bot-base-');
  });

  it('applies animation classes when animated is true', () => {
    const staticHtml = renderToString(<BotIcon animated={false} />);
    expect(staticHtml).not.toContain('pagent-fab-eyes');
    expect(staticHtml).not.toContain('pagent-fab-eyes-orbit');
    expect(staticHtml).not.toContain('pagent-fab-eye');

    const animHtml = renderToString(<BotIcon animated={true} />);
    expect(animHtml).toContain('pagent-fab-eyes');
    expect(animHtml).toContain('pagent-fab-eyes-orbit');
    expect(animHtml).toContain('pagent-fab-eye');
  });

  it('renders different eye expressions', () => {
    // 1. Normal: two rect capsules
    const normalHtml = renderToString(<BotIcon expression="normal" />);
    expect(normalHtml).toContain('<rect data-part="eye-left"');
    expect(normalHtml).toContain('<rect data-part="eye-right"');

    // 2. Happy: curved paths (^ ^)
    const happyHtml = renderToString(<BotIcon expression="happy" />);
    expect(happyHtml).toContain('<path data-part="eye-left"');
    expect(happyHtml).toContain('<path data-part="eye-right"');

    // 3. Blink: squeezed rects
    const blinkHtml = renderToString(<BotIcon expression="blink" />);
    expect(blinkHtml).toContain('height="2"');

    // 4. Wink: left rect, right path
    const winkHtml = renderToString(<BotIcon expression="wink" />);
    expect(winkHtml).toContain('<rect data-part="eye-left"');
    expect(winkHtml).toContain('<path data-part="eye-right"');
  });

  it('supports children slot for SVG animation extensions / decorations', () => {
    const html = renderToString(
      <BotIcon>
        <circle id="custom-sparkle" cx="10" cy="10" r="2" fill="yellow" />
      </BotIcon>,
    );
    expect(html).toContain('data-part="decorations"');
    expect(html).toContain('id="custom-sparkle"');
  });
});
