import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PageRequest } from './contracts';
import { pagination } from './pagination';
import { Actor, ClassroomPatch, ConsentInput, DataConflict, DataMissing, LearningRepository, NewClassroom, NewSimulationRun, NewStudent, ProgressAccess, ProjectPatch } from './learning.contracts';

const studentSelect = { id: true, username: true, display_name: true, status: true } as const;
const teacherSelect = { id: true, username: true, display_name: true, status: true } as const;
const lessonSelect = { id: true, level_id: true, course_week_id: true, title: true, summary: true, content_json: true, duration_minutes: true } as const;
const serial = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };

async function consent(tx: Prisma.TransactionClient, studentId: string) {
  const latest = await tx.guardian_consents.findFirst({
    where: { student_id: studentId, revoked_at: null },
    orderBy: [{ consented_at: 'desc' }, { recorded_at: 'desc' }, { id: 'desc' }]
  });
  return !!latest && latest.revoked_at === null;
}

@Injectable()
export class PrismaLearningRepository implements LearningRepository {
  constructor(private readonly db: PrismaService) {}
  // Prisma error codes are translated at the adapter boundary; the contract stays ORM-free.
  private async write<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); } catch (error) {
      const code = (error as { code?: string })?.code;
      if (['P2002', 'P2003', 'P2034'].includes(code ?? '')) throw new DataConflict();
      if (code === 'P2025') throw new DataMissing();
      throw error;
    }
  }
  async catalog() {
    const [levels, courses] = await Promise.all([
      this.db.levels.findMany({ select: { id: true, slug: true, name: true }, orderBy: { id: 'asc' }, take: 100 }),
      this.db.courses.findMany({ where: { status: 'published' }, select: { id: true, slug: true, title: true, total_weeks: true }, orderBy: { id: 'asc' }, take: 100 })
    ]);
    return { levels, courses };
  }
  listStudents(actor: Actor, page: PageRequest) {
    return this.db.users.findMany({
      where: { role: 'student', ...(actor.role === 'admin' ? {} : {
        back_fk_enrollments_student: { some: { rel_fk_enrollments_classroom: { teacher_id: actor.id } } }
      }) }, select: studentSelect, ...pagination(page), orderBy: { id: 'asc' }
    });
  }
  student(id: string) { return this.db.users.findFirst({ where: { id, role: 'student' }, select: studentSelect }); }
  async teacherHasStudent(teacherId: string, studentId: string) {
    return !!await this.db.classroom_enrollments.findFirst({ where: {
      student_id: studentId, rel_fk_enrollments_classroom: { teacher_id: teacherId, status: 'active' }
    }, select: { student_id: true } });
  }
  createStudent(input: NewStudent) {
    return this.write(() => this.db.users.create({ data: {
      id: randomUUID(), username: input.username, display_name: input.display_name,
      password_hash: input.password_hash, role: 'student', status: 'pending', must_change_password: true
    }, select: studentSelect }));
  }
  createTeacher(input: NewStudent) {
    return this.write(() => this.db.users.create({ data: {
      id: randomUUID(), username: input.username, display_name: input.display_name,
      password_hash: input.password_hash, role: 'teacher', status: 'active', must_change_password: true
    }, select: teacherSelect }));
  }
  setStudentStatus(id: string, status: string) {
    return this.write(() => this.db.$transaction(async tx => {
      const student = await tx.users.findFirst({ where: { id, role: 'student' } });
      if (!student) throw new DataMissing();
      if (status === 'active' && !await consent(tx, id)) throw new DataConflict();
      return tx.users.update({ where: { id }, data: { status, updated_at: new Date() }, select: studentSelect });
    }, serial));
  }
  recordConsent(id: string, input: ConsentInput) {
    return this.write(() => this.db.$transaction(async tx => {
      if (!await tx.users.findFirst({ where: { id, role: 'student' } })) throw new DataMissing();
      // A new record must follow revocation; immutable evidence is never overwritten.
      if (await consent(tx, id)) throw new DataConflict();
      return tx.guardian_consents.create({ data: {
        id: randomUUID(), student_id: id, guardian_name: input.guardian_name,
        guardian_contact_email: input.guardian_contact_email ?? null,
        consent_version: input.consent_version, consented_at: new Date()
      }, select: { id: true, student_id: true, consented_at: true } });
    }, serial));
  }
  setTeacherStatus(id: string, status: string) {
    return this.write(() => this.db.$transaction(async tx => {
      const teacher = await tx.users.findFirst({ where: { id, role: 'teacher' } });
      if (!teacher) throw new DataMissing();
      return tx.users.update({ where: { id }, data: { status, updated_at: new Date() }, select: teacherSelect });
    }, serial));
  }
  currentConsent(id: string) {
    return this.db.guardian_consents.findFirst({
      where: { student_id: id, revoked_at: null },
      orderBy: [{ consented_at: 'desc' }, { recorded_at: 'desc' }, { id: 'desc' }],
      select: { guardian_name: true, consent_version: true, consented_at: true }
    });
  }
  listTeachers(page: PageRequest) {
    return this.db.users.findMany({
      where: { role: 'teacher' }, select: teacherSelect, ...pagination(page), orderBy: [{ display_name: 'asc' }, { id: 'asc' }]
    });
  }
  revokeConsent(id: string) {
    return this.write(() => this.db.$transaction(async tx => {
      if (!await tx.users.findFirst({ where: { id, role: 'student' } })) throw new DataMissing();
      const now = new Date();
      await tx.guardian_consents.updateMany({ where: { student_id: id, revoked_at: null }, data: { revoked_at: now } });
      await tx.users.update({ where: { id }, data: { status: 'suspended', updated_at: now } });
    }, serial));
  }
  async validTeacher(id: string) { return !!await this.db.users.findFirst({ where: { id, role: 'teacher', status: 'active' }, select: { id: true } }); }
  async validCatalog(levelId: number, courseId: string) {
    const [level, course] = await Promise.all([
      this.db.levels.findUnique({ where: { id: levelId }, select: { id: true } }),
      this.db.courses.findFirst({ where: { id: courseId, status: 'published' }, select: { id: true } })
    ]);
    return !!level && !!course;
  }
  listClassrooms(actor: Actor, page: PageRequest) {
    const where = actor.role === 'admin' ? {} : actor.role === 'teacher' ? { teacher_id: actor.id } : {
      back_fk_enrollments_classroom: { some: { student_id: actor.id } }
    };
    return this.db.classrooms.findMany({ where, ...pagination(page), orderBy: [{ created_at: 'desc' }, { id: 'asc' }] });
  }
  classroom(id: string) { return this.db.classrooms.findUnique({ where: { id } }); }
  async enrolled(classroomId: string, studentId: string) {
    return !!await this.db.classroom_enrollments.findUnique({ where: { classroom_id_student_id: { classroom_id: classroomId, student_id: studentId } } });
  }
  createClassroom(input: NewClassroom) {
    return this.write(() => this.db.classrooms.create({ data: { id: randomUUID(), ...input } }));
  }
  updateClassroom(id: string, input: ClassroomPatch) {
    return this.write(() => this.db.classrooms.update({ where: { id }, data: { ...input, updated_at: new Date() } }));
  }
  async classroomStudents(id: string, page: PageRequest) {
    return this.db.users.findMany({ where: {
      role: 'student', back_fk_enrollments_student: { some: { classroom_id: id } }
    }, select: studentSelect, ...pagination(page), orderBy: { id: 'asc' } });
  }
  eligibleStudents(classroomId: string, page: PageRequest) {
    return this.db.users.findMany({ where: {
      role: 'student', status: 'active',
      back_fk_guardian_consents_student: { some: { revoked_at: null } },
      NOT: { back_fk_enrollments_student: { some: { classroom_id: classroomId } } }
    }, select: studentSelect, ...pagination(page), orderBy: [{ display_name: 'asc' }, { id: 'asc' }] });
  }
  enroll(classroomId: string, studentId: string) {
    return this.write(() => this.db.$transaction(async tx => {
      if (!await tx.classrooms.findFirst({ where: { id: classroomId, status: 'active' } }) ||
          !await tx.users.findFirst({ where: { id: studentId, role: 'student', status: 'active' } }) ||
          !await consent(tx, studentId)) throw new DataConflict();
      await tx.classroom_enrollments.upsert({
        where: { classroom_id_student_id: { classroom_id: classroomId, student_id: studentId } },
        create: { classroom_id: classroomId, student_id: studentId }, update: {}
      });
    }, serial));
  }
  async unenroll(classroomId: string, studentId: string) {
    await this.db.classroom_enrollments.deleteMany({ where: { classroom_id: classroomId, student_id: studentId } });
  }
  async lessons(classroomId: string, page: PageRequest) {
    const classroom = await this.classroom(classroomId);
    if (!classroom || classroom.status !== 'active') throw new DataMissing();
    return this.db.lessons.findMany({ where: {
      level_id: classroom.level_id, status: 'published', rel_fk_lessons_week: {
        course_id: classroom.course_id, rel_fk_course_weeks_course: { status: 'published' }
      }
    }, select: lessonSelect, ...pagination(page), orderBy: [{ rel_fk_lessons_week: { week_number: 'asc' } }, { id: 'asc' }] });
  }
  lessonForStudent(lessonId: string, studentId: string) {
    return this.db.lessons.findFirst({ where: {
      id: lessonId, status: 'published', rel_fk_lessons_level: { back_fk_classrooms_level: { some: {
        status: 'active', back_fk_enrollments_classroom: { some: { student_id: studentId } },
        rel_fk_classrooms_course: { status: 'published', back_fk_course_weeks_course: { some: { back_fk_lessons_week: { some: { id: lessonId } } } } }
      } } }
    }, select: lessonSelect });
  }
  listProjects(actor: Actor, page: PageRequest) {
    const where = actor.role === 'admin' ? {} : actor.role === 'teacher' ? {
      OR: [{ owner_id: actor.id }, { rel_fk_projects_classroom: { teacher_id: actor.id } }]
    } : { owner_id: actor.id };
    return this.db.projects.findMany({ where, ...pagination(page), orderBy: [{ updated_at: 'desc' }, { id: 'asc' }] });
  }
  project(id: string) { return this.db.projects.findUnique({ where: { id } }); }
  createProject(ownerId: string, input: { title: string; project_type: string; classroom_id?: string }) {
    return this.write(() => this.db.projects.create({ data: {
      id: randomUUID(), owner_id: ownerId, title: input.title, project_type: input.project_type,
      classroom_id: input.classroom_id ?? null
    } }));
  }
  updateProject(id: string, input: ProjectPatch) {
    return this.write(() => this.db.projects.update({ where: { id }, data: { ...input, updated_at: new Date() } }));
  }
  workspace(projectId: string) { return this.db.workspaces.findUnique({ where: { project_id: projectId } }); }
  saveWorkspace(projectId: string, version: number, json: string) {
    return this.write(() => this.db.$transaction(async tx => {
      let row;
      if (version === 0) {
        row = await tx.workspaces.create({ data: { id: randomUUID(), project_id: projectId, version: 1, blocks_json: json } });
      } else {
        const changed = await tx.workspaces.updateMany({ where: { project_id: projectId, version },
          data: { version: { increment: 1 }, blocks_json: json, updated_at: new Date() } });
        if (changed.count !== 1) throw new DataConflict();
        row = await tx.workspaces.findUniqueOrThrow({ where: { project_id: projectId } });
      }
      await tx.workspace_versions.create({ data: { id: randomUUID(), workspace_id: row.id, version: row.version, blocks_json: json } });
      return row;
    }));
  }
  async listSimulations(workspaceId: string, page: PageRequest) {
    const rows = await this.db.simulation_runs.findMany({ where: { workspace_id: workspaceId }, ...pagination(page), orderBy: [{ created_at: 'desc' }, { id: 'asc' }] });
    return rows.map(row => ({ ...row, accuracy: row.accuracy?.toString() ?? null, loss: row.loss?.toString() ?? null }));
  }
  createSimulation(input: NewSimulationRun) {
    return this.write(async () => {
      const now = new Date();
      const row = await this.db.simulation_runs.create({ data: {
        id: randomUUID(), ...input, status: 'completed', started_at: now, finished_at: now
      } });
      return { ...row, accuracy: row.accuracy?.toString() ?? null, loss: row.loss?.toString() ?? null };
    });
  }
  async listProgress(access: ProgressAccess, page: PageRequest) {
    const bounds = pagination(page);
    const rooms = access.teacher_id ? await this.db.classrooms.findMany({
      where: { teacher_id: access.teacher_id, status: 'active',
        back_fk_enrollments_classroom: { some: { student_id: access.student_id } } },
      select: { level_id: true, course_id: true }
    }) : null;
    if (rooms && !rooms.length) return [];
    return this.db.lesson_progress.findMany({ where: {
      student_id: access.student_id,
      ...(rooms ? { rel_fk_lesson_progress_lesson: { OR: rooms.map(room => ({
        level_id: room.level_id, rel_fk_lessons_week: { course_id: room.course_id }
      })) } } : {})
    }, ...bounds, orderBy: [{ updated_at: 'desc' }, { id: 'asc' }] });
  }
  saveProgress(studentId: string, lessonId: string, sections: number, total: number) {
    return this.write(() => this.db.$transaction(async tx => {
      const now = new Date();
      const where = { student_id_lesson_id: { student_id: studentId, lesson_id: lessonId } };
      await tx.lesson_progress.upsert({ where,
        create: { id: randomUUID(), student_id: studentId, lesson_id: lessonId, last_opened_at: now },
        update: { last_opened_at: now }
      });
      // A stale browser tab cannot lower progress; equal writes remain idempotent.
      await tx.lesson_progress.updateMany({ where: { student_id: studentId, lesson_id: lessonId, completed_sections: { lt: sections } }, data: {
        completed_sections: sections, progress_percent: Math.floor(sections * 100 / total),
        status: sections === total ? 'completed' : 'in_progress',
        completed_at: sections === total ? now : null, updated_at: now
      } });
      return tx.lesson_progress.findUniqueOrThrow({ where });
    }));
  }
}
