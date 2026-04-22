import { expect, test } from '@playwright/test';

test('release shell renders and free mode locks cloud and crm actions', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Packet Opt Control Tower')).toBeVisible();
  await expect(page.getByText('Workspace map')).toBeVisible();
  await expect(page.locator('#canvas')).toBeVisible();

  await page.locator('#cloudWorkspaceSection > summary').click();
  await expect(page.getByText(/Free mode: cloud auth đã tắt/i)).toBeVisible();

  await page.locator('#crmSection > summary').click();
  await expect(page.getByText(/Free mode: CRM và email tự động đã tắt/i)).toBeVisible();

  await page.getByRole('button', { name: /Commercial/i }).click();
  await expect(page.locator('#commercialProjectName')).toBeVisible();

  await expect(page.locator('[data-command="crm-submit-lead"]').first()).toHaveJSProperty(
    'disabled',
    true
  );
  await expect(page.locator('[data-command="crm-send-report"]').first()).toHaveJSProperty(
    'disabled',
    true
  );
  await expect(page.locator('[data-command="auth-send-link"]').first()).toHaveJSProperty(
    'disabled',
    true
  );
  await expect(page.locator('[data-command="cloud-save-plan"]').first()).toHaveJSProperty(
    'disabled',
    true
  );
});

test('status endpoint exposes release diagnostics and preflight rejects disallowed origins', async ({
  request,
}) => {
  const statusResponse = await request.get('/api/status');
  expect(statusResponse.ok()).toBeTruthy();

  const status = await statusResponse.json();
  expect(status.service).toBe('packet-opt-control-tower');
  expect(status.version).toBe('release-mvp');
  expect(Array.isArray(status.release?.issues)).toBeTruthy();

  const sameOriginPreflight = await request.post('/api/preflight', {
    data: {
      items: [],
      container: { w: 235, h: 239, d: 590 },
      maxWeight: 28000,
      floorLoadLimit: 0,
      settings: {},
    },
  });
  expect(sameOriginPreflight.ok()).toBeTruthy();

  const blockedPreflight = await request.post('/api/preflight', {
    headers: {
      Origin: 'https://evil.example',
      'content-type': 'application/json',
    },
    data: {
      items: [],
      container: { w: 235, h: 239, d: 590 },
    },
  });

  expect(blockedPreflight.status()).toBe(403);
  const blockedPayload = await blockedPreflight.json();
  expect(blockedPayload.ok).toBe(false);
});
