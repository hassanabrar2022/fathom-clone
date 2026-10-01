import { expect, test, publicPaths, type Page } from './fixtures';

const showcaseRoutes = (paths: { meeting: string; moment: string }) =>
  [
    { path: '/app', ready: '.featured' },
    { path: '/app/upload', ready: '.upload-layout' },
    {
      path: '/app/meetings/recording-walkthrough',
      ready: '.recording-layout',
    },
    {
      path: paths.meeting,
      ready: '.full-share-grid',
    },
    { path: paths.moment, ready: '.share-content-grid' },
  ] as const;

const viewportMatrix = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const;

async function expectContained(page: Page) {
  const height = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  for (const y of [0, Math.round(height / 2), height]) {
    await page.evaluate((top) => scrollTo(0, top), y);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      )
      .toBe(true);
  }
}

test('the complete showcase path stays contained at target widths', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'One browser covers the explicit viewport matrix.',
  );
  test.setTimeout(120_000);
  const paths = await publicPaths(page);

  for (const viewport of viewportMatrix) {
    await page.setViewportSize(viewport);
    for (const route of showcaseRoutes(paths)) {
      await page.goto(route.path);
      await expect(page.locator(route.ready)).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expectContained(page);
    }

    await page.goto('/app/meetings/recording-walkthrough');
    await expect(page.locator('.recording-layout')).toBeVisible();
    const meetingLayout = await page.evaluate(() => {
      const player = document.querySelector('.recording-column')!;
      const intelligence = document.querySelector('.intelligence-panel')!;
      const transcript = document.querySelector('.transcript-panel')!;
      const rect = (element: Element) => element.getBoundingClientRect();
      return {
        playerBottom: rect(player).bottom,
        intelligenceTop: rect(intelligence).top,
        intelligenceBottom: rect(intelligence).bottom,
        transcriptTop: rect(transcript).top,
        transcriptSize: Number.parseFloat(
          getComputedStyle(document.querySelector('.turn-text')!).fontSize,
        ),
      };
    });
    if (viewport.width <= 1100) {
      expect(meetingLayout.playerBottom).toBeLessThanOrEqual(
        meetingLayout.intelligenceTop + 1,
      );
      expect(meetingLayout.intelligenceBottom).toBeLessThanOrEqual(
        meetingLayout.transcriptTop + 1,
      );
    }
    if (viewport.width <= 600) {
      expect(meetingLayout.transcriptSize).toBeGreaterThanOrEqual(14);
    }
  }
});

test('critical private and public load failures recover on mobile', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'This audit sets its own mobile viewport.',
  );
  const momentPath = (await publicPaths(page)).moment;
  await page.setViewportSize({ width: 390, height: 844 });

  let failRecording = true;
  await page.route(
    '**/api/meetings/recording-walkthrough/recording',
    (route) => {
      return failRecording
        ? route.fulfill({ status: 503, body: '{}' })
        : route.fallback();
    },
  );
  await page.goto('/app/meetings/recording-walkthrough');
  await expect(
    page.getByRole('heading', { name: 'We couldn’t load this meeting' }),
  ).toBeVisible();
  await expectContained(page);
  failRecording = false;
  await page.getByRole('button', { name: 'Retry meeting' }).click();
  await expect(page.locator('.recording-layout')).toBeVisible();
  await expectContained(page);

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  let failShare = true;
  await page.route('**/api/moments/*', (route) => {
    return failShare
      ? route.fulfill({ status: 503, body: '{}' })
      : route.fallback();
  });
  await page.goto(momentPath);
  await expect(
    page.getByRole('heading', { name: 'This moment couldn’t load' }),
  ).toBeVisible();
  await expectContained(page);
  failShare = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.share-content-grid')).toBeVisible();
  await expectContained(page);
});
