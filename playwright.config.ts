import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  workers: 6,
  // Si corres la app aparte, exporta esta env antes de iniciar Next
  // O usa dotenv en tu dev server. Para E2E con server interno:
  webServer: {
    command: 'cross-env NEXT_PUBLIC_E2E_BYPASS=1 npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
