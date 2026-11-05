import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Camera, Download, Eraser, Mic, Upload } from 'lucide-react'
import type * as tf from '@tensorflow/tfjs'
import { ApiMessage } from '../AppShell'
import { loadModel, predict } from '../../training/engine'
import { audioDecoder, featuresToDataUrl, imageFeatures, soundFeatures, soundWindow } from '../../training/prepare'
import { modelBlob } from '../../training/storage'
import { inputKinds, percent, type InputKind } from '../../training/types'
import { Bar } from './charts'
import { StepActions, stepUrl, TrainingHeading, TrainingPage, type StepContext } from './TrainingLayout'

type Mode = 'draw' | 'upload' | 'camera' | 'record'
const modes: Record<InputKind, { id: Mode; label: string }[]> = {
  gray28: [{ id: 'draw', label: 'Dibujar' }, { id: 'upload', label: 'Subir imagen' }],
  rgb64: [{ id: 'upload', label: 'Subir imagen' }, { id: 'camera', label: 'Usar cámara' }],
  spec64: [{ id: 'record', label: 'Grabar' }, { id: 'upload', label: 'Subir WAV' }]
}
const RECORD_MS = 1500

/** Lienzo para dibujar con el mouse, el dedo o un lápiz. */
function DrawingPad({ onReady }: { onReady: (blob: Blob) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null), drawing = useRef(false), [empty, setEmpty] = useState(true)
  const ctx = () => canvas.current?.getContext('2d') ?? null
  const clear = () => { const c = ctx(); if (!c) return; c.fillStyle = '#ffffff'; c.fillRect(0, 0, 280, 280); setEmpty(true) }
  useEffect(clear, [])
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => { const box = event.currentTarget.getBoundingClientRect(); return [(event.clientX - box.left) * 280 / box.width, (event.clientY - box.top) * 280 / box.height] }
  return <div className="drawing-pad">
    <canvas ref={canvas} width={280} height={280} aria-label="Lienzo para dibujar"
      onPointerDown={event => { const c = ctx(); if (!c) return; event.currentTarget.setPointerCapture(event.pointerId); drawing.current = true; const [x, y] = point(event); c.strokeStyle = '#161616'; c.lineWidth = 16; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y); c.stroke(); setEmpty(false) }}
      onPointerMove={event => { if (!drawing.current) return; const c = ctx(); if (!c) return; const [x, y] = point(event); c.lineTo(x, y); c.stroke() }}
      onPointerUp={() => { drawing.current = false }} onPointerLeave={() => { drawing.current = false }} />
    <div className="actions"><button type="button" className="secondary" onClick={clear}><Eraser size={16} /> Limpiar</button>
      <button type="button" className="primary" disabled={empty} onClick={() => canvas.current?.toBlob(blob => blob && onReady(blob), 'image/png')}>Reconocer dibujo</button></div>
  </div>
}

function CameraCapture({ onReady }: { onReady: (blob: Blob) => void }) {
  const video = useRef<HTMLVideoElement>(null), [error, setError] = useState(''), [ready, setReady] = useState(false)
  useEffect(() => {
    let stream: MediaStream | undefined, alive = true
    if (!navigator.mediaDevices?.getUserMedia) { setError('Este navegador no permite usar la cámara.'); return }
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then(s => {
      if (!alive) { s.getTracks().forEach(t => t.stop()); return }
      stream = s; if (video.current) { video.current.srcObject = s; void video.current.play(); setReady(true) }
    }).catch(() => setError('No se pudo usar la cámara. Revisa el permiso del navegador.'))
    return () => { alive = false; stream?.getTracks().forEach(t => t.stop()) }
  }, [])
  function capture() {
    const v = video.current; if (!v || !v.videoWidth) return
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d')?.drawImage(v, 0, 0); c.toBlob(blob => blob && onReady(blob), 'image/png')
  }
  if (error) return <p className="training-warning">{error}</p>
  return <div className="camera-capture"><video ref={video} muted playsInline /><button type="button" className="primary" disabled={!ready} onClick={capture}><Camera size={16} /> Tomar foto y reconocer</button></div>
}

function Recorder({ onReady }: { onReady: (blob: Blob) => void }) {
  const [state, setState] = useState<'idle' | 'recording'>('idle'), [error, setError] = useState('')
  async function record() {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Este navegador no permite grabar audio.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }), recorder = new MediaRecorder(stream), chunks: Blob[] = []
      recorder.ondataavailable = event => chunks.push(event.data)
      recorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); setState('idle'); onReady(new Blob(chunks, { type: recorder.mimeType })) }
      recorder.start(); setState('recording'); setTimeout(() => recorder.stop(), RECORD_MS)
    } catch { setError('No se pudo usar el micrófono. Revisa el permiso del navegador.'); setState('idle') }
  }
  return <div className="recorder">
    <button type="button" className="primary" disabled={state === 'recording'} onClick={() => void record()}><Mic size={16} /> {state === 'recording' ? 'Grabando…' : 'Grabar 1,5 segundos'}</button>
    <p className="dataset-hint">Se toma el segundo con más energía de la grabación, igual que con el dataset.</p>
    {error && <p className="training-warning">{error}</p>}
  </div>
}

function PredictionContent({ projectId, project, state }: StepContext) {
  const kind = inputKinds[state.project_type], labels = state.dataset!.labels, run = state.model?.run_number
  const model = useRef<tf.LayersModel | undefined>(undefined), upload = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState(false), [error, setError] = useState(''), [mode, setMode] = useState<Mode>(modes[kind][0].id)
  const [busy, setBusy] = useState(false), [input, setInput] = useState<{ url: string; audio: boolean }>(), [seen, setSeen] = useState('')
  const [result, setResult] = useState<{ label: string; confidence: number }[]>()
  useEffect(() => {
    let alive = true
    if (!run) return
    void modelBlob(projectId, run).then(loadModel).then(({ model: loadedModel }) => { if (alive) { model.current = loadedModel; setLoaded(true) } else loadedModel.dispose() })
      .catch(() => { if (alive) setError('No se pudo cargar el modelo guardado.') })
    return () => { alive = false; model.current?.dispose(); model.current = undefined }
  }, [projectId, run])
  useEffect(() => () => { if (input) URL.revokeObjectURL(input.url) }, [input])
  async function recognize(blob: Blob) {
    if (!model.current) return
    setBusy(true); setError(''); setResult(undefined); setInput({ url: URL.createObjectURL(blob), audio: kind === 'spec64' })
    try {
      const features = kind === 'spec64' ? soundFeatures(soundWindow(await audioDecoder()(await blob.arrayBuffer())).window) : await imageFeatures(blob, kind)
      setSeen(featuresToDataUrl(features, kind)); setResult(predict(model.current, kind, features, labels))
    } catch { setError(kind === 'spec64' ? 'No se pudo procesar el audio.' : 'No se pudo procesar la imagen.') }
    finally { setBusy(false) }
  }
  async function download() {
    if (!run) return
    try {
      const url = URL.createObjectURL(await modelBlob(projectId, run)), link = document.createElement('a')
      const slug = project.title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'proyecto'
      link.href = url; link.download = `modelo-${slug}-entrenamiento-${run}.zip`; document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setError('No se pudo descargar el modelo.') }
  }
  const top = result?.[0]
  return <>
    <TrainingHeading step="PASO 6 · PRUEBA" title="Prueba tu modelo" project={project}>
      <p className="training-meta">Usa el modelo del entrenamiento {run ?? '—'}. Prueba con ejemplos que no estén en el dataset.</p>
    </TrainingHeading>
    {!run ? <section className="panel empty-state"><p>Aún no hay un modelo entrenado.</p><Link to={stepUrl(4, projectId)}>Entrenar modelo</Link></section> : <>
      <div className="training-grid">
        <section className="panel training-card">
          <div className="tab-row" role="tablist">{modes[kind].map(item => <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} className={mode === item.id ? 'active' : ''} onClick={() => setMode(item.id)}>{item.label}</button>)}</div>
          {!loaded && !error && <p role="status" className="dataset-progress">Cargando el modelo…</p>}
          {loaded && mode === 'draw' && <DrawingPad onReady={blob => void recognize(blob)} />}
          {loaded && mode === 'camera' && <CameraCapture onReady={blob => void recognize(blob)} />}
          {loaded && mode === 'record' && <Recorder onReady={blob => void recognize(blob)} />}
          {loaded && mode === 'upload' && <div className="upload-test">
            <input ref={upload} className="dataset-file-input" type="file" aria-label="Archivo de prueba" accept={kind === 'spec64' ? '.wav,audio/wav' : 'image/png,image/jpeg'} onChange={e => { const f = e.target.files?.[0]; if (f) void recognize(f); e.target.value = '' }} />
            <button type="button" className="primary" onClick={() => upload.current?.click()}><Upload size={16} /> {kind === 'spec64' ? 'Seleccionar WAV' : 'Seleccionar imagen'}</button>
          </div>}
          <ApiMessage error={error} />
        </section>
        <section className="panel training-card" aria-live="polite">
          <h2>Resultado</h2>
          {busy && <p role="status" className="dataset-progress">Analizando…</p>}
          {!top && !busy && <p>Dibuja, graba o sube un ejemplo para ver la predicción de la CNN.</p>}
          {input && <div className="preview-pair test-input">
            <figure>{input.audio ? <audio controls src={input.url} /> : <img src={input.url} alt="Ejemplo de prueba" />}<figcaption>Ejemplo</figcaption></figure>
            {seen && <figure><img className="pixelated" src={seen} alt="Lo que recibe la CNN" /><figcaption>Lo que recibe la CNN</figcaption></figure>}
          </div>}
          {top && <>
            <p className="prediction-label">Predicción: <strong>{top.label}</strong></p>
            <p>Confianza: {percent(top.confidence)}</p>
            {top.confidence < 0.6 && <p className="training-warning">Confianza baja: la CNN no está segura de esta predicción.</p>}
            <ul className="category-bars">{result!.map(row => <li key={row.label}><span>{row.label}</span><Bar value={row.confidence} /><strong>{percent(row.confidence)}</strong></li>)}</ul>
          </>}
        </section>
      </div>
      <section className="panel training-card download-card">
        <div><h2>Descargar modelo</h2><p>ZIP con model.json y weights.bin (formato de TensorFlow.js) y metadata.json con las categorías, la entrada y la preparación de los datos.</p></div>
        <button type="button" className="primary" onClick={() => void download()}><Download size={16} /> Descargar modelo</button>
      </section>
    </>}
    <StepActions back={{ to: stepUrl(5, projectId), label: 'Anterior · Paso 5' }} />
  </>
}

export default function PredictionStep() { return <TrainingPage step={6}>{context => <PredictionContent {...context} />}</TrainingPage> }
