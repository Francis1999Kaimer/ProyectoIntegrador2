const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {PrismaLearningRepository}=require('../dist/repositories/prisma.learning.repository');
const {DataConflict}=require('../dist/repositories/learning.contracts');

test('Prisma learning adapter scopes roster, projects, classroom membership and student projection',async()=>{
  const calls=[];
  const db={users:{findMany:async q=>{calls.push(['students',q]);return[];}},
    projects:{findMany:async q=>{calls.push(['projects',q]);return[];}},
    classrooms:{findMany:async q=>{calls.push(['rooms',q]);return[];}}};
  const repo=new PrismaLearningRepository(db);
  await repo.listStudents({id:'teacher',role:'teacher'},{limit:3,offset:2});
  const students=calls[0][1];
  assert.equal(students.where.role,'student');
  assert.equal(students.where.back_fk_enrollments_student.some.rel_fk_enrollments_classroom.teacher_id,'teacher');
  assert.deepEqual(Object.keys(students.select).sort(),['display_name','id','status','username']);
  assert.equal(students.take,3);assert.equal(students.skip,2);
  await repo.listProjects({id:'student',role:'student'},{});
  assert.deepEqual(calls[1][1].where,{owner_id:'student'});
  await repo.listProjects({id:'teacher',role:'teacher'},{});
  assert.deepEqual(calls[2][1].where.OR,[{owner_id:'teacher'},{rel_fk_projects_classroom:{teacher_id:'teacher'}}]);
  await repo.listClassrooms({id:'student',role:'student'},{});
  assert.deepEqual(calls[3][1].where,{back_fk_enrollments_classroom:{some:{student_id:'student'}}});
});

test('teacher progress adapter correlates BOTH course and level to own active enrolled rooms',async()=>{
  const calls=[];
  const repo=new PrismaLearningRepository({classrooms:{findMany:async q=>{
    calls.push(q);return[{level_id:1,course_id:'course-A'},{level_id:2,course_id:'course-B'}];
  }},lesson_progress:{findMany:async q=>{calls.push(q);return[];}}});
  await repo.listProgress({student_id:'student',teacher_id:'teacher'},{limit:5});
  assert.equal(calls[0].where.teacher_id,'teacher');assert.equal(calls[0].where.status,'active');
  assert.equal(calls[0].where.back_fk_enrollments_classroom.some.student_id,'student');
  assert.deepEqual(calls[1].where,{student_id:'student',rel_fk_lesson_progress_lesson:{OR:[
    {level_id:1,rel_fk_lessons_week:{course_id:'course-A'}},{level_id:2,rel_fk_lessons_week:{course_id:'course-B'}}
  ]}});
});

test('workspace compare-and-swap and snapshot use one transaction; conflicts write no snapshot',async()=>{
  const calls=[];
  const tx={workspaces:{updateMany:async q=>{calls.push(q);return{count:1};},
    findUniqueOrThrow:async()=>({id:'workspace',version:8})},
    workspace_versions:{create:async q=>{calls.push(q);}}};
  const db={$transaction:async fn=>{calls.push('transaction');return fn(tx);}};
  const repo=new PrismaLearningRepository(db);
  const result=await repo.saveWorkspace('project',7,'{}');
  assert.equal(result.version,8);
  assert.deepEqual(calls[1].where,{project_id:'project',version:7});
  assert.deepEqual(calls[1].data.version,{increment:1});
  assert.equal(calls[2].data.workspace_id,'workspace');assert.equal(calls[2].data.version,8);
  calls.length=0;tx.workspaces.updateMany=async()=>({count:0});
  await assert.rejects(repo.saveWorkspace('project',7,'{}'),DataConflict);
  assert.deepEqual(calls,['transaction']);
});

test('activation and enrollment require consent inside serializable transactions',async()=>{
  const calls=[];
  const tx={users:{findFirst:async()=>({id:'student'}),update:async()=>{throw Error('Must not activate');}},
    classrooms:{findFirst:async()=>({id:'room'})},
    guardian_consents:{findFirst:async q=>{calls.push(q);return null;}},
    classroom_enrollments:{upsert:async()=>{throw Error('Must not enroll');}}};
  const repo=new PrismaLearningRepository({$transaction:async(fn,options)=>{assert.equal(options.isolationLevel,'Serializable');return fn(tx);}});
  await assert.rejects(repo.setStudentStatus('student','active'),DataConflict);
  await assert.rejects(repo.enroll('room','student'),DataConflict);
  assert.deepEqual(calls[0].where,{student_id:'student',revoked_at:null});
});

test('Prisma writes map uniqueness, FK and concurrent-transaction conflicts to domain errors',async()=>{
  for(const code of ['P2002','P2003','P2034']){
    const repo=new PrismaLearningRepository({users:{create:async()=>{throw {code};}}});
    await assert.rejects(repo.createStudent({username:'x',display_name:'x',password_hash:'hash'}),DataConflict);
  }
});

test('progress adapter derives percent/status and conditionally advances sections without regression',async()=>{
  const calls=[];
  const tx={lesson_progress:{upsert:async q=>{calls.push(q);},updateMany:async q=>{calls.push(q);},findUniqueOrThrow:async()=>({id:'progress'})}};
  const repo=new PrismaLearningRepository({$transaction:async fn=>fn(tx)});
  await repo.saveProgress('student','lesson',3,5);
  assert.deepEqual(calls[1].where,{student_id:'student',lesson_id:'lesson',completed_sections:{lt:3}});
  assert.equal(calls[1].data.progress_percent,60);assert.equal(calls[1].data.status,'in_progress');
  assert.equal(calls[1].data.completed_at,null);
  assert.deepEqual(calls[0].where,{student_id_lesson_id:{student_id:'student',lesson_id:'lesson'}});
});
