import {
  expect,
  fitsViewport,
  intelligence,
  meeting,
  meetingId,
  silentWav,
  test,
} from './fixtures';

const open = `/app/meetings/${meetingId}`;
const transcript = meeting().transcript;

test('an upload goes straight to storage and processing continues in the background', async ({
  page,
  api,
}) => {
  const uploads: string[] = [];
  await page.route('https://storage.example/**', (route) => {
    const headers = {
      'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
      'Access-Control-Allow-Methods': 'PUT',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (route.request().method() === 'PUT') uploads.push(route.request().url());
    return route.fulfill({ status: 200, headers, body: '' });
  });
  await page.goto('/app/upload');
  await page.getByLabel('Recording file').setInputFiles({
    name: 'Standup notes.wav',
    mimeType: 'audio/wav',
    buffer: silentWav(5),
  });
  await expect(page.getByLabel('Meeting title')).toHaveValue('Standup notes');
  await page.getByRole('button', { name: 'Upload & transcribe' }).click();
  await expect(page).toHaveURL(/\/app\/meetings\/[0-9a-f-]{36}$/);
  await expect(
    page.getByText('You can leave this page; processing continues.'),
  ).toBeVisible();
  expect(uploads).toEqual([expect.stringContaining('/staging/')]);
  const created = api.meetings[0];
  expect(created).toMatchObject({
    title: 'Standup notes',
    status: 'transcribing',
  });
  expect(
    api.calls.filter(
      (call) => call.path === `/api/uploads/${created.id}/process`,
    ),
  ).toHaveLength(1);

  Object.assign(created, {
    status: 'complete',
    processing_progress: 100,
    transcript,
    intelligence,
  });
  await expect(page.getByText('Let’s ship the pilot on Friday.')).toBeVisible({
    timeout: 10000,
  });
});

test('analysis failure keeps the transcript playable and retry starts a new run', async ({
  page,
  api,
}) => {
  api.meetings[0] = meeting({
    status: 'failed',
    processing_progress: 80,
    processing_error: 'analysis_failed',
    intelligence: null,
  });
  await page.goto(open);
  await expect(page.getByText('Let’s ship the pilot on Friday.')).toBeVisible();
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
  // Pause the media and check the transport control follows it. Clicking the
  // control instead needs playback to still be running, which a headless Linux
  // runner will not do: it either stops or errors once started, and on error the
  // component sets playing false and disables the control while the element
  // itself never pauses, so nothing moves and nothing can click it. Pausing the
  // element directly asserts the half that matters -- the label reflects the
  // media state -- and holds whether or not the runner kept the audio alive.
  await page.locator('video').evaluate((video) => video.pause());
  await expect(
    page.getByRole('button', { name: 'Play recording', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry processing' }).click();
  await expect(
    page.getByText('Creating summaries', { exact: false }),
  ).toHaveCount(0);
  Object.assign(api.meetings[0], {
    status: 'complete',
    processing_progress: 100,
    processing_error: null,
    intelligence,
  });
  await expect(
    page.getByText('AI analysis · grounded in your transcript'),
  ).toBeVisible({
    timeout: 10000,
  });
});

test('an interrupted upload asks for the file again', async ({ page, api }) => {
  api.meetings[0] = meeting({
    status: 'uploading',
    processing_progress: 0,
    transcript: null,
    intelligence: null,
  });
  await page.goto(open);
  await expect(
    page.getByRole('button', { name: 'Choose recording to retry' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Retry processing' }),
  ).toHaveCount(0);
});

test('a recording with no speech stays playable', async ({ page, api }) => {
  api.meetings[0] = meeting({ transcript: [], intelligence: null });
  await page.goto(open);
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

test('transcription failure is explicit, retryable, and stops polling', async ({
  page,
  api,
}) => {
  api.meetings[0] = meeting({
    status: 'failed',
    processing_progress: 35,
    processing_error: 'transcription_failed',
    transcript: null,
    intelligence: null,
  });
  await page.goto(open);
  await expect(
    page.getByText(
      'We couldn’t transcribe this recording. Your uploaded media is saved; try again.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Retry processing' }),
  ).toBeEnabled();
  const reads = () =>
    api.calls.filter((call) => call.path === `/api/uploads/${meetingId}`)
      .length;
  const settled = reads();
  await page.waitForTimeout(2800);
  expect(reads()).toBe(settled);
});

test('the upload form rejects empty files and fits a phone screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  expect(await fitsViewport(page)).toBe(true);
});

test('daily upload limits are shown to the user', async ({ page }) => {
  await page.route('**/api/uploads', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 429,
          json: {
            message:
              'You have reached today’s upload limit. Please try again tomorrow.',
          },
        })
      : route.fallback(),
  );
  await page.goto('/app/upload');
  await page.getByLabel('Recording file').setInputFiles({
    name: 'call.wav',
    mimeType: 'audio/wav',
    buffer: silentWav(3),
  });
  await page.getByRole('button', { name: 'Upload & transcribe' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'You have reached today’s upload limit. Please try again tomorrow.',
  );
});
