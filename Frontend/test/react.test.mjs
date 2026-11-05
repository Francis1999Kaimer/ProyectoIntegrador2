import {test} from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import React,{act} from 'react'
import JSZip from 'jszip'
import { File as NodeFile } from 'node:buffer'
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost:5173/'})
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','sessionStorage','Event','MouseEvent','CustomEvent'])globalThis[key]=dom.window[key]
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true})
globalThis.ResizeObserver=class {observe(){} unobserve(){} disconnect(){}}
globalThis.requestAnimationFrame=callback=>setTimeout(callback,0)
globalThis.cancelAnimationFrame=id=>clearTimeout(id)
globalThis.IS_REACT_ACT_ENVIRONMENT=true
dom.window.confirm=()=>true
dom.window.HTMLCanvasElement.prototype.getContext=()=>null
globalThis.createImageBitmap=async()=>({close(){},width:10,height:10})
const MIN_PER_CATEGORY=10
const stateOf=a=>Date.now()<new Date(a.starts_at).getTime()?'upcoming':Date.now()>new Date(a.ends_at).getTime()?'closed':'open'
const roomOf=a=>current.rooms.find(r=>r.id===a.classroom_id)
const taskView=(a,hide=false)=>({...a,description:hide?null:a.description,instructions:hide?null:a.instructions,state:stateOf(a)})
function detailOf(a,user){
  const room=roomOf(a),manage=user.role==='admin'||room.teacher_id===user.id,base={...taskView(a,!manage&&stateOf(a)==='upcoming'),classroom:{id:room.id,name:room.name,status:room.status},manage}
  if(manage)return {...base,submissions:current.users.filter(u=>u.role==='student'&&current.enrolled.has(room.id+':'+u.id)).map(u=>{const sub=current.submissions.find(x=>x.assignment_id===a.id&&x.student_id===u.id);const project=sub&&current.projects.find(x=>x.id===sub.project_id);return {student:{id:u.id,username:u.username,display_name:u.display_name},enrolled:true,submission:sub?{...sub,project:project?{id:project.id,title:project.title,project_type:project.project_type}:null,test_accuracy:null}:null}})}
  return {...base,submission:current.submissions.find(x=>x.assignment_id===a.id&&x.student_id===user.id)??null,projects:current.projects.filter(x=>x.owner_id===user.id&&x.classroom_id===room.id).map(({id,title,project_type,status})=>({id,title,project_type,status}))}
}
async function countZip(bytes){const zip=await JSZip.loadAsync(bytes),counts={};for(const e of Object.values(zip.files))if(!e.dir){const [label]=e.name.split('/');counts[label]=(counts[label]??0)+1}return counts}
const enough=lab=>Object.values(lab.counts).every(n=>n>=MIN_PER_CATEGORY)
function trainingState(p,user){
  const lab=current.labs.get(p.id),owner=p.owner_id===user.id,editable=owner&&p.status!=='archived',sufficient=!!lab&&enough(lab),runs=lab?.runs??[]
  let step=1;if(lab?.locked)step=!sufficient||!lab.test_percent?2:runs.length?5:!lab.config?3:4
  return {project_id:p.id,project_type:p.project_type,owner,editable,step,min_per_category:MIN_PER_CATEGORY,
    dataset:lab?{file_name:lab.file_name,labels:lab.labels,counts:lab.counts,samples:lab.samples,updated_at:lab.updated_at,locked:!!lab.locked,sufficient,problem:sufficient?null:'Cada categoría necesita al menos 10 ejemplos para entrenar.',can_replace:editable&&(!lab.locked||!sufficient)}:null,
    preparation:lab?.test_percent?{test_percent:lab.test_percent,split_seed:7}:null,config:lab?.config??null,runs,
    model:runs.length?{run_number:runs.at(-1).run_number,updated_at:runs.at(-1).created_at}:null}
}
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
  if(path==='/projects/draft'&&method==='POST'){
    const p={id:body.request_id,owner_id:user.id,classroom_id:body.classroom_id??null,title:body.title,project_type:body.project_type,status:'draft'}
    current.projects.push(p);return json(201,p)
  }
  if(path==='/projects'){
    if(current.projectsError)return json(current.projectsError,{message:'driver secret'})
    if(method==='POST'){const p={id:uid(++current.sequence+100),...body,owner_id:user.id,status:'draft',updated_at:new Date().toISOString()};current.projects.push(p);return json(201,p)}
    return json(200,current.projects.filter(p=>user.role==='admin'||p.owner_id===user.id).slice(Number(u.searchParams.get('offset')??0),Number(u.searchParams.get('offset')??0)+Number(u.searchParams.get('limit')??25)))
  }
  if(path.startsWith('/projects/')){
    const [, , projectId, resource, sub] = path.split('/'),p=current.projects.find(p=>p.id===projectId);if(!p)return json(404,{})
    const editable=p.owner_id===user.id&&p.status!=='archived',lab=current.labs.get(projectId)
    if(resource==='training'&&!sub&&method==='GET')return json(200,trainingState(p,user))
    if(resource==='dataset'&&sub==='file')return lab?new Response(lab.zip,{status:200,headers:{'Content-Type':'application/zip'}}):json(404,{})
    if(resource==='training'&&sub==='model-file')return lab?.model?new Response(lab.model,{status:200,headers:{'Content-Type':'application/zip'}}):json(404,{})
    if(resource==='dataset'&&!sub&&(method==='POST'||method==='PUT')){
      if(!editable)return json(404,{})
      if(method==='POST'&&lab)return json(409,{})
      if(method==='PUT'&&(!lab||lab.updated_at!==body.expected_updated_at||(lab.locked&&enough(lab))))return json(409,{})
      const zip=Buffer.from(body.archive_base64,'base64'),counts=await countZip(zip)
      current.labs.set(projectId,{file_name:body.file_name,labels:Object.keys(counts).sort((a,b)=>a.localeCompare(b)),counts,samples:body.samples,updated_at:new Date(Date.now()+(++current.sequence)*1000).toISOString(),locked:false,zip,runs:[],config:lab?.config??null})
      return json(method==='POST'?201:200,trainingState(p,user))
    }
    if(resource==='dataset'&&sub==='lock'){if(!editable)return json(404,{});if(!lab)return json(409,{});lab.locked=true;return json(201,trainingState(p,user))}
    if(resource==='training'&&sub==='preparation'){if(!editable)return json(404,{});if(!lab?.locked||!enough(lab))return json(409,{});lab.test_percent=body.test_percent;return json(200,trainingState(p,user))}
    if(resource==='training'&&sub==='config'){if(!editable)return json(404,{});if(!lab?.test_percent)return json(409,{});lab.config=body;return json(200,trainingState(p,user))}
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
  if(path==='/assignments/pending'){
    const now=Date.now()
    if(user.role==='student')return json(200,{tasks:current.assignments.filter(a=>stateOf(a)==='open'&&current.enrolled.has(a.classroom_id+':'+user.id)&&!current.submissions.some(s=>s.assignment_id===a.id&&s.student_id===user.id)).map(a=>({...taskView(a),classroom_name:roomOf(a).name})),to_grade:[]})
    const rows=current.assignments.filter(a=>user.role==='admin'||roomOf(a).teacher_id===user.id).map(a=>({...taskView(a),classroom_name:roomOf(a).name,ungraded:current.submissions.filter(s=>s.assignment_id===a.id&&s.grade===null).length})).filter(a=>a.ungraded)
    return json(200,{tasks:[],to_grade:rows})
  }
  if(path.startsWith('/assignments/')){
    const [,,taskId,resource,studentId]=path.split('/'),a=current.assignments.find(x=>x.id===taskId);if(!a)return json(404,{})
    const room=roomOf(a),manage=user.role==='admin'||room.teacher_id===user.id
    if(!manage&&!current.enrolled.has(room.id+':'+user.id))return json(404,{})
    if(resource==='submission'&&method==='PUT'){
      if(user.role!=='student')return json(403,{});if(stateOf(a)!=='open')return json(409,{})
      const project=current.projects.find(x=>x.id===body.project_id);if(!project||project.owner_id!==user.id||project.classroom_id!==room.id)return json(400,{})
      let sub=current.submissions.find(x=>x.assignment_id===a.id&&x.student_id===user.id);if(sub?.grade!=null)return json(409,{})
      if(!sub){sub={id:uid(++current.sequence+900),assignment_id:a.id,student_id:user.id,grade:null,feedback:null,graded_at:null};current.submissions.push(sub)}
      Object.assign(sub,{project_id:project.id,run_number:null,comment:body.comment??null,submitted_at:new Date().toISOString()})
      return json(200,detailOf(a,user))
    }
    if(resource==='submissions'&&method==='PUT'){
      if(!manage)return json(404,{});const sub=current.submissions.find(x=>x.assignment_id===a.id&&x.student_id===studentId);if(!sub)return json(404,{})
      if(body.grade<a.grade_min||body.grade>a.grade_max)return json(400,{})
      Object.assign(sub,{grade:body.grade,feedback:body.feedback??null,graded_at:new Date().toISOString()});return json(200,detailOf(a,user))
    }
    if(method==='PATCH'){if(!manage)return json(404,{});Object.assign(a,body);return json(200,taskView(a))}
    if(method==='DELETE'){if(!manage)return json(404,{});if(current.submissions.some(x=>x.assignment_id===a.id))return json(409,{});current.assignments.splice(current.assignments.indexOf(a),1);return json(204)}
    return json(200,detailOf(a,user))
  }
  if(path.startsWith('/users/')&&path.endsWith('/password')){
    const target=current.users.find(u=>u.id===path.split('/')[2]);if(user.role==='student')return json(403,{})
    const allowed=target&&(user.role==='admin'||(target.role==='student'&&current.rooms.some(r=>r.teacher_id===user.id&&current.enrolled.has(r.id+':'+target.id))))
    if(!allowed)return json(404,{});if(body.password.length<12)return json(400,{})
    target.password=body.password;target.must_change_password=body.require_password_change!==false
    for(const [key,value]of current.tokens)if(value.id===target.id)current.tokens.delete(key)
    return json(204)
  }
  if(path==='/classrooms'){
    if(method==='POST'){const r={id:uid(++current.sequence+200),...body,teacher_id:body.teacher_id??user.id,status:'active'};current.rooms.push(r);return json(201,r)}
    return json(200,current.rooms.filter(r=>user.role==='admin'||r.teacher_id===user.id||current.enrolled.has(r.id+':'+user.id)))
  }
  if(path.startsWith('/classrooms/')){
    const [,,id,resource,studentId]=path.split('/'),room=current.rooms.find(r=>r.id===id)
    if(!room)return json(404,{})
    if(resource==='lessons')return json(200,[current.lesson])
    if(resource==='assignments'){
      const manage=user.role==='admin'||room.teacher_id===user.id
      if(method==='POST'){if(!manage)return json(404,{});const a={id:uid(++current.sequence+800),classroom_id:id,...body,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};current.assignments.push(a);return json(201,taskView(a))}
      const own=current.assignments.filter(a=>a.classroom_id===id)
      if(manage)return json(200,own.map(a=>({...taskView(a),counts:{students:current.users.filter(u=>current.enrolled.has(id+':'+u.id)).length,submitted:current.submissions.filter(s=>s.assignment_id===a.id).length,graded:current.submissions.filter(s=>s.assignment_id===a.id&&s.grade!==null).length}})))
      return json(200,own.map(a=>({...taskView(a,stateOf(a)==='upcoming'),my_submission:current.submissions.find(s=>s.assignment_id===a.id&&s.student_id===user.id)??null})))
    }
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
    if(method==='POST'){
      if(body.guardian_authorized!==true)return json(400,{});if(user.role==='teacher'&&!current.rooms.some(r=>r.id===body.classroom_id&&r.teacher_id===user.id))return json(user.role==='teacher'&&!body.classroom_id?400:404,{})
      const s={id:uid(++current.sequence+300),username:body.username,display_name:body.display_name,password:body.password,role:'student',status:'active',must_change_password:body.require_password_change!==false,guardian:body.guardian_name??'No indicado'}
      current.users.push(s);current.consents.add(s.id);if(body.classroom_id)current.enrolled.add(body.classroom_id+':'+s.id);const {password,...profile}=s;return json(201,profile)
    }
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
const {AuthProvider,Gate,api,setToken,getToken,useProjectStore,buildModel,exportModel}=await import('../.test-build/ui/entry.js')
let root
function fresh(){
  for(const key of [...Object.keys(sessionStorage)])if(key.startsWith('aiblocks.login-throttle.'))sessionStorage.removeItem(key)
  current={assignments:[],submissions:[],users:['student','teacher','admin'].map((role,i)=>({id:uid(i+1),username:role,display_name:'Test '+role,role,status:'active',must_change_password:false,password:PASSWORD})),tokens:new Map(),sequence:0,requests:[],projects:[],labs:new Map(),progress:[],simulations:[],workspaces:new Map(),consents:new Set([uid(1)]),enrolled:new Set()}
  current.rooms=[{id:uid(50),teacher_id:uid(2),name:'Salon piloto',course_id:uid(90),level_id:1,academic_year:2026,status:'active'}]
  current.enrolled.add(uid(50)+':'+uid(1))
  current.lesson={id:uid(60),title:'Leccion piloto',summary:'Contenido publicado',content:{sections:Array.from({length:5},(_,i)=>({title:'Seccion '+(i+1),text:i===0?'<img src=x onerror=alert(1)>':'Texto de lectura'}))}}
  current.projects=[{id:uid(40),owner_id:uid(1),classroom_id:null,title:'Proyecto persistido',project_type:'character_recognition',status:'draft',updated_at:'2026-10-09T10:00:00Z'}]
}
async function mount(path='/login'){
  window.history.replaceState(null,'',path);document.body.innerHTML='<div id="root"></div>'
  root=createRoot(document.getElementById('root'))
  await act(async()=>{root.render(React.createElement(BrowserRouter,null,React.createElement(AuthProvider,null,React.createElement(Gate))));await Promise.resolve()})
}
async function unmount(){if(root)await act(async()=>root.unmount());root=null}
async function fixture(fn){fresh();setToken(null);useProjectStore.getState().reset();try{await fn()}finally{await unmount();setToken(null);useProjectStore.getState().reset()}}
function field(text){const label=[...document.querySelectorAll('label')].find(l=>l.firstChild?.textContent.trim()===text);assert.ok(label,'Missing label: '+text);return label.querySelector('input,select,textarea')}
async function fill(text,value){const el=field(text);await act(async()=>{Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new window.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));await Promise.resolve()})}
async function click(text){const el=[...document.querySelectorAll('button,a,summary')].find(e=>e.textContent.trim()===text);assert.ok(el,'Missing action: '+text);await act(async()=>{el.dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true,button:0}));await Promise.resolve()})}
async function submit(label){const form=field(label).closest('form');await act(async()=>{form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await Promise.resolve()})}
async function settle(){ for(let i=0;i<5;i++) await act(async()=>{await Promise.resolve()}) }
async function login(role='student',password=PASSWORD){await fill('Usuario',role);await fill('Contraseña',password);await submit('Usuario');await settle()}
const text=()=>document.body.textContent
async function waitFor(check,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){await act(async()=>{await new Promise(r=>setTimeout(r,25))});if(check())return}assert.fail('Tiempo agotado esperando: '+check)}
async function zipFile(counts,name='datos.zip'){const zip=new JSZip();for(const [label,n] of Object.entries(counts))for(let i=1;i<=n;i++)zip.file(label+'/'+i+'.png',new Uint8Array([1,2,3]));return new NodeFile([await zip.generateAsync({type:'uint8array'})],name,{type:'application/zip'})}
async function choose(file){const input=document.querySelector('input[aria-label="Dataset ZIP"]');assert.ok(input,'Falta el selector de ZIP');Object.defineProperty(input,'files',{value:[file],configurable:true});await act(async()=>{input.dispatchEvent(new window.Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,40))})}
const button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label)
async function seedProject({counts={A:10,B:10},locked=true,test_percent=20,config={epochs:8,learning_rate:0.001,batch_size:16,model_size:'small'},runs=[],model,type='image_classification'}={}){
  const p={id:uid(++current.sequence+700),owner_id:uid(1),classroom_id:uid(50),title:'Proyecto sembrado',project_type:type,status:'draft'};current.projects.push(p)
  const zip=Buffer.from(await (await zipFile(counts)).arrayBuffer())
  current.labs.set(p.id,{file_name:'datos.zip',labels:Object.keys(counts),counts,samples:Object.values(counts).reduce((a,b)=>a+b,0),updated_at:'2026-11-05T10:00:00.000Z',locked,zip,test_percent,config,runs,model})
  return p
}

test('unauthenticated deep link redirects to login; incorrect password shows error; successful login preserves destination',()=>fixture(async()=>{
  await mount('/proyectos/'+uid(40));assert.equal(window.location.pathname,'/login')
  await login('student','incorrect');assert.match(text(),/Usuario o contraseña incorrectos/);assert.equal(field('Contraseña').value,'')
  await login();assert.equal(window.location.pathname,'/proyectos/'+uid(40));assert.match(text(),/Proyecto persistido/)
}))
test('the login form temporarily blocks a username after three wrong passwords',()=>fixture(async()=>{
  await mount();await login('locked_user','incorrect');await login('locked_user','incorrect');await login('locked_user','incorrect')
  assert.match(text(),/3 intentos fallidos/);assert.match(text(),/60 segundos/)
  const button=[...document.querySelectorAll('button')].find(item=>item.textContent.includes('Espera'))
  assert.ok(button?.disabled)
}))
test('public landing presents the product and sends visitors to login',()=>fixture(async()=>{
  await mount('/');assert.match(text(),/Entrena modelos de IA que/);assert.match(text(),/AI Studio/);assert.ok(!text().includes('AI Blocks'))
  assert.equal(document.querySelectorAll('.landing-types li').length,6);assert.equal(document.querySelectorAll('.landing-steps li').length,7)
  await click('Iniciar sesión');assert.equal(window.location.pathname,'/login')
}))
test('new project screen selects each type and advances to dataset validation',()=>fixture(async()=>{
  await mount();await login();await click('Crear proyecto');await fill('Nombre del proyecto','Proyecto nuevo DOM')
  const choices=[...document.querySelectorAll('.project-type-option')]
  assert.equal(choices.length,6)
  const expected=[['Reconocedor de números','letras.zip'],['Clasificador de frutas','frutas.zip'],['Reconocedor de palmadas','sonidos.zip'],['Reconocedor de mano abierta y puño','gestos.zip'],['Reconocedor de brazos arriba y abajo','posturas.zip'],['Reconocedor de dibujos de casas','dibujos.zip']]
  for(let i=0;i<choices.length;i++){
    const choice=choices[i]
    assert.equal(choice.disabled,false)
    await act(async()=>{choice.click();await Promise.resolve()})
    assert.equal(choice.getAttribute('aria-pressed'),'true')
    assert.equal(choices.filter(item=>item.getAttribute('aria-pressed')==='true').length,1)
    const details=document.querySelector('.project-type-details')
    assert.ok(details.textContent.includes(expected[i][0]))
    assert.ok(details.textContent.includes(expected[i][1]))
    if(i>0)assert.match(details.textContent,/Formato propuesto/)
  }
  await click('Crear proyecto y siguiente')
  assert.equal(window.location.pathname,'/crear/datos')
  assert.match(text(),/PASO 1 · DATOS DE ENTRENAMIENTO/)
  assert.match(text(),/Clasificador de dibujos simples/)
  assert.ok(document.querySelector('input[aria-label="Dataset ZIP"]'))
  assert.ok(current.requests.some(r=>r.method==='POST'&&r.path==='/projects/draft'))
}))
test('teacher classroom form, roster enrollment and removal use real component event flow',()=>fixture(async()=>{
  await mount();await login('teacher');await click('Salones');await click('Crear salón');await fill('Nombre','Salon nuevo DOM');await fill('Nivel','1');await submit('Nombre')
  const room=current.rooms.find(r=>r.name==='Salon nuevo DOM');assert.ok(room);assert.equal(room.teacher_id,uid(2))
  await click('Salon nuevo DOMAño 2026Activo');await fill('Alumno',uid(1));await submit('Alumno')
  assert.match(text(),/Test student/);assert.ok(current.enrolled.has(room.id+':'+uid(1)))
  await click('Retirar matrícula');assert.ok(!current.enrolled.has(room.id+':'+uid(1)))
}))
test('admin selects an active teacher instead of entering a classroom UUID',()=>fixture(async()=>{
  await mount();await login('admin');await click('Salones');await click('Crear salón');await fill('Nombre','Salon admin DOM');await fill('Nivel','1');await fill('Docente responsable',uid(2));await submit('Nombre')
  const room=current.rooms.find(r=>r.name==='Salon admin DOM');assert.ok(room);assert.equal(room.teacher_id,uid(2))
}))
test('admin sees the responsible teacher in classroom details',()=>fixture(async()=>{
  await mount();await login('admin');await click('Salones');await click('Salon pilotoAño 2026Activo');await settle()
  assert.match(text(),/Docente responsable: Test teacher · teacher/)
}))
test('old character workflow routes open the project in the new flow',()=>fixture(async()=>{
  await mount('/modelo?project='+uid(40));await login();await settle()
  await waitFor(()=>window.location.pathname==='/crear/datos')
  assert.equal(new URLSearchParams(window.location.search).get('project'),uid(40))
  assert.match(text(),/PASO 1 · DATOS DE ENTRENAMIENTO/);assert.match(text(),/Selecciona tu archivo ZIP/)
}))
test('classroom detail no longer shows course lessons; students see the tasks section',()=>fixture(async()=>{
  await mount();await login();await click('Salones');await click('Salon pilotoAño 2026Activo');await settle()
  assert.ok(!text().includes('Lecciones'));assert.ok(!text().includes('Leccion piloto'));assert.match(text(),/Tareas/)
  assert.match(text(),/Este salón todavía no tiene tareas/);assert.ok(!text().includes('Matricular alumno'));assert.ok(!text().includes('Nueva tarea'))
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
test('admin creates an active student in one step with the guardian authorization',()=>fixture(async()=>{
  await mount();await login('admin');await click('Alumnos');await click('Registrar alumno')
  await fill('Usuario','new_student');await fill('Nombre visible','Alumno DOM');await fill('Contraseña inicial',PASSWORD);await fill('Nombre del padre, madre o tutor (opcional)','Tutor DOM')
  assert.equal(button('Crear alumno').disabled,true,'la casilla es obligatoria')
  const authorize=[...document.querySelectorAll('input[type=checkbox]')].find(c=>c.closest('label').textContent.includes('autorización'))
  await act(async()=>{authorize.click();await Promise.resolve()});await submit('Usuario');await settle()
  const student=current.users.find(u=>u.username==='new_student');assert.ok(student);assert.equal(student.status,'active');assert.equal(student.guardian,'Tutor DOM')
  assert.ok(current.consents.has(student.id));assert.equal(student.must_change_password,true);assert.match(text(),/Alumno creado/)
}))

test('teacher creates a student inside the classroom and resets the password of own students',()=>fixture(async()=>{
  await mount();await login('teacher');await click('Salones');await click('Salon pilotoAño 2026Activo');await settle()
  await click('Crear alumno en este salón');await fill('Usuario','nina');await fill('Nombre visible','Niña DOM');await fill('Contraseña inicial',PASSWORD)
  const checks=[...document.querySelectorAll('input[type=checkbox]')]
  await act(async()=>{checks.find(c=>c.closest('label').textContent.includes('autorización')).click();checks.find(c=>c.closest('label').textContent.includes('cambie la contraseña')).click();await Promise.resolve()})
  await submit('Usuario');await settle()
  const nina=current.users.find(u=>u.username==='nina');assert.ok(nina);assert.ok(current.enrolled.has(uid(50)+':'+nina.id));assert.equal(nina.must_change_password,false)
  await waitFor(()=>/Niña DOM/.test(document.querySelector('.roster-list')?.textContent??''))
  const row=[...document.querySelectorAll('.roster-list li')].find(l=>l.textContent.includes('Test student'))
  await act(async()=>{[...row.querySelectorAll('button')].find(b=>b.textContent==='Restablecer contraseña').click();await Promise.resolve()})
  await fill('Nueva contraseña','clave-nueva-alumno-1');await submit('Nueva contraseña');await settle()
  assert.equal(current.users[0].password,'clave-nueva-alumno-1');assert.match(text(),/Contraseña restablecida/)
}))

test('admin manages teacher accounts through connected forms',()=>fixture(async()=>{
  await mount();await login('admin');await click('Docentes');await click('Registrar docente');await fill('Usuario','new_teacher');await fill('Nombre visible','Docente DOM');await fill('Contraseña inicial',PASSWORD);await submit('Usuario')
  const teacher=current.users.find(u=>u.username==='new_teacher');assert.ok(teacher);assert.equal(teacher.role,'teacher');assert.equal(teacher.status,'active');assert.equal(teacher.must_change_password,true)
  const toggle=async label=>{const row=[...document.querySelectorAll('.roster-list li')].find(l=>l.textContent.includes('Docente DOM'));await act(async()=>{[...row.querySelectorAll('button')].find(b=>b.textContent===label).click();await Promise.resolve()})}
  await toggle('Suspender');assert.equal(teacher.status,'suspended')
  await toggle('Activar');assert.equal(teacher.status,'active')
  await toggle('Restablecer contraseña');await fill('Nueva contraseña','otra-clave-segura-1');await submit('Nueva contraseña');await settle()
  assert.equal(teacher.password,'otra-clave-segura-1');assert.equal(teacher.must_change_password,true);assert.match(text(),/Contraseña restablecida/)
}))


test('late 401 from an old request does not clear a newly authenticated session',()=>fixture(async()=>{
  await mount();await login();const old=getToken();const request=api.request('/deferred').catch(e=>e)
  await click('Salir');await login('teacher');const next=getToken();assert.notEqual(next,old)
  await act(async()=>{current.deferred();await request})
  assert.equal(getToken(),next);assert.match(text(),/Hola, Test teacher/)
}))

test('validated image dataset saves project and archive through the API',()=>fixture(async()=>{
  await mount();await login();await click('Crear proyecto');await fill('Nombre del proyecto','Proyecto con datos')
  const choice=[...document.querySelectorAll('.project-type-option')].find(item=>item.textContent.includes('Clasificador de imágenes'))
  await act(async()=>{choice.click();await Promise.resolve()});await click('Crear proyecto y siguiente')
  const zip=new JSZip()
  for(const name of ['A/1.png','A/2.png','B/1.jpg','B/2.jpg'])zip.file(name,new Uint8Array([1,2,3]))
  const file=new NodeFile([await zip.generateAsync({type:'uint8array'})],'datos.zip',{type:'application/zip'})
  globalThis.createImageBitmap=async()=>({close(){}})
  const input=document.querySelector('input[aria-label="Dataset ZIP"]')
  Object.defineProperty(input,'files',{value:[file],configurable:true})
  await act(async()=>{input.dispatchEvent(new window.Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,40))})
  assert.match(text(),/ZIP validado/)
  await click('Guardar dataset');await settle()
  assert.match(text(),/ZIP guardado/)
  const created=current.projects.find(p=>p.title==='Proyecto con datos')
  assert.equal(created.project_type,'image_classification')
  const req=current.requests.find(r=>r.path==='/projects/'+created.id+'/dataset')
  assert.equal(req.body.samples,4)
  assert.deepEqual(req.body.labels,['A','B']);assert.ok(req.body.archive_base64)
  await unmount();await mount('/crear/datos?project='+created.id);await settle()
  assert.match(text(),/ZIP guardado/);assert.match(text(),/datos.zip/)
  assert.equal(button('Siguiente · Paso 2').disabled,false)
  assert.ok(button('Reemplazar ZIP'))
  assert.equal(document.querySelector('input[aria-label="Dataset ZIP"]'),null)
}))

test('reopening a project with no dataset offers ZIP upload; archived projects cannot upload',()=>fixture(async()=>{
  await mount();await login();await click('Crear proyecto');await fill('Nombre del proyecto','Proyecto pendiente')
  await click('Crear proyecto y siguiente')
  const created=current.projects.find(p=>p.title==='Proyecto pendiente')
  assert.ok(created)
  await unmount();await mount('/crear/datos?project='+created.id);await settle()
  assert.match(text(),/Selecciona tu archivo ZIP/)
  assert.ok(!document.querySelector('button.primary') || document.querySelector('button.primary').disabled)
  created.status='archived'
  await unmount();await mount('/crear/datos?project='+created.id);await settle()
  assert.match(text(),/El proyecto está archivado/)
  assert.ok(document.querySelector('input[aria-label="Dataset ZIP"]').disabled)
}))

const run=(n,over={})=>({id:'run-'+n,run_number:n,created_at:'2026-11-05T11:00:00.000Z',duration_ms:42000,config:{epochs:5,learning_rate:0.001,batch_size:16,model_size:'medium'},hardware:{backend:'webgl',gpu:'GPU de prueba',cores:8,memory_gb:8},history:[1,2,3,4,5].map(e=>({epoch:e,accuracy:0.5+e/10,loss:1-e/10})),
  metrics:{labels:['A','B'],train_accuracy:0.95,train_loss:0.1,test_accuracy:0.75,test_loss:0.5,test_total:4,test_correct:3,per_class:[{label:'A',total:2,correct:1},{label:'B',total:2,correct:2}],confusion:[[1,1],[0,2]],misclassified:[{file:'A/1.png',actual:'A',predicted:'B',confidence:0.8}]},...over})

test('step 1 replaces the ZIP before step 2; step 2 blocks training until each category has enough examples',()=>fixture(async()=>{
  await mount();await login();await click('Crear proyecto');await fill('Nombre del proyecto','Proyecto reemplazo')
  const choice=[...document.querySelectorAll('.project-type-option')].find(item=>item.textContent.includes('Clasificador de imágenes'))
  await act(async()=>{choice.click();await Promise.resolve()});await click('Crear proyecto y siguiente')
  const created=current.projects.find(p=>p.title==='Proyecto reemplazo')
  await waitFor(()=>!!document.querySelector('input[aria-label="Dataset ZIP"]'))
  await choose(await zipFile({A:2,B:2}));await click('Guardar dataset');await waitFor(()=>/ZIP guardado/.test(text()))
  await click('Reemplazar ZIP');await choose(await zipFile({A:3,B:3},'nuevo.zip'));await click('Reemplazar dataset')
  await waitFor(()=>/nuevo.zip/.test(text())&&!button('Reemplazar dataset'))
  const put=current.requests.find(r=>r.method==='PUT'&&r.path==='/projects/'+created.id+'/dataset');assert.ok(put.body.expected_updated_at)
  assert.equal(current.labs.get(created.id).samples,6)
  await click('Siguiente · Paso 2');await waitFor(()=>window.location.pathname==='/crear/preparacion'&&/No se puede entrenar todavía/.test(text()))
  assert.ok(current.labs.get(created.id).locked)
  assert.match(text(),/A: 3 ejemplos \(faltan 7\)/)
  assert.equal(button('Siguiente · Paso 3').disabled,true)
  await click('Reemplazar ZIP');await waitFor(()=>window.location.pathname==='/crear/datos'&&!!document.querySelector('input[aria-label="Dataset ZIP"]'))
  await choose(await zipFile({A:10,B:12},'completo.zip'));await click('Reemplazar dataset')
  await waitFor(()=>/completo.zip/.test(text())&&!button('Reemplazar dataset'))
  assert.equal(current.labs.get(created.id).locked,false)
  await click('Siguiente · Paso 2');await waitFor(()=>window.location.pathname==='/crear/preparacion'&&!!button('Siguiente · Paso 3'))
  assert.ok(!/No se puede entrenar todavía/.test(text()));assert.equal(button('Siguiente · Paso 3').disabled,false)
  const radio=document.querySelector('input[name="test_percent"][value="30"]')
  await act(async()=>{radio.click();await Promise.resolve()})
  assert.match(text(),/Entrenamiento15 ejemplos/);assert.match(text(),/Prueba7 ejemplos/)
  await click('Siguiente · Paso 3');await waitFor(()=>window.location.pathname==='/crear/configuracion')
  assert.equal(current.labs.get(created.id).test_percent,30)
  // Con datos suficientes y pasado el paso 2, el ZIP ya no se puede reemplazar.
  await unmount();await mount('/crear/datos?project='+created.id);await waitFor(()=>/ZIP guardado/.test(text()))
  assert.equal(button('Reemplazar ZIP'),undefined);assert.match(text(),/quedó fijo/)
}))

test('step 3 shows recommended values for the detected hardware and saves the configuration',()=>fixture(async()=>{
  const p=await seedProject({config:null})
  await mount('/crear/configuracion?project='+p.id);await login();await waitFor(()=>!!document.querySelector('input[aria-label="Épocas"]'))
  assert.match(text(),/PASO 3 · CONFIGURACIÓN DEL ENTRENAMIENTO/);assert.match(text(),/Backend de TensorFlow.js/);assert.match(text(),/CPU/)
  assert.equal(document.querySelector('input[aria-label="Épocas"]').value,'8')
  assert.match(text(),/Adam/);assert.match(text(),/Conv2D \(4 filtros/)
  await waitFor(()=>!/Midiendo/.test(text()))
  assert.match(text(),/Tiempo estimado por época/)
  await fill('Learning rate','0.003')
  await click('Siguiente · Paso 4');await waitFor(()=>window.location.pathname==='/crear/entrenar')
  assert.deepEqual(current.labs.get(p.id).config,{epochs:8,learning_rate:0.003,batch_size:16,model_size:'small'})
  await waitFor(()=>/Entrenar 8 épocas/.test(text()))
  assert.match(text(),/Configuración usada/);assert.match(text(),/0\.003/)
}))

test('step 5 shows test results, confusions, diagnosis and the training history; viewers cannot retrain',()=>fixture(async()=>{
  const first=run(1,{metrics:{...run(1).metrics,test_accuracy:0.5,test_correct:2,confusion:[[1,1],[1,1]],per_class:[{label:'A',total:2,correct:1},{label:'B',total:2,correct:1}]}})
  const p=await seedProject({runs:[first,run(2)]})
  await mount('/crear/evaluar?project='+p.id);await login();await waitFor(()=>/Resultados con el conjunto de prueba/.test(text()))
  assert.match(text(),/75\.0\s%/);assert.match(text(),/Acertó 3 de 4 ejemplos de prueba/);assert.match(text(),/Posible sobreajuste/)
  assert.match(text(),/A se confundió con B 1 vez/);assert.match(text(),/Entrenamiento 2 de 2/)
  assert.ok(document.querySelector('.confusion-table'));assert.equal(document.querySelectorAll('.training-stepper li').length,7)
  await click('Ver');assert.match(text(),/Entrenamiento 1 de 2/)
  await click('Cambiar configuración y volver a entrenar');await waitFor(()=>window.location.pathname==='/crear/configuracion')
  await unmount();setToken(null)
  await mount('/crear/evaluar?project='+p.id);await login('teacher');await waitFor(()=>/Resultados con el conjunto de prueba/.test(text()))
  assert.equal(button('Cambiar configuración y volver a entrenar'),undefined)
}))

test('step 6 loads the last model and offers the inputs for the project type and the download',()=>fixture(async()=>{
  const model=buildModel('rgb64',2,{model_size:'small',learning_rate:0.001})
  const archive=Buffer.from(await (await exportModel(model,{labels:['A','B']})).arrayBuffer());model.dispose()
  const p=await seedProject({runs:[run(1)],model:archive})
  await mount('/crear/probar?project='+p.id);await login();await waitFor(()=>!!button('Seleccionar imagen'))
  assert.match(text(),/PASO 6 · PRUEBA/);assert.match(text(),/modelo del entrenamiento 1/)
  assert.ok(button('Usar cámara'));assert.ok(button('Descargar modelo'))
  assert.ok(current.requests.some(r=>r.path==='/projects/'+p.id+'/training/model-file'))
}))

test('opening a project continues at the last step reached; later steps redirect back',()=>fixture(async()=>{
  const p=await seedProject({runs:[run(1)]})
  await mount('/proyectos/'+p.id);await login();await waitFor(()=>!!button('Continuar proyecto'));await click('Continuar proyecto')
  await waitFor(()=>window.location.pathname==='/crear/evaluar')
  const q=await seedProject({config:null});await unmount();await mount('/crear/entrenar?project='+q.id)
  await waitFor(()=>window.location.pathname==='/crear/configuracion')
}))


test('teacher creates a task; the student submits a project from the shortcut flow; the teacher grades and the student sees the grade',()=>fixture(async()=>{
  await mount();await login('teacher');await click('Salones');await click('Salon pilotoAño 2026Activo');await settle()
  await click('Nueva tarea');await fill('Título','Clasificador de frutas');await fill('Descripción','Entrena un modelo de frutas.');await fill('Consigna','Usa tres frutas y prueba el modelo.')
  assert.equal(field('Nota mínima').value,'0');assert.equal(field('Nota máxima').value,'20')
  await submit('Título');await settle()
  const task=current.assignments[0];assert.ok(task);assert.equal(task.instructions,'Usa tres frutas y prueba el modelo.');assert.equal(task.grade_max,20)
  assert.ok(new Date(task.ends_at)>new Date(task.starts_at))
  await waitFor(()=>/Entregas 0 de 1/.test(text()))
  await click('Salir');await login();await click('Inicio');await settle()
  await waitFor(()=>/Tareas pendientes/.test(text())&&/Clasificador de frutas/.test(text()))
  await click('Salones');await click('Salon pilotoAño 2026Activo');await settle()
  await waitFor(()=>/Pendiente de entrega/.test(text()))
  const card=[...document.querySelectorAll('a.task-card')].find(a=>a.textContent.includes('Clasificador de frutas'));await act(async()=>{card.dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true,button:0}));await Promise.resolve()})
  await waitFor(()=>/Mi entrega/.test(text()));assert.match(text(),/Aún no tienes proyectos en este salón/);assert.match(text(),/Usa tres frutas/)
  await click('Crear proyecto para esta tarea');await waitFor(()=>window.location.pathname==='/crear')
  assert.equal(new URLSearchParams(window.location.search).get('salon'),uid(50))
  await waitFor(()=>document.querySelector('select')?.value===uid(50));await fill('Nombre del proyecto','Mis frutas');await click('Crear proyecto y siguiente')
  await waitFor(()=>window.location.pathname==='/crear/datos')
  const project=current.projects.find(p=>p.title==='Mis frutas');assert.equal(project.classroom_id,uid(50))
  await unmount();await mount('/salones/'+uid(50)+'/tareas/'+task.id);await settle()
  await waitFor(()=>!!button('Entregar proyecto'));await fill('Descripción de la entrega (opcional)','Usé manzanas');await click('Entregar proyecto');await settle()
  await waitFor(()=>/Entregaste/.test(text()))
  assert.equal(current.submissions[0].project_id,project.id);assert.equal(current.submissions[0].comment,'Usé manzanas')
  await click('Salir');await login('teacher');await click('Inicio');await waitFor(()=>/Entregas por calificar/.test(text())&&/1 por calificar/.test(text()))
  await unmount();await mount('/salones/'+uid(50)+'/tareas/'+task.id);await settle()
  await waitFor(()=>/Por calificar/.test(text()));assert.match(text(),/Mis frutas/);assert.match(text(),/Usé manzanas/)
  await fill('Nota (0 a 20)','17.5');await fill('Comentario (opcional)','Muy bien');await click('Guardar nota');await settle()
  await waitFor(()=>/Nota: 17\.5/.test(text()));assert.equal(current.submissions[0].grade,17.5)
  await click('Salir');await login();await unmount();await mount('/salones/'+uid(50)+'/tareas/'+task.id);await settle()
  await waitFor(()=>/Nota: 17\.5 \/ 20/.test(text()));assert.match(text(),/Muy bien/);assert.equal(button('Actualizar entrega'),undefined)
}))
