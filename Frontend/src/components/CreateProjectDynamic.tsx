import { useState } from 'react'
import { ArrowRight, Target } from 'lucide-react'
import { Link } from 'react-router'
import { type Classroom } from '../api/types'
import { useResource } from '../api/useResource'
import { useProjectStore } from '../store/project'
import { ApiMessage, Header } from './AppShell'

const projectTypes = [
  { id: 'characters', title: 'Reconocedor de caracteres', description: 'Números, letras y símbolos.', examples: ['Reconocedor de números', 'Reconocedor de letras del español', 'Reconocedor de símbolos matemáticos'], dataset: 'letras.zip\n├── A/\n│   ├── imagen_001.png\n│   └── imagen_002.png\n└── B/\n    ├── imagen_001.png\n    └── imagen_002.png', note: 'ZIP con carpetas por etiqueta e imágenes PNG o JPG. Cada imagen contiene un carácter; se prepara a 28 × 28 píxeles en escala de grises.' },
  { id: 'images', title: 'Clasificador de imágenes', description: 'Frutas, figuras y animales.', examples: ['Clasificador de frutas', 'Clasificador de figuras geométricas', 'Clasificador de animales'], dataset: 'frutas.zip\n├── manzana/\n│   ├── foto_001.jpg\n│   └── foto_002.jpg\n└── naranja/\n    ├── foto_001.jpg\n    └── foto_002.jpg', note: 'Formato propuesto: ZIP con carpetas por categoría e imágenes JPG o PNG.' },
  { id: 'sounds', title: 'Reconocedor de sonidos cortos', description: 'Palmadas, silbidos y palabras.', examples: ['Reconocedor de palmadas', 'Reconocedor de silbidos', 'Reconocedor de palabras cortas'], dataset: 'sonidos.zip\n├── palmada/\n│   ├── audio_001.wav\n│   └── audio_002.wav\n└── silbido/\n    ├── audio_001.wav\n    └── audio_002.wav', note: 'Formato propuesto: ZIP con carpetas por categoría y grabaciones WAV cortas.' },
  { id: 'hands', title: 'Clasificador de gestos de la mano', description: 'Mano abierta, puño y otros gestos.', examples: ['Reconocedor de mano abierta y puño', 'Reconocedor de pulgar arriba y abajo', 'Controlador de juegos con gestos de la mano'], dataset: 'gestos.zip\n├── mano_abierta/\n│   ├── foto_001.jpg\n│   └── foto_002.jpg\n└── puno/\n    ├── foto_001.jpg\n    └── foto_002.jpg', note: 'Formato propuesto: ZIP con imágenes JPG o PNG de gestos estáticos, organizadas por categoría.' },
  { id: 'postures', title: 'Clasificador de posturas corporales', description: 'Diferentes posturas del cuerpo.', examples: ['Reconocedor de brazos arriba y abajo', 'Reconocedor de posturas sentado y de pie', 'Controlador de juegos con posturas corporales'], dataset: 'posturas.zip\n├── sentado/\n│   ├── foto_001.jpg\n│   └── foto_002.jpg\n└── de_pie/\n    ├── foto_001.jpg\n    └── foto_002.jpg', note: 'Formato propuesto: ZIP con imágenes JPG o PNG de posturas estáticas, organizadas por categoría.' },
  { id: 'drawings', title: 'Clasificador de dibujos simples', description: 'Casas, animales y figuras dibujadas.', examples: ['Reconocedor de dibujos de casas', 'Reconocedor de dibujos de animales', 'Reconocedor de figuras geométricas dibujadas'], dataset: 'dibujos.zip\n├── casa/\n│   ├── dibujo_001.png\n│   └── dibujo_002.png\n└── arbol/\n    ├── dibujo_001.png\n    └── dibujo_002.png', note: 'Formato propuesto: ZIP con dibujos JPG o PNG organizados por categoría.' },
] as const

export default function CreateProjectDynamic() {
  const { name, setName } = useProjectStore()
  const rooms = useResource<Classroom[]>('/classrooms?limit=100')
  const [classroom, setClassroom] = useState('')
  const [type, setType] = useState<string>('characters')

  const selected = projectTypes.find(item => item.id === type) ?? projectTypes[0]

  return <>
    <Header />
    <main className="page wizard-page new-project-page">
      <Link className="back-link" to="/">← Volver al inicio</Link>
      <section className="panel form-panel wizard-main-panel new-project-panel">
        <span className="eyebrow">NUEVO PROYECTO</span>
        <h1>Entrena un proyecto nuevo</h1>
        <div className="new-project-fields">
          <label>Nombre del proyecto<input required maxLength={180} value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Reconocedor de números" /></label>
          <label>Salón (opcional)<select value={classroom} onChange={e => setClassroom(e.target.value)}><option value="">Proyecto personal</option>{rooms.data?.filter(r => r.status === 'active').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        </div>
        <ApiMessage {...rooms} retry={rooms.reload} />
        <section aria-labelledby="project-types-heading">
          <h2 id="project-types-heading">Tipo de proyecto</h2>
          <p className="new-project-hint">Elige el tipo de proyecto que deseas crear.</p>
          <div className="project-type-selector">
            {projectTypes.map(item => <button key={item.id} type="button" className={`project-type-option${type === item.id ? ' selected' : ''}`} aria-pressed={type === item.id} onClick={() => setType(item.id)}>
              <span className="project-type-icon" aria-hidden="true"><Target size={20} /></span>
              <span><strong>{item.title}</strong><small>{item.description}</small></span>
              <span className="selection-mark" aria-hidden="true">{type === item.id ? '✓' : ''}</span>
            </button>)}
          </div>
        </section>
        <div className="project-type-details" aria-live="polite">
          <section aria-labelledby="project-examples-heading">
            <h2 id="project-examples-heading">Ejemplos de proyectos</h2>
            <ul>{selected.examples.map(example => <li key={example}>{example}</li>)}</ul>
          </section>
          <section aria-labelledby="dataset-example-heading">
            <h2 id="dataset-example-heading">Ejemplo de estructura del dataset</h2>
            <p>{selected.note}</p>
            <pre><code>{selected.dataset}</code></pre>
          </section>
        </div>
        <div className="actions wizard-actions">
          <Link className="secondary button-link" to="/">Cancelar</Link>
          <button type="button" className="primary">Siguiente <ArrowRight size={17} /></button>
        </div>
      </section>
    </main>
  </>
}
