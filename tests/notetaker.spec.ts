import { expect, fitsViewport, notetaker, test } from './fixtures';

test('sending the notetaker to a call opens its live view', async ({ page, api }) => {
  await page.goto('/app/record');
  await page.getByLabel('Meeting link').fill('https://meet.google.com/abc-defg-hij');
  await page.getByLabel(/^Title/).fill('Roadmap review');
  await page.getByRole('button', { name: 'Send notetaker' }).click();
  await expect(page).toHaveURL(/\/app\/live\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Roadmap review' })).toBeVisible();
  await expect(page.getByLabel('Notetaker progress').getByText('Joining')).toHaveClass(/current/);
  expect(api.calls).toContainEqual({
    method: 'POST',
    path: '/api/notetakers',
    body: {
      provider: 'recall',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      title: 'Roadmap review',
    },
  });
});

test('a meeting link must be Meet, Zoom, or Teams', async ({ page, api }) => {
  await page.goto('/app/record');
  await page.getByLabel('Meeting link').fill('https://example.com/call');
  await page.getByRole('button', { name: 'Send notetaker' }).click();
  await expect(page.getByRole('alert')).toHaveText('Use a Google Meet, Zoom, or Teams link.');
  expect(api.calls.some((call) => call.path === '/api/notetakers' && call.method === 'POST')).toBe(
    false,
  );
});

test('highlights can be added while the call records', async ({ page, api }) => {
  api.notetakers.push(
    notetaker({
      status: 'recording',
      statusDetail: 'Recording',
      recordingStartedAt: new Date(Date.now() - 95000).toISOString(),
    }),
  );
  await page.goto(`/app/live/${api.notetakers[0].id}`);
  await expect(page.locator('.live-timer.large')).toHaveText(/1:3\d/);
  await page.getByLabel('Highlight note').fill('Budget approved');
  await page.getByRole('button', { name: 'Highlight' }).click();
  const highlights = page.getByRole('region', { name: 'Highlights' });
  await expect(highlights.getByText('Budget approved')).toBeVisible();
  await expect(highlights.locator('.timestamp')).toHaveText(/1:3\d/);
  await page.getByRole('button', { name: 'Stop recording and leave the call' }).click();
  await expect(page.locator('.live-header .notetaker-status')).toHaveText('Processing');
});

test('live calls appear on the dashboard', async ({ page, api }) => {
  api.notetakers.push(notetaker({ title: 'Customer onboarding', status: 'waiting_room' }));
  await page.goto('/app');
  const live = page.getByRole('region', { name: 'Live and upcoming calls' });
  await expect(live.getByRole('link', { name: /Customer onboarding.*In waiting room/ })).toBeVisible();
});

test('the calendar lists upcoming calls with a notetaker switch each', async ({ page, api }) => {
  const start = new Date(Date.now() + 2 * 3600000);
  api.calendar = {
    connected: true,
    email: 'ada@example.com',
    autoRecord: false,
    events: [
      {
        id: 'evt1',
        title: 'Design review',
        start: start.toISOString(),
        end: new Date(start.getTime() + 1800000).toISOString(),
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
        platform: 'google_meet',
        attendees: 8,
        notetaker: null,
      },
    ],
  };
  await page.goto('/app/record');
  const toggle = page.getByRole('switch', { name: 'Notetaker for Design review' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(toggle).toHaveText('Notetaker on');
  expect(api.calls).toContainEqual({
    method: 'POST',
    path: '/api/calendar/events/evt1/notetaker',
    body: { enabled: true },
  });
});

test('without a bot, calls are recorded from the browser', async ({ page, api }) => {
  api.capabilities = { bot: false, calendar: false };
  await page.goto('/app/record');
  await expect(page.getByRole('button', { name: 'Send notetaker' })).toHaveCount(0);
  await expect(page.getByText('Google Calendar isn’t set up on this server yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Record from this browser' }).click();
  await expect(page).toHaveURL(/\/app\/live\//);
  await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible();
  await expect(page.getByText('Share tab audio')).toBeVisible();
});

test('the record page fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/record');
  await expect(page.getByRole('heading', { name: 'Record a meeting' })).toBeVisible();
  expect(await fitsViewport(page)).toBe(true);
});
