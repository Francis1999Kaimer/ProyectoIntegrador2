import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { BrainCircuit, FolderOpen, Home, LogOut, Users } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useProjectStore } from '../store/project'
export function Header() {
  const { user, logout } = useAuth()
  return <header className="app-header">
    <Link to="/" className="brand"><span className="brand-mark"><BrainCircuit size={21}/></span><span>AI Blocks <strong>Studio</strong></span></Link>
    <nav className="main-nav"><NavLink to="/" end><Home size={17}/>Inicio</NavLink><NavLink to="/proyectos"><FolderOpen size={17}/>Proyectos</NavLink><NavLink to="/salones"><Users size={17}/>Salones</NavLink>{user?.role!=='student'&&<NavLink to="/alumnos">Alumnos</NavLink>}{user?.role==='admin'&&<NavLink to="/docentes">Docentes</NavLink>}</nav>
    <div className="header-actions session-actions"><span className="session-user">{user?.display_name}<small>{user?.role === 'teacher' ? 'Docente' : user?.role === 'admin' ? 'Administrador' : 'Alumno'}</small></span><Link to="/cambiar-clave" className="text-action">Cambiar clave</Link><button className="secondary" onClick={logout}><LogOut size={16}/>Salir</button></div>
  </header>
}
export function workflow(path: string, id: string | null) { return id ? path + '?project=' + encodeURIComponent(id) : path }
const steps = [['/dataset','Datos'],['/preparacion','Preparación'],['/modelo','Modelo'],['/editor','Pipeline'],['/entrenamiento','Entrenar'],['/evaluacion','Evaluar'],['/prediccion','Probar']]
export function ProjectStepper() {
  const { pathname } = useLocation(), id = useProjectStore(s=>s.id)
  return <div className="stepper">{steps.map(([path,label],i)=><Link key={path} to={workflow(path,id)} className={pathname===path?'active':''}><span>{i+1}</span>{label}</Link>)}</div>
}
export function Page({children,stepper=false}:{children:ReactNode;stepper?:boolean}) {
  return <><Header/>{stepper&&<ProjectStepper/>}<main className="page">{children}</main></>
}
export function ApiMessage({loading,error,retry}:{loading?:boolean;error?:string;retry?:()=>void}) {
  if (loading) return <p role="status" className="api-message">Cargando…</p>
  if (!error) return null
  return <div role="alert" className="api-error"><p>{error}</p>{retry&&<button className="secondary" onClick={retry}>Reintentar</button>}</div>
}
