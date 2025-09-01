import { test, expect } from '@playwright/test';

test('operadores renderiza (autorizado o no autorizado)', async ({ page }) => {
  await page.goto('/admin/operadores');

  const ok = await page.getByRole('heading', { name: /Operadores/i }).count();
  const noAuth = await page.getByText(/No autorizado/i).count();

  expect(ok + noAuth).toBeGreaterThan(0);
});
