import { useState, type ReactNode } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router'
import {
  Activity, ArrowRight, BarChart3, Bell, BrainCircuit, Camera, CheckCircle2, CircleHelp,
  Code2, Database, Download, FileText, FolderOpen, Gauge, HardDrive, Home, Image as ImageIcon,
  Link2, Network, Pause, Play, Plus, Save, Search, Settings2, Share2, SlidersHorizontal,
  Sparkles, Split, Square, Target, TrendingUp, Trophy, UploadCloud, WandSparkles,
} from 'lucide-react'
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from '@xyflow/react'
import { useProjectStore, type ProjectLevel } from './store/project'

type IconType = typeof Home

type MockProject = {
  id: string
  title: string
  description: string
  type: string
  level: ProjectLevel
  status: 'En progreso' | 'Completado' | 'Borrador' | 'Entrenando'
  progress: number
  model: string
  metric: string
  metricLabel: string
  updated: string
  icon: string
  tone: string
  tags: string[]
}

const projectTypes: Array<{ title: string; description: string; icon: IconType; tone: string }> = [
  { title: 'Clasificador de imágenes', description: 'Reconoce objetos, animales y categorías a partir de imágenes.', icon: ImageIcon, tone: 'blue' },
  { title: 'Predicción con datos', description: 'Analiza variables y predice resultados con datos tabulares.', icon: BarChart3, tone: 'violet' },
  { title: 'Clasificador de textos', description: 'Detecta temas, intención o sentimiento en textos.', icon: FileText, tone: 'indigo' },
  { title: 'Regresión', description: 'Predice valores numéricos continuos.', icon: TrendingUp, tone: 'green' },
  { title: 'Red neuronal desde cero', description: 'Construye una red y comprende cada capa paso a paso.', icon: Network, tone: 'purple' },
  { title: 'Proyecto vacío', description: 'Empieza desde cero y crea tu propio pipeline.', icon: Plus, tone: 'gray' },
]

const mockProjects: MockProject[] = [
  { id:'pets', title:'Clasificador perros y gatos', description:'Clasificación visual con CNN para reconocer mascotas a partir de imágenes.', type:'Clasificación de imágenes', level:'Principiante', status:'Completado', progress:100, model:'CNN', metric:'92.4%', metricLabel:'Accuracy', updated:'Hoy, 10:42', icon:'🐶', tone:'blue', tags:['Visión','CNN','2 clases'] },
  { id:'recycle', title:'Detector de residuos reciclables', description:'Reconoce plástico, papel, vidrio y metal para un prototipo de clasificación de residuos.', type:'Clasificación de imágenes', level:'Intermedio', status:'Entrenando', progress:72, model:'MobileNet', metric:'81.3%', metricLabel:'Val. accuracy', updated:'Hoy, 09:18', icon:'♻️', tone:'green', tags:['Visión','MobileNet','4 clases'] },
  { id:'dropout', title:'Riesgo de abandono estudiantil', description:'Predice estudiantes en riesgo usando asistencia, notas, entregas y participación.', type:'Predicción con datos', level:'Intermedio', status:'En progreso', progress:64, model:'Random Forest', metric:'87.6%', metricLabel:'F1 Score', updated:'Ayer, 22:06', icon:'🎓', tone:'violet', tags:['Tabular','Random Forest','Educación'] },
  { id:'energy', title:'Pronóstico de consumo eléctrico', description:'Estima el consumo energético de las próximas horas a partir de datos históricos.', type:'Regresión', level:'Avanzado', status:'En progreso', progress:48, model:'Red neuronal', metric:'4.8%', metricLabel:'MAPE', updated:'Ayer, 18:25', icon:'⚡', tone:'indigo', tags:['Series de tiempo','Regresión','Energía'] },
  { id:'sentiment', title:'Sentimiento de reseñas', description:'Clasifica comentarios como positivos, neutrales o negativos y compara confianza.', type:'Clasificador de textos', level:'Intermedio', status:'Completado', progress:100, model:'Transformer', metric:'89.1%', metricLabel:'Accuracy', updated:'Hace 2 días', icon:'💬', tone:'purple', tags:['NLP','Transformer','3 clases'] },
  { id:'flowers', title:'Clasificador de flores', description:'Proyecto guiado para distinguir cinco especies y explorar data augmentation.', type:'Clasificación de imágenes', level:'Principiante', status:'Completado', progress:100, model:'CNN', metric:'88.1%', metricLabel:'Accuracy', updated:'Hace 4 días', icon:'🌸', tone:'pink', tags:['Visión','CNN','5 clases'] },
  { id:'sensors', title:'Anomalías en sensores industriales', description:'Explora patrones extraños en señales de temperatura, presión y vibración.', type:'Predicción con datos', level:'Avanzado', status:'Borrador', progress:28, model:'Autoencoder', metric:'—', metricLabel:'Sin evaluar', updated:'Hace 1 semana', icon:'🏭', tone:'orange', tags:['Anomalías','Sensores','Industrial'] },
  { id:'xor', title:'Red neuronal XOR desde cero', description:'Laboratorio educativo para entender neuronas, pesos, activaciones y backpropagation.', type:'Red neuronal desde cero', level:'Principiante', status:'Completado', progress:100, model:'MLP', metric:'100%', metricLabel:'Accuracy', updated:'Hace 2 semanas', icon:'🧠', tone:'cyan', tags:['Fundamentos','MLP','Laboratorio'] },
]

const flowSteps = [
  ['/dataset', 'Datos'], ['/preparacion', 'Preparación'], ['/modelo', 'Modelo'], ['/editor', 'Pipeline'],
  ['/entrenamiento', 'Entrenar'], ['/evaluacion', 'Evaluar'], ['/prediccion', 'Probar'],
] as const

const palette: Array<[string, IconType]> = [
  ['Datos', Database], ['Procesar', SlidersHorizontal], ['Modelos', BrainCircuit],
  ['Entrenar', Settings2], ['Evaluar', BarChart3], ['Usar', Play],
]

function Header() {
  return <header className="app-header">
    <Link to="/" className="brand"><span className="brand-mark"><BrainCircuit size={21}/></span><span>AI Blocks <strong>Studio</strong></span></Link>
    <nav className="main-nav">
      <NavLink to="/" end><Home size={17}/>Inicio</NavLink><NavLink to="/proyectos"><FolderOpen size={17}/>Mis proyectos</NavLink>
      <a href="#retos"><Trophy size={17}/>Retos</a><a href="#ayuda"><CircleHelp size={17}/>Ayuda</a>
    </nav>
    <div className="header-actions"><div className="search"><Search size={16}/><span>Buscar proyectos...</span><kbd>Ctrl K</kbd></div><button className="icon-button"><Bell size={18}/></button><div className="avatar">FA</div></div>
  </header>
}

function ProjectStepper() {
  const { pathname } = useLocation()
  return <div className="stepper">{flowSteps.map(([path,label],i)=><Link key={path} to={path} className={pathname===path?'active':''}><span>{i+1}</span>{label}</Link>)}</div>
}

function Page({ children, stepper=false }: { children: ReactNode; stepper?: boolean }) {
  return <><Header/>{stepper&&<ProjectStepper/>}<main className="page">{children}</main></>
}

function Dashboard() {
  const navigate=useNavigate()
  return <Page>
    <section className="hero"><div><span className="eyebrow">ENTORNO EDUCATIVO DE INTELIGENCIA ARTIFICIAL</span><h1>Aprende IA creando<br/><em>con bloques</em></h1><p>Diseña pipelines, prepara datos, entrena modelos y entiende los resultados sin empezar escribiendo código.</p><div className="hero-actions"><button className="primary" onClick={()=>navigate('/crear')}><Plus size={18}/>Crear proyecto</button><button className="secondary" onClick={()=>navigate('/proyectos')}><FolderOpen size={18}/>Mis proyectos</button></div></div><div className="hero-flow"><div className="mini-node blue"><Database size={18}/>Cargar datos</div><ArrowRight/><div className="mini-node purple"><BrainCircuit size={18}/>Entrenar modelo</div><ArrowRight/><div className="mini-node green"><Target size={18}/>Predecir</div></div></section>
    <section className="section-heading"><div><span className="eyebrow">EMPIEZA POR UNA IDEA</span><h2>¿Qué quieres crear?</h2></div><span className="muted">Prototipo UX/UI · datos simulados</span></section>
    <div className="card-grid">{projectTypes.map(({title,description,icon:Icon,tone})=><button key={title} className="project-card" onClick={()=>navigate('/crear')}><span className={`card-icon ${tone}`}><Icon size={22}/></span><strong>{title}</strong><p>{description}</p><ArrowRight size={17}/></button>)}</div>
    <section className="recent-panel"><div><span className="eyebrow">CONTINÚA APRENDIENDO</span><h2>Proyectos recientes</h2></div><div className="recent-list"><div><span className="recent-icon">🐶</span><strong>Gatos vs perros</strong><small>Clasificación · 92.4%</small></div><div><span className="recent-icon">🎓</span><strong>Riesgo de abandono</strong><small>Random Forest · 64%</small></div><div><span className="recent-icon">♻️</span><strong>Residuos reciclables</strong><small>MobileNet · entrenando</small></div></div><button className="secondary" onClick={()=>navigate('/proyectos')}>Ver todos los proyectos <ArrowRight size={16}/></button></section>
  </Page>
}

function ProjectsPage(){
  const navigate=useNavigate()
  const {setName,setType,setLevel}=useProjectStore()
  const [filter,setFilter]=useState('Todos')
  const filtered=filter==='Todos'?mockProjects:mockProjects.filter(project=>project.status===filter)
  const openProject=(project:MockProject)=>{setName(project.title);setType(project.type);setLevel(project.level);navigate('/editor')}
  return <Page>
    <section className="projects-hero">
      <div><span className="eyebrow">TU LABORATORIO DE IA</span><h1>Mis proyectos</h1><p>Continúa experimentos, compara resultados y explora distintas formas de construir inteligencia artificial.</p></div>
      <button className="primary" onClick={()=>navigate('/crear')}><Plus size={18}/>Nuevo proyecto</button>
    </section>
    <section className="projects-overview">
      <div><span>Proyectos</span><strong>{mockProjects.length}</strong><small>en tu espacio</small></div>
      <div><span>Completados</span><strong>{mockProjects.filter(p=>p.status==='Completado').length}</strong><small>listos para probar</small></div>
      <div><span>En progreso</span><strong>{mockProjects.filter(p=>p.status==='En progreso'||p.status==='Entrenando').length}</strong><small>continúa aprendiendo</small></div>
      <div><span>Mejor resultado</span><strong>92.4%</strong><small>clasificador visual</small></div>
    </section>
    <section className="featured-project panel">
      <div className="featured-copy"><span className="project-status training">● Entrenando</span><span className="eyebrow">PROYECTO DESTACADO</span><h2>Detector de residuos reciclables</h2><p>Un proyecto más compuesto que combina preparación de imágenes, aumento de datos, MobileNet y evaluación multiclase.</p><div className="project-tags"><span>Visión</span><span>MobileNet</span><span>4 clases</span><span>GPU</span></div><div className="featured-progress"><div><span>Entrenamiento</span><strong>72%</strong></div><i><b style={{width:'72%'}}/></i></div><button className="primary" onClick={()=>openProject(mockProjects[1])}>Continuar proyecto <ArrowRight size={16}/></button></div>
      <div className="featured-pipeline"><div><Database size={20}/><span>Dataset</span><small>3,840 imgs</small></div><ArrowRight/><div><WandSparkles size={20}/><span>Augmentation</span><small>Flip + crop</small></div><ArrowRight/><div><BrainCircuit size={20}/><span>MobileNet</span><small>Transfer learning</small></div><ArrowRight/><div><BarChart3 size={20}/><span>Evaluar</span><small>4 clases</small></div></div>
    </section>
    <section className="projects-toolbar">
      <div className="project-filters">{['Todos','En progreso','Entrenando','Completado','Borrador'].map(item=><button key={item} className={filter===item?'active':''} onClick={()=>setFilter(item)}>{item}</button>)}</div>
      <div className="projects-search"><Search size={16}/><span>Buscar por nombre, modelo o categoría</span></div>
    </section>
    <section className="projects-grid">
      {filtered.map(project=><article className="project-library-card" key={project.id}>
        <div className={`project-cover ${project.tone}`}><span>{project.icon}</span><div><small>{project.type}</small><strong>{project.model}</strong></div></div>
        <div className="project-card-body"><div className="project-card-top"><span className={`project-status ${project.status.toLowerCase().replace(' ','-')}`}>{project.status}</span><small>{project.updated}</small></div><h3>{project.title}</h3><p>{project.description}</p><div className="project-tags">{project.tags.map(tag=><span key={tag}>{tag}</span>)}</div><div className="project-card-metrics"><div><small>{project.metricLabel}</small><strong>{project.metric}</strong></div><div><small>Nivel</small><strong>{project.level}</strong></div></div><div className="project-progress"><div><span>Progreso</span><strong>{project.progress}%</strong></div><i><b style={{width:`${project.progress}%`}}/></i></div><div className="project-card-actions"><button className="secondary" onClick={()=>openProject(project)}>Abrir proyecto</button><button className="icon-button" title="Más opciones">•••</button></div></div>
      </article>)}
      <button className="new-project-card" onClick={()=>navigate('/crear')}><span><Plus size={28}/></span><strong>Crear otro proyecto</strong><p>Empieza desde una plantilla o construye un pipeline desde cero.</p></button>
    </section>
  </Page>
}

function CreateProject() {
  const navigate=useNavigate(); const {name,type,level,setName,setType,setLevel}=useProjectStore(); const levels:ProjectLevel[]=['Principiante','Intermedio','Avanzado']
  return <Page><div className="narrow-page"><Link className="back-link" to="/">← Volver al inicio</Link><div className="wizard-progress"><span className="active">1 Información</span><span>2 Datos</span><span>3 Objetivo</span><span>4 Confirmar</span></div><div className="two-column">
    <section className="panel form-panel"><span className="eyebrow">NUEVO PROYECTO</span><h1>Cuéntanos qué quieres construir</h1><label>Nombre del proyecto<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Tipo de proyecto</label><div className="option-grid">{['Clasificación de imágenes','Predicción con datos','Clasificador de textos','Regresión'].map(item=><button key={item} onClick={()=>setType(item)} className={type===item?'option selected':'option'}>{item}</button>)}</div><label>Nivel</label><div className="level-row">{levels.map(item=><button key={item} onClick={()=>setLevel(item)} className={level===item?'chip active':'chip'}>{item}</button>)}</div><div className="actions"><Link className="secondary button-link" to="/">Cancelar</Link><button className="primary" onClick={()=>navigate('/dataset')}>Continuar <ArrowRight size={17}/></button></div></section>
    <aside className="panel preview-panel"><span className="eyebrow">VISTA PREVIA</span><h3>{name||'Proyecto sin nombre'}</h3><div className="preview-visual">🧠 <span>→</span> ✨</div><dl><dt>Tipo</dt><dd>{type}</dd><dt>Nivel</dt><dd>{level}</dd><dt>Dificultad estimada</dt><dd>Baja</dd></dl><div className="tip"><Sparkles size={18}/><div><strong>Bloques recomendados</strong><p>Dataset → Procesar → Modelo → Entrenar → Evaluar</p></div></div></aside>
  </div></div></Page>
}

function DatasetPage(){const navigate=useNavigate();return <Page stepper><div className="page-title"><div><span className="eyebrow">PASO 1</span><h1>Cargar dataset</h1><p>Selecciona el origen de tus datos y revisa su balance.</p></div><button className="secondary"><CircleHelp size={17}/>Ver guía</button></div><div className="source-tabs"><button className="active"><UploadCloud size={19}/>Subir archivos</button><button><Camera size={19}/>Webcam</button><button><Database size={19}/>Ejemplo</button><button><Link2 size={19}/>URL</button><button><HardDrive size={19}/>Drive</button></div><div className="two-column dataset-layout"><section className="panel upload-panel"><UploadCloud size={42}/><h3>Arrastra y suelta tus imágenes aquí</h3><p>JPG, PNG o WEBP · máximo 10 MB por archivo</p><button className="secondary">Seleccionar archivos</button><div className="thumb-row"><span>🐶</span><span>🐱</span><span>🐕</span><span>🐈</span><span>🐶</span><span>＋</span></div></section><aside className="panel dataset-summary"><div className="status"><CheckCircle2 size={18}/>Listo para usar</div><h3>Resumen del dataset</h3><div className="stats"><div><strong>1,010</strong><small>imágenes</small></div><div><strong>2</strong><small>clases</small></div></div><div className="class-bar"><div><span>Perro</span><b>520 · 51.5%</b></div><i style={{width:'51.5%'}}/></div><div className="class-bar purple"><div><span>Gato</span><b>490 · 48.5%</b></div><i style={{width:'48.5%'}}/></div></aside></div><div className="actions end"><button className="primary" onClick={()=>navigate('/preparacion')}>Usar este dataset <ArrowRight size={17}/></button></div></Page>}

function PreparationPage(){const navigate=useNavigate();const cards:Array<[IconType,string,string,string]>=[[ImageIcon,'Resize','224 × 224 px','Redimensiona todas las imágenes a un tamaño uniforme.'],[SlidersHorizontal,'Normalizar','Rango 0–1','Escala los píxeles para estabilizar el aprendizaje.'],[Split,'Dividir datos','70 / 15 / 15','Separa entrenamiento, validación y prueba.']];return <Page stepper><div className="page-title"><div><span className="eyebrow">PASO 2</span><h1>Preparar datos</h1><p>Configura las transformaciones antes de entrenar.</p></div></div><div className="pipeline-strip">{cards.map(([Icon,title],i)=><div key={title}><span><Icon size={19}/></span><strong>{title}</strong>{i<cards.length-1&&<ArrowRight size={18}/>}</div>)}</div><div className="three-grid">{cards.map(([Icon,title,detail,text])=><section className="panel config-card" key={title}><div className="config-title"><span className="card-icon violet"><Icon size={20}/></span><strong>{title}</strong><CheckCircle2 size={18}/></div><label>Configuración<input value={detail} readOnly/></label><p>{text}</p></section>)}</div><div className="tip"><WandSparkles size={20}/><div><strong>Aprende mientras creas</strong><p>La preparación consistente mejora el entrenamiento y permite evaluar el modelo con datos separados.</p></div></div><div className="actions end"><button className="secondary"><Save size={17}/>Guardar cambios</button><button className="primary" onClick={()=>navigate('/modelo')}>Continuar <ArrowRight size={17}/></button></div></Page>}

function ModelPage(){const navigate=useNavigate();const [selected,setSelected]=useState('CNN');const models=['Regresión logística','Árbol de decisión','Random Forest','Red neuronal','CNN','ResNet18','MobileNet','Transformer'];return <Page stepper><div className="page-title"><div><span className="eyebrow">PASO 3</span><h1>Elige y configura tu modelo</h1><p>Explora alternativas y empieza por una opción comprensible.</p></div></div><div className="model-layout"><div className="model-grid">{models.map(model=><button key={model} onClick={()=>setSelected(model)} className={selected===model?'model-card selected':'model-card'}><BrainCircuit size={24}/><strong>{model}</strong><small>{model==='CNN'?'Ideal para imágenes · Intermedio':'Disponible para explorar'}</small>{selected===model&&<CheckCircle2 size={18}/>}</button>)}</div><aside className="panel inspector"><span className="eyebrow">MODELO SELECCIONADO</span><h2>{selected}</h2><p>Configuración sugerida para el prototipo educativo.</p><label>Capas<input value="3" readOnly/></label><label>Filtros<input value="32, 64, 128" readOnly/></label><label>Activación<input value="ReLU" readOnly/></label><label>Dropout<input value="0.25" readOnly/></label><div className="network-preview"><span>Entrada</span><ArrowRight size={15}/><span>Capa 1</span><ArrowRight size={15}/><span>Capa 2</span><ArrowRight size={15}/><span>Salida</span></div><button className="primary full" onClick={()=>navigate('/editor')}>Usar modelo <ArrowRight size={17}/></button></aside></div></Page>}

const nodes:Node[]=[
  {id:'dataset',position:{x:30,y:110},data:{label:'📚 Dataset\n1,010 ejemplos'},style:{background:'#eef6ff',border:'1px solid #90c2ff',width:150}},
  {id:'resize',position:{x:230,y:55},data:{label:'🧹 Preparar\nTransformación'},style:{background:'#f5efff',border:'1px solid #c6a7ff',width:150}},
  {id:'normalize',position:{x:230,y:175},data:{label:'🎚️ Normalizar\n0–1'},style:{background:'#f5efff',border:'1px solid #c6a7ff',width:150}},
  {id:'split',position:{x:440,y:110},data:{label:'✂️ Dividir datos\n70 / 15 / 15'},style:{background:'#eef6ff',border:'1px solid #90c2ff',width:150}},
  {id:'cnn',position:{x:650,y:110},data:{label:'🧠 Modelo\nConfigurable'},style:{background:'#ecfbf5',border:'2px solid #42b88a',width:150}},
  {id:'train',position:{x:860,y:55},data:{label:'⚙️ Entrenar\n20 épocas'},style:{background:'#f3efff',border:'1px solid #aa91ff',width:150}},
  {id:'eval',position:{x:860,y:175},data:{label:'📊 Evaluar\nMétricas'},style:{background:'#fff7e7',border:'1px solid #f2c36b',width:150}},
]
const edges:Edge[]=[{id:'e1',source:'dataset',target:'resize'},{id:'e2',source:'resize',target:'normalize'},{id:'e3',source:'normalize',target:'split'},{id:'e4',source:'split',target:'cnn'},{id:'e5',source:'cnn',target:'train'},{id:'e6',source:'train',target:'eval'}]

function EditorPage(){const navigate=useNavigate();const{name,type,level}=useProjectStore();return <Page stepper><div className="editor-head"><div><span className="eyebrow">EDITOR VISUAL · {type} · {level}</span><h1>{name}</h1></div><div><Link className="secondary button-link" to="/proyectos"><FolderOpen size={17}/>Mis proyectos</Link><button className="secondary"><Save size={17}/>Guardar</button><button className="primary" onClick={()=>navigate('/entrenamiento')}><Play size={17}/>Ejecutar proyecto</button></div></div><div className="editor-layout"><aside className="panel block-palette"><h3>Bloques</h3><div className="search small"><Search size={15}/><span>Buscar bloques...</span></div>{palette.map(([label,Icon])=><button key={label}><Icon size={18}/><span>{label}</span><Plus size={15}/></button>)}</aside><section className="flow-canvas"><ReactFlow nodes={nodes} edges={edges} fitView><Background gap={20} size={1}/><Controls/><MiniMap zoomable pannable/></ReactFlow></section><aside className="panel inspector editor-inspector"><span className="eyebrow">PROPIEDADES</span><h2>Modelo</h2><p>Configura el bloque seleccionado.</p><label>Arquitectura<input value="Modelo del proyecto" readOnly/></label><label>Iteraciones<input value="20" readOnly/></label><label>Optimizador<input value="Adam" readOnly/></label><label>Learning rate<input value="0.001" readOnly/></label><div className="tip compact"><CircleHelp size={17}/><div><strong>Aprende mientras construyes</strong><p>Cada bloque representa una etapa del pipeline de IA.</p></div></div></aside></div></Page>}

function TrainingPage(){const navigate=useNavigate();const metrics:Array<[string,string,IconType]>=[['Accuracy entrenamiento','92.4%',Target],['Accuracy validación','89.7%',Gauge],['Loss','0.238',Activity]];return <Page stepper><section className="training-hero"><div><span className="eyebrow">ENTRENAMIENTO SIMULADO</span><h1>Entrenando modelo</h1><p>Esta pantalla usa datos mock para validar la experiencia antes de conectar el servidor ML.</p><div className="progress"><i style={{width:'40%'}}/></div><div className="progress-meta"><span>Época 8 / 20</span><strong>40%</strong></div></div><BrainCircuit size={72}/></section><div className="metric-grid">{metrics.map(([label,value,Icon])=><div className="metric-card" key={label}><Icon size={22}/><span>{label}</span><strong>{value}</strong><small>Actualizado hace unos segundos</small></div>)}</div><div className="chart-grid"><section className="panel chart-card"><h3>Accuracy por época</h3><div className="fake-chart"><svg viewBox="0 0 500 180" preserveAspectRatio="none"><polyline points="0,155 60,135 120,112 180,95 240,72 300,62 360,45 420,34 500,26" fill="none" stroke="currentColor" strokeWidth="4"/><polyline className="purple-line" points="0,160 60,143 120,123 180,108 240,88 300,78 360,62 420,54 500,45" fill="none" strokeWidth="4"/></svg></div></section><section className="panel log-card"><h3>Registro</h3><code>✓ Dataset preparado</code><code>✓ Modelo inicializado</code><code>✓ Época 7 completada</code><code>→ Entrenando época 8/20...</code></section></div><div className="actions between"><div><button className="secondary"><Pause size={17}/>Pausar</button><button className="danger"><Square size={15}/>Detener</button></div><button className="primary" onClick={()=>navigate('/evaluacion')}>Ver resultado simulado <ArrowRight size={17}/></button></div></Page>}

function EvaluationPage(){const navigate=useNavigate();return <Page stepper><div className="success-banner"><CheckCircle2 size={32}/><div><span className="eyebrow">EVALUACIÓN COMPLETADA</span><h1>Tu modelo tiene un buen resultado</h1><p>Ahora revisa las métricas y dónde se equivoca.</p></div></div><div className="metric-grid four">{[['Accuracy','91.7%'],['Precision','90.2%'],['Recall','92.1%'],['F1 Score','91.1%']].map(([label,value])=><div className="metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>Resultado mock</small></div>)}</div><div className="two-column eval-layout"><section className="panel"><h3>Matriz de confusión</h3><div className="confusion"><span></span><b>Clase A</b><b>Clase B</b><b>Clase A</b><strong>92</strong><em>8</em><b>Clase B</b><em>6</em><strong>94</strong></div></section><section className="panel"><h3>Errores comunes</h3><div className="mistakes"><div>🔎 <span>Ejemplo mal clasificado</span></div><div>🔎 <span>Confianza baja</span></div><div>🔎 <span>Caso ambiguo</span></div></div><div className="tip compact"><Sparkles size={17}/><div><strong>Qué significa accuracy</strong><p>91.7% indica que el modelo acierta aproximadamente 92 de cada 100 ejemplos.</p></div></div></section></div><div className="actions end"><button className="secondary" onClick={()=>navigate('/editor')}>Mejorar modelo</button><button className="primary" onClick={()=>navigate('/prediccion')}>Probar modelo <ArrowRight size={17}/></button></div></Page>}

function PredictionPage(){return <Page stepper><div className="page-title"><div><span className="eyebrow">PASO FINAL</span><h1>Probar modelo</h1><p>Comprueba cómo se sentirá usar el modelo entrenado.</p></div></div><div className="two-column prediction-layout"><section className="panel test-card"><div className="tab-row"><button className="active"><UploadCloud size={17}/>Subir entrada</button><button><Camera size={17}/>Capturar</button></div><div className="prediction-drop">🧪<strong>ejemplo_de_prueba</strong><small>Entrada de demostración</small></div><button className="primary full"><Play size={17}/>Probar entrada</button><div className="prediction-result"><div><small>Predicción</small><h2>CLASE A</h2><span>Alta confianza</span></div><div className="probabilities"><p><span>Clase A</span><b>97%</b></p><i style={{width:'97%'}}/><p><span>Clase B</span><b>3%</b></p><i className="short"/></div></div></section><section className="panel code-card"><div className="tab-row"><button className="active"><Code2 size={17}/>Ver código</button><button><Share2 size={17}/>Exportar</button></div><pre><code>{`import tensorflow as tf
from tensorflow import keras

model = keras.Sequential([
    keras.layers.Dense(64, activation="relu"),
    keras.layers.Dense(2, activation="softmax")
])

model.compile(optimizer="adam", metrics=["accuracy"])`}</code></pre><div className="actions end"><button className="secondary"><Share2 size={17}/>Compartir</button><button className="primary"><Download size={17}/>Descargar modelo</button></div></section></div></Page>}

function NotFound(){return <Page><div className="empty-state"><h1>404</h1><p>Esta pantalla todavía no existe.</p><Link className="button-link primary" to="/">Volver al inicio</Link></div></Page>}

export default function App(){return <Routes><Route path="/" element={<Dashboard/>}/><Route path="/proyectos" element={<ProjectsPage/>}/><Route path="/crear" element={<CreateProject/>}/><Route path="/dataset" element={<DatasetPage/>}/><Route path="/preparacion" element={<PreparationPage/>}/><Route path="/modelo" element={<ModelPage/>}/><Route path="/editor" element={<EditorPage/>}/><Route path="/entrenamiento" element={<TrainingPage/>}/><Route path="/evaluacion" element={<EvaluationPage/>}/><Route path="/prediccion" element={<PredictionPage/>}/><Route path="*" element={<NotFound/>}/></Routes>}
