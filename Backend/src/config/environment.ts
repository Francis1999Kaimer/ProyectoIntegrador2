export function validateEnvironment(env: Record<string, unknown>) {
  const url = String(env.DATABASE_URL ?? '');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('DATABASE_URL debe ser una URL MySQL válida.'); }
  if (parsed.protocol !== 'mysql:' || !parsed.hostname || parsed.pathname === '/' || parsed.password === 'REPLACE_ME') {
    throw new Error('Configura DATABASE_URL para MySQL/MariaDB antes de iniciar.');
  }
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe estar entre 1 y 65535.');
  const nodeEnv = String(env.NODE_ENV ?? 'development');
  if (!['development','test','production'].includes(nodeEnv)) throw new Error('NODE_ENV inválido.');
  const configuredOrigins = String(env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map(v => v.trim()).filter(Boolean);
  // Public frontend. Keep this exact deployed origin available even when a host
  // does not set NODE_ENV (a common deployment-platform default).
  const origins = [...new Set([...configuredOrigins, 'https://proyecto-integrador2-two.vercel.app'])];
  for (const origin of origins) {
    let parsedOrigin: URL;
    try { parsedOrigin = new URL(origin); } catch { throw new Error('CORS_ORIGINS contiene un origen inválido.'); }
    if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== origin) throw new Error('Usa orígenes HTTP completos, sin ruta, en CORS_ORIGINS.');
  }
  const secret = String(env.JWT_SECRET ?? '');
  if (secret.length < 32 || secret.includes('REPLACE_ME')) throw new Error('JWT_SECRET requiere un secreto propio de al menos 32 caracteres.');
  return { ...env, NODE_ENV: nodeEnv, JWT_SECRET: secret, PORT: port, HOST: String(env.HOST ?? '127.0.0.1'), CORS_ORIGINS: origins };
}
