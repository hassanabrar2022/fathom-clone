import { expect, test } from './fixtures';

const id = '99999999-9999-4999-8999-999999999999';
const token = 'd'.repeat(64);
const row = {
  id,
  title: 'Private deletion rehearsal',
  media_type: 'video/webm',
  media_size: 4,
  duration_seconds: 104,
  status: 'complete',
  processing_progress: 100,
  processing_error: null,
  created_at: '2026-09-14T12:00:00Z',
  transcript: [
    {
      id: 'one',
      speakerId: 'speaker',
      start: 2.7,
      end: 10,
      paragraphs: ['We agreed to remove this private test meeting.'],
    },
  ],
  speaker_names: { speaker: 'Jordan' },
  intelligence: null,
};

test('owner confirms deletion, can retry cleanup failure, and removes the meeting everywhere', async ({
  browser,
  context,
  page,
}) => {
  let present = true;
  let deleteAttempts = 0;
  let releaseFailure!: () => void;
  const failureGate = new Promise<void>((resolve) => {
    releaseFailure = resolve;
  });
  await context.route(`**/api/uploads/${id}`, async (route) => {
    if (route.request().method() === 'DELETE') {
      deleteAttempts += 1;
      if (deleteAttempts === 1) {
        await failureGate;
        return route.fulfill({
          status: 503,
          json: {
            message:
              'The stored recording could not be removed. Nothing else was deleted; please retry.',
          },
        });
      }
      present = false;
      return route.fulfill({ json: { deleted: true } });
    }
    return route.fulfill(
      present
        ? { json: row }
        : { status: 404, json: { message: 'Meeting unavailable' } },
    );
  });
  await context.route('**/api/uploads', (route) =>
    route.fulfill({ json: present ? [row] : [] }),
  );
  await context.route(`**/api/uploads/${id}/media`, (route) =>
    route.fulfill({
      path: 'apps/web/public/media/recording-walkthrough-optimized.webm',
      contentType: 'video/webm',
    }),
  );
  await page.goto(`/app/meetings/${id}`);
  await page.evaluate((meetingId) => {
    localStorage.setItem(`fathom-clone:moments:${meetingId}:v1`, '[]');
    localStorage.setItem(`fathom-clone:speakers:${meetingId}:v1`, '{}');
  }, id);

  const trigger = page.getByRole('button', { name: 'Delete meeting' });
  await trigger.click();
  await expect(
    page.getByRole('heading', { name: `Delete “${row.title}”?` }),
  ).toBeVisible();
  await expect(
    page.getByText('recording, transcript, summaries, speaker labels', {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(trigger).toBeFocused();
  expect(deleteAttempts).toBe(0);

  await trigger.click();
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  const deleting = page.getByRole('button', { name: 'Deleting…' });
  await expect(deleting).toBeVisible();
  await expect(deleting).toBeDisabled();
  releaseFailure();
  await expect(page.getByRole('alert')).toContainText(
    'Nothing else was deleted',
  );
  await expect(page).toHaveURL(new RegExp(`/app/meetings/${id}$`));
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(row.title)).toHaveCount(0);
  expect(
    await page.evaluate(
      (meetingId) => [
        localStorage.getItem(`fathom-clone:moments:${meetingId}:v1`),
        localStorage.getItem(`fathom-clone:speakers:${meetingId}:v1`),
      ],
      id,
    ),
  ).toEqual([null, null]);

  const visitor = await browser.newContext();
  await visitor.route(`**/api/shares/${token}`, (route) =>
    route.fulfill({ status: 404, json: { message: 'Unavailable' } }),
  );
  const shared = await visitor.newPage();
  await shared.goto(`/share/meeting-${token}`);
  await expect(
    shared.getByRole('heading', {
      name: 'This shared meeting isn’t available',
    }),
  ).toBeVisible();
  await visitor.close();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('public showcase meetings never expose a destructive delete control', async ({
  page,
}) => {
  await page.goto('/app/meetings/recording-walkthrough');
  await expect(
    page.getByRole('button', { name: 'Delete meeting' }),
  ).toHaveCount(0);
});
