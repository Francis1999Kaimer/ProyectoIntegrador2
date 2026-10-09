const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateEnvironment } = require('../dist/config/environment');
const { HealthController } = require('../dist/health/health.controller');
const { checkSchema } = require('../scripts/check-schema.cjs');
const contract = require('../scripts/schema-contract.json');

test('configuration rejects missing URL, invalid port, non-HTTP and path origins', () => {
  const good = { DATABASE_URL: 'mysql://test:test@localhost:3306/test', JWT_SECRET: 'test-only-secret-32-characters-long' };
  assert.throws(() => validateEnvironment({}));
  assert.throws(() => validateEnvironment({ ...good, JWT_SECRET: 'short' }));
  assert.throws(() => validateEnvironment({ ...good, PORT: 0 }));
  assert.throws(() => validateEnvironment({ ...good, CORS_ORIGINS: 'javascript:alert(1)' }));
  assert.throws(() => validateEnvironment({ ...good, CORS_ORIGINS: 'http://localhost:5173/path' }));
  assert.equal(validateEnvironment(good).PORT, 3000);
});
test('health failure returns generic 503 without driver secrets', async () => {
  const controller = new HealthController({ $queryRaw: async () => { throw new Error('mysql://secret'); } });
  await assert.rejects(controller.check(), error => error.getStatus() === 503 && !JSON.stringify(error.getResponse()).includes('secret'));
});
test('health success queries the database', async () => {
  let queried = false;
  const controller = new HealthController({ $queryRaw: async () => { queried = true; return []; } });
  assert.deepEqual(await controller.check(), { status: 'ok', database: 'up' });
  assert.equal(queried, true);
});
test('baseline guard refuses empty, incomplete and incompatible schemas', () => {
  const fixture = {
    tables: contract.map(t => ({ TABLE_NAME: t.name })),
    columns: contract.flatMap(t => t.columns.map(c => ({ TABLE_NAME: t.name, COLUMN_NAME: c.name, COLUMN_TYPE: c.type, IS_NULLABLE: c.nullable ? 'YES' : 'NO' }))),
    fks: contract.flatMap(t => t.fks.map(f => ({ TABLE_NAME: t.name, CONSTRAINT_NAME: f.name, COLUMN_NAME: f.column, REFERENCED_TABLE_NAME: f.target, REFERENCED_COLUMN_NAME: f.ref, DELETE_RULE: f.delete, UPDATE_RULE: 'RESTRICT' }))),
    checks: contract.flatMap(t => t.checks.map(c => ({ TABLE_NAME: t.name, CONSTRAINT_NAME: c }))),
    indexes: contract.flatMap(t => t.indexes.map(i => ({ TABLE_NAME: t.name, INDEX_NAME: i.name, COLS: i.columns, NON_UNIQUE: i.unique ? 0 : 1 })))
  };
  assert.deepEqual(checkSchema(fixture), []);
  assert.ok(checkSchema({ tables: [], columns: [], fks: [], checks: [], indexes: [] }).length);
  assert.ok(checkSchema({ ...fixture, checks: [] }).length);
  assert.ok(checkSchema({ ...fixture, indexes: [] }).length);
  const changed = structuredClone(fixture);
  changed.columns[0].COLUMN_TYPE = 'varchar(1)';
  assert.ok(checkSchema(changed).length);
});
