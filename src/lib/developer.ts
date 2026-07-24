import { normalizeEmail } from '@/modules/auth/auth-logic';

/**
 * Developer-only tooling. Controlled by DEVELOPER_EMAILS in .env —
 * never by admin roles. Fallback keeps the project owner unlocked if
 * the env var fails to load in Next/Turbopack.
 */
const FALLBACK_DEVELOPER_EMAILS = ['joaopedro.lemos0098@gmail.com'];

export function getDeveloperEmails(): string[] {
  const raw = process.env.DEVELOPER_EMAILS ?? '';
  const fromEnv = raw
    .split(',')
    .map((value) => normalizeEmail(value.trim()))
    .filter(Boolean);

  return fromEnv.length > 0 ? fromEnv : FALLBACK_DEVELOPER_EMAILS.map(normalizeEmail);
}

export function isDeveloperEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getDeveloperEmails().includes(normalizeEmail(email));
}
