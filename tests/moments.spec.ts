import { expect, test, publicPaths } from './fixtures';

const meetingPath = '/app/meetings/recording-walkthrough';
const fixtureRoute = '**/api/moments/*';

test.setTimeout(90000);

test('transcript moment persists and opens with the correct context in a clean browser', async ({
  browser,
  browserName,
  context,
  page,
}) => {
  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  }
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(meetingPath);
  await expect(page.getByRole('heading', { name: /Moments 1/ })).toBeVisible();

  await page
    .getByRole('button', { name: 'Save moment from transcript at 1:37' })
    .click();
  const composer = page.locator('.moment-composer');
  await expect(
    composer.getByRole('heading', {
      name: 'Capture this part of the conversation',
    }),
  ).toBeVisible();
  await composer.getByLabel('Title').fill('Participant recording concern');
  await composer
    .getByLabel('Note optional')
    .fill('Review the final handoff before the meeting ends.');
  await expect(composer.getByLabel('Start (seconds)')).toHaveValue('97.17');
  await expect(composer.getByLabel('End (seconds)')).toHaveValue('103.8');
  await composer.getByRole('button', { name: 'Save moment' }).click();

  await expect(
    page.getByRole('heading', { name: 'Participant recording concern' }),
  ).toBeVisible();
  await expect(page.getByText('Moment saved to this meeting.')).toBeVisible();
  const publicLink = page.getByRole('link', {
    name: 'Open public view for Participant recording concern',
  });
  const href = await publicLink.getAttribute('href');
  expect(href).toMatch(/^\/share\/moment-[a-f0-9]{64}$/);
  await page
    .getByRole('button', {
      name: 'Copy public link for Participant recording concern',
    })
    .click();
  await expect(page.getByText('Link copied')).toBeVisible();
  if (browserName === 'chromium') {
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      new URL(href!, page.url()).toString(),
    );
  }

  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Participant recording concern' }),
  ).toBeVisible();

  const cleanContext = await browser.newContext();
  const visitor = await cleanContext.newPage();
  const visitorErrors: string[] = [];
  visitor.on('pageerror', (error) => visitorErrors.push(error.message));
  await visitor.goto(new URL(href!, page.url()).toString());
  await expect(
    visitor.getByRole('heading', { name: 'Participant recording concern' }),
  ).toBeVisible();
  await expect(visitor.getByText('Shared via Fathom Clone')).toBeVisible();
  await expect(
    visitor.getByRole('heading', { name: 'From conversation to recording' }),
  ).toBeVisible();
  await expect(
    visitor.getByText('A real reference demo of recording controls', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    visitor.getByText('But my video is not getting recorded.', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(visitor.locator('.sidebar')).toHaveCount(0);
  const video = visitor.locator('video');
  await expect
    .poll(() => video.evaluate((element) => element.readyState), {
      timeout: 30000,
    })
    .toBeGreaterThanOrEqual(1);
  await expect
    .poll(() => video.evaluate((element) => element.currentTime), {
      timeout: 30000,
    })
    .toBeCloseTo(97.17, 1);
  expect(
    await visitor.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(visitorErrors).toEqual([]);
  await cleanContext.close();
  expect(errors).toEqual([]);
});

test('shared moment visibly ends at its bounded timestamp', async ({
  page,
}) => {
  await page.goto((await publicPaths(page)).moment);
  const video = page.locator('video');
  await expect
    .poll(() => video.evaluate((element) => element.readyState), {
      timeout: 30000,
    })
    .toBeGreaterThanOrEqual(1);
  await page.getByRole('button', { name: 'Play moment' }).click();
  await video.evaluate((element) => {
    element.currentTime = 103.6;
  });
  await expect
    .poll(
      () =>
        video.evaluate(
          (element) => !element.seeking && element.readyState >= 2,
        ),
      { timeout: 30000 },
    )
    .toBe(true);
  await expect(page.getByRole('button', { name: 'Replay moment' })).toBeVisible(
    { timeout: 30000 },
  );
  await expect
    .poll(() => video.evaluate((element) => element.paused))
    .toBe(true);
  await page.getByRole('button', { name: 'Replay moment' }).click();
  await expect
    .poll(() => video.evaluate((element) => element.currentTime))
    .toBeLessThan(98.5);
});

test('share loading failure retries and malformed links recover safely', async ({
  page,
}) => {
  const url = (await publicPaths(page)).moment;
  await page.route(fixtureRoute, (route) =>
    route.fulfill({ status: 503, body: '{}' }),
  );
  await page.goto(url);
  await expect(
    page.getByRole('heading', { name: 'This moment couldn’t load' }),
  ).toBeVisible();
  await page.unroute(fixtureRoute);
  await page.route('**/media/*.webm', (route) => route.abort());
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(
    page.getByRole('heading', { name: 'Recording issue before wrap-up' }),
  ).toBeVisible();
  await expect(page.getByText('Recording couldn’t load')).toBeVisible();
  await expect(
    page.getByText('But my video is not getting recorded.', { exact: false }),
  ).toBeVisible();
  await page.unroute('**/media/*.webm');
  await page.getByRole('button', { name: 'Retry recording' }).click();
  await expect
    .poll(
      () => page.locator('video').evaluate((element) => element.readyState),
      {
        timeout: 30000,
      },
    )
    .toBeGreaterThanOrEqual(1);

  await page.goto(
    '/share/recording-walkthrough-invalid?start=20&end=100&title=Too+long',
  );
  await expect(
    page.getByRole('heading', {
      name: 'This shared moment isn’t available',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Explore Fathom Clone' }),
  ).toBeVisible();
});
