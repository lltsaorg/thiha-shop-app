import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Register (REAL DB)', () => {
  test('unique phone inserts into DB; UI overlay shows', async ({ page }) => {
    await page.goto(BASE);

    await expect(page.getByText('Welcome')).toBeVisible();
    await page.getByRole('button', { name: 'Register' }).click();

    const phone = `09${Math.floor(Math.random()*1e9).toString().padStart(9,'0')}`;
    await page.fill('#phone', phone);
    await page.getByRole('button', { name: 'Register' }).click();
    await page.getByRole('button', { name: 'OK' }).click();

    await expect(page.getByTestId('global-loading-overlay')).toBeVisible();
    await expect(page.getByText('Welcome')).toBeHidden({ timeout: 7000 });
  });
});
