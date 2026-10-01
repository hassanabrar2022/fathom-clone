import { fixture } from '../packages/shared/reviewer-fixture';
import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures';

const meetingPath = '/app/meetings/recording-walkthrough';

test('copies the active cited summary and reports clipboard failure', async ({
  browserName,
  context,
  page,
}) => {
  if (browserName === 'chromium')
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(meetingPath);
  await page.getByRole('button', { name: 'Copy summary' }).click();
  await expect(
    page.getByRole('button', { name: 'Summary copied' }),
  ).toBeVisible();
  let copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('Fathom Clone summary · General');
  expect(copied).toContain('Action items');
  expect(copied).toContain('Source: 1:14');

  await page.getByRole('button', { name: /Sales \/ Customer/ }).click();
  await expect(
    page.getByRole('button', { name: 'Copy summary' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Copy summary' }).click();
  copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('Fathom Clone summary · Sales / Customer');
  expect(copied).toContain(
    'A product walkthrough centered on less note-taking',
  );

  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('Unavailable')) },
    }),
  );
  await page.getByRole('button', { name: 'Summary copied' }).click();
  await expect(
    page.getByRole('button', { name: 'Copy failed — try again' }),
  ).toBeVisible();
});

test('copies and downloads the full transcript with current speaker names', async ({
  browserName,
  context,
  page,
}) => {
  if (browserName === 'chromium')
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(meetingPath);
  await page.getByRole('button', { name: 'Rename Presenter' }).click();
  await page.getByLabel('Speaker name').fill('Alex');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('button', { name: 'Rename Alex' })).toBeVisible();

  await page
    .getByRole('button', { name: 'Copy transcript', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Transcript copied' }),
  ).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('From conversation to recording');
  expect(copied).toContain('[0:02] Alex');
  expect(copied).toContain('[1:37] Participant');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .txt' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    'from-conversation-to-recording-transcript.txt',
  );
  const path = await download.path();
  expect(path).not.toBeNull();
  const text = await readFile(path!, 'utf8');
  expect(text).toContain('[0:02] Alex');
  expect(text).toContain('But my video is not getting recorded.');

  await page
    .getByRole('button', { name: 'Copy transcript segment at 1:37' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Copy transcript segment at 1:37' }),
  ).toContainText('Segment copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    '[1:37] Participant\nBut my video is not getting recorded. Okay, let me end this meeting.',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('empty transcripts do not expose nonfunctional export controls', async ({
  page,
}) => {
  await page.route(
    '**/api/meetings/recording-walkthrough/recording',
    async (route) => {
      const data = structuredClone(fixture);
      await route.fulfill({ json: { ...data, segments: [] } });
    },
  );
  await page.goto(meetingPath);
  await expect(
    page.getByRole('heading', { name: 'No transcript available' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Copy transcript', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download .txt' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: /Copy transcript segment/ }),
  ).toHaveCount(0);
});
