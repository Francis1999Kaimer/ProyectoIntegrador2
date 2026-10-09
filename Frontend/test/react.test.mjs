import {test} from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import React,{act} from 'react'
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost:5173/'})
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','sessionStorage','Event','MouseEvent','CustomEvent'])globalThis[key]=dom.window[key]
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true})
globalThis.ResizeObserver=class {observe(){} unobserve(){} disconnect(){}}
globalThis.requestAnimationFrame=callback=>setTimeout(callback,0)
globalThis.cancelAnimationFrame=id=>clearTimeout(id)
globalThis.IS_REACT_ACT_ENVIRONMENT=true
let current
const PASSWORD='test-only-password-123'
const uid=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0')
const json=(status,body)=>new Response(status===204?null:JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
globalThis.fetch=async(url,options={})=>{
  const u=new URL(url),path=u.pathname,method=options.method??'GET',body=options.body?JSON.parse(options.body):undefined
  current.requests.push({path,method,body,headers:options.headers})
  if(path==='/deferred')return new Promise(resolve=>{current.deferred=()=>resolve(json(401,{}))})
  if(path==='/auth/login'){
    const user=current.users.find(v=>v.username===body.username&&v.password===body.password&&v.status==='active')
    if(!user)return json(401,{})
    const token='unit-token-'+user.id+'-'+(++current.sequence);current.tokens.set(token,user)
    const {password,...profile}=user;return json(200,{access_token:token,user:profile})
  }
  const token=options.headers?.Authorization?.slice(7),user=current.tokens.get(token)
  if(!user||current.expired||user.status!=='active')return json(401,{})
  if(path==='/auth/me'){const {password,...profile}=user;return json(200,profile)}
  if(path==='/auth/change-password'){
    if(body.current_password!==user.password)return json(401,{})
    user.password=body.new_password;user.must_change_password=false
    for(const [key,value]of current.tokens)if(value.id===user.id)current.tokens.delete(key)
    return json(200,{message:'ok'})
  }
  if(user.must_change_password)return json(403,{})
  if(path==='/catalog')return json(200,{levels:[{id:1,name:'Exploradores'}],courses:[{id:uid(90),title:'Curso piloto'}]})
  if(path==='/projects'){
    if(current.projectsError)return json(current.projectsError,{message:'driver secret'})
    if(method==='POST'){const p={id:uid(++current.sequence+100),...body,owner_id:user.id,status:'draft',updated_at:new Date().toISOString()};current.projects.push(p);return json(201,p)}
    return json(200,current.projects.filter(p=>user.role==='admin'||p.owner_id===user.id).slice(Number(u.searchParams.get('offset')??0),Number(u.searchParams.get('offset')??0)+Number(u.searchParams.get('limit')??25)))
  }
  if(path.startsWith('/projects/')){
    const [, , projectId, resource] = path.split('/'),p=current.projects.find(p=>p.id===projectId);if(!p)return json(404,{})
    if(resource==='workspace'){
      if(method==='GET'){const workspace=current.workspaces.get(projectId);return workspace?json(200,workspace):json(404,{})}
      const previous=current.workspaces.get(projectId),workspace={id:previous?.id??uid(++current.sequence+500),project_id:projectId,version:(previous?.version??0)+1,blocks:body.blocks};current.workspaces.set(projectId,workspace);return json(200,workspace)
    }
    if(resource==='simulations'){
      if(method==='GET')return json(200,current.simulations.filter(run=>run.project_id===projectId))
      const workspace=current.workspaces.get(projectId);if(!workspace)return json(400,{})
      const run={id:uid(++current.sequence+600),project_id:projectId,workspace_id:workspace.id,workspace_version:workspace.version,status:'completed',provider:'pedagogical-deterministic-v1',seed:42,created_at:new Date().toISOString(),accuracy:'0.9120',loss:'0.063360',parameters:{epochs:20},metrics:{train_accuracy:.93,validation_accuracy:.912,precision:.905,recall:.919,f1:.912,loss:.06336,epochs:20,confusion_matrix:[[88,12],[7,93]],prediction:{label:'Clase A',confidence:.88}}};current.simulations.unshift(run);return json(201,run)
    }
    if(method==='PATCH'){Object.assign(p,body);return json(200,p)}return json(200,p)
  }
  if(path==='/classrooms'){
    if(method==='POST'){const r={id:uid(++current.sequence+200),...body,teacher_id:body.teacher_id??user.id,status:'active'};current.rooms.push(r);return json(201,r)}
    return json(200,current.rooms.filter(r=>user.role==='admin'||r.teacher_id===user.id||current.enrolled.has(r.id+':'+user.id)))
  }
  if(path.startsWith('/classrooms/')){
    const [,,id,resource,studentId]=path.split('/'),room=current.rooms.find(r=>r.id===id)
    if(!room)return json(404,{})
    if(resource==='lessons')return json(200,[current.lesson])
    if(resource==='eligible-students')return json(200,current.users.filter(s=>s.role==='student'&&s.status==='active'&&!current.enrolled.has(id+':'+s.id)).map(({password,...s})=>s))
    if(resource==='students'){
      if(method==='POST'){current.enrolled.add(id+':'+body.student_id);return json(200,{})}
      if(method==='DELETE'){current.enrolled.delete(id+':'+studentId);return json(204)}
      return json(200,current.users.filter(s=>current.enrolled.has(id+':'+s.id)).map(({password,...s})=>s))
    }
    if(method==='PATCH')Object.assign(room,body)
    return json(200,room)
  }
  if(path==='/progress')return json(200,current.progress)
  if(path.startsWith('/progress/')){
    const p={id:uid(80),student_id:user.id,lesson_id:current.lesson.id,completed_sections:body.completed_sections,progress_percent:body.completed_sections*20,status:'in_progress'};current.progress=[p];return json(200,p)
  }
  if(path==='/students'){
    if(method==='POST'){const s={id:uid(++current.sequence+300),username:body.username,display_name:body.display_name,password:body.password,role:'student',status:'pending',must_change_password:true};current.users.push(s);const {password,...profile}=s;return json(201,profile)}
    return json(200,current.users.filter(u=>u.role==='student').map(({password,...u})=>u))
  }
  if(path==='/teachers'){
    if(method==='POST'){const t={id:uid(++current.sequence+400),username:body.username,display_name:body.display_name,password:body.password,role:'teacher',status:'active',must_change_password:true};current.users.push(t);const {password,...profile}=t;return json(201,profile)}
    return json(200,current.users.filter(u=>u.role==='teacher').map(({password,...u})=>u))
  }
  if(path.startsWith('/teachers/')){
    const id=path.split('/')[2],t=current.users.find(u=>u.id===id)
    if(path.endsWith('/status')){t.status=body.status;return json(200,{id:t.id,status:t.status})}
  }
  if(path.startsWith('/students/')){
    const [,,id,resource]=path.split('/'),s=current.users.find(u=>u.id===id)
    if(resource==='consents'){
      if(method==='GET')return json(200,current.consents.has(id)?{guardian_name:'Tutor sintetico DOM',consent_version:'unit-test-v1',consented_at:'2026-10-09T10:00:00Z'}:null)
      current.consents.add(id);return json(method==='DELETE'?204:201,{})
    }
    if(resource==='status'){if(body.status==='active'&&!current.consents.has(id))return json(409,{});s.status=body.status;return json(200,{id:s.id,status:s.status})}
  }
  return json(404,{})
}
const {createRoot}=await import('react-dom/client')
const {BrowserRouter}=await import('react-router')
const {AuthProvider,Gate,api,setToken,getToken,useProjectStore}=await import('../.test-build/ui/entry.js')
let root
function fresh(){
  current={users:['student','teacher','admin'].map((role,i)=>({id:uid(i+1),username:role,display_name:'Test '+role,role,status:'active',must_change_password:false,password:PASSWORD})),tokens:new Map(),sequence:0,requests:[],projects:[],progress:[],simulations:[],workspaces:new Map(),consents:new Set([uid(1)]),enrolled:new Set()}
  current.rooms=[{id:uid(50),teacher_id:uid(2),name:'Salon piloto',course_id:uid(90),level_id:1,academic_year:2026,status:'active'}]
  current.enrolled.add(uid(50)+':'+uid(1))
  current.lesson={id:uid(60),title:'Leccion piloto',summary:'Contenido publicado',content:{sections:Array.from({length:5},(_,i)=>({title:'Seccion '+(i+1),text:i===0?'<img src=x onerror=alert(1)>':'Texto de lectura'}))}}
  current.projects=[{id:uid(40),owner_id:uid(1),classroom_id:null,title:'Proyecto persistido',project_type:'image_classification',status:'draft',updated_at:'2026-10-09T10:00:00Z'}]
}
async function mount(path='/login'){
  window.history.replaceState(null,'',path);document.body.innerHTML='<div id="root"></div>'
  root=createRoot(document.getElementById('root'))
  await act(async()=>{root.render(React.createElement(BrowserRouter,null,React.createElement(AuthProvider,null,React.createElement(Gate))));await Promise.resolve()})
}
async function unmount(){if(root)await act(async()=>root.unmount());root=null}
async function fixture(fn){fresh();setToken(null);useProjectStore.getState().reset();try{await fn()}finally{await unmount();setToken(null);useProjectStore.getState().reset()}}
function field(text){const label=[...document.querySelectorAll('label')].find(l=>l.firstChild?.textContent.trim()===text);assert.ok(label,'Missing label: '+text);return label.querySelector('input,select')}
async function fill(text,value){const el=field(text);await act(async()=>{Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new window.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));await Promise.resolve()})}
async function click(text){const el=[...document.querySelectorAll('button,a,summary')].find(e=>e.textContent.trim()===text);assert.ok(el,'Missing action: '+text);await act(async()=>{el.dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true,button:0}));await Promise.resolve()})}
async function submit(label){const form=field(label).closest('form');await act(async()=>{form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await Promise.resolve()})}
async function settle(){ for(let i=0;i<5;i++) await act(async()=>{await Promise.resolve()}) }
async function login(role='student',password=PASSWORD){await fill('Usuario',role);await fill('Contraseña',password);await submit('Usuario');await settle()}
const text=()=>document.body.textContent

test('unauthenticated deep link redirects to login; incorrect password shows error; successful login preserves destination',()=>fixture(async()=>{
  await mount('/proyectos/'+uid(40));assert.equal(window.location.pathname,'/login')
  await login('student','incorrect');assert.match(text(),/Usuario o contraseña incorrectos/);assert.equal(field('Contraseña').value,'')
  await login();assert.equal(window.location.pathname,'/proyectos/'+uid(40));assert.match(text(),/Proyecto persistido/)
}))
test('public landing presents the product and sends visitors to login',()=>fixture(async()=>{
  await mount('/');assert.match(text(),/Entrena un modelo que/);await click('Iniciar sesión');assert.equal(window.location.pathname,'/login')
}))
test('project creation uses API, persists metadata, survives session restore and sends no caller owner id',()=>fixture(async()=>{
  await mount();await login();await click('Crear proyecto');await fill('Nombre del proyecto','Proyecto nuevo DOM');await click('Crear y cargar dataset')
  assert.equal(window.location.pathname,'/dataset');assert.match(text(),/Laboratorio de caracteres/)
  const created=current.projects.find(p=>p.title==='Proyecto nuevo DOM');assert.ok(created)
  assert.equal(new URLSearchParams(window.location.search).get('project'),created.id)
  assert.equal(current.requests.find(r=>r.method==='POST'&&r.path==='/projects').body.owner_id,undefined)
  const token=getToken();assert.ok(token);assert.equal(sessionStorage.length,1);assert.ok(!sessionStorage.getItem('aiblocks.session.token').includes(PASSWORD))
  await unmount();await mount('/dataset?project='+created.id);assert.equal(useProjectStore.getState().name,'Proyecto nuevo DOM');assert.match(text(),/Test student/)
  await click('Salir');assert.equal(getToken(),null);assert.equal(sessionStorage.length,0);assert.equal(useProjectStore.getState().id,null)
}))
test('teacher classroom form, roster enrollment and removal use real component event flow',()=>fixture(async()=>{
  await mount();await login('teacher');await click('Salones');await click('Crear salón');await fill('Nombre','Salon nuevo DOM');await fill('Nivel','1');await fill('Curso',uid(90));await submit('Nombre')
  const room=current.rooms.find(r=>r.name==='Salon nuevo DOM');assert.ok(room);assert.equal(room.teacher_id,uid(2))
  await click('Salon nuevo DOMAño 2026Activo');await fill('Alumno',uid(1));await submit('Alumno')
  assert.match(text(),/Test student/);assert.ok(current.enrolled.has(room.id+':'+uid(1)))
  await click('Retirar matrícula');assert.ok(!current.enrolled.has(room.id+':'+uid(1)))
}))
test('admin selects an active teacher instead of entering a classroom UUID',()=>fixture(async()=>{
  await mount();await login('admin');await click('Salones');await click('Crear salón');await fill('Nombre','Salon admin DOM');await fill('Nivel','1');await fill('Curso',uid(90));await fill('Docente responsable',uid(2));await submit('Nombre')
  const room=current.rooms.find(r=>r.name==='Salon admin DOM');assert.ok(room);assert.equal(room.teacher_id,uid(2))
}))
test('admin sees the responsible teacher in classroom details',()=>fixture(async()=>{
  await mount();await login('admin');await click('Salones');await click('Salon pilotoAño 2026Activo');await settle()
  assert.match(text(),/Docente responsable: Test teacher · teacher/)
}))
test('character-recognition workflow exposes one CNN model instead of generic simulated projects',()=>fixture(async()=>{
  await mount('/modelo?project='+uid(40));await login();await settle();assert.match(text(),/ÚNICO MODELO DISPONIBLE/)
  assert.match(text(),/CNN para caracteres individuales/);assert.ok(!text().includes('MobileNet'));assert.match(text(),/no hay modelos genéricos/i)
}))
test('student lesson content is escaped and reading progress is written and refreshed',()=>fixture(async()=>{
  await mount();await login();await click('Salones');await click('Salon pilotoAño 2026Activo');await click('Leccion piloto')
  assert.match(text(),/<img src=x onerror=alert\(1\)>/);assert.equal(document.querySelector('.lesson-content img'),null)
  await click('Registrar lectura hasta aquí');assert.equal(current.progress[0].completed_sections,1);assert.match(text(),/Avance guardado: 20%/)
  assert.equal(document.querySelector('.lesson-section button').disabled,true)
  assert.ok(!text().includes('Matricular alumno'))
}))
test('API unavailable provides retry; protected 401 clears session and returns to login',()=>fixture(async()=>{
  await mount();await login();current.projectsError=503;await click('Proyectos');assert.match(text(),/servicio no está disponible/);assert.ok(getToken())
  current.projectsError=0;await click('Reintentar');assert.match(text(),/Proyecto persistido/)
  current.expired=true;await click('Inicio');assert.equal(window.location.pathname,'/login');assert.equal(getToken(),null);assert.equal(sessionStorage.length,0)
}))
test('forced password change blocks business pages, wrong current password preserves valid session, success requires re-login',()=>fixture(async()=>{
  current.users[0].must_change_password=true;await mount();await login();assert.equal(window.location.pathname,'/cambiar-clave')
  await fill('Contraseña actual','incorrect');await fill('Nueva contraseña','new-test-only-password-123');await fill('Confirmar nueva contraseña','new-test-only-password-123');await submit('Contraseña actual')
  assert.equal(window.location.pathname,'/cambiar-clave');assert.ok(getToken());assert.match(text(),/contraseña actual/)
  await fill('Contraseña actual',PASSWORD);await fill('Nueva contraseña','new-test-only-password-123');await fill('Confirmar nueva contraseña','new-test-only-password-123');await submit('Contraseña actual')
  assert.equal(window.location.pathname,'/login');assert.equal(getToken(),null);await login('student','new-test-only-password-123');assert.equal(window.location.pathname,'/inicio');assert.match(text(),/Hola, Test student/)
}))
test('admin creates pending student, registers consent and activates through connected forms',()=>fixture(async()=>{
  await mount();await login('admin');await click('Alumnos');await click('Registrar alumno');await fill('Usuario','new_student');await fill('Nombre visible','Alumno DOM');await fill('Contraseña inicial',PASSWORD);await submit('Usuario')
  const student=current.users.find(u=>u.username==='new_student');assert.ok(student);assert.equal(student.status,'pending')
  const row=[...document.querySelectorAll('.roster-list li')].find(l=>l.textContent.includes('Alumno DOM'))
  await act(async()=>{row.querySelector('button').click();await Promise.resolve()})
  await fill('Nombre del tutor','Tutor sintetico DOM');await fill('Versión del consentimiento','unit-test-v1')
  await act(async()=>{document.querySelector('input[type=checkbox]').click();await Promise.resolve()});await submit('Nombre del tutor')
  assert.ok(current.consents.has(student.id))
  const refreshed=[...document.querySelectorAll('.roster-list li')].find(l=>l.textContent.includes('Alumno DOM'))
  await act(async()=>{[...refreshed.querySelectorAll('button')].find(b=>b.textContent==='Activar').click();await Promise.resolve()})
  assert.equal(student.status,'active')
}))

test('admin manages teacher accounts through connected forms',()=>fixture(async()=>{
  await mount();await login('admin');await click('Docentes');await click('Registrar docente');await fill('Usuario','new_teacher');await fill('Nombre visible','Docente DOM');await fill('Contraseña inicial',PASSWORD);await submit('Usuario')
  const teacher=current.users.find(u=>u.username==='new_teacher');assert.ok(teacher);assert.equal(teacher.role,'teacher');assert.equal(teacher.status,'active');assert.equal(teacher.must_change_password,true)
  let row=[...document.querySelectorAll('.roster-list li')].find(l=>l.textContent.includes('Docente DOM'));await act(async()=>{row.querySelector('button').click();await Promise.resolve()});assert.equal(teacher.status,'suspended')
  row=[...document.querySelectorAll('.roster-list li')].find(l=>l.textContent.includes('Docente DOM'));await act(async()=>{row.querySelector('button').click();await Promise.resolve()});assert.equal(teacher.status,'active')
}))


test('late 401 from an old request does not clear a newly authenticated session',()=>fixture(async()=>{
  await mount();await login();const old=getToken();const request=api.request('/deferred').catch(e=>e)
  await click('Salir');await login('teacher');const next=getToken();assert.notEqual(next,old)
  await act(async()=>{current.deferred();await request})
  assert.equal(getToken(),next);assert.match(text(),/Hola, Test teacher/)
}))
