import { expect, test } from './fixtures';

test('clean reviewer sees only the recorded meeting and can open it', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/app');
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole('heading', { name: 'Your conversations. All connected.' }),
  ).toBeVisible();
  await expect(page.locator('.meeting-row')).toHaveCount(1);
  await expect(page.locator('.meeting-row')).toContainText(
    'From conversation to recording',
  );
  await expect(page.getByText('synthetic examples')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Search meetings' }).fill('pilot');
  await expect(
    page.getByRole('heading', { name: 'No meetings found' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page
    .getByRole('combobox', { name: 'Sort meetings' })
    .selectOption('oldest');
  await expect(page.locator('.meeting-row')).toHaveCount(1);
  await page.locator('.meeting-row').click();
  await expect(
    page.getByRole('heading', { name: 'From conversation to recording' }),
  ).toBeVisible();
  await expect(page.locator('video')).toBeVisible();
  await page.getByRole('link', { name: 'All meetings', exact: true }).click();
  await expect(page.locator('.meeting-row')).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('invalid deep link has a working recovery route', async ({ page }) => {
  await page.goto('/app/meetings/missing');
  await expect(
    page.getByRole('heading', { name: 'Meeting not found' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to meetings' }).click();
  await expect(page.locator('.meeting-row')).toHaveCount(1);
});

test('about dialog is keyboard accessible and returns focus', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Sidebar help is hidden in compact navigation.',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/app');
  const trigger = page.getByRole('button', { name: 'About this demo' });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
