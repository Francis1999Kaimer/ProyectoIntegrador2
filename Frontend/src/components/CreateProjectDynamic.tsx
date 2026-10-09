import { useRef, useState } from 'react'
import { api } from '../api/http'
import { typeCodes, type Classroom, type Project } from '../api/types'
import { useResource } from '../api/useResource'
import { ApiMessage, Header, workflow } from './AppShell'
import { ArrowRight, BarChart3, BrainCircuit, Database, FileText, Image as ImageIcon, Network, Sparkles, Target, TrendingUp } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useProjectStore, type ProjectLevel } from '../store/project'

type ProjectPreset = {
  title: string
  description: string
  objective: string
  targetLabel: string
  targetValue: string
  datasetHint: string
  metric: string
  pipeline: string[]
  models: string[]
  icon: typeof ImageIcon
  accent: string
  preview: string
}

const presets: Record<string, ProjectPreset> = {
  'Clasificación de imágenes': {
    title: 'Clasificación de imágenes',
    description: 'Reconoce categorías visuales a partir de fotografías o capturas.',
    objective: 'Aprender patrones visuales y asignar una clase a cada imagen.',
    targetLabel: 'Clases sugeridas',
    targetValue: 'Plástico, papel, vidrio, metal',
    datasetHint: 'Carpetas por clase, imágenes JPG/PNG o dataset de ejemplo.',
    metric: 'Accuracy + F1 por clase',
    pipeline: ['Imágenes', 'Resize', 'Augmentation', 'CNN / MobileNet', 'Evaluar'],
    models: ['CNN', 'MobileNet', 'ResNet18'],
    icon: ImageIcon,
    accent: 'blue',
    preview: '🖼️ → 🧠 → ♻️',
  },
  'Predicción con datos': {
    title: 'Predicción con datos',
    description: 'Usa variables tabulares para estimar una categoría o riesgo.',
    objective: 'Encontrar relaciones entre columnas y predecir una variable objetivo.',
    targetLabel: 'Variable objetivo sugerida',
    targetValue: 'riesgo_abandono',
    datasetHint: 'CSV o Excel con columnas como asistencia, notas y participación.',
    metric: 'F1 + Recall + matriz de confusión',
    pipeline: ['CSV', 'Limpiar', 'Seleccionar columnas', 'Random Forest', 'Evaluar'],
    models: ['Árbol de decisión', 'Random Forest', 'XGBoost'],
    icon: BarChart3,
    accent: 'violet',
    preview: '📊 → 🌳 → 🎯',
  },
  'Clasificador de textos': {
    title: 'Clasificador de textos',
    description: 'Clasifica frases, reseñas o mensajes por intención, tema o sentimiento.',
    objective: 'Convertir texto en representaciones útiles y asignar una etiqueta.',
    targetLabel: 'Etiquetas sugeridas',
    targetValue: 'Positivo, neutral, negativo',
    datasetHint: 'CSV con columnas texto + etiqueta, o ejemplos escritos manualmente.',
    metric: 'Accuracy + F1 macro',
    pipeline: ['Texto', 'Limpiar', 'Tokenizar', 'Transformer', 'Evaluar'],
    models: ['TF-IDF + Logistic', 'LSTM', 'Transformer'],
    icon: FileText,
    accent: 'indigo',
    preview: '💬 → 🔤 → 😊',
  },
  'Regresión': {
    title: 'Regresión',
    description: 'Predice un valor numérico continuo como precio, consumo o demanda.',
    objective: 'Estimar un número a partir de variables históricas o explicativas.',
    targetLabel: 'Variable numérica sugerida',
    targetValue: 'consumo_kwh',
    datasetHint: 'CSV con variables numéricas, fechas y una columna objetivo continua.',
    metric: 'MAE + RMSE + R²',
    pipeline: ['Datos', 'Normalizar', 'Features', 'Regresión / MLP', 'Evaluar'],
    models: ['Regresión lineal', 'Random Forest Regressor', 'MLP'],
    icon: TrendingUp,
    accent: 'green',
    preview: '⚡ → 📈 → 42.8',
  },
}

const levelCopy: Record<ProjectLevel, { label: string; text: string; complexity: string }> = {
  Principiante: { label: 'Guiado', text: 'Configuraciones recomendadas, explicaciones y pocos parámetros.', complexity: 'Baja' },
  Intermedio: { label: 'Exploración', text: 'Más modelos y parámetros visibles para comparar alternativas.', complexity: 'Media' },
  Avanzado: { label: 'Laboratorio', text: 'Control detallado del pipeline, hiperparámetros y evaluación.', complexity: 'Alta' },
}

export default function CreateProjectDynamic() {
  const navigate = useNavigate()
  const { name, type, level, setName, setType, setLevel, select } = useProjectStore()
  const rooms = useResource<Classroom[]>('/classrooms?limit=100')
  const [classroom,setClassroom] = useState(''), [error,setError] = useState(''), [busy,setBusy] = useState(false)
  const sending = useRef(false)
  async function create() {
    if (sending.current || !name.trim()) return
    sending.current = true; setBusy(true); setError('')
    try {
      const project = await api.request<Project>('/projects',{method:'POST',body:{title:name.trim(),project_type:typeCodes[type]??'blocks',...(classroom?{classroom_id:classroom}:{})}})
      select(project); navigate(workflow('/dataset',project.id))
    } catch(e) { setError((e as Error).message) }
    finally { sending.current = false; setBusy(false) }
  }
  const selected = presets[type] ?? presets['Clasificación de imágenes']
  const Icon = selected.icon
  const levels: ProjectLevel[] = ['Principiante', 'Intermedio', 'Avanzado']

  return <>
    <Header/>

    <main className="page wizard-page">
      <Link className="back-link" to="/">← Volver al inicio</Link>
      <div className="wizard-progress carbon-progress">
        <span className="active">1 <b>Información</b></span><span>2 <b>Datos</b></span><span>3 <b>Objetivo</b></span><span>4 <b>Confirmar</b></span>
      </div>

      <div className="wizard-dynamic-layout">
        <section className="panel form-panel wizard-main-panel">
          <span className="eyebrow">NUEVO PROYECTO</span>
          <h1>¿Qué quieres construir?</h1>
          <p className="wizard-intro">Elige el tipo de problema. La experiencia, los bloques y las recomendaciones cambiarán automáticamente.</p>

          <label>Nombre del proyecto<input required maxLength={180} value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Detector de residuos reciclables" /></label>

          <label>Salón (opcional)<select value={classroom} onChange={e=>setClassroom(e.target.value)}><option value="">Proyecto personal</option>{rooms.data?.filter(r=>r.status==='active').map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <ApiMessage {...rooms} retry={rooms.reload}/>
          <label>Tipo de proyecto</label>
          <div className="project-type-selector">
            {Object.entries(presets).map(([key, preset]) => {
              const ItemIcon = preset.icon
              return <button key={key} onClick={() => setType(key)} className={type === key ? `project-type-option selected ${preset.accent}` : 'project-type-option'}>
                <span className="project-type-icon"><ItemIcon size={21}/></span>
                <span><strong>{preset.title}</strong><small>{preset.description}</small></span>
                {type === key && <span className="selection-mark">✓</span>}
              </button>
            })}
          </div>

          <div className="dynamic-config-card">
            <div className="dynamic-config-heading"><Target size={20}/><div><strong>Objetivo del proyecto</strong><p>{selected.objective}</p></div></div>
            <div className="dynamic-config-grid">
              <div><small>{selected.targetLabel}</small><strong>{selected.targetValue}</strong></div>
              <div><small>Dataset recomendado</small><strong>{selected.datasetHint}</strong></div>
              <div><small>Métrica principal</small><strong>{selected.metric}</strong></div>
              <div><small>Modelos que podrás explorar</small><strong>{selected.models.join(' · ')}</strong></div>
            </div>
          </div>

          <label>Nivel de guía para esta sesión</label>
          <div className="level-cards">
            {levels.map(item => <button key={item} onClick={() => setLevel(item)} className={level === item ? 'level-card selected' : 'level-card'}>
              <strong>{item}</strong><span>{levelCopy[item].label}</span><small>{levelCopy[item].text}</small>
            </button>)}
          </div>

          <ApiMessage error={error}/>
          <div className="actions wizard-actions"><Link className="secondary button-link" to="/">Cancelar</Link><button className="primary" disabled={busy||!name.trim()} onClick={() => void create()}>{busy ? 'Creando…' : 'Crear y continuar'} <ArrowRight size={17}/></button></div>
        </section>

        <aside className="wizard-side">
          <section className={`panel live-preview ${selected.accent}`}>
            <span className="eyebrow">VISTA PREVIA DINÁMICA</span>
            <div className="preview-heading"><span className="preview-icon"><Icon size={25}/></span><div><h2>{name || 'Proyecto sin nombre'}</h2><p>{selected.title}</p></div></div>
            <div className="preview-stage">{selected.preview}</div>
            <dl><dt>Nivel</dt><dd>{level}</dd><dt>Complejidad</dt><dd>{levelCopy[level].complexity}</dd><dt>Evaluación</dt><dd>{selected.metric}</dd></dl>
          </section>

          <section className="panel pipeline-preview-card">
            <span className="eyebrow">PIPELINE SUGERIDO</span>
            <div className="pipeline-vertical">{selected.pipeline.map((step, i) => <div key={step}><span>{i + 1}</span><strong>{step}</strong>{i < selected.pipeline.length - 1 && <i>↓</i>}</div>)}</div>
          </section>

          <section className="friendly-note"><Sparkles size={20}/><div><strong>Esto cambiará después</strong><p>Al continuar, la pantalla de datos y los bloques disponibles se adaptarán a <b>{selected.title.toLowerCase()}</b>.</p></div></section>
        </aside>
      </div>
    </main>
  </>
}
