import { fixture } from '../packages/shared/reviewer-fixture';
import { expect, test } from './fixtures';

const path = '/app/meetings/recording-walkthrough';

// Public media crosses the network. Assert decoded frames, not just the
// synchronously assigned currentTime, before continuing to the next interaction.
test.setTimeout(90000);
const mediaTimeout = 30000;

test('featured real meeting plays, seeks, changes speed and follows the speaker', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/app');
  await page.getByRole('link', { name: 'Explore meeting' }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(
    page.getByRole('heading', { name: 'From conversation to recording' }),
  ).toBeVisible();
  const video = page.locator('video');
  await expect
    .poll(() => video.evaluate((element) => element.readyState))
    .toBeGreaterThanOrEqual(2);
  expect(await video.evaluate((element) => element.duration)).toBeGreaterThan(
    103,
  );
  expect(await video.evaluate((element) => element.controls)).toBe(true);
  await page
    .getByRole('button', { name: 'Play recording', exact: true })
    .click();
  await expect
    .poll(() => video.evaluate((element) => element.currentTime))
    .toBeGreaterThan(0.25);
  await page
    .getByRole('button', { name: 'Pause recording', exact: true })
    .click();
  await page.getByRole('button', { name: 'Seek to 1:37' }).click();
  await expect
    .poll(
      () =>
        video.evaluate(
          (element) => !element.seeking && element.readyState >= 2,
        ),
      { timeout: mediaTimeout },
    )
    .toBe(true);
  await expect
    .poll(() => video.evaluate((element) => element.currentTime))
    .toBeCloseTo(97.17, 1);
  await expect(
    page.locator('[data-segment-id="participant-turn"]'),
  ).toHaveClass(/is-active/);
  expect(await video.evaluate((element) => element.paused)).toBe(true);
  await page
    .getByRole('combobox', { name: 'Playback speed' })
    .selectOption('1.5');
  expect(await video.evaluate((element) => element.playbackRate)).toBe(1.5);
  await page.getByRole('button', { name: 'Seek to 0:02' }).click();
  await expect
    .poll(
      () =>
        video.evaluate(
          (element) => !element.seeking && element.readyState >= 2,
        ),
      { timeout: mediaTimeout },
    )
    .toBe(true);
  await expect
    .poll(() => video.evaluate((element) => element.currentTime))
    .toBeCloseTo(2.7, 1);
  await page
    .getByRole('button', { name: 'Play recording', exact: true })
    .click();
  await expect(page.locator('[data-segment-id="presenter-turn"]')).toHaveClass(
    /is-active/,
  );
  await video.evaluate((element) => {
    element.currentTime = 96.8;
  });
  await expect
    .poll(
      () =>
        video.evaluate(
          (element) => !element.seeking && element.readyState >= 2,
        ),
      { timeout: mediaTimeout },
    )
    .toBe(true);
  await expect(
    page.locator('[data-segment-id="participant-turn"]'),
  ).toHaveClass(/is-active/);
  await expect
    .poll(() =>
      page
        .locator('[data-segment-id="participant-turn"]')
        .evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.top >= 0 && bounds.bottom <= innerHeight;
        }),
    )
    .toBe(true);
  await page.getByRole('checkbox', { name: 'Follow playback' }).uncheck();
  await expect(
    page.getByRole('checkbox', { name: 'Follow playback' }),
  ).not.toBeChecked();
  await page
    .getByRole('button', { name: 'Pause recording', exact: true })
    .click();
  await page.reload();
  await expect(page.getByRole('heading', { name: /Transcript/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('failed recording preserves transcript and can retry', async ({
  page,
}) => {
  await page.route('**/media/*.webm', (route) => route.abort());
  await page.goto(path);
  await expect(
    page.getByRole('heading', { name: 'Recording couldn’t load' }),
  ).toBeVisible();
  await expect(
    page.getByText('But my video is not getting recorded.', { exact: false }),
  ).toBeAttached();
  await expect(
    page.getByRole('button', { name: 'Seek to 1:37' }),
  ).toBeDisabled();
  await page.unroute('**/media/*.webm');
  await page.getByRole('button', { name: 'Retry recording' }).click();
  await expect
    .poll(() => page.locator('video').evaluate((element) => element.readyState))
    .toBeGreaterThanOrEqual(2);
  await expect(
    page.getByRole('button', { name: 'Seek to 1:37' }),
  ).toBeEnabled();
});

test('meeting data failure retries and empty transcript still permits playback', async ({
  page,
}) => {
  const route = '**/api/meetings/recording-walkthrough/recording';
  await page.route(route, (handler) =>
    handler.fulfill({ status: 503, body: '{}' }),
  );
  await page.goto(path);
  await expect(
    page.getByRole('heading', { name: 'We couldn’t load this meeting' }),
  ).toBeVisible();
  await page.unroute(route);
  await page.route(route, async (handler) => {
    const data = structuredClone(fixture);
    await handler.fulfill({ json: { ...data, segments: [] } });
  });
  await page.getByRole('button', { name: 'Retry meeting' }).click();
  await expect(
    page.getByRole('heading', { name: 'No transcript available' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Play recording', exact: true })
    .click();
  await expect
    .poll(() =>
      page.locator('video').evaluate((element) => element.currentTime),
    )
    .toBeGreaterThan(0.25);
});

test('timestamp selected before metadata loads is applied when media is ready', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/media/*.webm', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(path);
  await expect(
    page.getByText('Loading recording…', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Seek to 1:37' }).click();
  release();
  await expect
    .poll(() =>
      page.locator('video').evaluate((element) => element.currentTime),
    )
    .toBeCloseTo(97.17, 1);
});

test('three summary templates differ and action sources seek the recording', async ({
  page,
}) => {
  await page.goto(path);
  const general = page.getByRole('button', { name: /General Balanced recap/ });
  const sales = page.getByRole('button', {
    name: /Sales \/ Customer Needs and value/,
  });
  const recruiting = page.getByRole('button', {
    name: /Recruiting \/ Interview Conversation signals/,
  });
  await expect(general).toHaveAttribute('aria-pressed', 'true');
  for (const template of [general, sales, recruiting]) {
    await expect(template.locator('strong')).toBeVisible();
  }
  await expect(
    page.getByRole('heading', {
      name: 'How the recording workflow fits together',
    }),
  ).toBeVisible();

  await sales.click();
  await expect(sales).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('heading', {
      name: 'A product walkthrough centered on less note-taking',
    }),
  ).toBeVisible();
  await expect(page.getByText('Friction observed')).toBeVisible();

  await recruiting.click();
  await expect(recruiting).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('heading', {
      name: 'Clear facilitation, with limited interview evidence',
    }),
  ).toBeVisible();
  await expect(
    page.getByText('No role history, motivation, or hiring criteria'),
  ).toBeVisible();

  await expect(
    page.getByRole('heading', { name: 'Action items' }),
  ).toBeVisible();
  await expect(page.getByText('End the current meeting')).toBeVisible();
  await expect(
    page.getByText('Open “View recording and summary”'),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Seek to source at 1:14' })
    .first()
    .click();
  await expect
    .poll(() =>
      page.locator('video').evaluate((element) => element.currentTime),
    )
    .toBeCloseTo(74, 1);
});
