import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Register (SIM, no DB)', () => {
  test('unique phone creates account; UI overlay shows', async ({ page, request }) => {
    // Reset simulated store
    await request.post(`${BASE}/api/test/register-sim/reset`);

    // Add a small delay so the global overlay is observable in SIM mode
    await page.goto(`${BASE}?simDelay=800`);

    // Gate should be visible initially (no saved phone)
    await expect(page.getByText('Welcome')).toBeVisible();

    // Switch to Register
    await page.getByRole('button', { name: 'Register' }).click();

    // Enter phone
    const phone = `09${Math.floor(Math.random()*1e9).toString().padStart(9,'0')}`;
    await page.fill('#phone', phone);

    // Click Register (opens confirm modal), then confirm
    await page.getByRole('button', { name: 'Register' }).click();
    await page.getByRole('button', { name: 'OK' }).click();

    // Global overlay appears
    await expect(page.getByTestId('global-loading-overlay')).toBeVisible();

    // Gate closes on success
    await expect(page.getByText('Welcome')).toBeHidden({ timeout: 7000 });

    // LocalStorage contains saved phone
    const saved = await page.evaluate(() => localStorage.getItem('thiha_phone'));
    expect(saved).toBeDefined();
  });
});
