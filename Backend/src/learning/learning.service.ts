import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PasswordService } from '../auth/password.service';
import { PageRequest, Project, Workspace } from '../repositories/contracts';
import { Actor, LEARNING_REPOSITORY, LearningRepository } from '../repositories/learning.contracts';
import { ClassroomDto, ClassroomPatchDto, ConsentDto, ProjectDto, ProjectPatchDto, StudentDto, WorkspaceDto } from './learning.dto';

@Injectable()
export class LearningService {
  constructor(@Inject(LEARNING_REPOSITORY) private readonly repo: LearningRepository,
    private readonly passwords: PasswordService) {}
  catalog() { return this.repo.catalog(); }
  students(actor: Actor, page: PageRequest) { return this.repo.listStudents(actor, page); }
  async createStudent(input: StudentDto) {
    return this.repo.createStudent({ username: input.username, display_name: input.display_name,
      password_hash: await this.passwords.hash(input.password) });
  }
  studentStatus(id: string, status: string) { return this.repo.setStudentStatus(id, status); }
  consent(id: string, input: ConsentDto) { return this.repo.recordConsent(id, input); }
  revokeConsent(id: string) { return this.repo.revokeConsent(id); }
  classrooms(actor: Actor, page: PageRequest) { return this.repo.listClassrooms(actor, page); }
  async classroom(actor: Actor, id: string, manage = false) {
    const row = await this.repo.classroom(id);
    if (!row || (actor.role !== 'admin' && !(actor.role === 'teacher' && row.teacher_id === actor.id) &&
      (manage || actor.role !== 'student' || !await this.repo.enrolled(id, actor.id)))) throw new NotFoundException('Salón no encontrado.');
    return row;
  }
  async createClassroom(actor: Actor, input: ClassroomDto) {
    const teacherId = input.teacher_id ?? actor.id;
    if (actor.role === 'teacher' && teacherId !== actor.id) throw new ForbiddenException('No puedes asignar otro docente.');
    if (!await this.repo.validTeacher(teacherId) || !await this.repo.validCatalog(input.level_id, input.course_id)) {
      throw new BadRequestException('Docente activo, nivel o curso publicado inválidos.');
    }
    const date = new Date(input.course_start_date + 'T00:00:00.000Z');
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.course_start_date) throw new BadRequestException('Fecha inválida.');
    return this.repo.createClassroom({
      teacher_id: teacherId, level_id: input.level_id, course_id: input.course_id, name: input.name,
      school_name: input.school_name, academic_year: input.academic_year, course_start_date: date
    });
  }
  async updateClassroom(actor: Actor, id: string, input: ClassroomPatchDto) {
    await this.classroom(actor, id, true);
    if (!Object.values(input).some(value => value !== undefined)) throw new BadRequestException('Indica un campo para actualizar.');
    return this.repo.updateClassroom(id, input);
  }
  async classroomStudents(actor: Actor, id: string, page: PageRequest) {
    await this.classroom(actor, id, true);
    return this.repo.classroomStudents(id, page);
  }
  async enroll(actor: Actor, id: string, studentId: string) {
    await this.classroom(actor, id, true);
    await this.repo.enroll(id, studentId);
    return { classroom_id: id, student_id: studentId };
  }
  async unenroll(actor: Actor, id: string, studentId: string) {
    await this.classroom(actor, id, true);
    await this.repo.unenroll(id, studentId);
  }
  async lessons(actor: Actor, id: string, page: PageRequest) {
    await this.classroom(actor, id);
    const rows = await this.repo.lessons(id, page);
    return rows.map(({ content_json, ...row }) => ({ ...row, content: JSON.parse(content_json) }));
  }
  projects(actor: Actor, page: PageRequest) { return this.repo.listProjects(actor, page); }
  async project(actor: Actor, id: string, write = false): Promise<Project> {
    const row = await this.repo.project(id);
    if (!row) throw new NotFoundException('Proyecto no encontrado.');
    if (row.owner_id === actor.id) return row;
    // Administrators/teachers may inspect, but only the owner changes a project's work.
    if (!write && actor.role === 'admin') return row;
    if (!write && actor.role === 'teacher' && row.classroom_id) {
      const classroom = await this.repo.classroom(row.classroom_id);
      if (classroom?.teacher_id === actor.id) return row;
    }
    throw new NotFoundException('Proyecto no encontrado.');
  }
  async createProject(actor: Actor, input: ProjectDto) {
    if (input.classroom_id) {
      const room = await this.classroom(actor, input.classroom_id);
      if (room.status !== 'active') throw new BadRequestException('El salón está archivado.');
    }
    return this.repo.createProject(actor.id, input);
  }
  async updateProject(actor: Actor, id: string, input: ProjectPatchDto) {
    await this.project(actor, id, true);
    if (!Object.values(input).some(value => value !== undefined)) throw new BadRequestException('Indica un campo para actualizar.');
    return this.repo.updateProject(id, input);
  }
  private workspaceView(row: Workspace) {
    const { blocks_json, ...meta } = row;
    return { ...meta, blocks: JSON.parse(blocks_json) };
  }
  async workspace(actor: Actor, projectId: string) {
    await this.project(actor, projectId);
    const row = await this.repo.workspace(projectId);
    if (!row) throw new NotFoundException('Workspace no encontrado.');
    return this.workspaceView(row);
  }
  async saveWorkspace(actor: Actor, projectId: string, input: WorkspaceDto) {
    const project = await this.project(actor, projectId, true);
    if (project.status === 'archived') throw new BadRequestException('El proyecto está archivado.');
    if (project.classroom_id) {
      const room = await this.classroom(actor, project.classroom_id);
      if (room.status !== 'active') throw new BadRequestException('El salón está archivado.');
    }
    const json = this.graph(input.blocks);
    return this.workspaceView(await this.repo.saveWorkspace(projectId, input.version, json));
  }
  private graph(blocks: Record<string, unknown>): string {
    const fail = () => { throw new BadRequestException('Grafo inválido: schemaVersion 1, nodos y aristas válidos; máximo 64 KiB.'); };
    if (blocks.schemaVersion !== 1 || Object.keys(blocks).some(k => !['schemaVersion', 'nodes', 'edges', 'viewport'].includes(k))) fail();
    const nodes = blocks.nodes, edges = blocks.edges;
    if (!Array.isArray(nodes) || !Array.isArray(edges) || nodes.length > 200 || edges.length > 500) return fail();
    const ids = new Set<string>(), edgeIds = new Set<string>();
    for (const node of nodes) {
      if (!node || typeof node !== 'object' || typeof node.id !== 'string' || !node.id.length || node.id.length > 80 || ids.has(node.id) ||
          !node.position || !Number.isFinite(node.position.x) || !Number.isFinite(node.position.y) ||
          !node.data || typeof node.data !== 'object' || Array.isArray(node.data)) fail();
      ids.add(node.id);
    }
    for (const edge of edges) {
      if (!edge || typeof edge !== 'object' || typeof edge.id !== 'string' || !edge.id.length || edge.id.length > 80 || edgeIds.has(edge.id) ||
          !ids.has(edge.source) || !ids.has(edge.target)) fail();
      edgeIds.add(edge.id);
    }
    if (blocks.viewport !== undefined) {
      const viewport = blocks.viewport as { x?: number; y?: number; zoom?: number };
      if (!viewport || !Number.isFinite(viewport.x) || !Number.isFinite(viewport.y) || !Number.isFinite(viewport.zoom) || viewport.zoom! <= 0) fail();
    }
    const json = JSON.stringify(blocks);
    if (Buffer.byteLength(json, 'utf8') > 65536) fail();
    return json;
  }
  async progress(actor: Actor, studentId: string, page: PageRequest) {
    if (actor.role === 'student' && studentId !== actor.id) throw new NotFoundException('Alumno no encontrado.');
    if (actor.role === 'teacher' && !await this.repo.teacherHasStudent(actor.id, studentId)) throw new NotFoundException('Alumno no encontrado.');
    if (!await this.repo.student(studentId)) throw new NotFoundException('Alumno no encontrado.');
    // Teachers get only lessons matching their own active rooms and this student's enrollment.
    return this.repo.listProgress({ student_id: studentId, ...(actor.role === 'teacher' ? { teacher_id: actor.id } : {}) }, page);
  }
  async saveProgress(actor: Actor, lessonId: string, sections: number) {
    const lesson = await this.repo.lessonForStudent(lessonId, actor.id);
    if (!lesson) throw new NotFoundException('Lección no disponible para tu matrícula.');
    const content = JSON.parse(lesson.content_json);
    const total = Array.isArray(content.sections) ? content.sections.length : 0;
    if (total < 1 || total > 255 || sections > total) throw new BadRequestException('Cantidad de secciones inválida.');
    return this.repo.saveProgress(actor.id, lessonId, sections, total);
  }
}
