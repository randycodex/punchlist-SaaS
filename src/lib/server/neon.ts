import 'server-only';

import postgres from 'postgres';

declare global {
  // eslint-disable-next-line no-var
  var __punchlistSql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured.');
  }

  return postgres(databaseUrl, {
    prepare: false,
    max: process.env.NODE_ENV === 'production' ? 10 : 1,
  });
}

export const sql = globalThis.__punchlistSql ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__punchlistSql = sql;
}
