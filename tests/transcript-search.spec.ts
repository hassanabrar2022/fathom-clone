import { fixture } from '../packages/shared/reviewer-fixture';
import { expect, test } from './fixtures';

const publicMeeting = '/app/meetings/recording-walkthrough';
const privateId = '88888888-8888-4888-8888-888888888888';

test.setTimeout(90000);

test('meeting transcript search opens a real source and clears cleanly', async ({
  page,
}) => {
  await page.goto(publicMeeting);
  const search = page.getByRole('searchbox', {
    name: 'Search this transcript',
  });
  await search.fill('video is not getting recorded');
  await expect(page.getByText('1 matching passage')).toBeVisible();
  await expect(page.locator('.transcript-match mark')).toHaveText(
    'video is not getting recorded',
  );
  await expect(page.locator('.turn-text mark')).toHaveText(
    'video is not getting recorded',
  );
  await page
    .getByRole('button', { name: 'View match 1 at 1:37 from Participant' })
    .click();
  const video = page.locator('video');
  await expect
    .poll(
      () =>
        video.evaluate(
          (element) => !element.seeking && element.readyState >= 2,
        ),
      { timeout: 30000 },
    )
    .toBe(true);
  await expect
    .poll(() => video.evaluate((element) => element.currentTime))
    .toBeCloseTo(97.17, 1);
  await expect(
    page.locator('[data-segment-id="participant-turn"]'),
  ).toHaveClass(/is-active/);
  await expect
    .poll(() =>
      page
        .locator('[data-segment-id="participant-turn"] p')
        .evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.top >= 0 && bounds.bottom <= innerHeight;
        }),
    )
    .toBe(true);
  await expect(
    page.getByRole('checkbox', { name: 'Follow playback' }),
  ).toBeChecked();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(search).toHaveValue('');
  await expect(page.locator('.transcript-search-results')).toHaveCount(0);
  await expect(page.locator('.turn-text mark')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('no matches and empty transcripts have usable states', async ({
  page,
}) => {
  await page.goto(publicMeeting);
  const search = page.getByRole('searchbox', {
    name: 'Search this transcript',
  });
  await search.fill('unmentioned pricing deadline');
  await expect(page.getByText('0 matching passages')).toBeVisible();
  await expect(page.getByText(/No transcript passages match/)).toBeVisible();
  await expect(page.locator('.transcript-turn')).toHaveCount(2);
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.route(
    '**/api/meetings/recording-walkthrough/recording',
    async (route) => {
      const data = structuredClone(fixture);
      await route.fulfill({ json: { ...data, segments: [] } });
    },
  );
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'No transcript available' }),
  ).toBeVisible();
  await expect(
    page.getByRole('searchbox', { name: 'Search this transcript' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Play recording', exact: true }),
  ).toBeEnabled();
});

test('the same transcript search works for a private uploaded meeting', async ({
  page,
}) => {
  const row = {
    id: privateId,
    title: 'Private planning conversation',
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
        paragraphs: ['We reviewed the launch budget.'],
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
  await page.route(`**/api/uploads/${privateId}`, (route) =>
    route.fulfill({ json: row }),
  );
  await page.route(`**/api/uploads/${privateId}/media`, async (route) => {
    const response = await route.fetch({
      url: new URL(
        '/media/recording-walkthrough-optimized.webm',
        route.request().url(),
      ).href,
    });
    await route.fulfill({ response });
  });
  await page.goto(`/app/meetings/${privateId}`);
  await expect(
    page.getByText('AI transcript · Speaker identities are not inferred'),
  ).toBeVisible();
  await page
    .getByRole('searchbox', { name: 'Search this transcript' })
    .fill('budget');
  await expect(page.getByText('2 matching passages')).toBeVisible();
  await page.getByRole('button', { name: 'Next match' }).click();
  await expect(page.getByText('1 of 2')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'View match 1 at 0:02 from Speaker' }),
  ).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: 'Next match' }).click();
  await expect(page.getByText('2 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Previous match' }).click();
  await expect(page.getByText('1 of 2')).toBeVisible();
  await page
    .getByRole('button', { name: 'View match 2 at 0:26 from Speaker' })
    .click();
  await expect
    .poll(
      () =>
        page
          .locator('video')
          .evaluate((video) => !video.seeking && video.readyState >= 2),
      { timeout: 30000 },
    )
    .toBe(true);
  await expect
    .poll(() => page.locator('video').evaluate((video) => video.currentTime))
    .toBeCloseTo(26, 1);
  await expect(
    page.getByRole('link', { name: /Open public view/ }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});
