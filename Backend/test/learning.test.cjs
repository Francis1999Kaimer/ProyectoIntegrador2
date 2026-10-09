const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Test } = require('@nestjs/testing');
const { USER_REPOSITORY } = require('../dist/repositories/contracts');
const { LEARNING_REPOSITORY, DataConflict, DataMissing } = require('../dist/repositories/learning.contracts');
const { PrismaService } = require('../dist/prisma/prisma.service');
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
  const course = randomUUID(), secondCourse = randomUUID(), lessonId = randomUUID();
  const room = { id: randomUUID(), teacher_id: t.id, level_id: 1, course_id: course, status: 'active', name: 'Owned room' };
  const otherRoom = { id: randomUUID(), teacher_id: other.id, level_id: 1, course_id: secondCourse, status: 'active', name: 'Other room' };
  const rooms = [room, otherRoom];
  const enrollments = new Set([room.id + ':' + a.id]);
  const consents = new Set([a.id]);
  const projects = [{ id: randomUUID(), owner_id: a.id, classroom_id: room.id, title: 'A project', status: 'draft', project_type: 'blocks' }];
  const workspaces = new Map(), snapshots = [], progress = [];
  const lesson = { id: lessonId, level_id: 1, title: 'Test lesson', content_json: JSON.stringify({ sections: [1,2,3,4,5] }) };
  const canRoom = (actor, r) => actor.role === 'admin' || (actor.role === 'teacher' ? r.teacher_id === actor.id : enrollments.has(r.id + ':' + actor.id));
  const repo = {
    catalog: async () => ({ levels: [{ id: 1 }], courses: [{ id: course }] }),
    listStudents: async actor => users.filter(u => u.role === 'student' && (actor.role === 'admin' || rooms.some(r => r.teacher_id === actor.id && enrollments.has(r.id + ':' + u.id)))).map(publicStudent),
    student: async id => users.find(u => u.id === id && u.role === 'student') ?? null,
    teacherHasStudent: async (teacher, student) => rooms.some(r => r.teacher_id === teacher && r.status === 'active' && enrollments.has(r.id + ':' + student)),
    createStudent: async input => {
      if (users.some(u => u.username === input.username)) throw new DataConflict();
      const u = { id: randomUUID(), ...input, role: 'student', status: 'pending', must_change_password: true };
      users.push(u); return publicStudent(u);
    },
    setStudentStatus: async (id, status) => {
      const u = users.find(u => u.id === id && u.role === 'student');
      if (!u) throw new DataMissing();
      if (status === 'active' && !consents.has(id)) throw new DataConflict();
      u.status = status; return publicStudent(u);
    },
    recordConsent: async id => { if (consents.has(id)) throw new DataConflict(); consents.add(id); return { id: randomUUID(), student_id: id }; },
    revokeConsent: async id => { consents.delete(id); users.find(u => u.id === id).status = 'suspended'; },
    validTeacher: async id => users.some(u => u.id === id && u.role === 'teacher' && u.status === 'active'),
    validCatalog: async (level, c) => level === 1 && c === course,
    listClassrooms: async actor => rooms.filter(r => canRoom(actor, r)),
    classroom: async id => rooms.find(r => r.id === id) ?? null,
    enrolled: async (id, student) => enrollments.has(id + ':' + student),
    createClassroom: async input => { const r = { id: randomUUID(), ...input, status: 'active' }; rooms.push(r); return r; },
    updateClassroom: async (id, input) => Object.assign(rooms.find(r => r.id === id), input),
    classroomStudents: async id => users.filter(u => enrollments.has(id + ':' + u.id)).map(publicStudent),
    enroll: async (id, student) => {
      if (!consents.has(student) || !users.some(u => u.id === student && u.role === 'student' && u.status === 'active') || rooms.find(r => r.id === id)?.status !== 'active') throw new DataConflict();
      enrollments.add(id + ':' + student);
    },
    unenroll: async (id, student) => { enrollments.delete(id + ':' + student); },
    lessons: async id => { if (rooms.find(r => r.id === id)?.status !== 'active') throw new DataMissing(); return [lesson]; },
    lessonForStudent: async (id, student) => id === lessonId && room.status === 'active' && enrollments.has(room.id + ':' + student) ? lesson : null,
    listProjects: async actor => projects.filter(p => p.owner_id === actor.id || actor.role === 'admin' || (actor.role === 'teacher' && rooms.some(r => r.id === p.classroom_id && r.teacher_id === actor.id))),
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
    updatePassword: async () => false
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(USER_REPOSITORY).useValue(authRepo)
    .overrideProvider(LEARNING_REPOSITORY).useValue(repo)
    .overrideProvider(PrismaService).useValue({ $queryRaw: async () => [{ ok: 1 }] }).compile();
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
  return { app, users, a, b, t, other, admin, course, room, otherRoom, projects, repo, call, lessonId, progress, snapshots };
}
const graph = { schemaVersion: 1, nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Input' } }], edges: [] };
async function withFixture(run) { const f = await fixture(); try { await run(f); } finally { await f.app.close(); } }

test('business APIs require JWT and roles; classroom, roster and project lists are scoped', () => withFixture(async f => {
  for (const path of ['/catalog','/students','/classrooms','/projects','/progress']) assert.equal((await f.call(null,'GET',path)).status,401);
  assert.equal((await f.call(f.a,'GET','/students')).status,403);
  assert.equal((await f.call(f.a,'POST','/classrooms',{})).status,403);
  assert.equal((await f.call(f.t,'POST','/students',{})).status,403);
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

test('admin student creation hashes passwords, denies field injection and requires consent to activate', () => withFixture(async f => {
  const body = { username: 'new_student', display_name: 'New student', password: PASSWORD };
  assert.equal((await f.call(f.admin,'POST','/students',{ ...body, role:'admin' })).status,400);
  assert.equal((await f.call(f.admin,'POST','/students',{ ...body, password:'🙂'.repeat(20) })).status,400);
  const created = await f.call(f.admin,'POST','/students',body);
  assert.equal(created.status,201); assert.equal(created.body.status,'pending');
  assert.equal(created.body.password_hash,undefined);
  const stored = f.users.find(u=>u.id===created.body.id);
  assert.equal(bcrypt.getRounds(stored.password_hash),12);
  assert.equal(stored.must_change_password,true);
  assert.equal((await f.call(f.admin,'POST','/students',body)).status,409);
  const statusPath = `/students/${created.body.id}/status`;
  assert.equal((await f.call(f.admin,'PATCH',statusPath,{status:'active'})).status,409);
  const consentPath = `/students/${created.body.id}/consents`;
  assert.equal((await f.call(f.t,'POST',consentPath,{guardian_name:'Synthetic',consent_version:'test-v1'})).status,403);
  assert.equal((await f.call(f.admin,'POST',consentPath,{guardian_name:'Synthetic',consent_version:'test-v1'})).status,201);
  assert.equal((await f.call(f.admin,'PATCH',statusPath,{status:'active'})).status,200);
  assert.equal((await f.call(f.admin,'POST',`/classrooms/${f.room.id}/students`,{student_id:created.body.id})).status,200);
}));

test('classrooms validate catalog, real dates and teacher assignment; outsiders cannot manage enrollments', () => withFixture(async f => {
  const body={name:'New room',level_id:1,course_id:f.course,academic_year:2026,course_start_date:'2026-10-09'};
  assert.equal((await f.call(f.t,'POST','/classrooms',{...body,teacher_id:f.other.id})).status,403);
  assert.equal((await f.call(f.t,'POST','/classrooms',{...body,course_start_date:'2026-02-30'})).status,400);
  assert.equal((await f.call(f.t,'POST','/classrooms',{...body,level_id:99})).status,400);
  const created=await f.call(f.t,'POST','/classrooms',body);
  assert.equal(created.status,201); assert.equal(created.body.teacher_id,f.t.id);
  assert.equal((await f.call(f.admin,'POST','/classrooms',body)).status,400,'admin must assign a valid teacher');
  assert.equal((await f.call(f.other,'POST',`/classrooms/${f.room.id}/students`,{student_id:f.a.id})).status,404);
  assert.equal((await f.call(f.t,'POST',`/classrooms/${f.room.id}/students`,{student_id:f.b.id})).status,409,'consent required');
  assert.equal((await f.call(f.t,'PATCH',`/classrooms/${f.room.id}`,{status:'archived'})).status,200);
  assert.equal((await f.call(f.t,'POST',`/classrooms/${f.room.id}/students`,{student_id:f.a.id})).status,409);
}));

test('project ownership comes from JWT; teachers/admin inspect but cannot overwrite another owner', () => withFixture(async f => {
  const body={title:'Personal',project_type:'blocks'};
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
