import { Classroom, LessonProgress, PageRequest, Project, Workspace } from './contracts';

// Domain types: no ORM, HTTP or password service dependency.
export interface Actor { id: string; role: string; }
export interface Student { id: string; username: string; display_name: string; status: string; }
export interface NewStudent { username: string; display_name: string; password_hash: string; }
export interface ConsentInput { guardian_name: string; consent_version: string; guardian_contact_email?: string; }
export interface NewClassroom {
  teacher_id: string; level_id: number; course_id: string; name: string;
  academic_year: number; course_start_date: Date; school_name?: string;
}
export interface ClassroomPatch { name?: string; school_name?: string; status?: string; }
export interface ProjectPatch { title?: string; status?: string; }
export interface Lesson {
  id: string; level_id: number; course_week_id: string; title: string;
  summary: string; content_json: string; duration_minutes: number;
}
export interface Catalog {
  levels: { id: number; slug: string; name: string }[];
  courses: { id: string; slug: string; title: string; total_weeks: number }[];
}
export interface ProgressAccess { student_id: string; teacher_id?: string; }
export interface LearningRepository {
  catalog(): Promise<Catalog>;
  listStudents(actor: Actor, page: PageRequest): Promise<Student[]>;
  student(id: string): Promise<Student | null>;
  teacherHasStudent(teacherId: string, studentId: string): Promise<boolean>;
  createStudent(input: NewStudent): Promise<Student>;
  setStudentStatus(id: string, status: string): Promise<Student>;
  recordConsent(id: string, input: ConsentInput): Promise<{ id: string; student_id: string; consented_at: Date }>;
  revokeConsent(id: string): Promise<void>;
  validTeacher(id: string): Promise<boolean>;
  validCatalog(levelId: number, courseId: string): Promise<boolean>;
  listClassrooms(actor: Actor, page: PageRequest): Promise<Classroom[]>;
  classroom(id: string): Promise<Classroom | null>;
  enrolled(classroomId: string, studentId: string): Promise<boolean>;
  createClassroom(input: NewClassroom): Promise<Classroom>;
  updateClassroom(id: string, input: ClassroomPatch): Promise<Classroom>;
  classroomStudents(id: string, page: PageRequest): Promise<Student[]>;
  enroll(classroomId: string, studentId: string): Promise<void>;
  unenroll(classroomId: string, studentId: string): Promise<void>;
  lessons(classroomId: string, page: PageRequest): Promise<Lesson[]>;
  lessonForStudent(lessonId: string, studentId: string): Promise<Lesson | null>;
  listProjects(actor: Actor, page: PageRequest): Promise<Project[]>;
  project(id: string): Promise<Project | null>;
  createProject(ownerId: string, input: { title: string; project_type: string; classroom_id?: string }): Promise<Project>;
  updateProject(id: string, input: ProjectPatch): Promise<Project>;
  workspace(projectId: string): Promise<Workspace | null>;
  saveWorkspace(projectId: string, version: number, json: string): Promise<Workspace>;
  listProgress(access: ProgressAccess, page: PageRequest): Promise<LessonProgress[]>;
  saveProgress(studentId: string, lessonId: string, sections: number, total: number): Promise<LessonProgress>;
}
export const LEARNING_REPOSITORY = Symbol('LearningRepository');
export class DataConflict extends Error {}
export class DataMissing extends Error {}
