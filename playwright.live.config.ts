import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_LIVE_PORT || 19007);

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.live.spec.ts',
  fullyParallel: false,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `EXPO_PUBLIC_E2E=0 node tests/e2e/web-server.js ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium-live',
      use: { browserName: 'chromium' },
    },
  ],
});
