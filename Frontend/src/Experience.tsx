import { type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import App from './App'
import CreateProjectDynamic from './components/CreateProjectDynamic'
import { DynamicDatasetPage, DynamicModelPage, DynamicPreparationPage } from './components/DynamicProjectFlow'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { LoginPage, PasswordPage } from './auth/AuthPages'
import { ApiMessage, Page } from './components/AppShell'
import { useResource } from './api/useResource'
import type { Project } from './api/types'
import { useEffect } from 'react'
import { useProjectStore } from './store/project'

const workflowPaths = ['/dataset','/preparacion','/modelo','/editor','/entrenamiento','/evaluacion','/prediccion']
function ProjectSelection({children}:{children:ReactNode}) {
  const {search} = useLocation(), id = new URLSearchParams(search).get('project')
  const result = useResource<Project>(id ? '/projects/'+encodeURIComponent(id) : null)
  const select = useProjectStore(s=>s.select), selectedId = useProjectStore(s=>s.id)
  useEffect(()=>{if(result.data)select(result.data)},[result.data,select])
  if (!id) return <Page><section className="panel empty-state"><h1>Selecciona un proyecto</h1><Link to="/proyectos">Ir a proyectos</Link></section></Page>
  if (result.loading || result.error || !result.data || selectedId!==id) return <Page><ApiMessage loading={result.loading||(!result.error&&selectedId!==id)} error={result.error} retry={result.reload}/></Page>
  return <><div className="demo-notice" role="note">Ejemplo educativo: el dataset, el pipeline y los resultados mostrados son ilustrativos. Los cambios de estas pantallas aún no se guardan.</div>{children}</>
}
function RoutedExperience() {
  const {pathname} = useLocation()
  if (pathname==='/crear') return <CreateProjectDynamic/>
  let content:ReactNode = <App/>
  if(pathname==='/dataset') content=<DynamicDatasetPage/>
  if(pathname==='/preparacion') content=<DynamicPreparationPage/>
  if(pathname==='/modelo') content=<DynamicModelPage/>
  return workflowPaths.includes(pathname)?<ProjectSelection>{content}</ProjectSelection>:content
}
export function Gate() {
  const {user,ready,error,refresh,logout}=useAuth(), location=useLocation()
  if(!ready) return <main className="auth-page"><ApiMessage loading/></main>
  if(error&&!user) return <main className="auth-page"><section className="panel auth-card"><ApiMessage error={error} retry={()=>void refresh()}/><button className="secondary" onClick={logout}>Volver al login</button></section></main>
  if(!user) return location.pathname==='/login'?<LoginPage/>:<Navigate to="/login" replace state={{from:location.pathname+location.search}}/>
  if(location.pathname==='/login') {
    const from=location.state?.from
    const target=typeof from==='string'&&from.startsWith('/')&&!from.startsWith('//')&&from.split('?')[0]!=='/login'&&from.split('?')[0]!=='/cambiar-clave'?from:'/'
    return <Navigate to={target} replace/>
  }
  if(user.must_change_password&&location.pathname!=='/cambiar-clave') return <Navigate to="/cambiar-clave" replace/>
  if(location.pathname==='/cambiar-clave') return <PasswordPage/>
  if(location.pathname==='/alumnos'&&user.role==='student') return <Navigate to="/" replace/>
  return <RoutedExperience key={user.id+':'+user.role}/>
}
