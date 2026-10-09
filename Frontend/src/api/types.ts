export type Role = 'student' | 'teacher' | 'admin'
export interface User { id: string; username: string; display_name: string; role: Role; status: string; must_change_password: boolean }
export interface Project { id: string; owner_id: string; classroom_id: string | null; title: string; project_type: string; status: string; created_at: string; updated_at: string }
export interface Classroom { id: string; teacher_id: string; level_id: number; course_id: string; name: string; school_name: string | null; academic_year: number; course_start_date: string; status: string }
export interface Student { id: string; username: string; display_name: string; status: string }
export interface Teacher { id: string; username: string; display_name: string; status: string }
export interface Consent { guardian_name: string; consent_version: string; consented_at: string }
export interface Catalog { levels: { id: number; name: string; slug: string }[]; courses: { id: string; title: string; slug: string }[] }
export interface Section { type?: string; title?: string; text?: string; questions?: { question: string; options: string[] }[] }
export interface Lesson { id: string; title: string; summary: string; content: { sections: Section[] } }
export interface Progress { id: string; student_id: string; lesson_id: string; completed_sections: number; progress_percent: number; status: string }
export const typeCodes: Record<string, string> = { 'Clasificación de imágenes': 'image_classification', 'Predicción con datos': 'tabular_prediction', 'Clasificador de textos': 'text_classification', 'Regresión': 'regression' }
export function typeLabel(code: string) { return Object.entries(typeCodes).find(([,value]) => value === code)?.[0] ?? code }
export const statusLabels: Record<string, string> = { draft: 'Borrador', active: 'En progreso', completed: 'Completado', archived: 'Archivado', pending: 'Pendiente', suspended: 'Suspendido' }
