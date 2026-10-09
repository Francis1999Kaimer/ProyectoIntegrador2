import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  UserRepository, ProjectRepository, WorkspaceRepository, ClassroomRepository,
  ProgressRepository, SimulationRunRepository, NewProject, PageRequest
} from './contracts';
import { pagination } from './pagination';

const userSelect = {
  id: true, username: true, email: true, role: true, status: true,
  display_name: true, must_change_password: true
} as const;

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: PrismaService) {}
  findById(id: string) {
    return this.db.users.findUnique({ where: { id }, select: userSelect });
  }
  findCredentialsById(id: string) {
    return this.db.users.findUnique({ where: { id }, select: { ...userSelect, password_hash: true } });
  }
  async updatePassword(id: string, previousHash: string, newHash: string) {
    const result = await this.db.users.updateMany({
      where: { id, password_hash: previousHash, status: 'active' },
      data: { password_hash: newHash, must_change_password: false, updated_at: new Date() }
    });
    return result.count === 1;
  }
  // Internal credential lookup only; never return this result through a public API.
  findForAuthentication(username: string) {
    return this.db.users.findUnique({ where: { username }, select: { ...userSelect, password_hash: true } });
  }
}
@Injectable()
export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly db: PrismaService) {}
  findById(id: string) { return this.db.projects.findUnique({ where: { id } }); }
  listByOwner(ownerId: string, page?: PageRequest) {
    return this.db.projects.findMany({
      where: { owner_id: ownerId }, ...pagination(page),
      orderBy: [{ updated_at: 'desc' }, { id: 'asc' }]
    });
  }
  create(input: NewProject) {
    // Explicit fields prevent caller-controlled IDs/status or extra properties.
    return this.db.projects.create({ data: {
      id: randomUUID(), owner_id: input.owner_id, classroom_id: input.classroom_id ?? null,
      title: input.title, project_type: input.project_type
    } });
  }
}
@Injectable()
export class PrismaWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly db: PrismaService) {}
  findByProject(projectId: string) {
    return this.db.workspaces.findUnique({ where: { project_id: projectId } });
  }
}
@Injectable()
export class PrismaClassroomRepository implements ClassroomRepository {
  constructor(private readonly db: PrismaService) {}
  listByTeacher(teacherId: string, page?: PageRequest) {
    return this.db.classrooms.findMany({
      where: { teacher_id: teacherId }, ...pagination(page),
      orderBy: [{ created_at: 'desc' }, { id: 'asc' }]
    });
  }
}
@Injectable()
export class PrismaProgressRepository implements ProgressRepository {
  constructor(private readonly db: PrismaService) {}
  listByStudent(studentId: string, page?: PageRequest) {
    return this.db.lesson_progress.findMany({
      where: { student_id: studentId }, ...pagination(page),
      orderBy: [{ updated_at: 'desc' }, { id: 'asc' }]
    });
  }
}
@Injectable()
export class PrismaSimulationRunRepository implements SimulationRunRepository {
  constructor(private readonly db: PrismaService) {}
  async listByWorkspace(workspaceId: string, page?: PageRequest) {
    const rows = await this.db.simulation_runs.findMany({
      where: { workspace_id: workspaceId }, ...pagination(page),
      orderBy: [{ created_at: 'desc' }, { id: 'asc' }]
    });
    // Keep decimal precision without leaking a Prisma Decimal in the contract.
    return rows.map(row => ({
      ...row, accuracy: row.accuracy?.toString() ?? null, loss: row.loss?.toString() ?? null
    }));
  }
}
