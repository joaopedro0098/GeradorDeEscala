import 'dotenv/config';
import '@testing-library/jest-dom/vitest';

process.env.SESSION_SECRET ??= 'test-session-secret-for-vitest-only';
