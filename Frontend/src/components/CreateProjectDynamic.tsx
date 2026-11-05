import { useState } from 'react'
import { ArrowRight, Target } from 'lucide-react'
import { Link } from 'react-router'
import { type Classroom } from '../api/types'
import { useResource } from '../api/useResource'
import { useProjectStore } from '../store/project'
import { ApiMessage, Header } from './AppShell'

const projectTypes = [
  { id: 'characters', title: 'Reconocedor de caracteres', description: 'Números, letras y símbolos.' },
  { id: 'images', title: 'Clasificador de imágenes', description: 'Frutas, figuras y animales.' },
  { id: 'sounds', title: 'Reconocedor de sonidos cortos', description: 'Palmadas, silbidos y palabras.' },
  { id: 'hands', title: 'Clasificador de gestos de la mano', description: 'Mano abierta, puño y otros gestos.' },
  { id: 'postures', title: 'Clasificador de posturas corporales', description: 'Diferentes posturas del cuerpo.' },
  { id: 'drawings', title: 'Clasificador de dibujos simples', description: 'Casas, animales y figuras dibujadas.' },
] as const

export default function CreateProjectDynamic() {
  const { name, setName } = useProjectStore()
  const rooms = useResource<Classroom[]>('/classrooms?limit=100')
  const [classroom, setClassroom] = useState('')
  const [type, setType] = useState<string>('characters')

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
        <div className="actions wizard-actions">
          <Link className="secondary button-link" to="/">Cancelar</Link>
          <button type="button" className="primary">Siguiente <ArrowRight size={17} /></button>
        </div>
      </section>
    </main>
  </>
}
