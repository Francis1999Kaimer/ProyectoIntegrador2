import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../prisma/prisma.service';
import { PageRequest, Project, SimulationRun, Workspace } from '../repositories/contracts';
import { Actor, LEARNING_REPOSITORY, LearningRepository } from '../repositories/learning.contracts';
import { CharacterDatasetDto, CharacterTrainingDto, ClassroomDto, ClassroomPatchDto, ConsentDto, ProjectDto, ProjectPatchDto, StudentDto, TeacherDto, WorkspaceDto } from './learning.dto';
import { simulatePedagogically } from './pedagogical-simulation';

@Injectable()
export class LearningService {
  constructor(@Inject(LEARNING_REPOSITORY) private readonly repo: LearningRepository,
    private readonly passwords: PasswordService, private readonly db: PrismaService) {}
  catalog() { return this.repo.catalog(); }
  students(actor: Actor, page: PageRequest) { return this.repo.listStudents(actor, page); }
  teachers(page: PageRequest) { return this.repo.listTeachers(page); }
  async createStudent(input: StudentDto) {
    return this.repo.createStudent({ username: input.username, display_name: input.display_name,
      password_hash: await this.passwords.hash(input.password) });
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
  private readonly maxCharacterArchiveBytes = 15 * 1024 * 1024;
  private archive(base64: string, subject: string) {
    // Buffer.from accepts malformed input silently; validate the canonical Base64
    // form before retaining it in the database.
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
      throw new BadRequestException(`${subject} invÃ¡lido.`);
    }
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length < 4 || bytes.length > this.maxCharacterArchiveBytes || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      throw new BadRequestException(`${subject} debe ser un ZIP de hasta 15 MB.`);
    }
    return bytes;
  }
  private labels(values: string[]) {
    const labels = values.map(value => value.trim());
    if (labels.some(value => !value) || new Set(labels).size !== labels.length) {
      throw new BadRequestException('Las etiquetas del dataset no son vÃ¡lidas.');
    }
    return labels.sort((a, b) => a.localeCompare(b));
  }
  private labView(row: { project_id: string; dataset_file_name: string; dataset_content_type: string; dataset_labels_json: string; dataset_samples: number; dataset_updated_at: Date; model_file_name: string | null; model_content_type: string | null; training_metrics_json: string | null; training_updated_at: Date | null }) {
    const labels = JSON.parse(row.dataset_labels_json) as string[];
    const metrics = row.training_metrics_json ? JSON.parse(row.training_metrics_json) as { labels: string[]; epochs: number; accuracy: number; loss: number; history: unknown[] } : null;
    return {
      project_id: row.project_id,
      dataset: { file_name: row.dataset_file_name, content_type: row.dataset_content_type, labels, samples: row.dataset_samples, updated_at: row.dataset_updated_at },
      training: metrics && row.model_file_name && row.model_content_type && row.training_updated_at ? {
        file_name: row.model_file_name, content_type: row.model_content_type, ...metrics, updated_at: row.training_updated_at
      } : null
    };
  }
  async characterLab(actor: Actor, projectId: string) {
    await this.project(actor, projectId);
    const row = await this.db.character_labs.findUnique({ where: { project_id: projectId }, select: {
      project_id: true, dataset_file_name: true, dataset_content_type: true, dataset_labels_json: true, dataset_samples: true, dataset_updated_at: true,
      model_file_name: true, model_content_type: true, training_metrics_json: true, training_updated_at: true
    } });
    return row ? this.labView(row) : { project_id: projectId, dataset: null, training: null };
  }
  async saveCharacterDataset(actor: Actor, projectId: string, input: CharacterDatasetDto) {
    const project = await this.project(actor, projectId, true);
    if (project.status === 'archived') throw new BadRequestException('El proyecto estÃ¡ archivado.');
    const labels = this.labels(input.labels), bytes = this.archive(input.archive_base64, 'El dataset');
    const row = await this.db.character_labs.upsert({ where: { project_id: projectId }, create: {
      project_id: projectId, dataset_file_name: input.file_name, dataset_content_type: input.content_type, dataset_bytes: bytes,
      dataset_labels_json: JSON.stringify(labels), dataset_samples: input.samples
    }, update: {
      dataset_file_name: input.file_name, dataset_content_type: input.content_type, dataset_bytes: bytes,
      dataset_labels_json: JSON.stringify(labels), dataset_samples: input.samples, dataset_updated_at: new Date(),
      model_file_name: null, model_content_type: null, model_bytes: null, training_metrics_json: null, training_updated_at: null
    }, select: {
      project_id: true, dataset_file_name: true, dataset_content_type: true, dataset_labels_json: true, dataset_samples: true, dataset_updated_at: true,
      model_file_name: true, model_content_type: true, training_metrics_json: true, training_updated_at: true
    } });
    return this.labView(row);
  }
  async characterDatasetFile(actor: Actor, projectId: string) {
    await this.project(actor, projectId);
    const row = await this.db.character_labs.findUnique({ where: { project_id: projectId }, select: { dataset_file_name: true, dataset_content_type: true, dataset_bytes: true } });
    if (!row) throw new NotFoundException('AÃºn no hay un dataset para este proyecto.');
    return { file_name: row.dataset_file_name, content_type: row.dataset_content_type, bytes: row.dataset_bytes };
  }
  async saveCharacterTraining(actor: Actor, projectId: string, input: CharacterTrainingDto) {
    await this.project(actor, projectId, true);
    const row = await this.db.character_labs.findUnique({ where: { project_id: projectId }, select: { dataset_labels_json: true } });
    if (!row) throw new BadRequestException('Carga un dataset antes de guardar el entrenamiento.');
    const labels = this.labels(input.labels), datasetLabels = JSON.parse(row.dataset_labels_json) as string[];
    if (JSON.stringify(labels) !== JSON.stringify(datasetLabels)) throw new BadRequestException('El modelo no corresponde al dataset actual.');
    const bytes = this.archive(input.archive_base64, 'El modelo');
    const metrics = { labels, epochs: input.epochs, accuracy: input.accuracy, loss: input.loss, history: input.history };
    await this.db.character_labs.update({ where: { project_id: projectId }, data: {
      model_file_name: input.file_name, model_content_type: input.content_type, model_bytes: bytes,
      training_metrics_json: JSON.stringify(metrics), training_updated_at: new Date()
    } });
    return this.characterLab(actor, projectId);
  }
  async characterModelFile(actor: Actor, projectId: string) {
    await this.project(actor, projectId);
    const row = await this.db.character_labs.findUnique({ where: { project_id: projectId }, select: { model_file_name: true, model_content_type: true, model_bytes: true } });
    if (!row?.model_file_name || !row.model_content_type || !row.model_bytes) throw new NotFoundException('AÃºn no hay un modelo entrenado para este proyecto.');
    return { file_name: row.model_file_name, content_type: row.model_content_type, bytes: row.model_bytes };
  }
  async clearCharacterLab(actor: Actor, projectId: string) {
    await this.project(actor, projectId, true);
    await this.db.character_labs.deleteMany({ where: { project_id: projectId } });
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
