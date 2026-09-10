import { ArrowRight, BarChart3, BrainCircuit, Camera, CheckCircle2, CircleHelp, Database, FileText, FolderOpen, HardDrive, Image as ImageIcon, Link2, Network, Save, SlidersHorizontal, Sparkles, Split, Target, TrendingUp, UploadCloud, WandSparkles } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useState, type ReactNode } from 'react'
import { useProjectStore } from '../store/project'

type FlowPreset = {
  dataTitle: string
  dataSubtitle: string
  sourceTabs: Array<[string, typeof Database]>
  uploadTitle: string
  uploadText: string
  previewItems: string[]
  stats: Array<[string, string]>
  preparation: Array<[string, string, string]>
  models: Array<[string, string]>
  recommendedModel: string
  modelDescription: string
  config: Array<[string, string]>
}

const flowPresets: Record<string, FlowPreset> = {
  'Clasificación de imágenes': {
    dataTitle: 'Cargar imágenes', dataSubtitle: 'Organiza ejemplos visuales por clase y revisa si el dataset está balanceado.',
    sourceTabs: [['Subir imágenes', UploadCloud], ['Webcam', Camera], ['Dataset ejemplo', Database], ['URL', Link2], ['Drive', HardDrive]],
    uploadTitle: 'Arrastra imágenes por categoría', uploadText: 'JPG, PNG o WEBP. Puedes crear una carpeta o etiqueta por clase.',
    previewItems: ['♻️ Plástico', '📄 Papel', '🍾 Vidrio', '🥫 Metal'], stats: [['3,840', 'imágenes'], ['4', 'clases']],
    preparation: [['Resize', '224 × 224 px', 'Unifica el tamaño de entrada.'], ['Normalizar', '0–1', 'Escala valores de píxeles.'], ['Data augmentation', 'Flip + crop', 'Crea variaciones para generalizar mejor.'], ['Dividir datos', '70 / 15 / 15', 'Separa train, validation y test.']],
    models: [['CNN', 'Aprende patrones visuales desde cero.'], ['MobileNet', 'Ligero y rápido con transfer learning.'], ['ResNet18', 'Más profundo para proyectos complejos.']], recommendedModel: 'MobileNet', modelDescription: 'Transfer learning eficiente para clasificación visual.',
    config: [['Imagen de entrada', '224 × 224'], ['Capas a entrenar', 'Últimas 20'], ['Learning rate', '0.001'], ['Métrica', 'Accuracy + F1']],
  },
  'Predicción con datos': {
    dataTitle: 'Cargar datos tabulares', dataSubtitle: 'Importa columnas, identifica la variable objetivo y revisa datos faltantes.',
    sourceTabs: [['Subir CSV / Excel', UploadCloud], ['Dataset ejemplo', Database], ['URL', Link2], ['Drive', HardDrive]],
    uploadTitle: 'Arrastra un CSV o Excel', uploadText: 'El sistema mostrará columnas, tipos de datos, faltantes y variable objetivo.',
    previewItems: ['asistencia', 'promedio', 'entregas', 'participación'], stats: [['2,450', 'filas'], ['12', 'variables']],
    preparation: [['Limpiar faltantes', 'Mediana / moda', 'Completa o elimina valores ausentes.'], ['Codificar categorías', 'One-hot', 'Convierte texto categórico a números.'], ['Seleccionar variables', '8 de 12', 'Conserva las variables más útiles.'], ['Dividir datos', '75 / 25', 'Separa entrenamiento y prueba.']],
    models: [['Árbol de decisión', 'Fácil de interpretar visualmente.'], ['Random Forest', 'Robusto y muy útil en datos tabulares.'], ['XGBoost', 'Mayor control y rendimiento.']], recommendedModel: 'Random Forest', modelDescription: 'Conjunto de árboles para predicción tabular robusta.',
    config: [['Árboles', '200'], ['Profundidad máxima', '12'], ['Variable objetivo', 'riesgo_abandono'], ['Métrica', 'F1 + Recall']],
  },
  'Clasificador de textos': {
    dataTitle: 'Cargar textos y etiquetas', dataSubtitle: 'Prepara frases, reseñas o mensajes con su categoría correspondiente.',
    sourceTabs: [['Subir CSV', UploadCloud], ['Escribir ejemplos', FileText], ['Dataset ejemplo', Database], ['URL', Link2]],
    uploadTitle: 'Carga textos etiquetados', uploadText: 'Usa columnas como “texto” y “etiqueta”, o agrega ejemplos manualmente.',
    previewItems: ['😊 Positivo', '😐 Neutral', '😟 Negativo', '💬 12,600 textos'], stats: [['12.6k', 'textos'], ['3', 'etiquetas']],
    preparation: [['Limpiar texto', 'URLs + signos', 'Elimina ruido innecesario.'], ['Normalizar', 'Minúsculas', 'Homogeneiza el contenido.'], ['Tokenizar', 'Máx. 128 tokens', 'Convierte texto en unidades procesables.'], ['Dividir datos', '80 / 10 / 10', 'Separa train, validation y test.']],
    models: [['TF-IDF + Logistic', 'Base rápida y explicable.'], ['LSTM', 'Aprende secuencias y contexto.'], ['Transformer', 'Comprende mejor el contexto del texto.']], recommendedModel: 'Transformer', modelDescription: 'Modelo contextual para clasificar intención o sentimiento.',
    config: [['Longitud máxima', '128 tokens'], ['Batch size', '32'], ['Learning rate', '2e-5'], ['Métrica', 'F1 macro']],
  },
  'Regresión': {
    dataTitle: 'Cargar variables numéricas', dataSubtitle: 'Importa datos históricos y selecciona el valor continuo que quieres estimar.',
    sourceTabs: [['Subir CSV / Excel', UploadCloud], ['Dataset ejemplo', Database], ['URL', Link2], ['Drive', HardDrive]],
    uploadTitle: 'Carga tu tabla de regresión', uploadText: 'Debe incluir variables explicativas y una columna objetivo numérica.',
    previewItems: ['fecha', 'temperatura', 'hora', 'consumo_kwh'], stats: [['8,760', 'registros'], ['9', 'variables']],
    preparation: [['Limpiar datos', 'Interpolación', 'Corrige faltantes y valores extremos.'], ['Normalizar', 'StandardScaler', 'Escala variables numéricas.'], ['Crear features', 'Hora + día', 'Genera variables derivadas.'], ['Dividir datos', '80 / 20', 'Reserva datos para evaluación.']],
    models: [['Regresión lineal', 'Base simple e interpretable.'], ['Random Forest Regressor', 'Captura relaciones no lineales.'], ['MLP', 'Red neuronal para patrones complejos.']], recommendedModel: 'Random Forest Regressor', modelDescription: 'Predicción numérica flexible sin exigir una relación lineal.',
    config: [['Árboles', '250'], ['Profundidad', '14'], ['Objetivo', 'consumo_kwh'], ['Métrica', 'MAE + RMSE']],
  },
}

function FlowShell({ children, active }: { children: ReactNode; active: number }) {
  const steps = [['/dataset','Datos'],['/preparacion','Preparación'],['/modelo','Modelo'],['/editor','Pipeline'],['/entrenamiento','Entrenar'],['/evaluacion','Evaluar'],['/prediccion','Probar']]
  return <><header className="app-header"><Link to="/" className="brand"><span className="brand-mark"><BrainCircuit size={21}/></span><span>AI Blocks <strong>Studio</strong></span></Link><nav className="main-nav"><Link to="/">Inicio</Link><Link to="/proyectos"><FolderOpen size={17}/>Mis proyectos</Link></nav><div className="avatar">FA</div></header><div className="stepper">{steps.map(([path,label],i)=><Link key={path} to={path} className={i===active?'active':''}><span>{i+1}</span>{label}</Link>)}</div><main className="page dynamic-flow-page">{children}</main></>
}

function getPreset(type: string) { return flowPresets[type] ?? flowPresets['Clasificación de imágenes'] }

export function DynamicDatasetPage() {
  const navigate=useNavigate(); const {type}=useProjectStore(); const preset=getPreset(type); const [source,setSource]=useState(0)
  return <FlowShell active={0}><div className="page-title"><div><span className="eyebrow">PASO 1 · {type.toUpperCase()}</span><h1>{preset.dataTitle}</h1><p>{preset.dataSubtitle}</p></div><button className="secondary"><CircleHelp size={17}/>¿Qué datos necesito?</button></div>
    <div className="source-tabs dynamic-source-tabs">{preset.sourceTabs.map(([label,Icon],i)=><button key={label} className={source===i?'active':''} onClick={()=>setSource(i)}><Icon size={18}/>{label}</button>)}</div>
    <div className="dynamic-dataset-grid"><section className="panel upload-panel dynamic-upload"><UploadCloud size={38}/><span className="eyebrow">{preset.sourceTabs[source][0]}</span><h2>{preset.uploadTitle}</h2><p>{preset.uploadText}</p><button className="primary">Seleccionar datos</button><div className="dataset-preview-chips">{preset.previewItems.map(item=><span key={item}>{item}</span>)}</div></section>
    <aside className="panel dynamic-data-summary"><div className="status"><CheckCircle2 size={17}/>Ejemplo listo para explorar</div><h3>Resumen esperado</h3><div className="stats">{preset.stats.map(([value,label])=><div key={label}><strong>{value}</strong><small>{label}</small></div>)}</div><div className="data-check"><Target size={18}/><div><strong>El sistema validará tu dataset</strong><p>Tipos, balance, faltantes y compatibilidad con el problema seleccionado.</p></div></div></aside></div>
    <div className="actions end"><button className="primary" onClick={()=>navigate('/preparacion')}>Preparar estos datos <ArrowRight size={17}/></button></div></FlowShell>
}

export function DynamicPreparationPage() {
  const navigate=useNavigate(); const {type}=useProjectStore(); const preset=getPreset(type)
  return <FlowShell active={1}><div className="page-title"><div><span className="eyebrow">PASO 2 · {type.toUpperCase()}</span><h1>Preparar datos</h1><p>Cada tipo de proyecto necesita transformaciones distintas. Estas son las recomendadas para tu caso.</p></div></div>
    <div className="dynamic-prep-pipeline">{preset.preparation.map(([title],i)=><div key={title}><span>{i+1}</span><strong>{title}</strong>{i<preset.preparation.length-1&&<ArrowRight size={17}/>}</div>)}</div>
    <div className="dynamic-prep-grid">{preset.preparation.map(([title,value,text],i)=><section className="panel dynamic-prep-card" key={title}><div><span className="prep-number">0{i+1}</span><CheckCircle2 size={18}/></div><h3>{title}</h3><strong>{value}</strong><p>{text}</p><button className="text-action">Configurar →</button></section>)}</div>
    <div className="friendly-note"><WandSparkles size={20}/><div><strong>Pipeline adaptado al problema</strong><p>No mostramos bloques irrelevantes: el estudiante ve primero las transformaciones que sí tienen sentido para <b>{type.toLowerCase()}</b>.</p></div></div>
    <div className="actions end"><button className="secondary"><Save size={17}/>Guardar</button><button className="primary" onClick={()=>navigate('/modelo')}>Elegir modelo <ArrowRight size={17}/></button></div></FlowShell>
}

export function DynamicModelPage() {
  const navigate=useNavigate(); const {type}=useProjectStore(); const preset=getPreset(type); const [selected,setSelected]=useState(preset.recommendedModel)
  const description=preset.models.find(([model])=>model===selected)?.[1] ?? preset.modelDescription
  return <FlowShell active={2}><div className="page-title"><div><span className="eyebrow">PASO 3 · {type.toUpperCase()}</span><h1>Selecciona un modelo apropiado</h1><p>Mostramos alternativas compatibles con el tipo de problema, ordenadas desde lo más explicable hasta lo más potente.</p></div></div>
    <div className="dynamic-model-layout"><section className="dynamic-model-list">{preset.models.map(([model,text],i)=><button key={model} onClick={()=>setSelected(model)} className={selected===model?'dynamic-model-card selected':'dynamic-model-card'}><span className="model-rank">0{i+1}</span><span className="model-symbol">{i===0?'◎':i===1?'◈':'⬡'}</span><span><strong>{model}</strong><small>{text}</small></span>{model===preset.recommendedModel&&<em>Recomendado</em>}</button>)}</section>
    <aside className="panel dynamic-model-inspector"><span className="eyebrow">MODELO SELECCIONADO</span><div className="model-big-icon"><Network size={30}/></div><h2>{selected}</h2><p>{description}</p><div className="dynamic-model-config">{preset.config.map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div><div className="friendly-note compact"><Sparkles size={18}/><div><strong>Explicación para el estudiante</strong><p>Antes de entrenar podrás ver qué hace este modelo, qué parámetros importan y qué resultados esperar.</p></div></div><button className="primary full" onClick={()=>navigate('/editor')}>Construir pipeline <ArrowRight size={17}/></button></aside></div></FlowShell>
}
