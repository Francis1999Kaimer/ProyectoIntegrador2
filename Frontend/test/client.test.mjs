import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ApiClient,ApiError} from '../.test-build/ui/entry.js'
const response=(status,body)=>new Response(status===204?null:JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
test('HTTP client sends Bearer, JSON and no cookies; login omits Bearer',async()=>{
  const calls=[]
  const client=new ApiClient('http://localhost:3000/',()=> 'token',()=>{},async(url,options)=>{calls.push({url,options});return response(200,{ok:true})})
  await client.request('/projects',{method:'POST',body:{title:'Project'}})
  assert.equal(calls[0].url,'http://localhost:3000/projects');assert.equal(calls[0].options.headers.Authorization,'Bearer token')
  assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.redirect,'error')
  assert.equal(calls[0].options.body,JSON.stringify({title:'Project'}))
  await client.request('/auth/login',{auth:false,method:'POST',body:{username:'test',password:'test-only'}})
  assert.equal(calls[1].options.headers.Authorization,undefined)
})
test('401 invalidates captured session; login and password mistakes do not prematurely invalidate',async()=>{
  const expired=[];const client=new ApiClient('http://localhost',()=> 'old-token',token=>expired.push(token),async()=>response(401,{message:'driver secret'}))
  await assert.rejects(client.request('/projects'),e=>e instanceof ApiError&&e.status===401)
  assert.deepEqual(expired,['old-token']);expired.length=0
  await assert.rejects(client.request('/auth/login',{auth:false}),/Usuario o contraseña incorrectos/)
  await assert.rejects(client.request('/auth/change-password',{invalidateSession:false}),/contraseña actual/)
  assert.deepEqual(expired,[])
})
test('HTTP statuses are actionable and do not expose raw server messages',async()=>{
  for(const status of [400,403,404,409,413,429,500,503]){
    const client=new ApiClient('http://localhost',()=>null,()=>{},async()=>response(status,{message:'mysql://user:secret@host/db'}))
    await assert.rejects(client.request('/projects'),e=>e instanceof ApiError&&e.status===status&&!/mysql|secret/.test(e.message))
  }
})
test('204 succeeds without JSON; malformed successes and transport failures become safe errors',async()=>{
  const empty=new ApiClient('http://localhost',()=>null,()=>{},async()=>response(204))
  assert.equal(await empty.request('/resource',{method:'DELETE'}),undefined)
  for(const transport of [async()=>new Response('<html>bad gateway</html>'),async()=>{throw Error('private network details')}]){
    await assert.rejects(new ApiClient('http://localhost',()=>null,()=>{},transport).request('/projects'),e=>e.status===0&&!/private|html/.test(e.message))
  }
})
test('abort and timeout terminate requests; client rejects credential-bearing URLs and foreign paths',async()=>{
  const transport=(_url,{signal})=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true});if(signal.aborted)reject(new DOMException('aborted','AbortError'))})
  const client=new ApiClient('http://localhost',()=>null,()=>{},transport,10)
  await assert.rejects(client.request('/slow'),e=>e.status===0)
  const controller=new AbortController();controller.abort()
  await assert.rejects(client.request('/slow',{signal:controller.signal}),e=>e.name==='AbortError')
  for(const base of ['file:///tmp','http://user:password@localhost','http://localhost/?secret=x'])assert.throws(()=>new ApiClient(base,()=>null,()=>{}))
  await assert.rejects(client.request('//foreign-host/path'),/Ruta API inválida/)
})
