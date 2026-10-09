import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowRight, BrainCircuit, FolderOpen, Plus } from 'lucide-react'
import { api } from '../api/http'
import { useResource } from '../api/useResource'
import { statusLabels, typeLabel, type Catalog, type Classroom, type Lesson, type Progress, type Project, type Student } from '../api/types'
import { useAuth } from '../auth/AuthProvider'
import { useProjectStore } from '../store/project'
import { ApiMessage, Page, workflow } from './AppShell'

function Paging({offset,count,setOffset}:{offset:number;count:number;setOffset:(value:number)=>void}) {
  return <div className="actions between api-pagination"><button className="secondary" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-25))}>Anterior</button><span>Página {offset/25+1}</span><button className="secondary" disabled={count<25} onClick={()=>setOffset(offset+25)}>Siguiente</button></div>
}
export function Dashboard() {
  const {user}=useAuth(), recent=useResource<Project[]>('/projects?limit=3&offset=0')
  return <Page><section className="hero"><div><span className="eyebrow">TU ESPACIO DE APRENDIZAJE</span><h1>Hola, {user?.display_name}</h1><p>Crea proyectos y continúa con tus salones y lecciones.</p><div className="hero-actions"><Link className="primary button-link" to="/crear"><Plus size={18}/>Crear proyecto</Link><Link className="secondary button-link" to="/salones">Ver salones</Link></div></div><BrainCircuit size={72}/></section>
    <section className="section-heading"><h2>Proyectos recientes</h2><Link to="/proyectos">Ver todos</Link></section>
    <ApiMessage {...recent} retry={recent.reload}/>
    {recent.data?.length===0&&<section className="panel empty-state"><p>Aún no hay proyectos disponibles para tu cuenta.</p><Link to="/crear">Crea tu primer proyecto</Link></section>}
    <div className="card-grid">{recent.data?.map(p=><Link className="project-card" key={p.id} to={'/proyectos/'+p.id}><FolderOpen size={24}/><strong>{p.title}</strong><p>{typeLabel(p.project_type)}</p><small>{statusLabels[p.status]??p.status}</small></Link>)}</div>
  </Page>
}
export function ProjectsPage() {
  const {user}=useAuth(), [offset,setOffset]=useState(0), [filter,setFilter]=useState(''), [search,setSearch]=useState('')
  const result=useResource<Project[]>('/projects?limit=25&offset='+offset)
  const visible=result.data?.filter(p=>(!filter||p.status===filter)&&p.title.toLowerCase().includes(search.toLowerCase()))??[]
  return <Page><section className="projects-hero"><div><span className="eyebrow">TU LABORATORIO DE IA</span><h1>Proyectos</h1><p>{user?.role==='student'?'Tus proyectos guardados.':'Tus proyectos y los que puedes consultar según tus permisos.'}</p></div><Link className="primary button-link" to="/crear"><Plus size={18}/>Nuevo proyecto</Link></section>
    <div className="projects-toolbar"><label>Estado en esta página<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Todos</option>{Object.entries(statusLabels).filter(([code])=>['draft','active','completed','archived'].includes(code)).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label><label>Buscar en esta página<input type="search" value={search} onChange={e=>setSearch(e.target.value)} /></label></div>
    <ApiMessage {...result} retry={result.reload}/>
    {!result.loading&&!result.error&&!visible.length&&<section className="panel empty-state"><p>No hay proyectos que coincidan en esta página.</p><Link to="/crear">Crear proyecto</Link></section>}
    <section className="projects-grid">{visible.map(p=><article className="project-library-card" key={p.id}><div className="project-cover blue"><FolderOpen size={35}/><strong>{typeLabel(p.project_type)}</strong></div><div className="project-card-body"><span className="project-status">{statusLabels[p.status]??p.status}</span><h2>{p.title}</h2><p>{p.owner_id===user?.id?'Tu proyecto':'Consulta de otro propietario'}</p><small>Actualizado: {new Date(p.updated_at).toLocaleString('es-PE')}</small><div className="project-card-actions"><Link className="secondary button-link" to={'/proyectos/'+p.id}>Abrir proyecto</Link></div></div></article>)}</section>
    {!result.loading&&!result.error&&<Paging offset={offset} count={result.data?.length??0} setOffset={setOffset}/>}</Page>
}
export function ProjectDetail() {
  const {id}=useParams(), {user}=useAuth(), navigate=useNavigate(), result=useResource<Project>(id?'/projects/'+id:null)
  const [title,setTitle]=useState(''), [busy,setBusy]=useState(false), [error,setError]=useState('')
  const project=result.data, owner=project?.owner_id===user?.id
  async function update(body:unknown) { setBusy(true);setError('');try{await api.request('/projects/'+id,{method:'PATCH',body});result.reload();setTitle('')}catch(e){setError((e as Error).message)}finally{setBusy(false)} }
  function open() { if(project){useProjectStore.getState().select(project);navigate(workflow('/dataset',project.id))} }
  return <Page><Link className="back-link" to="/proyectos">← Volver a proyectos</Link><ApiMessage {...result} retry={result.reload}/>{project&&<section className="panel resource-detail"><span className="eyebrow">{typeLabel(project.project_type)}</span><h1>{project.title}</h1><p>Estado: {statusLabels[project.status]??project.status}</p><p>{owner?'Este proyecto te pertenece.':'Puedes consultar este proyecto; su propietario conserva los permisos de edición.'}</p>
    <button className="primary" onClick={open}>Explorar proyecto <ArrowRight size={17}/></button>
    {owner&&<><form className="api-form" onSubmit={e=>{e.preventDefault();void update({title:title.trim()})}}><label>Nuevo nombre<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)}/></label><button className="secondary" disabled={busy||!title.trim()}>Guardar nombre</button></form><button className="secondary" disabled={busy} onClick={()=>void update({status:project.status==='archived'?'draft':'archived'})}>{project.status==='archived'?'Reabrir proyecto':'Archivar proyecto'}</button></>}
    <ApiMessage error={error}/></section>}</Page>
}
export function ClassroomsPage() {
  const {user}=useAuth(), [offset,setOffset]=useState(0), result=useResource<Classroom[]>('/classrooms?limit=25&offset='+offset)
  const manage=user?.role!=='student', catalog=useResource<Catalog>(manage?'/catalog':null)
  const [name,setName]=useState(''),[level,setLevel]=useState(''),[course,setCourse]=useState(''),[teacher,setTeacher]=useState(''),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  async function create(e:FormEvent) {e.preventDefault();if(busy)return;setBusy(true);setError('');try{
    await api.request('/classrooms',{method:'POST',body:{name:name.trim(),level_id:Number(level),course_id:course,academic_year:Number(date.slice(0,4)),course_start_date:date,...(user?.role==='admin'?{teacher_id:teacher.trim()}:{})}})
    setName('');setOffset(0);result.reload()
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  return <Page><section className="page-title"><div><h1>Salones</h1><p>{manage?'Administra tus salones y matrículas.':'Consulta los salones donde estás matriculado.'}</p></div></section>
    {manage&&<details className="panel resource-detail"><summary>Crear salón</summary><ApiMessage {...catalog} retry={catalog.reload}/><form className="api-form" onSubmit={create}>
      <label>Nombre<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>Nivel<select required value={level} onChange={e=>setLevel(e.target.value)}><option value="">Selecciona un nivel</option>{catalog.data?.levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <label>Curso<select required value={course} onChange={e=>setCourse(e.target.value)}><option value="">Selecciona un curso</option>{catalog.data?.courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      {user?.role==='admin'&&<label>ID del docente activo<input required value={teacher} onChange={e=>setTeacher(e.target.value)} placeholder="UUID del docente"/></label>}
      <label>Fecha de inicio<input required type="date" min="2000-01-01" max="2100-12-31" value={date} onChange={e=>setDate(e.target.value)}/></label>
      <button className="primary" disabled={busy||!name.trim()||!catalog.data}>{busy?'Creando…':'Crear salón'}</button><ApiMessage error={error}/></form></details>}
    <ApiMessage {...result} retry={result.reload}/>{result.data?.length===0&&<p className="api-message">No hay salones disponibles para tu cuenta.</p>}
    <div className="card-grid">{result.data?.map(r=><Link className="project-card" key={r.id} to={'/salones/'+r.id}><strong>{r.name}</strong><p>Año {r.academic_year}</p><small>{r.status==='active'?'Activo':'Archivado'}</small></Link>)}</div>
    {!result.loading&&!result.error&&<Paging offset={offset} count={result.data?.length??0} setOffset={setOffset}/>}</Page>
}
export function ClassroomDetail() {
  const {id}=useParams(),{user}=useAuth(), manage=user?.role!=='student'
  const room=useResource<Classroom>(id?'/classrooms/'+id:null), [offset,setOffset]=useState(0)
  const roster=useResource<Student[]>(manage&&id?'/classrooms/'+id+'/students?limit=25&offset='+offset:null)
  const lessons=useResource<Lesson[]>(room.data?.status==='active'?'/classrooms/'+id+'/lessons?limit=100':null)
  const progress=useResource<Progress[]>(user?.role==='student'?'/progress?limit=100':null)
  const [studentId,setStudentId]=useState(''),[selected,setSelected]=useState<Lesson|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  async function mutation(method:string,path:string,body?:unknown) {if(busy)return;setBusy(true);setError('');setNotice('');try{await api.request(path,{method,body});roster.reload();room.reload();setNotice('Cambio guardado.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  async function readSections(count:number) {if(!selected||busy)return;setBusy(true);setError('');try{await api.request('/progress/'+selected.id,{method:'PUT',body:{completed_sections:count}});progress.reload()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  const current=progress.data?.find(p=>p.lesson_id===selected?.id)
  return <Page><Link className="back-link" to="/salones">← Volver a salones</Link><ApiMessage {...room} retry={room.reload}/>{room.data&&<>
    <section className="panel resource-detail"><h1>{room.data.name}</h1><p>Año {room.data.academic_year} · {room.data.status==='active'?'Activo':'Archivado'}</p>
    {manage&&<button className="secondary" disabled={busy} onClick={()=>void mutation('PATCH','/classrooms/'+id,{status:room.data!.status==='active'?'archived':'active'})}>{room.data.status==='active'?'Archivar salón':'Reabrir salón'}</button>}
    <ApiMessage error={error}/>{notice&&<p role="status">{notice}</p>}</section>
    {manage&&<section className="panel resource-detail"><h2>Alumnos matriculados</h2><p>El alumno debe estar activo y tener consentimiento registrado.</p><form className="api-form" onSubmit={e=>{e.preventDefault();void mutation('POST','/classrooms/'+id+'/students',{student_id:studentId.trim()})}}><label>ID del alumno<input required value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="UUID del alumno"/></label><button className="primary" disabled={busy||room.data.status!=='active'}>Matricular alumno</button></form>
      <ApiMessage {...roster} retry={roster.reload}/><ul className="roster-list">{roster.data?.map(s=><li key={s.id}><span><strong>{s.display_name}</strong><small>{s.username} · {statusLabels[s.status]??s.status}</small></span><button className="secondary" disabled={busy} onClick={()=>void mutation('DELETE','/classrooms/'+id+'/students/'+s.id)}>Retirar matrícula</button></li>)}</ul>
      {roster.data?.length===0&&<p>Aún no hay alumnos matriculados.</p>}{!roster.loading&&!roster.error&&<Paging offset={offset} count={roster.data?.length??0} setOffset={setOffset}/>}</section>}
    {room.data.status==='active'&&<section className="panel resource-detail"><h2>Lecciones</h2><ApiMessage {...lessons} retry={lessons.reload}/>{lessons.data?.length===0&&<p>Este curso y nivel todavía no tienen lecciones publicadas.</p>}
      <div className="lesson-list">{lessons.data?.map(l=><button className="secondary" key={l.id} onClick={()=>setSelected(l)}>{l.title}</button>)}</div>
      {selected&&<article className="lesson-content"><h3>{selected.title}</h3><p>{selected.summary}</p>{user?.role==='student'&&<><ApiMessage {...progress} retry={progress.reload}/><p role="status">Avance guardado: {current?.progress_percent??0}%</p></>}
        {selected.content.sections.map((section,i)=><section className="lesson-section" key={i}><h4>{section.title??'Sección '+(i+1)}</h4>{section.text&&<p>{section.text}</p>}{section.questions?.map((q,j)=><div key={j}><p>{q.question}</p><ul>{q.options.map(option=><li key={option}>{option}</li>)}</ul></div>)}
          {user?.role==='student'&&<button className="secondary" disabled={busy||progress.loading||!!progress.error||(current?.completed_sections??0)>=i+1} onClick={()=>void readSections(i+1)}>{(current?.completed_sections??0)>=i+1?'Lectura registrada':'Registrar lectura hasta aquí'}</button>}
        </section>)}
      </article>}
    </section>}
  </>}</Page>
}
