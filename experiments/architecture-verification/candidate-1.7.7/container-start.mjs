// Draft startup gate; does not log credentials or fall back to embedded PG.
for (const name of ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'BASE_URL']) {
  if (!process.env[name]) throw new Error(`Required environment variable missing: ${name}`);
}
const base = new URL(process.env.BASE_URL);
if (process.env.NODE_ENV === 'production' && base.protocol !== 'https:') {
  throw new Error('Production BASE_URL must use HTTPS');
}
await import('./src/server.ts');
