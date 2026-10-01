import { expect, test } from '@playwright/test';

// Real provider tests are explicit to bound demo quotas. No traces: upload URLs
// and guest credentials must not be included in test artifacts.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('real private upload transcribes, persists, seeks, and remains isolated', async ({
  page,
  browser,
  context,
}, testInfo) => {
  test.skip(
    !process.env.FATHOM_CLONE_INGESTION_LIVE || testInfo.project.name !== 'chromium',
  );
  test.setTimeout(300000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/app');
  await page
    .getByRole('link', { name: 'Upload recording', exact: true })
    .click();
  await page
    .getByLabel('Recording file')
    .setInputFiles(
      'apps/web/public/media/recording-walkthrough-optimized.webm',
    );
  await expect(
    page.getByRole('button', { name: 'Upload & transcribe' }),
  ).toBeEnabled();
  await page.getByLabel('Meeting title').fill('Private ingestion verification');
  await page.getByRole('button', { name: 'Upload & transcribe' }).click();
  await expect(page).toHaveURL(/\/app\/meetings\/[a-f0-9-]{36}$/, {
    timeout: 25000,
  });
  const meetingUrl = page.url();
  const id = new URL(meetingUrl).pathname.split('/').at(-1)!;
  try {
    await expect(
      page.getByRole('heading', { name: 'Private ingestion verification' }),
    ).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(
      page.getByText('AI transcript · Speaker identities are not inferred'),
    ).toBeVisible({ timeout: 175000 });
    await expect(page.locator('.transcript-turn').first()).toBeVisible();
    const recording = page.locator('video');
    await page
      .getByRole('button', { name: 'Play recording', exact: true })
      .click();
    await expect
      .poll(() => recording.evaluate((video) => video.currentTime), {
        timeout: 30000,
      })
      .toBeGreaterThan(0);
    await page
      .getByRole('button', { name: 'Pause recording', exact: true })
      .click();
    const timestamps = page.locator('.transcript-turn .timestamp-button');
    await timestamps.last().click();
    await expect
      .poll(() => recording.evaluate((video) => video.currentTime), {
        timeout: 30000,
      })
      .toBeGreaterThan(60);
    await expect
      .poll(
        () =>
          recording.evaluate(
            (video) => !video.seeking && video.readyState >= 2,
          ),
        { timeout: 30000 },
      )
      .toBe(true);
    await expect(
      page.getByText('AI analysis · grounded in your transcript'),
    ).toBeVisible({ timeout: 120000 });
    await page.getByRole('button', { name: /Sales \/ Customer/ }).click();
    await expect(page.locator('.summary-kicker')).toContainText(
      'Sales / Customer',
    );
    const views: string[] = [];
    for (const label of [
      'General',
      'Sales / Customer',
      'Recruiting / Interview',
    ]) {
      await page
        .getByRole('button', { name: new RegExp(label.replaceAll('/', '\\/')) })
        .click();
      await expect(page.locator('.summary-kicker')).toContainText(label);
      views.push(await page.locator('.summary-overview').innerText());
    }
    expect(new Set(views).size).toBe(3);
    await page
      .getByRole('button', { name: /Rename Speaker/ })
      .first()
      .click();
    await page.getByLabel('Speaker name').fill('Audit speaker');
    await page.getByRole('button', { name: 'Save name' }).click();
    await expect(
      page.getByRole('button', { name: 'Rename Audit speaker' }).first(),
    ).toBeVisible();
    await page
      .getByRole('button', { name: /Save moment from transcript/ })
      .first()
      .click();
    await page
      .getByLabel('Title', { exact: true })
      .fill('Persisted private moment');
    await page
      .getByRole('button', { name: 'Save moment', exact: true })
      .click();
    await expect(page.getByText('Moment saved to this meeting.')).toBeVisible();
    await page
      .getByRole('button', { name: 'Copy transcript', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Transcript copied' }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        navigator.clipboard.readText().then((s) => s.length),
      ),
    ).toBeGreaterThan(20);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download .txt' }).click();
    expect((await download).suggestedFilename()).toMatch(/transcript\.txt$/);
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Rename Audit speaker' }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Persisted private moment' }),
    ).toBeVisible();
    await expect(
      page.getByText('AI transcript · Speaker identities are not inferred'),
    ).toBeVisible();
    await expect(
      page.getByText('AI analysis · grounded in your transcript'),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Open public view/ }),
    ).toHaveCount(0);
    const stranger = await browser.newContext();
    const external = await stranger.newPage();
    await external.goto(meetingUrl);
    await expect(external.getByRole('alert')).toContainText('browser');
    await expect(external.locator('.transcript-turn')).toHaveCount(0);
    const response = await stranger.request.get(
      new URL(`/api/uploads/${id}/media`, meetingUrl).href,
    );
    expect(response.status()).toBe(401);
    await page.getByRole('button', { name: 'Share meeting' }).click();
    await page.getByRole('button', { name: 'Create public link' }).click();
    const shareLink = page.getByRole('textbox', {
      name: 'Public meeting link',
    });
    await expect(shareLink).toHaveValue(/\/share\/meeting-[a-f0-9]{64}$/);
    const shareUrl = await shareLink.inputValue();
    await external.goto(shareUrl);
    await expect(
      external.getByRole('heading', { name: 'Private ingestion verification' }),
    ).toBeVisible();
    await expect(external.locator('.transcript-turn').first()).toBeVisible();
    await external.locator('.transcript-turn .timestamp-button').last().click();
    await expect
      .poll(
        () => external.locator('video').evaluate((video) => video.currentTime),
        {
          timeout: 30000,
        },
      )
      .toBeGreaterThan(60);
    await page.getByRole('button', { name: 'Revoke public link' }).click();
    await expect(page.getByText(/Link revoked/)).toBeVisible();
    await external.reload();
    await expect(
      external.getByRole('heading', {
        name: 'This shared meeting isn’t available',
      }),
    ).toBeVisible();
    const shareToken = new URL(shareUrl).pathname.split('meeting-')[1];
    const revokedMedia = await stranger.request.get(
      new URL(`/api/shares/${shareToken}/media`, meetingUrl).href,
    );
    expect(revokedMedia.status()).toBe(404);
    await stranger.close();
    await page.getByRole('link', { name: 'All meetings', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Your private recordings' }),
    ).toContainText('Private ingestion verification');
    await page.getByRole('textbox', { name: 'Search meetings' }).fill('video');
    await expect(
      page
        .locator('.search-result-card')
        .filter({ hasText: 'Private ingestion verification' }),
    ).toBeVisible();
    await page.goto(meetingUrl);
    await page.getByRole('button', { name: 'Delete meeting' }).click();
    await page.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(page).toHaveURL(/\/app$/);
    expect(
      await page.evaluate(
        async (meetingId) => (await fetch(`/api/uploads/${meetingId}`)).status,
        id,
      ),
    ).toBe(404);
  } finally {
    await page
      .evaluate(async (meetingId) => {
        await fetch(`/api/uploads/${meetingId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
      }, id)
      .catch(() => undefined);
  }
});
