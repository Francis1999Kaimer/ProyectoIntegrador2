// Explicit local integration test: HTTP writes, independent Prisma reads, synthetic records only.
require('dotenv').config();
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const base = 'http://127.0.0.1:' + (process.env.PORT || '3000');
let stage = 'configuracion', adminToken, teacherToken, studentToken, studentId, roomId, projectId;
let cleanupFailed = false, projectArchived = false;
async function call(method, path, token, body, expected = 200) {
  const response = await fetch(base + path, { method,
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000)
  });
  if (response.status !== expected) throw new Error('HTTP ' + response.status + ', esperado ' + expected);
  return response.status === 204 ? null : response.json();
}
async function login(username, password) {
  return (await call('POST', '/auth/login', undefined, { username, password })).access_token;
}
async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(process.env.NODE_ENV, 'development');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  assert.ok(process.env.DEMO_PASSWORD);
  stage = 'health y login de cuentas demo';
  assert.equal((await call('GET', '/health')).database, 'up');
  adminToken = await login('aiblocks_demo_admin', process.env.DEMO_PASSWORD);
  teacherToken = await login('aiblocks_demo_teacher', process.env.DEMO_PASSWORD);
  const outsider = await login('aiblocks_demo_student', process.env.DEMO_PASSWORD);
  const teacher = await call('GET', '/auth/me', teacherToken);
  stage = 'catalogo y salon';
  const catalog = await call('GET', '/catalog', teacherToken);
  const course = catalog.courses.find(c => c.id === '10000000-0000-4000-8000-000000000001');
  const level = catalog.levels.find(l => l.id === 1);
  assert.ok(course && level, 'Se requiere el seed didactico del hito 2.');
  const run = Date.now() + '_' + randomBytes(4).toString('hex');
  const room = await call('POST', '/classrooms', teacherToken, {
    name: 'Prueba APF2 ' + run, level_id: level.id, course_id: course.id,
    academic_year: new Date().getUTCFullYear(), course_start_date: new Date().toISOString().slice(0, 10)
  }, 201);
  roomId = room.id;
  assert.equal(room.teacher_id, teacher.id);
  stage = 'alta sintetica, consentimiento y activacion';
  const firstPassword = randomBytes(24).toString('hex');
  const nextPassword = randomBytes(24).toString('hex');
  const username = 'aiblocks_h6_' + run;
  const student = await call('POST', '/students', adminToken, {
    username, display_name: 'Alumno sintetico APF2 ' + run, password: firstPassword
  }, 201);
  studentId = student.id;
  assert.equal(student.status, 'pending');
  assert.equal(student.password_hash, undefined);
  await call('PATCH', '/students/' + studentId + '/status', adminToken, { status: 'active' }, 409);
  await call('POST', '/students/' + studentId + '/consents', adminToken, {
    guardian_name: 'Tutor SINTETICO de prueba APF2', consent_version: 'synthetic-test-v1'
  }, 201);
  await call('PATCH', '/students/' + studentId + '/status', adminToken, { status: 'active' });
  studentToken = await login(username, firstPassword);
  await call('GET', '/projects', studentToken, undefined, 403);
  await call('POST', '/auth/change-password', studentToken, { current_password: firstPassword, new_password: nextPassword });
  await call('GET', '/auth/me', studentToken, undefined, 401);
  studentToken = await login(username, nextPassword);
  console.log('PASS: alumno sintetico, consentimiento, activacion y cambio de clave persistido; JWT anterior -> 401.');
  stage = 'matricula y permisos';
  const enrollPath = '/classrooms/' + roomId + '/students';
  await call('POST', enrollPath, teacherToken, { student_id: studentId });
  await call('POST', enrollPath, teacherToken, { student_id: studentId });
  const roster = await call('GET', enrollPath, teacherToken);
  assert.ok(roster.some(s => s.id === studentId));
  assert.equal(roster[0].password_hash, undefined);
  assert.equal(roster[0].email, undefined);
  assert.ok((await call('GET', '/classrooms', studentToken)).some(c => c.id === roomId));
  await call('GET', '/classrooms/' + roomId, outsider, undefined, 404);
  await call('POST', '/classrooms', studentToken, {}, 403);
  console.log('PASS: salon, matricula idempotente, roster sin credenciales y acceso por matricula.');
  stage = 'proyecto y workspace';
  const project = await call('POST', '/projects', studentToken, {
    title: 'Proyecto APF2 ' + run, project_type: 'blocks', classroom_id: roomId
  }, 201);
  projectId = project.id;
  assert.equal(project.owner_id, studentId);
  await call('GET', '/projects/' + projectId, outsider, undefined, 404);
  await call('GET', '/projects/' + projectId, teacherToken);
  await call('PATCH', '/projects/' + projectId, teacherToken, { title: 'No autorizado' }, 404);
  await call('POST', '/projects', studentToken, { title: 'No autorizado', project_type: 'blocks', owner_id: teacher.id }, 400);
  await call('PATCH', '/projects/' + projectId, studentToken, { title: 'Proyecto renombrado APF2 ' + run });
  const path = '/projects/' + projectId + '/workspace';
  const blocks = { schemaVersion: 1, nodes: [{ id: 'input', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Prueba sintetica' } }], edges: [] };
  assert.equal((await call('PUT', path, studentToken, { version: 0, blocks })).version, 1);
  assert.equal((await call('PUT', path, studentToken, { version: 1, blocks })).version, 2);
  await call('PUT', path, studentToken, { version: 1, blocks }, 409);
  await call('PUT', path, outsider, { version: 2, blocks }, 404);
  // Test actual DB contention, without assuming the order in which requests win.
  const racing = await Promise.all([0, 1].map(async () => {
    const response = await fetch(base + path, { method: 'PUT', headers: { Authorization: 'Bearer ' + studentToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 2, blocks }), signal: AbortSignal.timeout(15000) });
    return response.status;
  }));
  assert.deepEqual(racing.sort(), [200, 409]);
  assert.equal((await call('GET', path, studentToken)).version, 3);
  const workspace = await db.workspaces.findUniqueOrThrow({ where: { project_id: projectId } });
  assert.equal(workspace.version, 3);
  assert.deepEqual(JSON.parse(workspace.blocks_json), blocks);
  assert.equal(await db.workspace_versions.count({ where: { workspace_id: workspace.id } }), 3);
  assert.equal(await db.classroom_enrollments.count({ where: { classroom_id: roomId, student_id: studentId } }), 1);
  console.log('PASS: proyecto y JSON persistidos; tres snapshots en MySQL, escritura concurrente 200/409.');
  stage = 'lecciones y progreso';
  const lessons = await call('GET', '/classrooms/' + roomId + '/lessons', studentToken);
  assert.ok(lessons.length > 0);
  const lesson = lessons[0], total = lesson.content.sections.length;
  await call('PUT', '/progress/' + lesson.id, studentToken, { completed_sections: total + 1 }, 400);
  const first = await call('PUT', '/progress/' + lesson.id, studentToken, { completed_sections: 1 });
  assert.equal(first.progress_percent, Math.floor(100 / total));
  await call('PUT', '/progress/' + lesson.id, studentToken, { completed_sections: total });
  assert.equal((await call('PUT', '/progress/' + lesson.id, studentToken, { completed_sections: 0 })).progress_percent, 100);
  assert.ok((await call('GET', '/students/' + studentId + '/progress', teacherToken)).some(p => p.lesson_id === lesson.id));
  const progress = await db.lesson_progress.findUniqueOrThrow({ where: { student_id_lesson_id: { student_id: studentId, lesson_id: lesson.id } } });
  assert.equal(progress.progress_percent, 100); assert.equal(progress.status, 'completed');
  assert.equal(progress.completed_sections, total);
  console.log('PASS: progreso calculado, sin regresion, visible al docente y persistido en MySQL.');
  await call('PATCH', '/projects/' + projectId, studentToken, { status: 'archived' });
  projectArchived = true;
  stage = 'revocacion de consentimiento';
  await call('DELETE', '/students/' + studentId + '/consents/current', adminToken, undefined, 204);
  await call('GET', '/projects', studentToken, undefined, 401);
  await call('POST', enrollPath, teacherToken, { student_id: studentId }, 409);
  console.log('PASS: revocacion suspende al alumno sintetico y rechaza su JWT y nueva matricula.');
}
async function cleanup() {
  // Retain synthetic evidence; archive only records whose IDs were created in this run.
  const jobs = [];
  if (projectId && studentToken && !projectArchived) jobs.push(() => call('PATCH', '/projects/' + projectId, studentToken, { status: 'archived' }));
  if (roomId && teacherToken) jobs.push(() => call('PATCH', '/classrooms/' + roomId, teacherToken, { status: 'archived' }));
  if (studentId && adminToken) jobs.push(() => call('DELETE', '/students/' + studentId + '/consents/current', adminToken, undefined, 204));
  for (const job of jobs) { try { await job(); } catch { cleanupFailed = true; } }
  await db.$disconnect();
}
main().catch(error => {
  const status = /^HTTP \d+, esperado \d+$/.test(error.message) ? ' (' + error.message + ')' : '';
  console.error('FAIL en ' + stage + status + '. Revisa API, .env, seed y limite de login. No compartas claves ni tokens.');
  process.exitCode = 1;
}).finally(async () => {
  await cleanup();
  if (cleanupFailed) { console.error('FAIL: no se pudo archivar toda la evidencia sintetica. Revisa API antes de repetir.'); process.exitCode = 1; }
  if (!process.exitCode) console.log('PASS: APIs hito 6 verificadas con MySQL real; evidencia sintetica conservada y archivada.');
});
