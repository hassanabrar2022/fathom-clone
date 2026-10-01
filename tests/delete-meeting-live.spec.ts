import { expect, test } from '@playwright/test';

// Explicit production integration check. It reserves an empty private row and
// immediately deletes it; no media upload, transcription, or AI call occurs.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('live owner deletes a private meeting row and both absent R2 objects', async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.FATHOM_CLONE_DELETE_LIVE || testInfo.project.name !== 'chromium',
  );
  test.setTimeout(90000);
  await page.goto('/app');
  const created = await page.evaluate(async () => {
    await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const response = await fetch('/api/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Private deletion verification',
        filename: 'delete-verification.webm',
        contentType: 'video/webm',
        size: 4,
        duration: 5,
      }),
    });
    return { status: response.status, body: await response.json() };
  });
  expect(created.status).toBe(201);
  const id = (created.body as { id: string }).id;
  expect(id).toMatch(/^[a-f0-9-]{36}$/);
  try {
    await page.goto(`/app/meetings/${id}`);
    await expect(
      page.getByRole('heading', { name: 'Private deletion verification' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Delete meeting' }).click();
    await page.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText('Private deletion verification')).toHaveCount(
      0,
    );
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
