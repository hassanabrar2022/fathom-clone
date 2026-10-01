import { expect, test, publicPaths } from './fixtures';

const id = '88888888-8888-4888-8888-888888888888';
const transcript = [
  {
    id: 'one',
    speakerId: 'speaker',
    start: 2,
    end: 8,
    paragraphs: ['We reviewed the plan.'],
  },
  {
    id: 'two',
    speakerId: 'speaker',
    start: 20,
    end: 27,
    paragraphs: ['We agreed on the next step.'],
  },
];

test('demo speaker rename persists for its owner and leaves the public share unchanged', async ({
  page,
  browser,
}) => {
  const sharePath = (await publicPaths(page)).meeting;
  await page.goto('/app/meetings/recording-walkthrough');
  await page.getByRole('button', { name: 'Rename Presenter' }).click();
  await page.getByLabel('Speaker name').fill('Alex');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('button', { name: 'Rename Alex' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Rename Alex' })).toBeVisible();
  const visitor = await browser.newContext();
  const shared = await visitor.newPage();
  await shared.goto(sharePath);
  await expect(
    shared.getByText('Presenter', { exact: true }).first(),
  ).toBeVisible();
  await visitor.close();
});

test('private rename saves all matching turns, survives reload, and retries a failed save', async ({
  page,
}) => {
  let name = 'Speaker';
  let failures = 1;
  const meeting = () => ({
    id,
    title: 'Fictional planning conversation',
    media_type: 'video/webm',
    media_size: 4,
    duration_seconds: 104,
    status: 'complete',
    processing_progress: 100,
    processing_error: null,
    created_at: '2026-09-14T12:00:00Z',
    transcript,
    speaker_names: name === 'Speaker' ? {} : { speaker: name },
    intelligence: null,
  });
  await page.route(`**/api/uploads/${id}`, (route) =>
    route.fulfill({ json: meeting() }),
  );
  await page.route(`**/api/uploads/${id}/speakers`, async (route) => {
    if (failures-- > 0)
      return route.fulfill({ status: 503, json: { message: 'Retry' } });
    const input = route.request().postDataJSON() as {
      speakerId: string;
      name: string;
    };
    expect(input.speakerId).toBe('speaker');
    name = input.name;
    return route.fulfill({ json: meeting() });
  });
  await page.route(`**/api/uploads/${id}/media`, (route) =>
    route.fulfill({
      path: 'apps/web/public/media/recording-walkthrough-optimized.webm',
      contentType: 'video/webm',
    }),
  );
  await page.goto(`/app/meetings/${id}`);
  await page.getByRole('button', { name: 'Rename Speaker' }).first().click();
  await page.getByLabel('Speaker name').fill('Jordan');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Could not save this speaker name',
  );
  await expect(
    page.getByRole('button', { name: 'Rename Speaker' }),
  ).toHaveCount(2);
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('button', { name: 'Rename Jordan' })).toHaveCount(
    2,
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Rename Jordan' })).toHaveCount(
    2,
  );
  await expect(page.getByText('We reviewed the plan.')).toBeVisible();
  await page
    .getByRole('searchbox', { name: 'Search this transcript' })
    .fill('agreed');
  await expect(
    page.getByRole('button', { name: /View match 1 at 0:20 from Jordan/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
