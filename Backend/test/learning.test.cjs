const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Test } = require('@nestjs/testing');
const { USER_REPOSITORY } = require('../dist/repositories/contracts');
const { LEARNING_REPOSITORY, DataConflict, DataMissing } = require('../dist/repositories/learning.contracts');
const { PrismaService } = require('../dist/prisma/prisma.service');
const { datasetBody, trainingDb } = require('./training-helpers.cjs');
process.env.JWT_SECRET = 'unit-only-learning-secret-32-characters-long';
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/unit_tests';
process.env.NODE_ENV = 'test';
const { AppModule } = require('../dist/app.module');
const { AuthService } = require('../dist/auth/auth.service');
const PASSWORD = 'unit-only-password-123';
const publicStudent = u => ({ id: u.id, username: u.username, display_name: u.display_name, status: u.status });

async function fixture() {
  const hash = await bcrypt.hash(PASSWORD, 4);
  const users = ['student', 'student', 'teacher', 'teacher', 'admin'].map((role, i) => ({
    id: randomUUID(), role, username: 'test_' + i, display_name: 'Test ' + i,
    status: 'active', email: null, must_change_password: false, password_hash: hash
  }));
  const [a, b, t, other, admin] = users;
  const course = '10000000-0000-4000-8000-000000000001', secondCourse = randomUUID(), lessonId = randomUUID();
  const room = { id: randomUUID(), teacher_id: t.id, level_id: 1, course_id: course, status: 'active', name: 'Owned room' };
  const otherRoom = { id: randomUUID(), teacher_id: other.id, level_id: 1, course_id: secondCourse, status: 'active', name: 'Other room' };
  const rooms = [room, otherRoom];
  const enrollments = new Set([room.id + ':' + a.id]);
  const consents = new Set([a.id]), consentLog = [];
  const projects = [{ id: randomUUID(), owner_id: a.id, classroom_id: room.id, title: 'A project', status: 'draft', project_type: 'blocks' }];
  const workspaces = new Map(), snapshots = [], progress = [], simulations = [];
  const lesson = { id: lessonId, level_id: 1, title: 'Test lesson', content_json: JSON.stringify({ sections: [1,2,3,4,5] }) };
  const coTeachers = new Set();
  const teaches = (teacher, r) => r.teacher_id === teacher || coTeachers.has(r.id + ':' + teacher);
  const canRoom = (actor, r) => actor.role === 'admin' || (actor.role === 'teacher' ? teaches(actor.id, r) : enrollments.has(r.id + ':' + actor.id));
  const repo = {
    catalog: async () => ({ levels: [{ id: 1 }], courses: [{ id: course }] }),
    listStudents: async actor => users.filter(u => u.role === 'student' && (actor.role === 'admin' || rooms.some(r => teaches(actor.id, r) && enrollments.has(r.id + ':' + u.id)))).map(publicStudent),
    listTeachers: async () => users.filter(u => u.role === 'teacher').map(publicStudent),
    student: async id => users.find(u => u.id === id && u.role === 'student') ?? null,
    teacherHasStudent: async (teacher, student) => rooms.some(r => teaches(teacher, r) && r.status === 'active' && enrollments.has(r.id + ':' + student)),
    createStudent: async input => {
      if (users.some(u => u.username === input.username)) throw new DataConflict();
      if (input.classroom_id && rooms.find(r => r.id === input.classroom_id)?.status !== 'active') throw new DataConflict();
      const { classroom_id, guardian_name, consent_version, ...fields } = input;
      const u = { id: randomUUID(), ...fields, role: 'student', status: 'active' };
      users.push(u); consents.add(u.id); consentLog.push({ student_id: u.id, guardian_name, consent_version });
      if (classroom_id) enrollments.add(classroom_id + ':' + u.id);
      return publicStudent(u);
    },
    account: async id => { const u = users.find(u => u.id === id); return u ? { id: u.id, role: u.role, status: u.status } : null; },
    resetPassword: async (id, password_hash, must_change_password) => { const u = users.find(u => u.id === id); if (!u) throw new DataMissing(); Object.assign(u, { password_hash, must_change_password }); },
    createTeacher: async input => {
      if (users.some(u => u.username === input.username)) throw new DataConflict();
      const u = { id: randomUUID(), ...input, role: 'teacher', status: 'active', must_change_password: true };
      users.push(u); return publicStudent(u);
    },
    setStudentStatus: async (id, status) => {
      const u = users.find(u => u.id === id && u.role === 'student');
      if (!u) throw new DataMissing();
      if (status === 'active' && !consents.has(id)) throw new DataConflict();
      u.status = status; return publicStudent(u);
    },
    setTeacherStatus: async (id, status) => {
      const u = users.find(u => u.id === id && u.role === 'teacher');
      if (!u) throw new DataMissing();
      u.status = status; return publicStudent(u);
    },
    recordConsent: async id => { if (consents.has(id)) throw new DataConflict(); consents.add(id); return { id: randomUUID(), student_id: id }; },
    currentConsent: async id => consents.has(id) ? { guardian_name: 'Synthetic guardian', consent_version: 'unit-test-v1', consented_at: new Date() } : null,
    revokeConsent: async id => { consents.delete(id); users.find(u => u.id === id).status = 'suspended'; },
    validTeacher: async id => users.some(u => u.id === id && u.role === 'teacher' && u.status === 'active'),
    validCatalog: async (level, c) => level === 1 && (!c || c === course),
    listClassrooms: async actor => rooms.filter(r => canRoom(actor, r)),
    classroom: async id => rooms.find(r => r.id === id) ?? null,
    enrolled: async (id, student) => enrollments.has(id + ':' + student),
    teachesClassroom: async (id, teacher) => coTeachers.has(id + ':' + teacher) || rooms.some(r => r.id === id && r.teacher_id === teacher),
    classroomTeachers: async id => { const r = rooms.find(x => x.id === id); return users.filter(u => u.id === r.teacher_id || coTeachers.has(id + ':' + u.id)).map(u => ({ ...publicStudent(u), responsible: u.id === r.teacher_id })); },
    eligibleTeachers: async id => users.filter(u => u.role === 'teacher' && u.status === 'active' && !teaches(u.id, rooms.find(r => r.id === id))).map(publicStudent),
    addClassroomTeacher: async (id, teacher) => { const r = rooms.find(x => x.id === id); if (r?.status !== 'active' || r.teacher_id === teacher || !users.some(u => u.id === teacher && u.role === 'teacher' && u.status === 'active')) throw new DataConflict(); coTeachers.add(id + ':' + teacher); },
    removeClassroomTeacher: async (id, teacher) => { coTeachers.delete(id + ':' + teacher); },
    createClassroom: async input => { const r = { id: randomUUID(), ...input, status: 'active' }; rooms.push(r); return r; },
    updateClassroom: async (id, input) => Object.assign(rooms.find(r => r.id === id), input),
    classroomStudents: async id => users.filter(u => enrollments.has(id + ':' + u.id)).map(publicStudent),
    eligibleStudents: async id => users.filter(u => u.role === 'student' && u.status === 'active' && consents.has(u.id) && !enrollments.has(id + ':' + u.id)).map(publicStudent),
    enroll: async (id, student) => {
      if (!consents.has(student) || !users.some(u => u.id === student && u.role === 'student' && u.status === 'active') || rooms.find(r => r.id === id)?.status !== 'active') throw new DataConflict();
      enrollments.add(id + ':' + student);
    },
    unenroll: async (id, student) => { enrollments.delete(id + ':' + student); },
    lessons: async id => { if (rooms.find(r => r.id === id)?.status !== 'active') throw new DataMissing(); return [lesson]; },
    lessonForStudent: async (id, student) => id === lessonId && rooms.some(r => r.course_id === course && r.level_id === 1 && r.status === 'active' && enrollments.has(r.id + ':' + student)) ? lesson : null,
    listProjects: async actor => projects.filter(p => p.owner_id === actor.id || actor.role === 'admin' || (actor.role === 'teacher' && rooms.some(r => r.id === p.classroom_id && teaches(actor.id, r)))),
    project: async id => projects.find(p => p.id === id) ?? null,
    createProject: async (owner_id, input) => { const p = { id: randomUUID(), ...input, owner_id, status: 'draft' }; projects.push(p); return p; },
    updateProject: async (id, input) => Object.assign(projects.find(p => p.id === id), input),
    workspace: async id => workspaces.get(id) ?? null,
    saveWorkspace: async (id, version, json) => {
      const previous = workspaces.get(id);
      if ((previous?.version ?? 0) !== version) throw new DataConflict();
      const next = { id: previous?.id ?? randomUUID(), project_id: id, version: version + 1, blocks_json: json };
      workspaces.set(id, next); snapshots.push({ ...next }); return next;
    },
    listSimulations: async workspace_id => simulations.filter(run => run.workspace_id === workspace_id),
    createSimulation: async input => {
      const now = new Date(), run = { id: randomUUID(), ...input, status: 'completed', accuracy: String(input.accuracy), loss: String(input.loss), started_at: now, finished_at: now, created_at: now };
      simulations.push(run); return run;
    },
    listProgress: async access => progress.filter(p => p.student_id === access.student_id),
    saveProgress: async (student_id, lesson_id, sections, total) => {
      let p = progress.find(p => p.student_id === student_id && p.lesson_id === lesson_id);
      if (!p) { p = { id: randomUUID(), student_id, lesson_id, completed_sections: 0, progress_percent: 0, status: 'not_started', completed_at: null }; progress.push(p); }
      if (sections > p.completed_sections) Object.assign(p, { completed_sections: sections, progress_percent: Math.floor(sections * 100 / total), status: sections === total ? 'completed' : 'in_progress', completed_at: sections === total ? new Date() : null });
      return p;
    }
  };
  const authRepo = {
    findForAuthentication: async name => users.find(u => u.username === name) ?? null,
    findCredentialsById: async id => users.find(u => u.id === id) ?? null,
    updatePassword: async (id, old, next) => {
      const user = users.find(u => u.id === id && u.password_hash === old && u.status === 'active');
      if (!user) return false;
      user.password_hash = next; user.must_change_password = false; return true;
    }
  };
  const db = { $queryRaw: async () => [{ ok: 1 }] };
  db.projects = { findUnique: async ({where}) => projects.find(p => p.id === where.id) ?? null, create: async ({data}) => { if(projects.some(p=>p.id===data.id)) throw Object.assign(new Error('duplicate'),{code:'P2002'}); const p = {...data,status:'draft'}; projects.push(p); return p; } };
  const training = trainingDb();
  db.character_labs = training.db.character_labs; db.training_runs = training.db.training_runs;
  db.classrooms = { findUnique: async ({where}) => rooms.find(r => r.id === where.id) ?? null };
  db.$transaction = async fn => fn(db);
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(USER_REPOSITORY).useValue(authRepo)
    .overrideProvider(LEARNING_REPOSITORY).useValue(repo)
    .overrideProvider(PrismaService).useValue(db).compile();
  const app = module.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const auth = module.get(AuthService);
  const tokens = {};
  for (const u of users) tokens[u.id] = (await auth.login(u.username, PASSWORD)).access_token;
  async function call(actor, method, path, body) {
    const response = await fetch(base + path, { method, headers: {
      ...(actor ? { Authorization: 'Bearer ' + tokens[actor.id] } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
    }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }
  return { app, base, tokens, coTeachers, consents, consentLog, users, a, b, t, other, admin, course, room, rooms, otherRoom, projects, repo, call, lessonId, progress, snapshots, workspaces, simulations, enrollments };
}
const graph = { schemaVersion: 1, nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Input' } }], edges: [] };
const simulationGraph = { schemaVersion: 1, nodes: [
  { id: 'data', position: { x: 0, y: 0 }, data: { label: 'Datos', kind: 'dataset' } },
  { id: 'model', position: { x: 100, y: 0 }, data: { label: 'Modelo', kind: 'model' } },
  { id: 'train', position: { x: 200, y: 0 }, data: { label: 'Entrenar', kind: 'train' } },
  { id: 'evaluate', position: { x: 300, y: 0 }, data: { label: 'Evaluar', kind: 'evaluate' } }
], edges: [{ id: 'a', source: 'data', target: 'model' }, { id: 'b', source: 'model', target: 'train' }, { id: 'c', source: 'train', target: 'evaluate' }] };
async function withFixture(run) { const f = await fixture(); try { await run(f); } finally { await f.app.close(); } }

test('business APIs require JWT and roles; classroom, roster and project lists are scoped', () => withFixture(async f => {
  for (const path of ['/catalog','/students','/classrooms','/projects','/progress']) assert.equal((await f.call(null,'GET',path)).status,401);
  assert.equal((await f.call(f.a,'GET','/students')).status,403);
  assert.equal((await f.call(f.a,'POST','/classrooms',{})).status,403);
  assert.equal((await f.call(f.t,'POST','/students',{})).status,400);
  assert.equal((await f.call(f.a,'POST','/students',{})).status,403);
  assert.equal((await f.call(f.a,'GET',`/classrooms/${f.room.id}/students`)).status,403);
  assert.equal((await f.call(f.other,'GET',`/classrooms/${f.room.id}`)).status,404);
  assert.equal((await f.call(f.b,'GET',`/classrooms/${f.room.id}`)).status,404);
  assert.deepEqual((await f.call(f.a,'GET','/classrooms')).body.map(r=>r.id),[f.room.id]);
  assert.equal((await f.call(f.b,'GET','/projects')).body.length,0);
  const students = (await f.call(f.t,'GET','/students')).body;
  assert.deepEqual(students.map(s=>s.id),[f.a.id]);
  assert.equal(students[0].password_hash,undefined);
  assert.equal(students[0].email,undefined);
  assert.equal((await f.call(f.admin,'GET','/students')).body.length,2);
}));

test('student accounts are created active in one step with the guardian authorization; teachers create them in their own classroom', () => withFixture(async f => {
  const body = { username: 'new_student', display_name: 'New student', password: PASSWORD, guardian_authorized: true, guardian_name: 'Tutor sintético' };
  assert.equal((await f.call(f.admin,'POST','/students',{ ...body, guardian_authorized: false })).status,400,'la casilla es obligatoria');
  assert.equal((await f.call(f.admin,'POST','/students',{ ...body, role:'admin' })).status,400);
  assert.equal((await f.call(f.admin,'POST','/students',{ ...body, password:'🙂'.repeat(20) })).status,400);
  const created = await f.call(f.admin,'POST','/students',body);
  assert.equal(created.status,201); assert.equal(created.body.status,'active');
  assert.equal(created.body.password_hash,undefined);
  const stored = f.users.find(u=>u.id===created.body.id);
  assert.equal(bcrypt.getRounds(stored.password_hash),12);
  assert.equal(stored.must_change_password,true);
  assert.ok(f.consents.has(created.body.id));
  assert.deepEqual(f.consentLog.at(-1),{ student_id: created.body.id, guardian_name: 'Tutor sintético', consent_version: 'casilla-alta-v1' });
  assert.equal((await f.call(f.admin,'POST','/students',body)).status,409);
  assert.equal((await f.call(f.admin,'POST',`/classrooms/${f.room.id}/students`,{student_id:created.body.id})).status,200,'ya puede matricularse');
  // El docente debe indicar uno de sus salones activos; el alumno queda matriculado.
  const teacherBody = { ...body, username: 'teacher_made', require_password_change: false };
  assert.equal((await f.call(f.t,'POST','/students',teacherBody)).status,400);
  assert.equal((await f.call(f.t,'POST','/students',{ ...teacherBody, classroom_id: f.otherRoom.id })).status,404);
  const mine = await f.call(f.t,'POST','/students',{ ...teacherBody, classroom_id: f.room.id });
  assert.equal(mine.status,201); assert.ok(f.enrollments.has(f.room.id + ':' + mine.body.id));
  assert.equal(f.users.find(u=>u.id===mine.body.id).must_change_password,false);
  assert.equal((await f.call(f.t,'GET','/students')).body.some(s=>s.id===mine.body.id),true);
  assert.equal((await f.call(f.t,'PATCH',`/classrooms/${f.room.id}`,{status:'archived'})).status,200);
  assert.equal((await f.call(f.t,'POST','/students',{ ...teacherBody, username:'late_student', classroom_id: f.room.id })).status,400,'salón archivado');
}));

test('teachers reset passwords of their own students and administrators of any account; old sessions stop working', () => withFixture(async f => {
  const NEW = 'nueva-clave-segura-1';
  const before = await f.call(f.a,'GET','/projects'); assert.equal(before.status,200);
  assert.equal((await f.call(f.a,'POST',`/users/${f.b.id}/password`,{password:NEW})).status,403,'un alumno no restablece');
  assert.equal((await f.call(f.t,'POST',`/users/${f.a.id}/password`,{password:'corta'})).status,400);
  assert.equal((await f.call(f.t,'POST',`/users/${f.b.id}/password`,{password:NEW})).status,404,'alumno de otro salón');
  assert.equal((await f.call(f.t,'POST',`/users/${f.other.id}/password`,{password:NEW})).status,404,'otro docente');
  assert.equal((await f.call(f.t,'POST',`/users/${f.a.id}/password`,{password:NEW,require_password_change:false})).status,204);
  const student = f.users.find(u=>u.id===f.a.id);
  assert.ok(await bcrypt.compare(NEW, student.password_hash)); assert.equal(student.must_change_password,false);
  assert.equal((await f.call(f.a,'GET','/projects')).status,401,'la sesión anterior se invalida');
  assert.equal((await f.call(f.admin,'POST',`/users/${f.other.id}/password`,{password:NEW})).status,204);
  assert.equal(f.users.find(u=>u.id===f.other.id).must_change_password,true);
  assert.equal((await f.call(f.admin,'POST',`/users/${randomUUID()}/password`,{password:NEW})).status,404);
}));

test('only administrators manage teacher accounts and teachers must change their initial password', () => withFixture(async f => {
  const body = { username: 'new_teacher', display_name: 'New teacher', password: PASSWORD };
  assert.equal((await f.call(f.t,'GET','/teachers')).status,403);
  assert.equal((await f.call(f.t,'POST','/teachers',body)).status,403);
  assert.equal((await f.call(f.admin,'POST','/teachers',{ ...body, role:'admin' })).status,400);
  const created = await f.call(f.admin,'POST','/teachers',body);
  assert.equal(created.status,201); assert.equal(created.body.status,'active');
  const stored = f.users.find(u=>u.id===created.body.id);
  assert.equal(stored.role,'teacher'); assert.equal(stored.must_change_password,true); assert.equal(bcrypt.getRounds(stored.password_hash),12);
  assert.equal((await f.call(f.admin,'GET','/teachers')).body.some(t=>t.id===created.body.id),true);
  assert.equal((await f.call(f.admin,'PATCH',`/teachers/${created.body.id}/status`,{status:'suspended'})).status,200);
  assert.equal((await f.call(f.admin,'PATCH',`/teachers/${created.body.id}/status`,{status:'pending'})).status,400);
}));

test('classrooms validate catalog, real dates and teacher assignment; outsiders cannot manage enrollments', () => withFixture(async f => {
  const body={name:'New room',level_id:1,course_id:f.course,academic_year:2026,course_start_date:'2026-10-09'};
  assert.equal((await f.call(f.t,'POST','/classrooms',{...body,teacher_id:f.other.id})).status,403);
  assert.equal((await f.call(f.t,'POST','/classrooms',{...body,course_start_date:'2026-02-30'})).status,400);
  assert.equal((await f.call(f.t,'POST','/classrooms',{...body,level_id:99})).status,400);
  const created=await f.call(f.t,'POST','/classrooms',body);
  assert.equal(created.status,201); assert.equal(created.body.teacher_id,f.t.id);
  const { course_id, ...noCourse } = body;
  const withoutCourse=await f.call(f.t,'POST','/classrooms',{...noCourse,name:'Sin curso'});
  assert.equal(withoutCourse.status,201,'el curso es opcional'); assert.equal(withoutCourse.body.course_id,undefined);
  assert.deepEqual((await f.call(f.t,'GET',`/classrooms/${created.body.id}/eligible-students`)).body.map(s=>s.id),[f.a.id]);
  assert.equal((await f.call(f.other,'GET',`/classrooms/${created.body.id}/eligible-students`)).status,404);
  assert.equal((await f.call(f.admin,'POST','/classrooms',body)).status,400,'admin must assign a valid teacher');
  assert.equal((await f.call(f.other,'POST',`/classrooms/${f.room.id}/students`,{student_id:f.a.id})).status,404);
  assert.equal((await f.call(f.t,'POST',`/classrooms/${f.room.id}/students`,{student_id:f.b.id})).status,409,'consent required');
  assert.equal((await f.call(f.t,'PATCH',`/classrooms/${f.room.id}`,{status:'archived'})).status,200);
  assert.equal((await f.call(f.t,'POST',`/classrooms/${f.room.id}/students`,{student_id:f.a.id})).status,409);
}));

test('project ownership comes from JWT; teachers/admin inspect but cannot overwrite another owner', () => withFixture(async f => {
  const body={title:'Personal',project_type:'character_recognition'};
  assert.equal((await f.call(f.a,'POST','/projects',{...body,owner_id:f.b.id})).status,400);
  assert.equal((await f.call(f.b,'POST','/projects',{...body,classroom_id:f.room.id})).status,404);
  const created=await f.call(f.a,'POST','/projects',{...body,classroom_id:f.room.id});
  assert.equal(created.status,201); assert.equal(created.body.owner_id,f.a.id);
  const path='/projects/'+created.body.id;
  assert.equal((await f.call(f.b,'GET',path)).status,404);
  assert.equal((await f.call(f.t,'GET',path)).status,200);
  assert.equal((await f.call(f.admin,'GET',path)).status,200);
  for (const actor of [f.b,f.t,f.admin]) assert.equal((await f.call(actor,'PATCH',path,{title:'Intrusion'})).status,404);
  assert.equal((await f.call(f.a,'PATCH',path,{title:'Renamed'})).body.title,'Renamed');
}));

test('workspace saves keep snapshots, reject stale writes and allow exactly one concurrent winner', () => withFixture(async f => {
  const path=`/projects/${f.projects[0].id}/workspace`;
  assert.equal((await f.call(f.a,'GET',path)).status,404);
  assert.equal((await f.call(f.b,'PUT',path,{version:0,blocks:graph})).status,404);
  const first=await f.call(f.a,'PUT',path,{version:0,blocks:graph});
  assert.equal(first.status,200); assert.equal(first.body.version,1); assert.deepEqual(first.body.blocks,graph);
  assert.equal(first.body.blocks_json,undefined);
  assert.equal((await f.call(f.t,'PUT',path,{version:1,blocks:graph})).status,404);
  assert.equal((await f.call(f.a,'PUT',path,{version:1,blocks:graph})).body.version,2);
  assert.equal((await f.call(f.a,'PUT',path,{version:1,blocks:graph})).status,409);
  const concurrent=await Promise.all([f.call(f.a,'PUT',path,{version:2,blocks:graph}),f.call(f.a,'PUT',path,{version:2,blocks:graph})]);
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
  assert.equal((await f.call(f.a,'GET',path)).body.version,3); assert.equal(f.snapshots.length,3);
  await f.call(f.a,'PATCH',`/projects/${f.projects[0].id}`,{status:'archived'});
  assert.equal((await f.call(f.a,'PUT',path,{version:3,blocks:graph})).status,400);
}));

test('pedagogical simulations validate pipelines, persist deterministic metrics and follow project access', () => withFixture(async f => {
  const projectId = f.projects[0].id, workspace = `/projects/${projectId}/workspace`, simulations = `/projects/${projectId}/simulations`;
  assert.equal((await f.call(f.a,'POST',simulations)).status,400);
  assert.equal((await f.call(f.a,'PUT',workspace,{version:0,blocks:simulationGraph})).status,200);
  const first = await f.call(f.a,'POST',simulations);
  assert.equal(first.status,201); assert.equal(first.body.status,'completed'); assert.equal(first.body.provider,'deterministic');
  assert.equal(typeof first.body.metrics.validation_accuracy,'number'); assert.equal(first.body.parameters.epochs,20);
  const second = await f.call(f.a,'POST',simulations);
  assert.equal(second.body.metrics.validation_accuracy,first.body.metrics.validation_accuracy,'same pipeline has deterministic output');
  assert.equal((await f.call(f.t,'GET',simulations)).status,200);
  assert.equal((await f.call(f.b,'GET',simulations)).status,404);
  const invalid = { ...simulationGraph, edges: [{ id: 'broken', source: 'data', target: 'evaluate' }] };
  assert.equal((await f.call(f.a,'PUT',workspace,{version:1,blocks:invalid})).status,200);
  assert.equal((await f.call(f.a,'POST',simulations)).status,400);
}));

test('workspace validation rejects malformed graphs, dangling edges, duplicate ids and oversized data', () => withFixture(async f => {
  const path=`/projects/${f.projects[0].id}/workspace`;
  for(const blocks of [null,{schemaVersion:2,nodes:[],edges:[]},{...graph,nodes:[...graph.nodes,...graph.nodes]},
    {...graph,edges:[{id:'e1',source:'n1',target:'missing'}]},
    {...graph,secret:'injected'}, {...graph,nodes:[{...graph.nodes[0],data:{text:'é'.repeat(35000)}}]}]) {
    assert.equal((await f.call(f.a,'PUT',path,{version:0,blocks})).status,400);
  }
  assert.equal((await f.call(f.a,'PUT',path,{version:-1,blocks:graph})).status,400);
  assert.equal(f.snapshots.length,0);
}));

test('progress is enrollment-scoped, computed from lesson content, monotonic and teacher-scoped', () => withFixture(async f => {
  const path='/progress/'+f.lessonId;
  assert.equal((await f.call(f.t,'PUT',path,{completed_sections:2})).status,403);
  assert.equal((await f.call(f.b,'PUT',path,{completed_sections:2})).status,404);
  assert.equal((await f.call(f.a,'PUT',path,{completed_sections:6})).status,400);
  assert.equal((await f.call(f.a,'PUT',path,{completed_sections:2,progress_percent:100})).status,400);
  const first=await f.call(f.a,'PUT',path,{completed_sections:2});
  assert.equal(first.body.progress_percent,40); assert.equal(first.body.status,'in_progress');
  assert.equal((await f.call(f.a,'PUT',path,{completed_sections:0})).body.progress_percent,40);
  const completed=await f.call(f.a,'PUT',path,{completed_sections:5});
  assert.equal(completed.body.progress_percent,100); assert.equal(completed.body.status,'completed');
  assert.equal((await f.call(f.a,'PUT',path,{completed_sections:5})).body.completed_at,completed.body.completed_at);
  assert.equal((await f.call(f.t,'GET',`/students/${f.a.id}/progress`)).body.length,1);
  assert.equal((await f.call(f.other,'GET',`/students/${f.a.id}/progress`)).status,404);
  assert.equal((await f.call(f.a,'GET',`/students/${f.b.id}/progress`)).status,403);
  assert.equal((await f.call(f.a,'GET','/progress')).body.length,1);
  assert.equal((await f.call(f.t,'DELETE',`/classrooms/${f.room.id}/students/${f.a.id}`)).status,204);
  assert.equal((await f.call(f.a,'PUT',path,{completed_sections:5})).status,404);
  assert.equal((await f.call(f.t,'GET',`/students/${f.a.id}/progress`)).status,404);
}));

test('revoking consent suspends the student and existing JWT stops working', () => withFixture(async f => {
  assert.equal((await f.call(f.admin,'DELETE',`/students/${f.a.id}/consents/current`)).status,204);
  assert.equal((await f.call(f.a,'GET','/projects')).status,401);
  assert.equal((await f.call(f.admin,'PATCH',`/students/${f.a.id}/status`,{status:'active'})).status,409);
  assert.equal((await f.call(f.t,'POST',`/classrooms/${f.room.id}/students`,{student_id:f.a.id})).status,409);
}));

test('business validation bounds pagination, rejects null/empty updates, invalid UUIDs and immutable fields', () => withFixture(async f => {
  for(const query of ['limit=0','limit=101','limit=1.5','offset=-1','offset=1000001','limit=abc','owner_id=other']) {
    assert.equal((await f.call(f.a,'GET','/projects?'+query)).status,400);
  }
  assert.equal((await f.call(f.a,'GET','/projects/not-a-uuid')).status,400);
  const path='/projects/'+f.projects[0].id;
  for(const body of [{},{title:null},{title:' '},{owner_id:f.b.id},{classroom_id:f.otherRoom.id}]) assert.equal((await f.call(f.a,'PATCH',path,body)).status,400);
}));

test('business error filter returns generic 503 without driver secrets', () => withFixture(async f => {
  f.repo.project=async()=>{throw new Error('mysql://secret:password@host/database');};
  const response=await f.call(f.a,'GET','/projects/'+f.projects[0].id);
  assert.equal(response.status,503);
  assert.doesNotMatch(JSON.stringify(response.body),/mysql|password|secret/);
}));


test('local smoke script completes all HTTP stages and archives only its synthetic records (DB double)', () => withFixture(async f => {
  f.a.username = 'aiblocks_demo_student'; f.t.username = 'aiblocks_demo_teacher'; f.admin.username = 'aiblocks_demo_admin';
  const originalStatus = f.users.slice(0,5).map(u => u.status);
  const env = { NODE_ENV: process.env.NODE_ENV, PORT: process.env.PORT, DEMO_PASSWORD: process.env.DEMO_PASSWORD };
  process.env.NODE_ENV = 'development'; process.env.PORT = new URL(f.base).port; process.env.DEMO_PASSWORD = PASSWORD;
  const Module = require('node:module'); const load = Module._load;
  const logs = [], log = console.log, error = console.error;
  class ReadOnlyPrismaDouble {
    workspaces = { findUniqueOrThrow: async ({where}) => f.workspaces.get(where.project_id) };
    workspace_versions = { count: async ({where}) => f.snapshots.filter(s => s.id === where.workspace_id).length };
    classroom_enrollments = { count: async ({where}) => f.enrollments.has(where.classroom_id + ':' + where.student_id) ? 1 : 0 };
    lesson_progress = { findUniqueOrThrow: async ({where}) => f.progress.find(p => p.student_id === where.student_id_lesson_id.student_id && p.lesson_id === where.student_id_lesson_id.lesson_id) };
    async $disconnect() {}
  }
  try {
    Module._load = function(name, ...args) { return name === '@prisma/client' ? {PrismaClient:ReadOnlyPrismaDouble} : load.call(this,name,...args); };
    const {run} = require('../scripts/apis-smoke.cjs');
    Module._load = load;
    console.log = (...args) => logs.push(args.join(' ')); console.error = (...args) => logs.push(args.join(' '));
    assert.equal(await run(),true,logs.join('\n'));
    assert.ok(logs.some(l=>l.startsWith('PASS: APIs hito 6')));
    assert.deepEqual(f.users.slice(0,5).map(u=>u.status),originalStatus);
    assert.equal(f.users[5].status,'suspended');
    assert.equal(f.rooms[2].status,'archived'); assert.equal(f.projects[1].status,'archived');
    assert.equal(f.room.status,'active'); assert.equal(f.projects[0].status,'draft');
  } finally {
    Module._load = load; console.log = log; console.error = error;
    for (const [key,value] of Object.entries(env)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    process.exitCode = undefined;
  }
}));

test('draft survives without dataset; the training flow API is owner-only and enforces the dataset lock', () => withFixture(async f => {
  const draft={request_id:randomUUID(),title:'Draft test',project_type:'image_classification',classroom_id:f.room.id};
  assert.equal((await f.call(null,'POST','/projects/draft',draft)).status,401);
  const created=await f.call(f.a,'POST','/projects/draft',draft);
  assert.equal(created.status,201);
  const repeat=await f.call(f.a,'POST','/projects/draft',draft);
  assert.equal(repeat.body.id,created.body.id);
  assert.equal((await f.call(f.b,'POST','/projects/draft',draft)).status,404);
  assert.equal((await f.call(f.admin,'POST','/projects/draft',draft)).status,409);
  const path='/projects/'+created.body.id;
  assert.equal((await f.call(null,'GET',path+'/training')).status,401);
  const empty=await f.call(f.a,'GET',path+'/training');
  assert.equal(empty.status,200); assert.equal(empty.body.dataset,null); assert.equal(empty.body.step,1);
  const dataset=await datasetBody({perLabel:10});
  assert.equal((await f.call(f.b,'POST',path+'/dataset',dataset)).status,404);
  assert.equal((await f.call(f.a,'POST',path+'/dataset',{...dataset,samples:21})).status,400);
  const saved=await f.call(f.a,'POST',path+'/dataset',dataset);
  assert.equal(saved.status,201); assert.equal(saved.body.dataset.samples,20); assert.equal(saved.body.dataset.can_replace,true);
  assert.equal((await f.call(f.a,'POST',path+'/dataset',dataset)).status,409);
  // El docente del salón consulta en solo lectura.
  const viewer=await f.call(f.t,'GET',path+'/training');
  assert.equal(viewer.status,200); assert.equal(viewer.body.editable,false);
  assert.equal((await f.call(f.t,'POST',path+'/dataset/lock')).status,404);
  assert.equal((await f.call(f.b,'GET',path+'/dataset/file')).status,404);
  const file=await fetch(f.base+path+'/dataset/file',{headers:{Authorization:'Bearer '+f.tokens[f.a.id]}});
  assert.equal(file.status,200); assert.equal(Buffer.from(await file.arrayBuffer()).toString('base64'),dataset.archive_base64);
  const locked=await f.call(f.a,'POST',path+'/dataset/lock');
  assert.equal(locked.status,201); assert.equal(locked.body.step,2); assert.equal(locked.body.dataset.can_replace,false);
  assert.equal((await f.call(f.a,'PUT',path+'/dataset',{...dataset,expected_updated_at:locked.body.dataset.updated_at})).status,409);
  assert.equal((await f.call(f.a,'PUT',path+'/training/preparation',{test_percent:25})).status,400);
  assert.equal((await f.call(f.a,'PUT',path+'/training/preparation',{test_percent:20})).body.step,3);
  assert.equal((await f.call(f.a,'PUT',path+'/training/config',{epochs:40,learning_rate:0.001,batch_size:16,model_size:'medium'})).status,400);
  assert.equal((await f.call(f.a,'PUT',path+'/training/config',{epochs:12,learning_rate:0.001,batch_size:16,model_size:'medium'})).body.step,4);
  assert.equal((await f.call(f.a,'GET',path+'/training/model-file')).status,404);
}));

test('a classroom can have several teachers: the responsible teacher or an administrator adds and removes them', () => withFixture(async f => {
  const path = `/classrooms/${f.room.id}/teachers`;
  // Al inicio, solo el responsable.
  assert.deepEqual((await f.call(f.t,'GET',path)).body.map(t => [t.id, t.responsible]), [[f.t.id, true]]);
  assert.equal((await f.call(f.other,'GET',`/classrooms/${f.room.id}`)).status,404,'aún no es docente del salón');
  assert.deepEqual((await f.call(f.t,'GET',`/classrooms/${f.room.id}/eligible-teachers`)).body.map(t => t.id), [f.other.id]);
  assert.equal((await f.call(f.a,'POST',path,{teacher_id:f.other.id})).status,403,'un alumno no agrega docentes');
  assert.equal((await f.call(f.t,'POST',path,{teacher_id:f.t.id})).status,400,'ya es el responsable');
  assert.equal((await f.call(f.t,'POST',path,{teacher_id:f.a.id})).status,409,'solo docentes activos');
  const added = await f.call(f.t,'POST',path,{teacher_id:f.other.id});
  assert.equal(added.status,200); assert.deepEqual(added.body.map(t => [t.id, t.responsible]), [[f.t.id, true],[f.other.id, false]]);
  // El docente adicional gestiona el salón: lo ve, ve a sus alumnos y sus proyectos.
  assert.equal((await f.call(f.other,'GET',`/classrooms/${f.room.id}`)).status,200);
  assert.ok((await f.call(f.other,'GET','/classrooms')).body.some(r => r.id === f.room.id));
  assert.deepEqual((await f.call(f.other,'GET',`/classrooms/${f.room.id}/students`)).body.map(s => s.id), [f.a.id]);
  assert.ok((await f.call(f.other,'GET','/students')).body.some(s => s.id === f.a.id));
  assert.equal((await f.call(f.other,'GET',`/projects/${f.projects[0].id}`)).status,200,'ve los proyectos del salón');
  assert.equal((await f.call(f.other,'POST',`/users/${f.a.id}/password`,{password:'clave-del-co-docente-1'})).status,204,'restablece a sus alumnos');
  // Pero no agrega ni quita a otros docentes, no archiva el salón y no puede quitar al responsable.
  assert.equal((await f.call(f.other,'PATCH',`/classrooms/${f.room.id}`,{status:'archived'})).status,403);
  assert.equal((await f.call(f.other,'GET',`/classrooms/${f.room.id}/eligible-teachers`)).status,403);
  assert.equal((await f.call(f.other,'DELETE',`${path}/${f.t.id}`)).status,400);
  assert.equal((await f.call(f.admin,'DELETE',`${path}/${f.t.id}`)).status,400,'el responsable no se quita');
  // Un docente adicional puede salir del salón por su cuenta.
  assert.equal((await f.call(f.other,'DELETE',`${path}/${f.other.id}`)).status,204);
  assert.equal((await f.call(f.other,'GET',`/classrooms/${f.room.id}`)).status,404);
  // El administrador también agrega y quita docentes; con el salón archivado no se agregan.
  assert.equal((await f.call(f.admin,'POST',path,{teacher_id:f.other.id})).status,200);
  assert.equal((await f.call(f.admin,'DELETE',`${path}/${f.other.id}`)).status,204);
  assert.equal((await f.call(f.t,'PATCH',`/classrooms/${f.room.id}`,{status:'archived'})).status,200);
  assert.equal((await f.call(f.t,'POST',path,{teacher_id:f.other.id})).status,400);
}));
