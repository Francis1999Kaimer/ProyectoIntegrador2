const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const C = require('../dist/repositories/contracts');
const P = require('../dist/repositories/prisma.repositories');
const { ProjectService } = require('../dist/projects/project.service');
const { pagination } = require('../dist/repositories/pagination');

test('ProjectService can be injected with an alternative repository without Prisma', async () => {
  const calls = [];
  const fake = {
    listByOwner: async (owner, page) => { calls.push({ owner, page }); return []; },
    create: async input => { calls.push(input); return { id: 'test', ...input }; }
  };
  class TestModule {}
  Module({ providers: [ProjectService, { provide: C.PROJECT_REPOSITORY, useValue: fake }] })(TestModule);
  const app = await NestFactory.createApplicationContext(TestModule, { logger: false });
  try {
    const service = app.get(ProjectService);
    await service.listForOwner('owner', { limit: 5 });
    assert.deepEqual(calls[0], { owner: 'owner', page: { limit: 5 } });
    await service.createPersonalProject('owner', '  Mi proyecto  ', ' blocks ');
    assert.deepEqual(calls[1], { owner_id: 'owner', title: 'Mi proyecto', project_type: 'blocks' });
    assert.throws(() => service.createPersonalProject('owner', ' ', 'blocks'));
    assert.throws(() => service.createPersonalProject('owner', 'x'.repeat(181), 'blocks'));
    assert.throws(() => service.createPersonalProject('owner', 'title', 'x'.repeat(41)));
    assert.equal(calls.length, 2, 'invalid inputs never reach repository');
  } finally { await app.close(); }
});

test('pagination rejects unbounded, negative, fractional or unsafe requests', () => {
  assert.deepEqual(pagination(), { take: 25, skip: 0 });
  for (const page of [{ limit: 0 }, { limit: 101 }, { limit: 1.5 }, { offset: -1 }, { offset: Infinity }]) {
    assert.throws(() => pagination(page));
  }
});

test('list queries retain the owner/teacher/student/workspace filter and bounded pagination', async () => {
  for (const [Repo, table, method, field] of [
    [P.PrismaProjectRepository, 'projects', 'listByOwner', 'owner_id'],
    [P.PrismaClassroomRepository, 'classrooms', 'listByTeacher', 'teacher_id'],
    [P.PrismaProgressRepository, 'lesson_progress', 'listByStudent', 'student_id'],
    [P.PrismaSimulationRunRepository, 'simulation_runs', 'listByWorkspace', 'workspace_id']
  ]) {
    let query;
    const repo = new Repo({ [table]: { findMany: async q => { query = q; return []; } } });
    await repo[method]('actor', { limit: 10, offset: 20 });
    assert.deepEqual(query.where, { [field]: 'actor' });
    assert.equal(query.take, 10);
    assert.equal(query.skip, 20);
    assert.deepEqual(query.orderBy[1], { id: 'asc' }, 'stable ordering');
    query = undefined;
    await assert.rejects(async () => repo[method]('actor', { limit: 1000 }));
    assert.equal(query, undefined, 'invalid pagination never queries DB');
  }
});

test('public user lookup omits password_hash; credential lookup is explicit', async () => {
  const calls = [];
  const repo = new P.PrismaUserRepository({ users: { findUnique: async q => { calls.push(q); return null; } } });
  assert.equal(await repo.findById('id'), null);
  assert.equal(calls[0].select.password_hash, undefined);
  assert.deepEqual(calls[0].where, { id: 'id' });
  await repo.findForAuthentication('user');
  assert.equal(calls[1].select.password_hash, true);
  assert.deepEqual(calls[1].where, { username: 'user' });
});

test('project creation generates UUID and excludes caller-supplied id/status', async () => {
  let data;
  const repo = new P.PrismaProjectRepository({ projects: { create: async q => { data = q.data; return data; } } });
  await repo.create({ owner_id: 'owner', title: 'title', project_type: 'blocks', id: 'injected', status: 'archived' });
  assert.match(data.id, /^[0-9a-f-]{36}$/);
  assert.notEqual(data.id, 'injected');
  assert.equal(data.status, undefined);
  assert.equal(data.classroom_id, null);
});

test('workspace lookup uses unique project key and preserves missing result', async () => {
  let query;
  const repo = new P.PrismaWorkspaceRepository({ workspaces: { findUnique: async q => { query = q; return null; } } });
  assert.equal(await repo.findByProject('project'), null);
  assert.deepEqual(query.where, { project_id: 'project' });
});

test('simulation decimals cross contract as exact strings, with null preserved', async () => {
  const repo = new P.PrismaSimulationRunRepository({ simulation_runs: { findMany: async () => [
    { accuracy: { toString: () => '0.1234' }, loss: { toString: () => '0.000001' } },
    { accuracy: null, loss: null }
  ] } });
  const rows = await repo.listByWorkspace('workspace');
  assert.deepEqual(rows, [{ accuracy: '0.1234', loss: '0.000001' }, { accuracy: null, loss: null }]);
});
