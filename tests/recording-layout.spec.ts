import { expect, test } from './fixtures';

const path = '/app/meetings/recording-walkthrough';

test('meeting columns remain contained from top to bottom at target widths', async ({
  page,
}) => {
  test.setTimeout(120000);

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1280, height: 900 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: 'Fathom Clone intelligence' }),
    ).toBeVisible();

    const documentHeight = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    for (const scrollY of [
      0,
      Math.round(documentHeight * 0.35),
      Math.round(documentHeight * 0.7),
      documentHeight,
    ]) {
      await page.evaluate((nextY) => scrollTo(0, nextY), scrollY);
      const layout = await page.evaluate(() => {
        const bounds = (selector: string) => {
          const element = document.querySelector(selector);
          if (!element) throw new Error(`Missing ${selector}`);
          const rect = element.getBoundingClientRect();
          return {
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            containsChildren: element.scrollWidth <= element.clientWidth + 1,
          };
        };
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          player: bounds('.recording-column'),
          transcript: bounds('.transcript-panel'),
          intelligence: bounds('.intelligence-panel'),
          intelligencePosition: getComputedStyle(
            document.querySelector('.intelligence-panel')!,
          ).position,
          playerPosition: getComputedStyle(
            document.querySelector('.recording-column')!,
          ).position,
        };
      });

      expect(layout.overflow).toBe(false);
      expect(layout.playerPosition).toBe('static');
      expect(layout.player.containsChildren).toBe(true);
      expect(layout.transcript.containsChildren).toBe(true);
      expect(layout.intelligence.containsChildren).toBe(true);
      expect(layout.player.bottom).toBeLessThanOrEqual(
        layout.transcript.top + 1,
      );
      if (viewport.width > 1100) {
        expect(layout.intelligencePosition).toBe('static');
        expect(layout.player.right).toBeLessThan(layout.intelligence.left);
        expect(layout.transcript.right).toBeLessThan(layout.intelligence.left);
      } else {
        expect(layout.intelligencePosition).toBe('static');
        expect(layout.player.bottom).toBeLessThanOrEqual(
          layout.intelligence.top + 1,
        );
        expect(layout.intelligence.bottom).toBeLessThanOrEqual(
          layout.transcript.top + 1,
        );
      }
    }
  }
});
