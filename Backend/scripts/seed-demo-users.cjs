require('reflect-metadata');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const { PasswordService } = require('../dist/auth/password.service');
const { validateEnvironment } = require('../dist/config/environment');

async function main() {
  validateEnvironment(process.env);
  const url = new URL(process.env.DATABASE_URL);
  if (process.env.NODE_ENV !== 'development' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Las cuentas demo solo se crean en MySQL local y NODE_ENV=development.');
  }
  const password = process.env.DEMO_PASSWORD;
  if (!password) throw new Error('Se requiere DEMO_PASSWORD; usar el helper PowerShell.');
  const passwords = new PasswordService();
  const accounts = [];
  for (const role of ['student', 'teacher', 'admin']) accounts.push({
    id: randomUUID(), username: 'aiblocks_demo_' + role, role,
    display_name: 'Demo ' + role, status: 'active', must_change_password: false,
    password_hash: await passwords.hash(password)
  });
  const db = new PrismaClient();
  try {
    await db.$transaction(async tx => {
      for (const account of accounts) {
        const existing = await tx.users.findUnique({ where: { username: account.username } });
        if (existing) {
          if (existing.role !== account.role || existing.display_name !== account.display_name ||
              existing.status !== 'active' || !await passwords.verify(password, existing.password_hash)) {
            throw new Error('Una cuenta demo existente no coincide. No se sobrescribió ninguna credencial.');
          }
          continue;
        }
        await tx.users.create({ data: account });
      }
    }, { timeout: 15000 });
    console.log('PASS: tres cuentas sintéticas disponibles: aiblocks_demo_student, aiblocks_demo_teacher y aiblocks_demo_admin.');
    console.log('No se imprimen contraseñas ni se modifica una cuenta existente. Usar la misma contraseña al ejecutar auth:test-demo.');
  } finally { await db.$disconnect(); }
}
main().catch(error => {
  console.error('FAIL: no se pudo crear/verificar las cuentas demo. Comprueba .env, contraseña demo (12 caracteres/72 bytes), cuentas existentes y MySQL.');
  process.exitCode = 1;
});
