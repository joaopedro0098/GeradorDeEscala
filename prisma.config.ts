import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

function resolveMigrationDatabaseUrl(): string {
  const directUrl = process.env.DIRECT_URL?.trim();
  const databaseUrl = env('DATABASE_URL');

  if (directUrl) {
    return directUrl;
  }

  console.warn(
    '[prisma.config] DIRECT_URL is not set. Falling back to DATABASE_URL for CLI/migrations. ' +
      'Supabase migrations require a direct connection on port 5432.',
  );

  return databaseUrl;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Prisma 7 config supports only `url` (no directUrl). Use DIRECT_URL for migrate/introspect.
    url: resolveMigrationDatabaseUrl(),
  },
});
