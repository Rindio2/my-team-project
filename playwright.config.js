import { defineConfig, devices } from '@playwright/test';

const previewPort = Number(process.env.E2E_PORT || 8788);
const previewOrigin = process.env.E2E_BASE_URL || `http://127.0.0.1:${previewPort}`;
const releaseAppUrl =
  process.env.VITE_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || previewOrigin;
const runtimeAllowedOrigins = process.env.ALLOWED_ORIGINS || previewOrigin;
const securityContact =
  process.env.PUBLIC_SECURITY_CONTACT || 'mailto:security@packet-opt.example';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: previewOrigin,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: {
    command: `npm run build && npx wrangler pages dev dist --ip 127.0.0.1 --port ${previewPort} --local-protocol http --log-level error -b PUBLIC_APP_URL=${previewOrigin} -b ALLOWED_ORIGINS=${runtimeAllowedOrigins} -b PUBLIC_SECURITY_CONTACT=${securityContact}`,
    url: previewOrigin,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      VITE_PUBLIC_APP_URL: releaseAppUrl,
      PUBLIC_APP_URL: previewOrigin,
      ALLOWED_ORIGINS: runtimeAllowedOrigins,
      PUBLIC_SECURITY_CONTACT: securityContact,
    },
  },
});
