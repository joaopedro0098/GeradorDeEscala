import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Separate config for the Fase 10 smoke test suite (`*.smoke.test.ts`).
 * Excluded from the default `npm test` run because it hits the real
 * DATABASE_URL from `.env` (same Postgres used by `npm run dev`) instead of
 * running as an isolated, offline unit test. Run explicitly via `npm run
 * test:smoke` when you want to validate the critical path end-to-end.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.smoke.test.{ts,tsx}'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
