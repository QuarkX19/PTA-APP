import { test, expect } from '@playwright/test';

/**
 * Smoke de /admin/evidencias
 * - Pasa si ve "Evidencias" o "No autorizado".
 * - Si hay acceso, valida controles básicos (Ruta y botón Subir nivel).
 */
test('evidencias carga y muestra controles básicos', async ({ page }) => {
  await page.goto('/admin/evidencias');

  const noAuth = await page.getByText(/No autorizado/i).count();
  if (noAuth > 0) {
    expect(noAuth).toBeGreaterThan(0);
    return; // sin permisos, prueba aprobada por smoke
  }

  await expect(page.getByRole('heading', { name: /Evidencias/i })).toBeVisible();
  await expect(page.getByText(/^Ruta:/)).toBeVisible();
  const backBtn = page.getByRole('button', { name: /Subir nivel/i });
  await expect(backBtn).toBeVisible();

  // Si hay carpetas, entra a una y vuelve
  const folderButtons = page.locator('table button'); // botones "nombre/"
  const foldersCount = await folderButtons.count();
  if (foldersCount > 0) {
    await folderButtons.first().click();
    await expect(backBtn).toBeEnabled();
    await backBtn.click();
    await expect(backBtn).toBeDisabled(); // en raíz
  }
});

