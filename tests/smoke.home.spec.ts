import { test, expect } from '@playwright/test';

test('home carga el body', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
});
