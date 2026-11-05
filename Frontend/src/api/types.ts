export type Role = 'student' | 'teacher' | 'admin'
export interface User { id: string; username: string; display_name: string; role: Role; status: string; must_change_password: boolean }
export interface Project { id: string; owner_id: string; classroom_id: string | null; title: string; project_type: string; status: string; created_at: string; updated_at: string }
export interface Classroom { id: string; teacher_id: string; level_id: number; course_id: string | null; name: string; school_name: string | null; academic_year: number; course_start_date: string; status: string }
export interface Student { id: string; username: string; display_name: string; status: string }
export interface Teacher { id: string; username: string; display_name: string; status: string }
export interface Consent { guardian_name: string; consent_version: string; consented_at: string }
export interface Catalog { levels: { id: number; name: string; slug: string }[]; courses: { id: string; title: string; slug: string }[] }
export interface Section { type?: string; title?: string; text?: string; questions?: { question: string; options: string[] }[] }
export interface Lesson { id: string; title: string; summary: string; content: { sections: Section[] } }
export interface Progress { id: string; student_id: string; lesson_id: string; completed_sections: number; progress_percent: number; status: string }
export interface Workspace { id: string; project_id: string; version: number; blocks: { schemaVersion: 1; nodes: FlowNode[]; edges: FlowEdge[]; viewport?: { x: number; y: number; zoom: number } } }
export interface FlowNode { id: string; position: { x: number; y: number }; data: { label: string; kind?: string } }
export interface FlowEdge { id: string; source: string; target: string }
export interface SimulationMetrics { train_accuracy: number; validation_accuracy: number; precision: number; recall: number; f1: number; loss: number; epochs: number; confusion_matrix: number[][]; prediction: { label: string; confidence: number } }
export interface Simulation { id: string; workspace_id: string; requested_by: string; workspace_version: number; provider: string; status: string; seed: number; created_at: string; accuracy: string | null; loss: string | null; parameters: { epochs: number; [key: string]: unknown }; metrics: SimulationMetrics | null }
export const typeCodes: Record<string, string> = { 'Reconocedor de caracteres': 'character_recognition', 'Clasificador de imágenes': 'image_classification', 'Reconocedor de sonidos cortos': 'sound_recognition', 'Clasificador de gestos de la mano': 'hand_gesture_classification', 'Clasificador de posturas corporales': 'body_posture_classification', 'Clasificador de dibujos simples': 'drawing_classification' }
export function typeLabel(code: string) { return Object.entries(typeCodes).find(([,value]) => value === code)?.[0] ?? code }
// Estado de las cuentas (alumnos y docentes); los proyectos usan statusLabels.
export const accountStatusLabels: Record<string, string> = { active: 'Activa', pending: 'Pendiente', suspended: 'Suspendida' }
export const statusLabels: Record<string, string> = { draft: 'Borrador', active: 'En progreso', completed: 'Completado', archived: 'Archivado', pending: 'Pendiente', suspended: 'Suspendido' }
export type AssignmentState = 'upcoming' | 'open' | 'closed'
export const assignmentStates: Record<AssignmentState, string> = { upcoming: 'Próxima', open: 'Abierta', closed: 'Cerrada' }
export interface Submission { id: string; student_id: string; project_id: string; run_number: number | null; comment: string | null; submitted_at: string; grade: number | null; feedback: string | null; graded_at: string | null }
export interface Assignment {
  id: string; classroom_id: string; title: string; description: string | null; instructions: string | null
  starts_at: string; ends_at: string; grade_min: number; grade_max: number; state: AssignmentState; created_at: string; updated_at: string
  counts?: { students: number; submitted: number; graded: number }; my_submission?: Submission | null
}
export interface SubmissionEntry {
  student: { id: string; username: string; display_name: string }; enrolled: boolean
  submission: (Submission & { project: { id: string; title: string; project_type: string } | null; test_accuracy: number | null }) | null
}
export interface AssignmentDetail extends Assignment {
  classroom: { id: string; name: string; status: string }; manage: boolean
  submissions?: SubmissionEntry[]; submission?: Submission | null
  projects?: { id: string; title: string; project_type: string; status: string }[]
}
export interface PendingAssignment extends Assignment { classroom_name: string; ungraded?: number }
export interface Pending { tasks: PendingAssignment[]; to_grade: PendingAssignment[] }
