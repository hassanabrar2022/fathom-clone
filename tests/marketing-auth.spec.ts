import { expect, test, user } from './fixtures';

// These flows start signed out; individual tests mock the auth responses.
test.use({ signedIn: false });

const viewports = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 430, height: 932 },
  { width: 390, height: 844 },
];

test('the public site reaches every page from its navigation', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'AI notetaking for every recording',
    }),
  ).toBeAttached();
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'Pricing' }).click();
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Pricing');
  await nav.getByRole('link', { name: 'Overview' }).click();
  await expect(page).toHaveURL(/\/overview$/);
  await nav.getByRole('button', { name: 'Solutions' }).click();
  await page.getByRole('link', { name: 'For sales' }).first().click();
  await expect(page).toHaveURL(/\/solutions\/sales$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await nav.getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL(/\/about$/);
  await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy Policy' }).first().click();
  await expect(page).toHaveURL(/\/privacy$/);
  await page.getByRole('contentinfo').getByRole('link', { name: 'Terms of Service' }).first().click();
  await expect(page).toHaveURL(/\/terms$/);
  await page.goto('/solutions/unknown');
  await expect(page).toHaveURL(/\/$/);
});

test('pricing only offers plans that exist today', async ({ page }) => {
  await page.goto('/pricing');
  const cta = page.locator('.pricing-cta');
  await expect(cta).toHaveCount(3);
  await expect(cta.nth(0)).toHaveAttribute('href', '/signup');
  await expect(cta.nth(1)).toHaveAttribute('aria-disabled', 'true');
  await expect(cta.nth(2)).toHaveAttribute('aria-disabled', 'true');
});

test('public pages fit every width without sideways scrolling', async ({
  page,
}) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const path of ['/', '/pricing', '/overview', '/solutions/sales', '/login']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `${path} at ${viewport.width}px`).toBeLessThanOrEqual(1);
    }
  }
});

test('the mobile menu opens and closes on navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  const menu = page.getByRole('navigation', { name: 'Mobile' });
  await menu.getByRole('link', { name: 'Pricing' }).click();
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(menu).toBeHidden();
});

test('reduced motion shows the full headline immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.home-hero h1 [aria-hidden="true"]')).toContainText(
    'AI notetaking for every recording',
  );
});

test('immediate signup enters the existing dashboard when confirmation is disabled', async ({
  page,
}) => {
  await page.goto('/signup');
  await page.getByLabel('Email address').fill('new-person@example.com');
  await page.getByLabel('Password', { exact: true }).fill('secure-passphrase');
  await page.getByRole('button', { name: 'Get started free' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole('heading', { name: 'Your conversations. All connected.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' }).first()).toBeVisible();
});

test('signup waits for actual confirmation; errors and password visibility are usable', async ({
  page,
}) => {
  await page.route('**/api/auth/signup', (route) =>
    route.fulfill({ json: { confirmationRequired: true } }),
  );
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign up free' }).first().click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.getByRole('button', { name: 'Get started free' }).click();
  await expect(page.getByRole('alert')).toContainText('valid email');
  await page.getByLabel('Email address').fill('person@example.com');
  await page.getByLabel('Password', { exact: true }).fill('secure-passphrase');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'type',
    'text',
  );
  await page.getByRole('button', { name: 'Get started free' }).click();
  await expect(
    page.getByRole('heading', { name: 'Check your inbox' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.locator('a[href^="/app"]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('confirmed login enters the app and sign-out closes the workspace', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(
    page.getByRole('heading', { name: 'Sign in to Fathom Clone' }),
  ).toBeVisible();
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('secure-passphrase');
  await expect(page.getByLabel('Email address')).toHaveValue(user.email);
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue(
    'secure-passphrase',
  );
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole('heading', { name: 'Your conversations. All connected.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' }).first()).toBeVisible();
  await page.goto('/signup');
  await expect(page).toHaveURL(/\/app$/);
  await page.locator('.sidebar-signout').click();
  // Signed out, the workspace is closed until the next sign-in.
  await expect(page).not.toHaveURL(/\/app/);
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
});

test('confirmed email callback establishes a session and clears URL tokens', async ({
  page,
}) => {
  await page.goto(
    `/auth/confirm#access_token=${'a'.repeat(80)}&refresh_token=${'r'.repeat(12)}&expires_in=3600`,
  );
  await expect(page).toHaveURL(/\/app$/);
  await expect(page).not.toHaveURL(/access_token/);
  await expect(page.getByRole('button', { name: 'Sign out' }).first()).toBeVisible();
});

test('the workspace theme choice survives sign-in and reload', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/login');
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('secure-passphrase');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('the workspace sends signed-out visitors to sign in and returns them after', async ({
  page,
  api,
}) => {
  await page.goto(`/app/meetings/${api.meetings[0].id}`);
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fmeetings%2F/);
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('secure-passphrase');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/app/meetings/${api.meetings[0].id}$`));
  await expect(page.getByRole('heading', { name: 'Pilot planning' })).toBeVisible();
});

test('sign-in ignores a destination outside the workspace', async ({ page }) => {
  await page.goto('/login?next=https://evil.example/app');
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('secure-passphrase');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:5173\/app$/);
});

test('forgot password sends a reset link without revealing accounts', async ({
  page,
  api,
}) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('alert')).toContainText('valid email');
  await page.getByLabel('Email address').fill('someone@example.com');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
  await expect(page.getByText('If someone@example.com has an account')).toBeVisible();
  expect(api.calls.find((call) => call.path === '/api/auth/recover')?.body).toEqual({
    email: 'someone@example.com',
  });
});

test('a reset link signs in, then saves a matching new password', async ({
  page,
  api,
}) => {
  await page.goto(
    `/auth/reset#access_token=${'a'.repeat(80)}&refresh_token=${'r'.repeat(12)}&type=recovery`,
  );
  await expect(page).toHaveURL(/\/auth\/reset$/);
  await expect(page.getByRole('heading', { name: 'Choose a new password.' })).toBeVisible();
  await page.getByLabel('New password', { exact: true }).fill('a new passphrase');
  await page.getByLabel('Confirm new password').fill('something else');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('alert')).toContainText('don’t match');
  await page.getByLabel('Confirm new password').fill('a new passphrase');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page).toHaveURL(/\/app$/);
  expect(api.calls.find((call) => call.path === '/api/auth/recovery')?.body).toEqual({
    access_token: 'a'.repeat(80),
    refresh_token: 'r'.repeat(12),
  });
  expect(api.calls.find((call) => call.path === '/api/auth/password')?.body).toEqual({
    password: 'a new passphrase',
  });
});

test('an expired or incomplete reset link offers a new one', async ({ page }) => {
  await page.goto('/auth/reset');
  await expect(page.getByRole('heading', { name: 'Link expired' })).toBeVisible();
  await page.getByRole('link', { name: 'Request a new link' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);

  await page.route('**/api/auth/recovery', (route) =>
    route.fulfill({ status: 400, json: { message: 'This link has expired.' } }),
  );
  await page.goto(`/auth/reset#access_token=${'a'.repeat(80)}&refresh_token=${'r'.repeat(12)}`);
  await expect(page.getByRole('heading', { name: 'Link expired' })).toBeVisible();
});
