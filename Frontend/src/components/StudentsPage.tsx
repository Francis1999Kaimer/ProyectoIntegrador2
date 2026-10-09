import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { api } from '../api/http'
import { ApiError } from '../api/client'
import { useResource } from '../api/useResource'
import { statusLabels, type Consent, type Student } from '../api/types'
import { ApiMessage, Page } from './AppShell'
export function StudentsPage() {
  const {user}=useAuth(), admin=user?.role==='admin', [offset,setOffset]=useState(0)
  const result=useResource<Student[]>('/students?limit=25&offset='+offset)
  const [username,setUsername]=useState(''),[name,setName]=useState(''),[password,setPassword]=useState(''),[selected,setSelected]=useState<Student|null>(null)
  const [guardian,setGuardian]=useState(''),[version,setVersion]=useState(''),[confirmed,setConfirmed]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
  const consentInfo=useResource<Consent | null>(admin&&selected?'/students/'+selected.id+'/consents/current':null)
  async function action(method:string,path:string,body?:unknown,conflictMessage?:string):Promise<boolean> {
    if(busy)return false;setBusy(true);setError('');setNotice('')
    try{await api.request(path,{method,body});result.reload();setNotice('Cambio guardado.');return true}catch(e){setError(e instanceof ApiError&&e.status===409&&conflictMessage?conflictMessage:(e as Error).message);return false}finally{setBusy(false)}
  }
  async function create(e:FormEvent) {e.preventDefault();if(new TextEncoder().encode(password).length>72){setError('La contraseña no debe superar 72 bytes.');return}
    const saved=await action('POST','/students',{username:username.trim(),display_name:name.trim(),password});setPassword('');if(saved){setUsername('');setName('');setOffset(0)}
  }
  async function consent(e:FormEvent) {e.preventDefault();if(!selected||!confirmed)return
    if(await action('POST','/students/'+selected.id+'/consents',{guardian_name:guardian.trim(),consent_version:version.trim()})){setGuardian('');setVersion('');setConfirmed(false);consentInfo.reload()}
  }
  async function revokeConsent() { if(!selected)return; if(await action('DELETE','/students/'+selected.id+'/consents/current')) consentInfo.reload() }
  return <Page><section className="page-title"><div><h1>Alumnos</h1><p>{admin?'Registra cuentas y gestiona su estado y consentimiento.':'Alumnos matriculados en tus salones.'}</p></div></section>
    <ApiMessage error={error}/>{notice&&<p role="status">{notice}</p>}
    {admin&&<details className="panel resource-detail"><summary>Registrar alumno</summary><form className="api-form" onSubmit={create}>
      <label>Usuario<input required pattern="[A-Za-z0-9_.-]{3,64}" maxLength={64} value={username} onChange={e=>setUsername(e.target.value)} autoComplete="off"/></label>
      <label>Nombre visible<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>Contraseña inicial<input type="password" required minLength={12} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label>
      <p>La cuenta queda pendiente. Para activarla, registra consentimiento. El alumno deberá cambiar su contraseña al ingresar.</p>
      <button className="primary" disabled={busy||!name.trim()}>Registrar alumno</button></form></details>}
    <ApiMessage {...result} retry={result.reload}/>{result.data?.length===0&&<p className="api-message">No hay alumnos disponibles para tu cuenta.</p>}
    <ul className="roster-list panel resource-detail">{result.data?.map(s=><li key={s.id}><span><strong>{s.display_name}</strong><small>{s.username} · {statusLabels[s.status]??s.status}</small><code className="student-id">{s.id}</code></span>{admin&&<div><button className="secondary" disabled={busy} onClick={()=>{setSelected(s);setGuardian('');setVersion('');setConfirmed(false)}}>Consentimiento</button><button className="secondary" disabled={busy} onClick={()=>void action('PATCH','/students/'+s.id+'/status',{status:s.status==='active'?'suspended':'active'},s.status==='active'?undefined:'No se puede activar a este alumno sin un consentimiento vigente. Regístralo primero desde “Consentimiento”.')}>{s.status==='active'?'Suspender':'Activar'}</button></div>}</li>)}</ul>
    {!result.loading&&!result.error&&<div className="actions between api-pagination"><button className="secondary" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-25))}>Anterior</button><span>Página {offset/25+1}</span><button className="secondary" disabled={(result.data?.length??0)<25} onClick={()=>setOffset(offset+25)}>Siguiente</button></div>}
    {admin&&selected&&<section className="panel resource-detail"><h2>Consentimiento de {selected.display_name}</h2><ApiMessage {...consentInfo} retry={consentInfo.reload}/>{!consentInfo.loading&&!consentInfo.error&&(consentInfo.data?<dl className="consent-summary"><div><dt>Estado</dt><dd>Vigente</dd></div><div><dt>Tutor</dt><dd>{consentInfo.data.guardian_name}</dd></div><div><dt>Versión</dt><dd>{consentInfo.data.consent_version}</dd></div><div><dt>Registrado</dt><dd>{new Date(consentInfo.data.consented_at).toLocaleString('es-PE')}</dd></div></dl>:<p className="consent-empty">No hay un consentimiento vigente para este alumno.</p>)}{!consentInfo.loading&&!consentInfo.data&&<form className="api-form" onSubmit={consent}>
      <label>Nombre del tutor<input required maxLength={120} value={guardian} onChange={e=>setGuardian(e.target.value)}/></label>
      <label>Versión del consentimiento<input required maxLength={32} value={version} onChange={e=>setVersion(e.target.value)} placeholder="Ej. consentimiento-v1"/></label>
      <label><span><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Tengo la evidencia de consentimiento para este registro.</span></label>
      <button className="primary" disabled={busy||!confirmed||!guardian.trim()||!version.trim()}>Registrar consentimiento</button></form>}
      <p>Revocar el consentimiento suspende la cuenta y bloquea su sesión.</p><button className="secondary" disabled={busy||!consentInfo.data} onClick={()=>void revokeConsent()}>Revocar consentimiento y suspender</button>
      <button className="secondary" onClick={()=>setSelected(null)}>Cerrar</button></section>}
  </Page>
}
