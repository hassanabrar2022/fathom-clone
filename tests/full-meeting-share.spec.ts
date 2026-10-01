import { expect, test, publicPaths } from './fixtures';

const publicMeeting = '/app/meetings/recording-walkthrough';
const privateId = '88888888-8888-4888-8888-888888888888';
const token = 'c'.repeat(64);
const sharePath = `/share/meeting-${token}`;

test.setTimeout(90000);

test('public recording opens a complete read-only meeting view in a clean browser', async ({
  page,
  browser,
}) => {
  await page.goto(publicMeeting);
  await page.getByRole('button', { name: 'Share meeting' }).click();
  const link = page.getByRole('textbox', { name: 'Public meeting link' });
  await expect(link).toHaveValue(/\/share\/meeting-[a-f0-9]{64}$/);

  const clean = await browser.newContext();
  const visitor = await clean.newPage();
  await visitor.goto(await link.inputValue());
  await expect(
    visitor.getByRole('heading', { name: 'From conversation to recording' }),
  ).toBeVisible();
  await expect(visitor.getByText('Shared via Fathom Clone')).toBeVisible();
  await expect(visitor.getByRole('navigation')).toHaveCount(0);
  await expect(visitor.locator('.transcript-turn')).toHaveCount(2);
  await expect(
    visitor.getByRole('heading', { name: 'Fathom Clone intelligence' }),
  ).toBeVisible();
  await visitor.getByRole('button', { name: 'Sales / Customer' }).click();
  await expect(
    visitor.getByText('AI SUMMARY · Sales / Customer'),
  ).toBeVisible();
  await visitor
    .getByRole('button', { name: 'Seek to 1:37 from Participant' })
    .click();
  await expect
    .poll(() => visitor.locator('video').evaluate((video) => video.currentTime))
    .toBeCloseTo(97.17, 1);
  await expect(visitor.locator('.transcript-turn.is-active')).toHaveCount(1);
  await visitor
    .getByRole('button', { name: 'Seek to source at 1:14' })
    .first()
    .click();
  await expect
    .poll(() => visitor.locator('video').evaluate((video) => video.currentTime))
    .toBeGreaterThan(70);
  expect(
    await visitor.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await clean.close();
});

test('private owner creates and revokes an unguessable full-meeting link', async ({
  page,
  browser,
  context,
}) => {
  let shared = false;
  const privateMeeting = {
    id: privateId,
    title: 'Fictional planning conversation',
    media_type: 'video/webm',
    media_size: 4,
    duration_seconds: 104,
    status: 'complete',
    processing_progress: 100,
    processing_error: null,
    created_at: '2026-09-14T12:00:00Z',
    transcript: [
      {
        id: 'first',
        speakerId: 'speaker',
        start: 2.7,
        end: 8,
        paragraphs: ['We reviewed the launch plan.'],
      },
      {
        id: 'second',
        speakerId: 'speaker',
        start: 26,
        end: 32,
        paragraphs: ['The budget needs another review.'],
      },
    ],
    intelligence: null,
  };
  const routeMedia = async (route: import('@playwright/test').Route) => {
    const response = await route.fetch({
      url: new URL(
        '/media/recording-walkthrough-optimized.webm',
        route.request().url(),
      ).href,
    });
    await route.fulfill({ response });
  };
  await context.route('**/api/uploads', (route) => route.fulfill({ json: [] }));
  await context.route(`**/api/uploads/${privateId}`, (route) =>
    route.fulfill({ json: privateMeeting }),
  );
  await context.route(`**/api/uploads/${privateId}/media`, routeMedia);
  await context.route(`**/api/uploads/${privateId}/share`, (route) => {
    if (route.request().method() === 'POST') shared = true;
    if (route.request().method() === 'DELETE') shared = false;
    return route.fulfill({ json: { path: shared ? sharePath : null } });
  });
  await page.goto(`/app/meetings/${privateId}`);
  await page.getByRole('button', { name: 'Share meeting' }).click();
  await expect(
    page.getByText(/Creating a link will make the full recording/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Create public link' }).click();
  const link = page.getByRole('textbox', { name: 'Public meeting link' });
  await expect(link).toHaveValue(new RegExp(`${sharePath}$`));

  const clean = await browser.newContext();
  await clean.route(`**/api/shares/${token}`, (route) =>
    route.fulfill(
      shared
        ? {
            json: {
              title: privateMeeting.title,
              description: 'A fictional planning conversation.',
              duration: privateMeeting.duration_seconds,
              mediaUrl: `/api/shares/${token}/media`,
              mediaType: 'video/webm',
              speakers: [{ id: 'speaker', name: 'Speaker' }],
              segments: privateMeeting.transcript,
              intelligence: null,
            },
          }
        : { status: 404, json: { message: 'Unavailable' } },
    ),
  );
  await clean.route(`**/api/shares/${token}/media`, routeMedia);
  const visitor = await clean.newPage();
  expect(await clean.cookies()).toEqual([]);
  await visitor.goto(await link.inputValue());
  await expect(
    visitor.getByRole('heading', { name: privateMeeting.title }),
  ).toBeVisible();
  await expect(
    visitor.getByRole('heading', { name: 'No AI notes available' }),
  ).toBeVisible();
  await visitor
    .getByRole('button', { name: 'Seek to 0:26 from Speaker' })
    .click();
  await expect
    .poll(() => visitor.locator('video').evaluate((video) => video.currentTime))
    .toBeCloseTo(26, 1);
  await page.getByRole('button', { name: 'Revoke public link' }).click();
  await expect(page.getByText(/Link revoked/)).toBeVisible();
  await visitor.reload();
  await expect(
    visitor.getByRole('heading', {
      name: 'This shared meeting isn’t available',
    }),
  ).toBeVisible();
  await expect(visitor.locator('video')).toHaveCount(0);
  await context.unrouteAll({ behavior: 'ignoreErrors' });
  await clean.unrouteAll({ behavior: 'ignoreErrors' });
  await clean.close();
});

test('shared meeting loading failures recover and empty transcript stays honest', async ({
  page,
}) => {
  const publicPath = (await publicPaths(page)).meeting;
  let fail = true;
  await page.route('**/api/shares/*', async (route) => {
    if (fail) {
      await route.fulfill({ status: 503 });
    } else {
      await route.fallback();
    }
  });
  await page.goto(publicPath);
  await expect(
    page.getByRole('heading', { name: 'This meeting couldn’t load' }),
  ).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(
    page.getByRole('heading', { name: 'From conversation to recording' }),
  ).toBeVisible();

  await page.route(`**/api/shares/${token}`, (route) =>
    route.fulfill({
      json: {
        title: 'Silent review',
        description: 'No speech detected in this recording.',
        duration: 104,
        mediaUrl: `/api/shares/${token}/media`,
        mediaType: 'video/webm',
        speakers: [{ id: 'speaker', name: 'Speaker' }],
        segments: [],
        intelligence: null,
      },
    }),
  );
  await page.route(`**/api/shares/${token}/media`, (route) =>
    route.fulfill({
      path: 'apps/web/public/media/recording-walkthrough-optimized.webm',
      contentType: 'video/webm',
    }),
  );
  await page.goto(sharePath);
  await expect(
    page.getByText('No spoken transcript is available for this recording.'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'No AI notes available' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
