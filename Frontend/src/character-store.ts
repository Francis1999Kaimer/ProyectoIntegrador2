import JSZip from 'jszip'
import * as tf from '@tensorflow/tfjs'

export type CharacterSample = { label: string; pixels: number[] }
export type CharacterDataset = { projectId: string; labels: string[]; samples: CharacterSample[]; updatedAt: string }
export type CharacterResult = { projectId: string; labels: string[]; epochs: number; accuracy: number; loss: number; history: Array<{ epoch: number; accuracy: number; loss: number }>; updatedAt: string }
const DB='aiblocks-character-lab', STORE='records'
const memory = new Map<string, unknown>()
function open(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function get<T>(key:string){if(typeof indexedDB==='undefined')return memory.get(key) as T|undefined;const db=await open();return new Promise<T|undefined>((resolve,reject)=>{const r=db.transaction(STORE).objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function put(key:string,value:unknown){if(typeof indexedDB==='undefined'){memory.set(key,value);return}const db=await open();return new Promise<void>((resolve,reject)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).put(value,key);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)})}
async function drop(key:string){if(typeof indexedDB==='undefined'){memory.delete(key);return}const db=await open();return new Promise<void>((resolve,reject)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).delete(key);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)})}
export const datasetKey=(id:string)=>'dataset:'+id
export const resultKey=(id:string)=>'result:'+id
export const loadDataset=(id:string)=>get<CharacterDataset>(datasetKey(id))
export const loadResult=(id:string)=>get<CharacterResult>(resultKey(id))
export const modelUrl=(id:string)=>'indexeddb://aiblocks-character-'+id
export const saveDataset=(data:CharacterDataset)=>put(datasetKey(data.projectId),data)
export const saveResult=(data:CharacterResult)=>put(resultKey(data.projectId),data)

async function pixels(blob:Blob){
  const bitmap=await createImageBitmap(blob), canvas=document.createElement('canvas'); canvas.width=28;canvas.height=28
  const ctx=canvas.getContext('2d',{willReadFrequently:true}); if(!ctx) throw new Error('No se pudo procesar una imagen.')
  ctx.drawImage(bitmap,0,0,28,28); bitmap.close(); const data=ctx.getImageData(0,0,28,28).data
  const raw:number[]=[]; for(let i=0;i<data.length;i+=4) raw.push((data[i]*.299+data[i+1]*.587+data[i+2]*.114)/255)
  const mean=raw.reduce((a,b)=>a+b,0)/raw.length; return mean>.5?raw.map(v=>1-v):raw
}
export async function importZip(projectId:string,file:Blob,onProgress:(done:number,total:number)=>void,updatedAt=new Date().toISOString()){
  const zip=await JSZip.loadAsync(file); const entries=Object.values(zip.files).filter(f=>!f.dir&&!f.name.startsWith('__MACOSX/'))
  const valid=entries.filter(f=>/\.(png|jpe?g)$/i.test(f.name)&&f.name.split('/').filter(Boolean).length>=2)
  if(!valid.length) throw new Error('El ZIP debe contener PNG o JPG dentro de una carpeta por etiqueta.')
  const samples:CharacterSample[]=[]; for(let i=0;i<valid.length;i++){const item=valid[i],parts=item.name.split('/').filter(Boolean),label=parts[parts.length-2].trim();if(!label)continue;samples.push({label,pixels:await pixels(await item.async('blob'))});onProgress(i+1,valid.length)}
  const labels=[...new Set(samples.map(s=>s.label))].sort((a,b)=>a.localeCompare(b)); if(labels.length<2)throw new Error('Se necesitan al menos dos carpetas de etiquetas.');if(samples.length<12)throw new Error('Carga al menos 12 imÃ¡genes para una demostraciÃ³n Ãºtil.')
  if(labels.some(label=>samples.filter(s=>s.label===label).length<2))throw new Error('Cada etiqueta necesita al menos dos imÃ¡genes.')
  const data={projectId,labels,samples,updatedAt};await saveDataset(data);return data
}
function split(data:CharacterDataset){const ordered=[...data.samples].sort((a,b)=>a.label.localeCompare(b.label));const train:CharacterSample[]=[],test:CharacterSample[]=[];for(const label of data.labels){const own=ordered.filter(s=>s.label===label);const cut=Math.max(1,Math.floor(own.length*.8));train.push(...own.slice(0,cut));test.push(...own.slice(cut));}return {train,test:test.length?test:train}}
function tensors(samples:CharacterSample[],labels:string[]){const xs=tf.tensor4d(samples.flatMap(s=>s.pixels),[samples.length,28,28,1]);const ys=tf.oneHot(tf.tensor1d(samples.map(s=>labels.indexOf(s.label)),'int32'),labels.length);return {xs,ys}}
export async function train(projectId:string,epochs:number,onEpoch:(info:{epoch:number;accuracy:number;loss:number})=>void){
  const data=await loadDataset(projectId);if(!data)throw new Error('Primero carga un dataset ZIP.')
  const {train,test}=split(data),a=tensors(train,data.labels),b=tensors(test,data.labels);let model:tf.LayersModel|undefined
  try { await tf.io.removeModel(modelUrl(projectId)).catch(()=>undefined); model=tf.sequential({layers:[tf.layers.conv2d({inputShape:[28,28,1],filters:8,kernelSize:3,activation:'relu'}),tf.layers.maxPooling2d({poolSize:2}),tf.layers.conv2d({filters:16,kernelSize:3,activation:'relu'}),tf.layers.flatten(),tf.layers.dense({units:32,activation:'relu'}),tf.layers.dense({units:data.labels.length,activation:'softmax'})]});model.compile({optimizer:tf.train.adam(.001),loss:'categoricalCrossentropy',metrics:['accuracy']});const history:CharacterResult['history']=[]
    await model.fit(a.xs,a.ys,{epochs,batchSize:Math.min(16,train.length),validationData:[b.xs,b.ys],callbacks:{onEpochEnd:async(epoch,logs)=>{const info={epoch:epoch+1,accuracy:Number(logs?.val_acc??logs?.acc??0),loss:Number(logs?.val_loss??logs?.loss??0)};history.push(info);onEpoch(info)}}})
    const last=history.at(-1)!;const result={projectId,labels:data.labels,epochs,accuracy:last.accuracy,loss:last.loss,history,updatedAt:new Date().toISOString()};await model.save(modelUrl(projectId));await saveResult(result);return result
  } finally {a.xs.dispose();a.ys.dispose();b.xs.dispose();b.ys.dispose();model?.dispose()}
}
export async function exportModelArchive(projectId:string){
  const model=await tf.loadLayersModel(modelUrl(projectId));
  try { let archive:Blob|undefined;await model.save(tf.io.withSaveHandler(async artifacts=>{const raw=artifacts.weightData;if(!raw)throw new Error('No se encontraron los pesos del modelo.');const weights=raw instanceof ArrayBuffer?raw:await new Blob(raw as BlobPart[]).arrayBuffer();const zip=new JSZip();zip.file('model.json',JSON.stringify({format:'layers-model',generatedBy:`TensorFlow.js v${tf.version.tfjs}`,convertedBy:null,modelTopology:artifacts.modelTopology,weightsManifest:[{paths:['weights.bin'],weights:artifacts.weightSpecs}]}));zip.file('weights.bin',weights);archive=await zip.generateAsync({type:'blob',compression:'DEFLATE'});return {modelArtifactsInfo:{dateSaved:new Date(),modelTopologyType:'JSON',modelTopologyBytes:0,weightSpecsBytes:0,weightDataBytes:weights.byteLength}}}));if(!archive)throw new Error('No se pudo preparar el modelo para guardarlo.');return archive } finally {model.dispose()}
}
export async function importModelArchive(projectId:string,file:Blob){
  const zip=await JSZip.loadAsync(file), modelEntry=zip.file('model.json'), weightsEntry=zip.file('weights.bin');if(!modelEntry||!weightsEntry)throw new Error('El modelo guardado no tiene un formato vÃ¡lido.')
  const spec=JSON.parse(await modelEntry.async('text')) as {modelTopology:unknown;weightsManifest:Array<{weights:tf.io.WeightsManifestEntry[]}>};const weightData=await weightsEntry.async('arraybuffer');
  await tf.io.removeModel(modelUrl(projectId)).catch(()=>undefined);const model=await tf.loadLayersModel(tf.io.fromMemory({modelTopology:spec.modelTopology,weightSpecs:spec.weightsManifest[0]?.weights,weightData}));try{await model.save(modelUrl(projectId))}finally{model.dispose()}
}
export async function hasModel(projectId:string){return Boolean((await tf.io.listModels())[modelUrl(projectId)])}
export async function clearTrainingLocal(projectId:string){await Promise.all([drop(resultKey(projectId)),tf.io.removeModel(modelUrl(projectId)).catch(()=>undefined)])}
export async function clearCharacterLabLocal(projectId:string){await Promise.all([drop(datasetKey(projectId)),clearTrainingLocal(projectId)])}
export async function toBase64(file:Blob){const buffer=await file.arrayBuffer();let text='';const bytes=new Uint8Array(buffer);const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)text+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(text)}
export async function predict(projectId:string,file:File){const [data,result]=await Promise.all([loadDataset(projectId),loadResult(projectId)]);if(!data||!result)throw new Error('Primero entrena el modelo con un dataset.');const model=await tf.loadLayersModel(modelUrl(projectId));try{const input=tf.tensor4d(await pixels(file),[1,28,28,1]);const values=Array.from((model.predict(input) as tf.Tensor).dataSync());input.dispose();const index=values.indexOf(Math.max(...values));return {label:data.labels[index],confidence:values[index],values:data.labels.map((label,i)=>({label,confidence:values[i]}))}}finally{model.dispose()}}
