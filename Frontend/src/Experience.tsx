import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import App from './App'
import CreateProjectDynamic from './components/CreateProjectDynamic'
import DatasetUpload from './components/DatasetUpload'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { LoginPage, PasswordPage } from './auth/AuthPages'
import { ApiMessage } from './components/AppShell'
import { ContinueProject } from './components/training/TrainingLayout'
import PreparationStep from './components/training/PreparationStep'
import ConfigurationStep from './components/training/ConfigurationStep'
import TrainStep from './components/training/TrainStep'
import EvaluationStep from './components/training/EvaluationStep'
import PredictionStep from './components/training/PredictionStep'

// Rutas del flujo anterior de caracteres: ahora abren el proyecto en su último paso.
const legacyPaths = ['/dataset','/preparacion','/modelo','/entrenamiento','/evaluacion','/prediccion','/editor']
const steps: Record<string, () => ReactNode> = {
  '/crear': () => <CreateProjectDynamic/>, '/crear/datos': () => <DatasetUpload/>, '/crear/continuar': () => <ContinueProject/>,
  '/crear/preparacion': () => <PreparationStep/>, '/crear/configuracion': () => <ConfigurationStep/>, '/crear/entrenar': () => <TrainStep/>,
  '/crear/evaluar': () => <EvaluationStep/>, '/crear/probar': () => <PredictionStep/>
}
function RoutedExperience() {
  const {pathname,search} = useLocation()
  if (steps[pathname]) return steps[pathname]()
  if (legacyPaths.includes(pathname)) { const id = new URLSearchParams(search).get('project'); return <Navigate to={id ? '/crear/continuar?project='+encodeURIComponent(id) : '/proyectos'} replace/> }
  return <App/>
}
export function Gate() {
  const {user,ready,error,refresh,logout}=useAuth(), location=useLocation()
  if(!ready) return <main className="auth-page"><ApiMessage loading/></main>
  if(error&&!user) return <main className="auth-page"><section className="panel auth-card"><ApiMessage error={error} retry={()=>void refresh()}/><button className="secondary" onClick={logout}>Volver al login</button></section></main>
  if(!user) { if(location.pathname==='/') return <RoutedExperience/>; return location.pathname==='/login'?<LoginPage/>:<Navigate to="/login" replace state={{from:location.pathname+location.search}}/> }
  if(location.pathname==='/login') {
    const from=location.state?.from
    const target=typeof from==='string'&&from.startsWith('/')&&!from.startsWith('//')&&from.split('?')[0]!=='/login'&&from.split('?')[0]!=='/cambiar-clave'&&from!=='/'?from:'/inicio'
    return <Navigate to={target} replace/>
  }
  if(user.must_change_password&&location.pathname!=='/cambiar-clave') return <Navigate to="/cambiar-clave" replace/>
  if(location.pathname==='/cambiar-clave') return <PasswordPage/>
  if(location.pathname==='/alumnos'&&user.role==='student') return <Navigate to="/inicio" replace/>
  if(location.pathname==='/docentes'&&user.role!=='admin') return <Navigate to="/inicio" replace/>
  return <RoutedExperience key={user.id+':'+user.role}/>
}
