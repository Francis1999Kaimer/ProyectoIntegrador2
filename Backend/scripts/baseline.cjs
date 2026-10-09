// This script only reads application tables; resolve writes Prisma history.
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const { spawnSync } = require('node:child_process');
const { checkSchema } = require('./check-schema.cjs');
const path = require('node:path');

async function main() {
  const db = new PrismaClient();
  try {
    const tables = await db.$queryRaw`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`;
    const columns = await db.$queryRaw`SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`;
    const fks = await db.$queryRaw`SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, r.DELETE_RULE, r.UPDATE_RULE FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME WHERE k.TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL`;
    const checks = await db.$queryRaw`SELECT TABLE_NAME, CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = 'CHECK'`;
    const indexes = await db.$queryRaw`SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS COLS FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE`;
    const errors = checkSchema({ tables, columns, fks, checks, indexes });
    if (errors.length) { console.error(errors.join('\n')); throw new Error('Esquema distinto del baseline.'); }
    // Prisma diff additionally checks defaults, native types and its supported schema.
    const diff = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
    if (diff.status !== 0) throw new Error('Prisma detectó diferencias o no pudo comparar. Ejecuta npm run prisma:pull y comparte el resultado antes de continuar.');
    if (tables.some(t => t.TABLE_NAME === '_prisma_migrations')) {
      const history = await db.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations`;
      if (history.some(m => m.migration_name === '0_init' && m.finished_at && !m.rolled_back_at)) {
        console.log('PASS: 0_init ya está aplicado; no se modificó nada.');
        return;
      }
      if (history.length) throw new Error('Existe otro historial Prisma: revisar antes de registrar baseline.');
    }
    console.log('PASS: 17 tablas, columnas, 24 FK, nombres CHECK, índices y comparación Prisma verificados.');
  } finally { await db.$disconnect(); }
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'resolve', '--applied', '0_init'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Prisma no pudo registrar baseline; ejecutar prisma:status y compartir resultado.');
  console.log('PASS: 0_init registrado como aplicado. Se conservaron tablas y datos.');
}
main().catch(error => {
  // Known validation messages are safe; raw driver errors can expose secrets.
  console.error(error.message.startsWith('Prisma ') || error.message.startsWith('Existe ') || error.message.startsWith('Esquema ') ? error.message : 'No se pudo verificar la BD. Revisa .env, MySQL y permisos.');
  process.exitCode = 1;
});
