import { ArrowRight, AudioLines, BrainCircuit, ClipboardList, Cpu, Database, GraduationCap, Hand, Image, PencilLine, PersonStanding, Type, Users } from 'lucide-react'
import { Link } from 'react-router'

const projectTypes = [
  { icon: Type, title: 'Reconocedor de caracteres', text: 'Números, letras y símbolos matemáticos.' },
  { icon: Image, title: 'Clasificador de imágenes', text: 'Frutas, figuras geométricas y animales.' },
  { icon: AudioLines, title: 'Reconocedor de sonidos cortos', text: 'Palmadas, silbidos y palabras cortas.' },
  { icon: Hand, title: 'Clasificador de gestos de la mano', text: 'Mano abierta, puño y pulgar arriba o abajo.' },
  { icon: PersonStanding, title: 'Clasificador de posturas corporales', text: 'Sentado, de pie y brazos arriba o abajo.' },
  { icon: PencilLine, title: 'Clasificador de dibujos simples', text: 'Casas, animales y figuras dibujadas.' }
]
const steps = [
  ['Proyecto', 'Elige el tipo de proyecto y ponle nombre.'],
  ['Datos', 'Sube un ZIP con una carpeta por categoría.'],
  ['Preparación', 'Revisa tus ejemplos y separa el conjunto de prueba.'],
  ['Configuración', 'Ajusta épocas, learning rate, batch size y el tamaño de la CNN.'],
  ['Entrenar', 'La CNN aprende en tu navegador y ves las métricas por época.'],
  ['Evaluar', 'Revisa la accuracy de prueba, la matriz de confusión y los errores.'],
  ['Probar', 'Prueba con un dibujo, una foto o tu voz, y descarga el modelo.']
]
const classroom = [
  { icon: ClipboardList, title: 'Tareas con fecha y nota', text: 'El docente publica la descripción, la consigna, el plazo y el rango de notas.' },
  { icon: GraduationCap, title: 'Entrega y calificación', text: 'El alumno entrega su proyecto entrenado y recibe su nota con un comentario.' },
  { icon: Users, title: 'Cuentas sencillas', text: 'El docente crea a sus alumnos en el salón y restablece sus contraseñas.' }
]

export function LandingPage() {
  return <main className="landing-page">
    <header className="landing-header">
      <span className="brand"><span className="brand-mark"><BrainCircuit size={22} /></span>AI <strong>Studio</strong></span>
      <Link className="secondary button-link" to="/login">Iniciar sesión</Link>
    </header>

    <section className="landing-hero">
      <div>
        <span className="eyebrow">LABORATORIO EDUCATIVO DE IA</span>
        <h1>Entrena modelos de IA que <em>reconocen imágenes, sonidos y dibujos.</em></h1>
        <p>AI Studio guía a alumnos y docentes para crear un proyecto, preparar su dataset, entrenar una red neuronal en el navegador y probarla. En el salón, el docente publica tareas y califica los proyectos entregados.</p>
        <Link className="primary button-link landing-login" to="/login">Iniciar sesión <ArrowRight size={18} /></Link>
        <small>Acceso para alumnos, docentes y administradores. Las cuentas las crea el colegio.</small>
      </div>
      <aside className="landing-preview" aria-label="Resumen de AI Studio">
        <div className="landing-flow" aria-hidden="true"><span>ZIP</span><i>→</i><span>CNN</span><i>→</i><span>Predicción</span></div>
        <dl className="landing-stats">
          <div><dt>6</dt><dd>tipos de proyecto</dd></div>
          <div><dt>7</dt><dd>pasos guiados</dd></div>
          <div><dt>TF.js</dt><dd>en el navegador</dd></div>
        </dl>
      </aside>
    </section>

    <section className="landing-section" aria-labelledby="landing-types">
      <span className="eyebrow">QUÉ PUEDES CREAR</span>
      <h2 id="landing-types">Seis tipos de proyecto</h2>
      <ul className="landing-types">{projectTypes.map(({ icon: Icon, title, text }) => <li key={title}><Icon size={24} aria-hidden="true" /><strong>{title}</strong><span>{text}</span></li>)}</ul>
    </section>

    <section className="landing-section" aria-labelledby="landing-steps">
      <span className="eyebrow">CÓMO SE ENTRENA</span>
      <h2 id="landing-steps">Del dataset a la predicción, paso a paso</h2>
      <ol className="landing-steps">{steps.map(([title, text], i) => <li key={title}><span className="landing-step-number">{i}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}</ol>
    </section>

    <section className="landing-section" aria-labelledby="landing-classroom">
      <span className="eyebrow">PARA EL SALÓN</span>
      <h2 id="landing-classroom">Tareas, entregas y notas en un solo lugar</h2>
      <div className="landing-features">{classroom.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={23} aria-hidden="true" /><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>

    <section className="landing-section landing-trust">
      <article><Cpu size={23} aria-hidden="true" /><div><h3>Entrenamiento real</h3><p>TensorFlow.js entrena la red neuronal en el navegador y usa la GPU del equipo cuando está disponible.</p></div></article>
      <article><Database size={23} aria-hidden="true" /><div><h3>Todo queda guardado</h3><p>El dataset, el modelo y los resultados se guardan en el proyecto para continuar desde otro equipo.</p></div></article>
    </section>

    <section className="landing-cta">
      <h2>¿Listo para entrenar tu primer modelo?</h2>
      <Link className="primary button-link landing-login" to="/login">Iniciar sesión <ArrowRight size={18} /></Link>
    </section>
    <footer className="landing-footer">AI Studio · Proyecto Integrador 2</footer>
  </main>
}
