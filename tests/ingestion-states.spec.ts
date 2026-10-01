import { expect, test } from './fixtures';
import { fixture as demo } from '../packages/shared/reviewer-fixture';

// Controlled failure-state tests complement the separate live-provider test.
const id = '77777777-7777-4777-8777-777777777777';
const base = {
  id,
  title: 'Private test conversation',
  media_type: 'video/webm',
  media_size: 4,
  duration_seconds: 104,
  status: 'failed',
  processing_progress: 80,
  processing_error: 'analysis_failed',
  created_at: '2026-09-14T12:00:00Z',
  transcript: [
    {
      id: 'one',
      speakerId: 'speaker',
      start: 2.7,
      end: 10,
      paragraphs: ['We agreed to review the plan.'],
    },
  ],
  intelligence: null,
};

test('analysis failure preserves playable transcript and retry restores summaries', async ({
  page,
}) => {
  let complete = false;
  const response = () =>
    complete
      ? {
          ...base,
          status: 'complete',
          processing_error: null,
          processing_progress: 100,
          intelligence: { ...demo.intelligence, provenance: 'generated' },
        }
      : base;
  await page.route(`**/api/uploads/${id}`, (route) =>
    route.fulfill({ json: response() }),
  );
  await page.route(`**/api/uploads/${id}/media`, (route) =>
    route.fulfill({
      path: 'apps/web/public/media/recording-walkthrough-optimized.webm',
      contentType: 'video/webm',
    }),
  );
  await page.route(`**/api/uploads/${id}/process`, (route) => {
    complete = true;
    return route.fulfill({ json: response() });
  });
  await page.goto(`/app/meetings/${id}`);
  await expect(page.getByText('We agreed to review the plan.')).toBeVisible();
  await expect(
    page.getByText('Transcript complete. AI analysis failed.', {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Play recording', exact: true })
    .click();
  await expect
    .poll(() => page.locator('video').evaluate((video) => video.currentTime))
    .toBeGreaterThan(0);
  await page
    .getByRole('button', { name: 'Pause recording', exact: true })
    .click();
  await page.getByRole('button', { name: 'Retry processing' }).click();
  await expect(
    page.getByText('AI analysis · grounded in your transcript'),
  ).toBeVisible();
  await expect(page.getByText('We agreed to review the plan.')).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Open public view/ }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('interrupted upload offers file recovery and an empty transcript keeps the player', async ({
  page,
}) => {
  let empty = false;
  await page.route(`**/api/uploads/${id}`, (route) =>
    route.fulfill({
      json: empty
        ? {
            ...base,
            status: 'complete',
            processing_error: null,
            transcript: [],
          }
        : {
            ...base,
            status: 'uploading',
            processing_error: null,
            transcript: null,
          },
    }),
  );
  await page.route(`**/api/uploads/${id}/media`, (route) =>
    route.fulfill({
      path: 'apps/web/public/media/recording-walkthrough-optimized.webm',
      contentType: 'video/webm',
    }),
  );
  await page.goto(`/app/meetings/${id}`);
  await expect(
    page.getByRole('button', { name: 'Choose recording to retry' }),
  ).toBeVisible();
  empty = true;
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'No speech detected' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'No transcript available' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Play recording', exact: true }),
  ).toBeEnabled();
});

test('upload form rejects empty files and remains usable at mobile widths', async ({
  page,
}) => {
  await page.goto('/app/upload');
  await page.getByLabel('Recording file').setInputFiles({
    name: 'empty.wav',
    mimeType: 'audio/wav',
    buffer: Buffer.alloc(0),
  });
  await expect(page.getByRole('alert')).toContainText('non-empty recording');
  await expect(
    page.getByRole('button', { name: 'Upload & transcribe' }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('transcription failure is explicit, retryable, and stops background polling', async ({
  page,
}) => {
  let reads = 0;
  await page.route(`**/api/uploads/${id}`, (r) => {
    reads++;
    return r.fulfill({
      json: {
        ...base,
        transcript: null,
        processing_progress: 35,
        processing_error: 'transcription_failed',
      },
    });
  });
  await page.goto(`/app/meetings/${id}`);
  await expect(
    page.getByText(
      'We couldn’t transcribe this recording. Your uploaded media is saved; try again.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Retry processing' }),
  ).toBeEnabled();
  await expect(page.locator('.transcript-turn')).toHaveCount(0);
  const settledReads = reads;
  expect(settledReads).toBeGreaterThan(0);
  await page.waitForTimeout(2800);
  expect(reads).toBe(settledReads);
});
