// Contracts deliberately contain no Prisma imports.
export interface PageRequest { limit?: number; offset?: number; }
export interface UserSummary {
  id: string; username: string; email: string | null; role: string; status: string;
  display_name: string; must_change_password: boolean;
}
export interface AuthenticationUser extends UserSummary { password_hash: string; }
export interface Project {
  id: string; owner_id: string; classroom_id: string | null; title: string;
  project_type: string; status: string; created_at: Date; updated_at: Date;
}
export interface NewProject {
  owner_id: string; classroom_id?: string | null; title: string; project_type: string;
}
export interface Workspace {
  id: string; project_id: string; version: number; blocks_json: string;
  created_at: Date; updated_at: Date;
}
export interface Classroom {
  id: string; teacher_id: string; level_id: number; course_id: string;
  name: string; school_name: string | null; academic_year: number;
  course_start_date: Date; status: string; created_at: Date; updated_at: Date;
}
export interface LessonProgress {
  id: string; student_id: string; lesson_id: string; status: string;
  completed_sections: number; progress_percent: number; last_opened_at: Date | null;
  completed_at: Date | null; updated_at: Date;
}
export interface SimulationRun {
  id: string; workspace_id: string; requested_by: string; workspace_version: number;
  provider: string; status: string; seed: number; parameters_json: string;
  metrics_json: string | null; accuracy: string | null; loss: string | null;
  started_at: Date | null; finished_at: Date | null; created_at: Date;
}
export interface UserRepository {
  findById(id: string): Promise<UserSummary | null>;
  findForAuthentication(username: string): Promise<AuthenticationUser | null>;
}
export interface ProjectRepository {
  findById(id: string): Promise<Project | null>;
  listByOwner(ownerId: string, page?: PageRequest): Promise<Project[]>;
  create(input: NewProject): Promise<Project>;
}
export interface WorkspaceRepository { findByProject(projectId: string): Promise<Workspace | null>; }
export interface ClassroomRepository {
  listByTeacher(teacherId: string, page?: PageRequest): Promise<Classroom[]>;
}
export interface ProgressRepository {
  listByStudent(studentId: string, page?: PageRequest): Promise<LessonProgress[]>;
}
export interface SimulationRunRepository {
  listByWorkspace(workspaceId: string, page?: PageRequest): Promise<SimulationRun[]>;
}
export const USER_REPOSITORY = Symbol('UserRepository');
export const PROJECT_REPOSITORY = Symbol('ProjectRepository');
export const WORKSPACE_REPOSITORY = Symbol('WorkspaceRepository');
export const CLASSROOM_REPOSITORY = Symbol('ClassroomRepository');
export const PROGRESS_REPOSITORY = Symbol('ProgressRepository');
export const SIMULATION_RUN_REPOSITORY = Symbol('SimulationRunRepository');
