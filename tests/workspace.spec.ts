import { expect, fitsViewport, meeting, test } from './fixtures';

test('the library lists the account’s meetings with their status', async ({
  page,
  api,
}) => {
  api.meetings.push(
    meeting({
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Still processing',
      status: 'transcribing',
      transcript: null,
      intelligence: null,
    }),
  );
  await page.goto('/app');
  const library = page.getByRole('region', { name: 'Your meetings' });
  await expect(library.getByText('Your recordings')).toContainText('2');
  await expect(library.getByRole('link', { name: /Pilot planning.*Ready/ })).toBeVisible();
  await expect(
    library.getByRole('link', { name: /Still processing.*Transcribing/ }),
  ).toBeVisible();
  await library.getByRole('link', { name: /Pilot planning/ }).click();
  await expect(page).toHaveURL(new RegExp(`/app/meetings/${api.meetings[0].id}$`));
});

test('a new account sees a clear first step', async ({ page, api }) => {
  api.meetings = [];
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'No meetings yet' })).toBeVisible();
  await page.getByRole('link', { name: 'Upload your first recording' }).click();
  await expect(page).toHaveURL(/\/app\/upload$/);
});

test('library failures are explicit and recoverable', async ({ page }) => {
  let fail = true;
  await page.route('**/api/uploads', (route) =>
    fail
      ? route.fulfill({ status: 503, json: { message: 'Unavailable' } })
      : route.fallback(),
  );
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Meetings couldn’t load' })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Retry meetings' }).click();
  await expect(page.getByRole('link', { name: /Pilot planning/ })).toBeVisible();
});

test('search finds transcript passages and opens them at their source', async ({
  page,
}) => {
  await page.goto('/app');
  await page.getByLabel('Search meetings').fill('revised proposal');
  await expect(page.getByRole('heading', { name: '1 meeting found' })).toBeVisible();
  await expect(page.locator('mark').first()).toHaveText(/revised proposal/i);
  await page.getByRole('link', { name: /transcript match at 0:12/ }).click();
  await expect(page).toHaveURL(/t=12/);
  await expect(page.getByText('Opened at 0:12 for “revised proposal”.')).toBeVisible();
});

test('empty search results offer a way back', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app');
  await page.getByLabel('Search meetings').fill('nothing like this');
  await expect(page.getByRole('heading', { name: 'No meetings found' })).toBeVisible();
  expect(await fitsViewport(page)).toBe(true);
  await page.getByRole('button', { name: 'Clear search' }).last().click();
  await expect(page.getByRole('link', { name: /Pilot planning/ })).toBeVisible();
});

test('an expired session sends the user back to sign in', async ({ page, api }) => {
  await page.goto('/app');
  await expect(page.getByRole('link', { name: /Pilot planning/ })).toBeVisible();
  api.signedIn = false;
  await page.getByLabel('Search meetings').fill('pilot');
  await expect(page).toHaveURL(/\/login\?next=%2Fapp/);
});

test('settings change the password with confirmation', async ({ page, api }) => {
  await page.goto('/app/settings');
  await expect(page.getByText('ada@example.com').first()).toBeVisible();
  await page.getByLabel('New password', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('alert')).toContainText('at least 8 characters');
  await page.getByLabel('New password', { exact: true }).fill('a better passphrase');
  await page.getByLabel('Confirm new password').fill('a better passphrase');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('status')).toContainText('Password updated.');
  expect(api.calls.find((call) => call.path === '/api/auth/password')?.body).toEqual({
    password: 'a better passphrase',
  });
});

test('deleting the account needs the password and signs the user out', async ({
  page,
  api,
}) => {
  await page.goto('/app/settings');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete your account?' });
  await expect(dialog.getByRole('button', { name: 'Delete permanently' })).toBeDisabled();
  await page.route('**/api/auth/delete-account', (route) =>
    route.fulfill({ status: 400, json: { message: 'That password is incorrect.' } }),
  );
  await dialog.getByLabel('Password').fill('wrong password');
  await dialog.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('That password is incorrect.');
  await page.unroute('**/api/auth/delete-account');
  await dialog.getByLabel('Password').fill('the right password');
  await dialog.getByRole('button', { name: 'Delete permanently' }).click();
  // The workspace is closed to the deleted account.
  await expect(page).not.toHaveURL(/\/app/);
  expect(api.signedIn).toBe(false);
  expect(api.meetings).toEqual([]);
});
