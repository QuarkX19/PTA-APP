import { test, expect } from '@playwright/test';

/**
 * Smoke de /admin/asignaciones
 * - Pasa si la ruta responde y muestra "Asignaciones" o "No autorizado".
 */
test('asignaciones carga (autorizado o no)', async ({ page }) => {
  const resp = await page.goto('/admin/asignaciones');
  expect(resp?.status(), 'HTTP debe responder').toBeLessThan(500);

  const heading = await page.getByRole('heading', { name: /Asignaciones/i }).count();
  const noAuth  = await page.getByText(/No autorizado/i).count();

  expect(heading + noAuth, 'Debe ver heading o texto de no autorizado').toBeGreaterThan(0);
});
