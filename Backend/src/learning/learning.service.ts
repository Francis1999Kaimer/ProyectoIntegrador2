import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../prisma/prisma.service';
import { Classroom, PageRequest, Project, SimulationRun, Workspace } from '../repositories/contracts';
import { Actor, LEARNING_REPOSITORY, LearningRepository } from '../repositories/learning.contracts';
import { ClassroomDto, ClassroomPatchDto, ConsentDto, PasswordResetDto, ProjectDto, ProjectPatchDto, ProjectDraftDto, StudentDto, TeacherDto, WorkspaceDto } from './learning.dto';
import { simulatePedagogically } from './pedagogical-simulation';

@Injectable()
export class LearningService {
  constructor(@Inject(LEARNING_REPOSITORY) private readonly repo: LearningRepository,
    private readonly passwords: PasswordService, private readonly db: PrismaService) {}
  catalog() { return this.repo.catalog(); }
  students(actor: Actor, page: PageRequest) { return this.repo.listStudents(actor, page); }
  teachers(page: PageRequest) { return this.repo.listTeachers(page); }
  // El docente crea alumnos en uno de sus salones (quedan matriculados); el administrador, en cualquiera o sin salón.
  async createStudent(actor: Actor, input: StudentDto) {
    if (actor.role === 'teacher' && !input.classroom_id) throw new BadRequestException('Indica el salón del alumno.');
    if (input.classroom_id) {
      const room = await this.classroom(actor, input.classroom_id, true);
      if (room.status !== 'active') throw new BadRequestException('El salón está archivado.');
    }
    return this.repo.createStudent({
      username: input.username, display_name: input.display_name, password_hash: await this.passwords.hash(input.password),
      must_change_password: input.require_password_change ?? true, guardian_name: input.guardian_name || 'No indicado',
      consent_version: 'casilla-alta-v1', classroom_id: input.classroom_id
    });
  }
  // El docente restablece la contraseña de los alumnos de sus salones activos; el administrador, la de cualquier cuenta.
  async resetPassword(actor: Actor, id: string, input: PasswordResetDto) {
    const target = await this.repo.account(id);
    const allowed = !!target && (actor.role === 'admin' || (actor.role === 'teacher' && target.role === 'student' && await this.repo.teacherHasStudent(actor.id, id)));
    if (!allowed) throw new NotFoundException('Cuenta no encontrada.');
    await this.repo.resetPassword(id, await this.passwords.hash(input.password), input.require_password_change ?? true);
  }
  async createTeacher(input: TeacherDto) {
    return this.repo.createTeacher({ username: input.username, display_name: input.display_name,
      password_hash: await this.passwords.hash(input.password) });
  }
  studentStatus(id: string, status: string) { return this.repo.setStudentStatus(id, status); }
  teacherStatus(id: string, status: string) { return this.repo.setTeacherStatus(id, status); }
  consent(id: string, input: ConsentDto) { return this.repo.recordConsent(id, input); }
  currentConsent(id: string) { return this.repo.currentConsent(id); }
  revokeConsent(id: string) { return this.repo.revokeConsent(id); }
  classrooms(actor: Actor, page: PageRequest) { return this.repo.listClassrooms(actor, page); }
  /** Docente del salón: responsable o docente adicional. */
  private async teaches(actor: Actor, room: Classroom) {
    return actor.role === 'teacher' && (room.teacher_id === actor.id || await this.repo.teachesClassroom(room.id, actor.id));
  }
  /** Gestiona el salón (alumnos, tareas, notas): administrador o cualquier docente del salón. */
  async managesClassroom(actor: Actor, room: Classroom) { return actor.role === 'admin' || await this.teaches(actor, room); }
  async classroom(actor: Actor, id: string, manage = false) {
    const row = await this.repo.classroom(id);
    if (!row) throw new NotFoundException('Salón no encontrado.');
    if (await this.managesClassroom(actor, row)) return row;
    if (!manage && actor.role === 'student' && await this.repo.enrolled(id, actor.id)) return row;
    throw new NotFoundException('Salón no encontrado.');
  }
  // ---------- Docentes del salón ----------
  async classroomTeachers(actor: Actor, id: string) {
    await this.classroom(actor, id);
    return this.repo.classroomTeachers(id);
  }
  /** Solo el docente responsable y el administrador agregan o quitan docentes. */
  private assigner(actor: Actor, room: Classroom) {
    if (actor.role !== 'admin' && room.teacher_id !== actor.id) throw new ForbiddenException('Solo el docente responsable o un administrador gestionan los docentes del salón.');
  }
  async eligibleTeachers(actor: Actor, id: string, page: PageRequest) {
    this.assigner(actor, await this.classroom(actor, id, true));
    return this.repo.eligibleTeachers(id, page);
  }
  async addTeacher(actor: Actor, id: string, teacherId: string) {
    const room = await this.classroom(actor, id, true);
    this.assigner(actor, room);
    if (room.status !== 'active') throw new BadRequestException('El salón está archivado.');
    if (teacherId === room.teacher_id) throw new BadRequestException('Ese docente ya es el responsable del salón.');
    await this.repo.addClassroomTeacher(id, teacherId, actor.id);
    return this.repo.classroomTeachers(id);
  }
  /** El responsable y el administrador quitan docentes; un docente adicional puede salir por su cuenta. */
  async removeTeacher(actor: Actor, id: string, teacherId: string) {
    const room = await this.classroom(actor, id, true);
    if (teacherId === room.teacher_id) throw new BadRequestException('El docente responsable no se puede quitar del salón.');
    if (teacherId !== actor.id) this.assigner(actor, room);
    await this.repo.removeClassroomTeacher(id, teacherId);
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
  // Nombre, colegio y archivar/reabrir: solo el docente responsable y el administrador.
  async updateClassroom(actor: Actor, id: string, input: ClassroomPatchDto) {
    this.assigner(actor, await this.classroom(actor, id, true));
    if (!Object.values(input).some(value => value !== undefined)) throw new BadRequestException('Indica un campo para actualizar.');
    return this.repo.updateClassroom(id, input);
  }
  async classroomStudents(actor: Actor, id: string, page: PageRequest) {
    await this.classroom(actor, id, true);
    return this.repo.classroomStudents(id, page);
  }
  async eligibleStudents(actor: Actor, id: string, page: PageRequest) {
    await this.classroom(actor, id, true);
    return this.repo.eligibleStudents(id, page);
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
      if (classroom && await this.teaches(actor, classroom)) return row;
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
  async createProjectDraft(actor: Actor, input: ProjectDraftDto) {
    if (input.classroom_id) {
      const room = await this.classroom(actor, input.classroom_id);
      if (room.status !== 'active') throw new BadRequestException('El salón está archivado.');
    }
    const findExisting = async () => {
      const existing = await this.db.projects.findUnique({ where: { id: input.request_id } });
      if (!existing || existing.owner_id !== actor.id || existing.title !== input.title ||
          existing.project_type !== input.project_type || existing.classroom_id !== (input.classroom_id ?? null))
        throw new ConflictException('No se pudo repetir la creación.');
      return existing;
    };
    const current = await this.db.projects.findUnique({ where: { id: input.request_id } });
    if (current) return findExisting();
    try {
      return await this.db.projects.create({ data: { id: input.request_id, owner_id: actor.id, title: input.title, project_type: input.project_type, classroom_id: input.classroom_id ?? null } });
    } catch (error) {
      if ((error as {code?: string})?.code === 'P2002') return findExisting();
      throw error;
    }
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
  private simulationView(row: SimulationRun) {
    const { parameters_json, metrics_json, ...meta } = row;
    return { ...meta, parameters: JSON.parse(parameters_json), metrics: metrics_json ? JSON.parse(metrics_json) : null };
  }
  async simulations(actor: Actor, projectId: string, page: PageRequest) {
    await this.project(actor, projectId);
    const workspace = await this.repo.workspace(projectId);
    if (!workspace) return [];
    return (await this.repo.listSimulations(workspace.id, page)).map(row => this.simulationView(row));
  }
  async simulate(actor: Actor, projectId: string) {
    await this.project(actor, projectId, true);
    const workspace = await this.repo.workspace(projectId);
    if (!workspace) throw new BadRequestException('Guarda un pipeline válido antes de ejecutar la simulación.');
    const result = simulatePedagogically(workspace.blocks_json);
    return this.simulationView(await this.repo.createSimulation({
      workspace_id: workspace.id, requested_by: actor.id, workspace_version: workspace.version,
      provider: result.provider, seed: result.seed, parameters_json: JSON.stringify(result.parameters),
      metrics_json: JSON.stringify(result.metrics), accuracy: result.accuracy, loss: result.loss
    }));
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
