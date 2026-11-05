import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Classroom } from '../repositories/contracts';
import { Actor } from '../repositories/learning.contracts';
import { LearningService } from '../learning/learning.service';
import { AssignmentDto, AssignmentPatchDto, GradeDto, SubmissionDto } from './assignments.dto';

type Row = {
  id: string; classroom_id: string; created_by: string; title: string; description: string; instructions: string;
  starts_at: Date; ends_at: Date; grade_min: unknown; grade_max: unknown; created_at: Date; updated_at: Date
};
type SubmissionRow = {
  id: string; assignment_id: string; student_id: string; project_id: string; run_number: number | null; comment: string | null;
  submitted_at: Date; grade: unknown; feedback: string | null; graded_at: Date | null; graded_by: string | null
};
type Fields = { title: string; description: string; instructions: string; starts_at: Date; ends_at: Date; grade_min: number; grade_max: number };
const ROSTER = { limit: 100, offset: 0 };
const number = (value: unknown) => value === null || value === undefined ? null : Number(value);
const oneDecimal = (value: number) => Math.abs(Math.round(value * 10) - value * 10) < 1e-9;

// Tareas del salón. Gestionan el docente del salón y el administrador; los alumnos matriculados
// las ven y entregan uno de sus proyectos del salón. Un salón archivado queda en solo lectura.
@Injectable()
export class AssignmentsService {
  constructor(private readonly learning: LearningService, private readonly db: PrismaService) {}

  // ---------- Lectura ----------
  async list(actor: Actor, classroomId: string) {
    const room = await this.learning.classroom(actor, classroomId);
    const rows = await this.db.assignments.findMany({ where: { classroom_id: classroomId }, orderBy: [{ ends_at: 'asc' }, { id: 'asc' }] }) as Row[];
    const ids = rows.map(row => row.id);
    if (this.manages(actor, room)) {
      const students = await this.learning.classroomStudents(actor, classroomId, ROSTER);
      const subs = ids.length ? await this.db.assignment_submissions.findMany({ where: { assignment_id: { in: ids } }, select: { assignment_id: true, grade: true } }) : [];
      return rows.map(row => {
        const own = subs.filter(sub => sub.assignment_id === row.id);
        return { ...this.view(row), counts: { students: students.length, submitted: own.length, graded: own.filter(sub => sub.grade !== null).length } };
      });
    }
    const mine = ids.length ? await this.db.assignment_submissions.findMany({ where: { student_id: actor.id, assignment_id: { in: ids } } }) as SubmissionRow[] : [];
    return rows.map(row => {
      const sub = mine.find(item => item.assignment_id === row.id);
      return { ...this.view(row, this.state(row) === 'upcoming'), my_submission: sub ? this.submissionView(sub) : null };
    });
  }
  async detail(actor: Actor, id: string) {
    const row = await this.find(id), room = await this.learning.classroom(actor, row.classroom_id);
    const classroom = { id: room.id, name: room.name, status: room.status };
    if (this.manages(actor, room)) {
      const students = await this.learning.classroomStudents(actor, row.classroom_id, ROSTER);
      const subs = await this.db.assignment_submissions.findMany({ where: { assignment_id: id } }) as SubmissionRow[];
      const projects = subs.length ? await this.db.projects.findMany({ where: { id: { in: subs.map(sub => sub.project_id) } }, select: { id: true, title: true, project_type: true } }) : [];
      const pairs = subs.filter(sub => sub.run_number !== null).map(sub => ({ project_id: sub.project_id, run_number: sub.run_number! }));
      const runs = pairs.length ? await this.db.training_runs.findMany({ where: { OR: pairs }, select: { project_id: true, run_number: true, metrics_json: true } }) : [];
      // Quien entregó y luego fue retirado del salón sigue apareciendo con su entrega.
      const missing = subs.map(sub => sub.student_id).filter(student => !students.some(item => item.id === student));
      const former = missing.length ? await this.db.users.findMany({ where: { id: { in: missing } }, select: { id: true, username: true, display_name: true, status: true } }) : [];
      const entries = [...students.map(student => ({ student, enrolled: true })), ...former.map(student => ({ student, enrolled: false }))].map(({ student, enrolled }) => {
        const sub = subs.find(item => item.student_id === student.id);
        const run = sub && runs.find(item => item.project_id === sub.project_id && item.run_number === sub.run_number);
        return {
          student: { id: student.id, username: student.username, display_name: student.display_name }, enrolled,
          submission: sub ? { ...this.submissionView(sub), project: projects.find(project => project.id === sub.project_id) ?? null,
            test_accuracy: run ? (JSON.parse(run.metrics_json) as { test_accuracy?: number }).test_accuracy ?? null : null } : null
        };
      });
      return { ...this.view(row), classroom, manage: true, submissions: entries };
    }
    const sub = await this.db.assignment_submissions.findUnique({ where: { assignment_id_student_id: { assignment_id: id, student_id: actor.id } } }) as SubmissionRow | null;
    const projects = await this.db.projects.findMany({ where: { owner_id: actor.id, classroom_id: row.classroom_id }, select: { id: true, title: true, project_type: true, status: true }, orderBy: [{ updated_at: 'desc' }, { id: 'asc' }] });
    return { ...this.view(row, this.state(row) === 'upcoming'), classroom, manage: false, submission: sub ? this.submissionView(sub) : null, projects };
  }
  /** Para Inicio: tareas abiertas sin entregar (alumno) o entregas sin nota (docente y administrador). */
  async pending(actor: Actor) {
    const now = new Date();
    if (actor.role === 'student') {
      const rows = await this.db.assignments.findMany({
        where: { starts_at: { lte: now }, ends_at: { gte: now }, back_fk_submissions_assignment: { none: { student_id: actor.id } },
          rel_fk_assignments_classroom: { status: 'active', back_fk_enrollments_classroom: { some: { student_id: actor.id } } } },
        include: { rel_fk_assignments_classroom: { select: { name: true } } }, orderBy: [{ ends_at: 'asc' }, { id: 'asc' }], take: 20
      });
      return { tasks: rows.map(row => ({ ...this.view(row as Row), classroom_name: row.rel_fk_assignments_classroom.name })), to_grade: [] };
    }
    const rooms = { status: 'active', ...(actor.role === 'admin' ? {} : { teacher_id: actor.id }) };
    const subs = await this.db.assignment_submissions.findMany({ where: { grade: null, rel_fk_submissions_assignment: { rel_fk_assignments_classroom: rooms } }, select: { assignment_id: true } });
    const counts = new Map<string, number>();
    for (const sub of subs) counts.set(sub.assignment_id, (counts.get(sub.assignment_id) ?? 0) + 1);
    const rows = counts.size ? await this.db.assignments.findMany({ where: { id: { in: [...counts.keys()] } }, include: { rel_fk_assignments_classroom: { select: { name: true } } }, orderBy: [{ ends_at: 'asc' }, { id: 'asc' }], take: 20 }) : [];
    return { tasks: [], to_grade: rows.map(row => ({ ...this.view(row as Row), classroom_name: row.rel_fk_assignments_classroom.name, ungraded: counts.get(row.id) ?? 0 })) };
  }

  // ---------- Docente ----------
  async create(actor: Actor, classroomId: string, input: AssignmentDto) {
    const room = await this.learning.classroom(actor, classroomId, true);
    this.active(room);
    const fields = this.fields(input);
    const row = await this.db.assignments.create({ data: { id: randomUUID(), classroom_id: classroomId, created_by: actor.id, ...fields } }) as Row;
    return this.view(row);
  }
  async update(actor: Actor, id: string, input: AssignmentPatchDto) {
    const row = await this.find(id);
    this.active(await this.learning.classroom(actor, row.classroom_id, true));
    if (!Object.values(input).some(value => value !== undefined)) throw new BadRequestException('Indica un campo para actualizar.');
    const fields = this.fields({
      title: input.title ?? row.title, description: input.description ?? row.description, instructions: input.instructions ?? row.instructions,
      starts_at: input.starts_at ?? row.starts_at, ends_at: input.ends_at ?? row.ends_at,
      grade_min: input.grade_min ?? Number(row.grade_min), grade_max: input.grade_max ?? Number(row.grade_max)
    });
    if ((fields.grade_min !== Number(row.grade_min) || fields.grade_max !== Number(row.grade_max)) &&
        await this.db.assignment_submissions.count({ where: { assignment_id: id, grade: { not: null } } }))
      throw new ConflictException('Ya hay notas registradas: el rango de notas no se puede cambiar.');
    return this.view(await this.db.assignments.update({ where: { id }, data: { ...fields, updated_at: new Date() } }) as Row);
  }
  async remove(actor: Actor, id: string) {
    const row = await this.find(id);
    this.active(await this.learning.classroom(actor, row.classroom_id, true));
    if (await this.db.assignment_submissions.count({ where: { assignment_id: id } })) throw new ConflictException('La tarea ya tiene entregas y no se puede eliminar.');
    await this.db.assignments.delete({ where: { id } });
  }
  async grade(actor: Actor, id: string, studentId: string, input: GradeDto) {
    const row = await this.find(id);
    this.active(await this.learning.classroom(actor, row.classroom_id, true));
    const sub = await this.db.assignment_submissions.findUnique({ where: { assignment_id_student_id: { assignment_id: id, student_id: studentId } } });
    if (!sub) throw new NotFoundException('El alumno todavía no entrega esta tarea.');
    const min = Number(row.grade_min), max = Number(row.grade_max);
    if (input.grade < min || input.grade > max || !oneDecimal(input.grade)) throw new BadRequestException(`La nota debe estar entre ${min} y ${max}, con un decimal como máximo.`);
    await this.db.assignment_submissions.update({ where: { id: sub.id }, data: { grade: input.grade, feedback: input.feedback || null, graded_at: new Date(), graded_by: actor.id } });
    return this.detail(actor, id);
  }

  // ---------- Alumno ----------
  async submit(actor: Actor, id: string, input: SubmissionDto) {
    if (actor.role !== 'student') throw new ForbiddenException('Solo los alumnos entregan tareas.');
    const row = await this.find(id);
    this.active(await this.learning.classroom(actor, row.classroom_id));
    const state = this.state(row);
    if (state === 'upcoming') throw new ConflictException('La tarea todavía no empieza.');
    if (state === 'closed') throw new ConflictException('La tarea ya cerró.');
    const project = await this.db.projects.findUnique({ where: { id: input.project_id }, select: { id: true, owner_id: true, classroom_id: true, status: true } });
    if (!project || project.owner_id !== actor.id || project.classroom_id !== row.classroom_id) throw new BadRequestException('Elige uno de tus proyectos de este salón.');
    if (project.status === 'archived') throw new BadRequestException('El proyecto está archivado.');
    const existing = await this.db.assignment_submissions.findUnique({ where: { assignment_id_student_id: { assignment_id: id, student_id: actor.id } } });
    if (existing && existing.grade !== null) throw new ConflictException('La entrega ya tiene nota y no se puede cambiar.');
    // Se registra qué entrenamiento tenía el proyecto al entregarlo.
    const last = await this.db.training_runs.findFirst({ where: { project_id: project.id }, orderBy: { run_number: 'desc' }, select: { run_number: true } });
    const data = { project_id: project.id, run_number: last?.run_number ?? null, comment: input.comment || null, submitted_at: new Date() };
    try {
      if (existing) await this.db.assignment_submissions.update({ where: { id: existing.id }, data });
      else await this.db.assignment_submissions.create({ data: { id: randomUUID(), assignment_id: id, student_id: actor.id, ...data } });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') throw new ConflictException('La entrega cambió. Actualiza la página.');
      throw error;
    }
    return this.detail(actor, id);
  }

  // ---------- Reglas ----------
  private manages(actor: Actor, room: Classroom) { return actor.role === 'admin' || (actor.role === 'teacher' && room.teacher_id === actor.id); }
  private active(room: Classroom) { if (room.status !== 'active') throw new BadRequestException('El salón está archivado.'); }
  private async find(id: string) {
    const row = await this.db.assignments.findUnique({ where: { id } }) as Row | null;
    if (!row) throw new NotFoundException('Tarea no encontrada.');
    return row;
  }
  private fields(input: { title: string; description: string; instructions: string; starts_at: string | Date; ends_at: string | Date; grade_min: number; grade_max: number }): Fields {
    const starts = new Date(input.starts_at), ends = new Date(input.ends_at);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) throw new BadRequestException('La fecha de cierre debe ser posterior a la de inicio.');
    if (input.grade_max <= input.grade_min || !oneDecimal(input.grade_min) || !oneDecimal(input.grade_max)) throw new BadRequestException('La nota máxima debe ser mayor que la mínima, con un decimal como máximo.');
    return { title: input.title, description: input.description, instructions: input.instructions, starts_at: starts, ends_at: ends, grade_min: input.grade_min, grade_max: input.grade_max };
  }
  private state(row: Pick<Row, 'starts_at' | 'ends_at'>, now = new Date()) { return now < row.starts_at ? 'upcoming' : now > row.ends_at ? 'closed' : 'open'; }
  private view(row: Row, hideContent = false) {
    return {
      id: row.id, classroom_id: row.classroom_id, title: row.title,
      // Antes del inicio, el alumno ve solo el título y las fechas.
      description: hideContent ? null : row.description, instructions: hideContent ? null : row.instructions,
      starts_at: row.starts_at, ends_at: row.ends_at, grade_min: Number(row.grade_min), grade_max: Number(row.grade_max),
      state: this.state(row), created_at: row.created_at, updated_at: row.updated_at
    };
  }
  private submissionView(row: SubmissionRow) {
    return { id: row.id, student_id: row.student_id, project_id: row.project_id, run_number: row.run_number, comment: row.comment,
      submitted_at: row.submitted_at, grade: number(row.grade), feedback: row.feedback, graded_at: row.graded_at };
  }
}
