import { useState, type FormEvent } from 'react'
import { api } from '../api/http'
import { useResource } from '../api/useResource'
import { statusLabels, type Teacher } from '../api/types'
import { ApiMessage, Page } from './AppShell'

export function TeachersPage() {
  const [offset,setOffset]=useState(0), result=useResource<Teacher[]>('/teachers?limit=25&offset='+offset)
  const [username,setUsername]=useState(''),[name,setName]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
  async function action(method:string,path:string,body?:unknown):Promise<boolean> {
    if(busy)return false;setBusy(true);setError('');setNotice('')
    try{await api.request(path,{method,body});result.reload();setNotice('Cambio guardado.');return true}catch(e){setError((e as Error).message);return false}finally{setBusy(false)}
  }
  async function create(e:FormEvent) {
    e.preventDefault()
    if(new TextEncoder().encode(password).length>72){setError('La contraseña no debe superar 72 bytes.');return}
    const saved=await action('POST','/teachers',{username:username.trim(),display_name:name.trim(),password})
    setPassword('');if(saved){setUsername('');setName('');setOffset(0)}
  }
  return <Page><section className="page-title"><div><h1>Docentes</h1><p>Registra y administra las cuentas docentes de la institución.</p></div></section>
    <ApiMessage error={error}/>{notice&&<p role="status">{notice}</p>}
    <details className="panel resource-detail"><summary>Registrar docente</summary><form className="api-form" onSubmit={create}>
      <label>Usuario<input required pattern="[A-Za-z0-9_.-]{3,64}" maxLength={64} value={username} onChange={e=>setUsername(e.target.value)} autoComplete="off"/></label>
      <label>Nombre visible<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>Contraseña inicial<input type="password" required minLength={12} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label>
      <p>La cuenta queda activa y el docente deberá cambiar esta contraseña en su primer ingreso.</p>
      <button className="primary" disabled={busy||!name.trim()}>Registrar docente</button></form></details>
    <ApiMessage {...result} retry={result.reload}/>{result.data?.length===0&&<p className="api-message">No hay docentes registrados.</p>}
    <ul className="roster-list panel resource-detail">{result.data?.map(t=><li key={t.id}><span><strong>{t.display_name}</strong><small>{t.username} · {statusLabels[t.status]??t.status}</small></span><button className="secondary" disabled={busy} onClick={()=>void action('PATCH','/teachers/'+t.id+'/status',{status:t.status==='active'?'suspended':'active'})}>{t.status==='active'?'Suspender':'Activar'}</button></li>)}</ul>
    {!result.loading&&!result.error&&<div className="actions between api-pagination"><button className="secondary" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-25))}>Anterior</button><span>Página {offset/25+1}</span><button className="secondary" disabled={(result.data?.length??0)<25} onClick={()=>setOffset(offset+25)}>Siguiente</button></div>}
  </Page>
}
