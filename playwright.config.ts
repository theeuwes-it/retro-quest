import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Desktop Chrome'],
    viewport: { width: 1400, height: 900 },
  },
  webServer: {
    // Production build, in-memory store and polling: no external services needed.
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      RATE_LIMIT_JOIN_PER_MIN: '1000',
      RATE_LIMIT_CREATE_PER_MIN: '1000',
      UPSTASH_REDIS_REST_URL: '',
      UPSTASH_REDIS_REST_TOKEN: '',
      KV_REST_API_URL: '',
      KV_REST_API_TOKEN: '',
      ABLY_API_KEY: '',
    },
  },
});
