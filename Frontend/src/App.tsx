import { Navigate, Route, Routes } from 'react-router'
import { Dashboard, ProjectsPage, ProjectDetail, ClassroomsPage, ClassroomDetail } from './components/ConnectedPages'
import { StudentsPage } from './components/StudentsPage'
import { TeachersPage } from './components/TeachersPage'
import { DatasetPage, EvaluationPage, ModelPage, PredictionPage, PreparationPage, TrainingPage } from './components/CharacterLab'
import { LandingPage } from './components/LandingPage'

export default function App(){return <Routes>
  <Route path="/" element={<LandingPage/>}/><Route path="/inicio" element={<Dashboard/>}/><Route path="/proyectos" element={<ProjectsPage/>}/><Route path="/proyectos/:id" element={<ProjectDetail/>}/>
  <Route path="/salones" element={<ClassroomsPage/>}/><Route path="/salones/:id" element={<ClassroomDetail/>}/><Route path="/alumnos" element={<StudentsPage/>}/><Route path="/docentes" element={<TeachersPage/>}/>
  <Route path="/dataset" element={<DatasetPage/>}/><Route path="/preparacion" element={<PreparationPage/>}/><Route path="/modelo" element={<ModelPage/>}/><Route path="/entrenamiento" element={<TrainingPage/>}/><Route path="/evaluacion" element={<EvaluationPage/>}/><Route path="/prediccion" element={<PredictionPage/>}/>
  <Route path="/editor" element={<Navigate to="/entrenamiento" replace/>}/><Route path="*" element={<Navigate to="/" replace/>}/>
</Routes>}
