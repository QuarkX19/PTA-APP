import { test, expect } from '@playwright/test';

test('reportes renderiza (autorizado o no autorizado)', async ({ page }) => {
  await page.goto('/admin/reportes');

  // Mínimo una de estas dos debe aparecer
  const ok = await page.getByRole('heading', { name: /Reportes de estatus/i }).count();
  const noAuth = await page.getByText(/No autorizado/i).count();

  expect(ok + noAuth).toBeGreaterThan(0);
});
