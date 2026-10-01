import { firefox } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseURL = process.env.FATHOM_CLONE_VERIFY_URL || 'http://127.0.0.1:5173';
await mkdir('/tmp/fathom-clone-qa', { recursive: true });
const browser = await firefox.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/app`);
  await page.getByRole('link', { name: 'Explore meeting' }).click();
  await page
    .getByRole('heading', { name: 'Transcript', exact: false })
    .waitFor();
  await page.waitForFunction(
    () => document.querySelector('video')?.readyState >= 2,
  );
  await page
    .getByRole('button', { name: 'Play recording', exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector('video').currentTime > 1,
  );
  await page
    .getByRole('button', { name: 'Pause recording', exact: true })
    .click();
  await page.screenshot({
    path: '/tmp/fathom-clone-qa/recording-desktop.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: /Sales \/ Customer Needs and value/ })
    .click();
  await page
    .getByRole('heading', {
      name: 'A product walkthrough centered on less note-taking',
    })
    .waitFor();
  await page.screenshot({
    path: '/tmp/fathom-clone-qa/intelligence-sales.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Seek to 1:37' }).click();
  await page.waitForFunction(() => !document.querySelector('video').seeking);
  await page
    .locator('video')
    .screenshot({ path: '/tmp/fathom-clone-qa/sanitized-end-frame.png' });
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await mobile.goto(`${baseURL}/app/meetings/recording-walkthrough`);
  await mobile
    .getByRole('heading', { name: 'Transcript', exact: false })
    .waitFor();
  await mobile
    .getByRole('button', {
      name: /Recruiting \/ Interview Conversation signals/,
    })
    .click();
  await mobile
    .getByRole('heading', {
      name: 'Clear facilitation, with limited interview evidence',
    })
    .waitFor();
  await mobile.screenshot({
    path: '/tmp/fathom-clone-qa/recording-mobile.png',
    fullPage: true,
  });
  const metadata = await page.locator('video').evaluate((video) => ({
    duration: video.duration,
    width: video.videoWidth,
    height: video.videoHeight,
  }));
  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  if (overflow) throw new Error('Mobile layout overflows');
  const range = await context.request.get(
    `${baseURL}/media/recording-walkthrough-optimized.webm`,
    {
      headers: { Range: 'bytes=0-1023' },
    },
  );
  if (range.status() !== 206 || (await range.body()).length !== 1024) {
    throw new Error('Media byte-range response failed');
  }
  console.log(
    JSON.stringify({
      baseURL,
      cleanContext: true,
      metadata,
      mediaRangeStatus: range.status(),
      mobileOverflow: overflow,
      screenshots: '/tmp/fathom-clone-qa',
    }),
  );
} finally {
  await browser.close();
}
