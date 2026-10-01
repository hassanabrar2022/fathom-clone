import { test, expect } from './fixtures';
test('library failures do not silently show bundled meetings and can recover', async ({
  page,
}) => {
  await page.route('**/api/meetings', (r) =>
    r.fulfill({ status: 503, json: { message: 'Unavailable' } }),
  );
  await page.goto('/app');
  await expect(
    page.getByRole('heading', { name: 'Meetings couldn’t load' }),
  ).toBeVisible();
  await expect(page.locator('.meeting-row')).toHaveCount(0);
  await page.unroute('**/api/meetings');
  await page.getByRole('button', { name: 'Retry meetings' }).click();
  await expect(page.locator('.meeting-row')).toHaveCount(1);
});
test('dashboard loads metadata only and debounces persisted content search', async ({
  page,
}) => {
  const paths: string[] = [];
  page.on('request', (r) => paths.push(new URL(r.url()).pathname));
  await page.goto('/app');
  await expect(page.locator('.meeting-row')).toHaveCount(1);
  expect(
    paths.some(
      (p) =>
        p.endsWith('.webm') ||
        p.endsWith('/recording') ||
        p.includes('/recordings/'),
    ),
  ).toBe(false);
  const search = page.getByRole('textbox', { name: 'Search meetings' });
  await search.fill('record');
  await search.fill('recording');
  await expect(page.locator('.search-result-card').first()).toBeVisible();
  expect(paths.filter((p) => p === '/api/search')).toHaveLength(1);
  await page.route('**/api/search?*', (r) => r.fulfill({ status: 503 }));
  await search.fill('pilot');
  await expect(
    page.getByRole('heading', { name: 'Meetings couldn’t load' }),
  ).toBeVisible();
  await expect(page.locator('.search-result-card')).toHaveCount(0);
});
test('failed moment write never reports success and retry keeps the same identity', async ({
  page,
}) => {
  let fail = true;
  const ids: string[] = [];
  await page.route('**/api/meetings/*/moments', (r) => {
    if (r.request().method() !== 'POST') return r.fallback();
    ids.push(r.request().postDataJSON().id);
    return fail ? r.fulfill({ status: 503 }) : r.fallback();
  });
  await page.goto('/app/meetings/recording-walkthrough');
  await page
    .getByRole('button', { name: 'Save moment from transcript at 1:37' })
    .click();
  await page
    .getByLabel('Title', { exact: true })
    .fill('Retry persistence check');
  await page.getByRole('button', { name: 'Save moment', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Moment could not be saved',
  );
  await expect(page.getByText('Moment saved to this meeting.')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Save moment', exact: true }).click();
  await expect(page.getByText('Moment saved to this meeting.')).toBeVisible();
  expect(ids[0]).toBe(ids[1]);
});
