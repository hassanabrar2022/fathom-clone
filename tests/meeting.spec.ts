import { expect, fitsViewport, meetingId, test } from './fixtures';

const open = `/app/meetings/${meetingId}`;

test('a finished meeting plays, seeks from the transcript, and shows AI notes', async ({
  page,
}) => {
  await page.goto(open);
  await expect(page.getByRole('heading', { name: 'Pilot planning' })).toBeVisible();
  await expect(page.getByText('AI analysis · grounded in your transcript')).toBeVisible();
  await page.getByRole('button', { name: 'Seek to 0:12' }).click();
  await expect(page.getByLabel('Playback position')).toContainText('0:12');
  await expect(
    page.getByRole('article', { name: 'Speaker at 0:12' }),
  ).toHaveClass(/is-active/);
  expect(await fitsViewport(page)).toBe(true);
});

test('transcript search highlights passages and steps between matches', async ({
  page,
}) => {
  await page.goto(open);
  await page.getByLabel('Search this transcript').fill('the');
  await expect(page.getByRole('status').filter({ hasText: 'matching' })).toHaveText(
    '2 matching passages',
  );
  await page.getByRole('button', { name: 'Next match' }).click();
  await expect(page.getByText('1 of 2')).toBeVisible();
  await page.getByLabel('Search this transcript').fill('no such words');
  await expect(page.getByText('No transcript passages match')).toBeVisible();
});

test('renaming the speaker saves and survives a reload', async ({ page, api }) => {
  await page.goto(open);
  await page.getByRole('button', { name: 'Rename Speaker' }).first().click();
  await page.getByLabel('Speaker name').fill('Jordan');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('button', { name: 'Rename Jordan' }).first()).toBeVisible();
  expect(api.meetings[0].speaker_names).toEqual({ speaker: 'Jordan' });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Rename Jordan' }).first()).toBeVisible();
});

test('moments are private until shared, and revoking breaks the link', async ({
  page,
  api,
  browser,
}) => {
  await page.goto(open);
  await page
    .getByRole('button', { name: 'Save moment from transcript at 0:12' })
    .click();
  await page.getByLabel('Title').fill('The commitment');
  await page.getByRole('button', { name: 'Save moment', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Moment saved' })).toBeVisible();
  const item = page.getByRole('article').filter({ hasText: 'The commitment' });
  await expect(item).toContainText('Private');

  await item.getByRole('button', { name: 'Create public link for The commitment' }).click();
  await expect(item).toContainText('Shared by link');
  const sharePath = api.moments[0].sharePath!;
  expect(sharePath).toMatch(/^\/share\/moment-[a-f0-9]{64}$/);

  const visitor = await browser.newContext();
  const guest = await visitor.newPage();
  await guest.goto(sharePath);
  await expect(guest.getByRole('heading', { name: 'The commitment' })).toBeVisible();
  await expect(guest.getByText('I will send the revised proposal before then.')).toBeVisible();

  await item.getByRole('button', { name: 'Revoke public link for The commitment' }).click();
  await expect(item).toContainText('Private');
  await guest.reload();
  await expect(
    guest.getByRole('heading', { name: 'This shared moment isn’t available' }),
  ).toBeVisible();
  await visitor.close();

  await item.getByRole('button', { name: 'Delete The commitment' }).click();
  await expect(item).toHaveCount(0);
  expect(api.moments).toEqual([]);
});

test('a failed moment save keeps the form and its draft', async ({ page }) => {
  await page.route(`**/api/uploads/${meetingId}/moments`, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 503, json: { message: 'Unavailable' } })
      : route.fallback(),
  );
  await page.goto(open);
  await page.getByRole('button', { name: /Save current moment/ }).click();
  await page.getByLabel('Title').fill('Keep me');
  await page.getByRole('button', { name: 'Save moment', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not be saved');
  await expect(page.getByLabel('Title')).toHaveValue('Keep me');
});

test('the owner shares the full meeting read-only and can revoke it', async ({
  page,
  api,
  browser,
}) => {
  await page.goto(open);
  await page.getByRole('button', { name: 'Share meeting' }).click();
  await page.getByRole('button', { name: 'Create public link' }).click();
  const link = await page.getByLabel('Public meeting link').inputValue();
  expect(link).toMatch(/\/share\/meeting-[a-f0-9]{64}$/);

  const visitor = await browser.newContext();
  const guest = await visitor.newPage();
  await guest.goto(new URL(link).pathname);
  await expect(guest.getByRole('heading', { name: 'Pilot planning' })).toBeVisible();
  await expect(guest.getByText('Let’s ship the pilot on Friday.')).toBeVisible();
  await expect(guest.getByRole('button', { name: /Delete/ })).toHaveCount(0);
  await expect(guest.getByRole('button', { name: /Rename/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Revoke public link' }).click();
  await expect(page.getByRole('button', { name: 'Create public link' })).toBeVisible();
  expect(api.meetingShares.size).toBe(0);
  await guest.reload();
  await expect(
    guest.getByRole('heading', { name: 'This shared meeting isn’t available' }),
  ).toBeVisible();
  await visitor.close();
});

test('deleting a meeting asks first and returns to the library', async ({
  page,
  api,
}) => {
  await page.goto(open);
  await page.getByRole('button', { name: 'Delete meeting' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(api.meetings).toHaveLength(1);
  await page.getByRole('button', { name: 'Delete meeting' }).click();
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'No meetings yet' })).toBeVisible();
});

test('a meeting that belongs to someone else reads as not found', async ({ page }) => {
  await page.goto('/app/meetings/99999999-9999-4999-8999-999999999999');
  await expect(page.getByRole('alert')).toContainText('could not be found');
  await page.goto('/app/meetings/not-a-meeting');
  await expect(page.getByRole('heading', { name: 'Meeting not found' })).toBeVisible();
});
