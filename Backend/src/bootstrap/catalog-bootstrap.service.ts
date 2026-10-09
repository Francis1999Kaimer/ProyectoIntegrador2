import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const courseSlug = 'ia-bloques-24';
const weekId = (number: number) => `20000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const weeks = [
  ['¿Qué es la inteligencia?', 'Distinguir formas de inteligencia y reconocer ejemplos cotidianos.'],
  ['Máquinas que ayudan', 'Identificar cómo las máquinas ayudan en actividades cotidianas.'],
  ['¿Cómo aprendemos?', 'Comparar el aprendizaje humano con el de las máquinas.'],
  ['Datos: la comida de la IA', 'Reconocer la función de los datos en el aprendizaje automático.'],
  ['Reconocer y clasificar', 'Clasificar ejemplos de imágenes, sonidos y textos.'],
  ['Reglas o ejemplos', 'Diferenciar reglas programadas del aprendizaje basado en ejemplos.'],
  ['Armar un conjunto de datos', 'Reunir ejemplos variados para un problema sencillo.'],
  ['Etiquetar correctamente', 'Asignar etiquetas claras y reconocer errores.'],
  ['Entrenamiento y prueba', 'Separar ejemplos para aprender y evaluar.'],
  ['Mi primer modelo', 'Construir el primer flujo de clasificación por bloques.'],
  ['Épocas y práctica', 'Entender cómo las repeticiones afectan el entrenamiento.'],
  ['Probar el modelo', 'Medir aciertos y errores usando ejemplos nuevos.'],
  ['Cuando el modelo se equivoca', 'Detectar errores y proponer correcciones.'],
  ['Más datos, mejores resultados', 'Evaluar cuándo añadir datos mejora los resultados.'],
  ['Datos desbalanceados', 'Reconocer la importancia de ejemplos representativos.'],
  ['Memorizar o entender', 'Explorar el sobreajuste y la generalización.'],
  ['Ajustar parámetros', 'Experimentar con parámetros y comparar resultados.'],
  ['Comparar modelos', 'Comparar métricas y seleccionar un modelo justificado.'],
  ['Sesgos en los datos', 'Reconocer fuentes sencillas de sesgos en datasets.'],
  ['Privacidad de la información', 'Practicar hábitos de protección de datos personales.'],
  ['IA justa y segura', 'Evaluar resultados de IA con criterios de equidad.'],
  ['IA en la vida real', 'Identificar aplicaciones responsables en distintos sectores.'],
  ['Proyecto final: construir', 'Planificar y experimentar con un proyecto de IA propio.'],
  ['Proyecto final: presentar', 'Explicar decisiones y aprendizajes del proyecto final.']
] as const;

@Injectable()
export class CatalogBootstrapService implements OnApplicationBootstrap {
  constructor(private readonly db: PrismaService) {}
  async onApplicationBootstrap() {
    // Las pruebas sustituyen Prisma por repositorios en memoria: no deben tocar
    // una base real ni exigir que los dobles implementen el catálogo.
    if (process.env.NODE_ENV === 'test') return;
    await this.db.$transaction(async tx => {
      await tx.levels.createMany({ data: [
        { slug: 'exploradores', name: 'Exploradores', min_age: 5, max_age: 6 },
        { slug: 'aventureros', name: 'Aventureros', min_age: 7, max_age: 10 },
        { slug: 'expertos', name: 'Expertos', min_age: 10, max_age: null }
      ], skipDuplicates: true });
      const course = await tx.courses.upsert({ where: { slug: courseSlug }, update: {}, create: {
        id: '10000000-0000-4000-8000-000000000001', slug: courseSlug,
        title: 'Mi aventura con inteligencia artificial',
        description: 'Curso educativo de 24 semanas; contenido piloto de la semana 1 para APF2.', total_weeks: 24, status: 'published'
      } });
      await tx.course_weeks.createMany({ data: weeks.map(([title, objective], index) => ({
        id: weekId(index + 1), course_id: course.id, week_number: index + 1, phase: index < 6 ? 1 : index < 18 ? 2 : 3, title, objective
      })), skipDuplicates: true });
      const levels = await tx.levels.findMany({ where: { slug: { in: ['exploradores', 'aventureros', 'expertos'] } }, select: { id: true, slug: true } });
      const level = Object.fromEntries(levels.map(item => [item.slug, item.id]));
      const firstWeek = weekId(1);
      await tx.lessons.createMany({ data: [
        { id: '30000000-0000-4000-8000-000000000001', course_week_id: firstWeek, level_id: level.exploradores, title: '¿Qué cosas son inteligentes?', summary: 'Descubrimos juntos qué es aprender y cómo algunas máquinas pueden ayudarnos.', content_json: JSON.stringify({ schemaVersion: 1, sections: [{ type: 'story', title: '¡Hola, explorador!', text: 'Aprendemos al observar y practicar con muchos ejemplos.' }] }), duration_minutes: 30, status: 'published' },
        { id: '30000000-0000-4000-8000-000000000002', course_week_id: firstWeek, level_id: level.aventureros, title: 'Descubre la inteligencia artificial', summary: 'Exploramos qué significa aprender con ejemplos y ayudar a otras personas.', content_json: JSON.stringify({ schemaVersion: 1, sections: [{ type: 'learn', title: 'Patrones y ejemplos', text: 'La IA aprende patrones de ejemplos bien seleccionados.' }] }), duration_minutes: 30, status: 'published' },
        { id: '30000000-0000-4000-8000-000000000003', course_week_id: firstWeek, level_id: level.expertos, title: 'Introducción a sistemas inteligentes', summary: 'Comparamos ejemplos, reglas y aprendizaje de patrones con pensamiento crítico.', content_json: JSON.stringify({ schemaVersion: 1, sections: [{ type: 'learn', title: 'Datos, reglas y modelos', text: 'La calidad y diversidad de los datos afecta los resultados.' }] }), duration_minutes: 30, status: 'published' }
      ], skipDuplicates: true });
      await tx.challenges.createMany({ data: [
        { id: '40000000-0000-4000-8000-000000000001', course_week_id: firstWeek, level_id: level.exploradores, title: 'Reto: encuentra los ejemplos', challenge_type: 'quiz', config_json: JSON.stringify({ schemaVersion: 1, instructions: 'Elige los ejemplos correctos para ayudar a Nubi.' }), time_limit_seconds: 600, max_attempts: 3, max_score: 100, status: 'published' },
        { id: '40000000-0000-4000-8000-000000000002', course_week_id: firstWeek, level_id: level.aventureros, title: 'Reto: clasifica con lógica', challenge_type: 'game', config_json: JSON.stringify({ schemaVersion: 1, instructions: 'Clasifica correctamente las tarjetas.' }), time_limit_seconds: 900, max_attempts: 3, max_score: 100, status: 'published' },
        { id: '40000000-0000-4000-8000-000000000003', course_week_id: firstWeek, level_id: level.expertos, title: 'Reto: analiza el aprendizaje', challenge_type: 'quiz', config_json: JSON.stringify({ schemaVersion: 1, instructions: 'Explica el papel de los datos en un modelo.' }), time_limit_seconds: 1200, max_attempts: 3, max_score: 100, status: 'published' }
      ], skipDuplicates: true });
    });
  }
}
