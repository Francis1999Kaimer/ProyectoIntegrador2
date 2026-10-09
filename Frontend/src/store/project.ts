import { create } from 'zustand'
import type { Project } from '../api/types'
import { typeLabel } from '../api/types'
export type ProjectLevel = 'Principiante' | 'Intermedio' | 'Avanzado'
interface ProjectState {
  id: string | null; name: string; type: string; level: ProjectLevel
  setName: (name: string) => void; setType: (type: string) => void; setLevel: (level: ProjectLevel) => void
  select: (project: Project) => void; reset: () => void
}
const defaults = { id: null, name: '', type: 'Clasificación de imágenes', level: 'Principiante' as ProjectLevel }
export const useProjectStore = create<ProjectState>(set=>({
  ...defaults, setName: name=>set({name}), setType: type=>set({type}), setLevel: level=>set({level}),
  select: project=>set({id:project.id,name:project.title,type:typeLabel(project.project_type)}),
  reset: ()=>set(defaults)
}))
