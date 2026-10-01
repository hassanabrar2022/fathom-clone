import { defineConfig, devices } from '@playwright/test';

const chromiumLaunchOptions = process.env.FATHOM_CLONE_CHROMIUM_EXECUTABLE
  ? { executablePath: process.env.FATHOM_CLONE_CHROMIUM_EXECUTABLE }
  : undefined;

// Specs run the real web app with /api mocked by tests/fixtures.ts.
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: chromiumLaunchOptions,
      },
    },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        launchOptions: chromiumLaunchOptions,
      },
    },
  ],
  webServer: {
    command: 'npm run dev:web',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
});
