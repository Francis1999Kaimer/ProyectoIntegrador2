const contract = require('./schema-contract.json');
function normalizeType(type) {
  return type.toLowerCase().replace(/\b(tinyint|smallint|int)\(\d+\)/g, '$1');
}
function checkSchema({ tables, columns, fks, checks, indexes }) {
  const errors = [];
  const expectedNames = contract.map(t => t.name);
  if (tables.filter(t => t.TABLE_NAME !== '_prisma_migrations').length !== expectedNames.length) errors.push('Número de tablas diferente del baseline.');
  for (const table of contract) {
    if (!tables.some(t => t.TABLE_NAME === table.name)) errors.push('Falta tabla: ' + table.name);
    const actualCols = columns.filter(c => c.TABLE_NAME === table.name);
    if (actualCols.length !== table.columns.length) errors.push('Columnas diferentes: ' + table.name);
    for (const col of table.columns) {
      const actual = actualCols.find(c => c.COLUMN_NAME === col.name);
      if (!actual || normalizeType(actual.COLUMN_TYPE) !== normalizeType(col.type) || (actual.IS_NULLABLE === 'YES') !== col.nullable) errors.push('Columna incompatible: ' + table.name + '.' + col.name);
    }
    for (const fk of table.fks) {
      const actual = fks.find(f => f.TABLE_NAME === table.name && f.CONSTRAINT_NAME === fk.name);
      if (!actual || actual.COLUMN_NAME !== fk.column || actual.REFERENCED_TABLE_NAME !== fk.target || actual.REFERENCED_COLUMN_NAME !== fk.ref || actual.DELETE_RULE !== fk.delete || actual.UPDATE_RULE !== 'RESTRICT') errors.push('FK incompatible: ' + fk.name);
    }
    if (fks.filter(f => f.TABLE_NAME === table.name).length !== table.fks.length) errors.push('Cantidad FK incompatible: ' + table.name);
    const actualChecks = checks.filter(c => c.TABLE_NAME === table.name);
    if (actualChecks.length !== table.checks.length || table.checks.some(name => !actualChecks.some(c => c.CONSTRAINT_NAME === name))) errors.push('CHECK faltante/diferente: ' + table.name);
    const actualIndexes = indexes.filter(i => i.TABLE_NAME === table.name);
    if (actualIndexes.length !== table.indexes.length) errors.push('Índices diferentes: ' + table.name);
    for (const index of table.indexes) {
      const actual = actualIndexes.find(i => i.INDEX_NAME === index.name);
      if (!actual || actual.COLS !== index.columns || (Number(actual.NON_UNIQUE) === 0) !== index.unique) errors.push('Índice incompatible: ' + table.name + '.' + index.name);
    }
  }
  return errors;
}
module.exports = { checkSchema };
