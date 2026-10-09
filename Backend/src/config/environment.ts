export function validateEnvironment(env: Record<string, unknown>) {
  const url = String(env.DATABASE_URL ?? '');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('DATABASE_URL debe ser una URL MySQL válida.'); }
  if (parsed.protocol !== 'mysql:' || !parsed.hostname || parsed.pathname === '/' || parsed.password === 'REPLACE_ME') {
    throw new Error('Configura DATABASE_URL para MySQL/MariaDB antes de iniciar.');
  }
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe estar entre 1 y 65535.');
  const origins = String(env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map(v => v.trim()).filter(Boolean);
  for (const origin of origins) {
    let parsedOrigin: URL;
    try { parsedOrigin = new URL(origin); } catch { throw new Error('CORS_ORIGINS contiene un origen inválido.'); }
    if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== origin) throw new Error('Usa orígenes HTTP completos, sin ruta, en CORS_ORIGINS.');
  }
  if (!['development','test','production'].includes(String(env.NODE_ENV ?? 'development'))) throw new Error('NODE_ENV inválido.');
  return { ...env, PORT: port, HOST: String(env.HOST ?? '127.0.0.1'), CORS_ORIGINS: origins };
}
