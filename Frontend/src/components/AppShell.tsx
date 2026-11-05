import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { BrainCircuit, FolderOpen, Home, LogOut, Users } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
export function Header() {
  const { user, logout } = useAuth()
  return <header className="app-header">
    <Link to="/inicio" className="brand"><span className="brand-mark"><BrainCircuit size={21}/></span><span>AI Blocks <strong>Studio</strong></span></Link>
    <nav className="main-nav"><NavLink to="/inicio" end><Home size={17}/>Inicio</NavLink><NavLink to="/proyectos"><FolderOpen size={17}/>Proyectos</NavLink><NavLink to="/salones"><Users size={17}/>Salones</NavLink>{user?.role!=='student'&&<NavLink to="/alumnos">Alumnos</NavLink>}{user?.role==='admin'&&<NavLink to="/docentes">Docentes</NavLink>}</nav>
    <div className="header-actions session-actions"><span className="session-user">{user?.display_name}<small>{user?.role === 'teacher' ? 'Docente' : user?.role === 'admin' ? 'Administrador' : 'Alumno'}</small></span><Link to="/cambiar-clave" className="text-action">Cambiar clave</Link><button className="secondary" onClick={logout}><LogOut size={16}/>Salir</button></div>
  </header>
}
export function Page({children}:{children:ReactNode}) {
  return <><Header/><main className="page">{children}</main></>
}
export function ApiMessage({loading,error,retry}:{loading?:boolean;error?:string;retry?:()=>void}) {
  if (loading) return <p role="status" className="api-message">Cargando…</p>
  if (!error) return null
  return <div role="alert" className="api-error"><p>{error}</p>{retry&&<button className="secondary" onClick={retry}>Reintentar</button>}</div>
}
