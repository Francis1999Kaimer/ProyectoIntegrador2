import { create } from 'zustand'

export type ProjectLevel = 'Principiante' | 'Intermedio' | 'Avanzado'

interface ProjectState {
  name: string
  type: string
  level: ProjectLevel
  setName: (name: string) => void
  setType: (type: string) => void
  setLevel: (level: ProjectLevel) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  name: 'Clasificador perros y gatos',
  type: 'Clasificación de imágenes',
  level: 'Principiante',
  setName: (name) => set({ name }),
  setType: (type) => set({ type }),
  setLevel: (level) => set({ level }),
}))
