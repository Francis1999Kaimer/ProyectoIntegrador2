-- AI Blocks Studio | Datos didácticos mínimos APF2 (repetible, sin usuarios ni contraseñas)
-- Ejecutar DESPUÉS de database/schema.sql en la misma BD.
-- Se crean 3 niveles, 1 curso, 24 semanas y la semana 1 con 3 clases y 3 retos piloto.
-- Las otras semanas son el esqueleto curricular: NO se presentan como contenido completo.
-- IDs UUID fijos únicamente para catálogos de ejemplo, nunca para cuentas reales.
-- Los INSERT son idempotentes; esta seed no sobrescribe ediciones de contenido preexistente.

INSERT INTO levels (id, slug, name, min_age, max_age) VALUES
  (1, 'exploradores', 'Exploradores', 5, 6),
  (2, 'aventureros', 'Aventureros', 7, 10),
  (3, 'expertos', 'Expertos', 10, NULL)
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO courses (id, slug, title, description, total_weeks, status) VALUES
  ('10000000-0000-4000-8000-000000000001', 'ia-bloques-24', 'Mi aventura con inteligencia artificial', 'Curso educativo de 24 semanas; contenido piloto de la semana 1 para APF2.', 24, 'published')
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO course_weeks (id, course_id, week_number, phase, title, objective) VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 1, 1, '¿Qué es la inteligencia?', 'Distinguir formas de inteligencia y reconocer ejemplos cotidianos.'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 2, 1, 'Máquinas que ayudan', 'Identificar cómo las máquinas ayudan en actividades cotidianas.'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 3, 1, '¿Cómo aprendemos?', 'Comparar el aprendizaje humano con el de las máquinas.'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 4, 1, 'Datos: la comida de la IA', 'Reconocer la función de los datos en el aprendizaje automático.'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 5, 1, 'Reconocer y clasificar', 'Clasificar ejemplos de imágenes, sonidos y textos.'),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 6, 1, 'Reglas o ejemplos', 'Diferenciar reglas programadas del aprendizaje basado en ejemplos.'),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', 7, 2, 'Armar un conjunto de datos', 'Reunir ejemplos variados para un problema sencillo.'),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', 8, 2, 'Etiquetar correctamente', 'Asignar etiquetas claras y reconocer errores.'),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000001', 9, 2, 'Entrenamiento y prueba', 'Separar ejemplos para aprender y evaluar.'),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', 10, 2, 'Mi primer modelo', 'Construir el primer flujo de clasificación por bloques.'),
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', 11, 2, 'Épocas y práctica', 'Entender cómo las repeticiones afectan el entrenamiento.'),
  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000001', 12, 2, 'Probar el modelo', 'Medir aciertos y errores usando ejemplos nuevos.'),
  ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001', 13, 2, 'Cuando el modelo se equivoca', 'Detectar errores y proponer correcciones.'),
  ('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000001', 14, 2, 'Más datos, mejores resultados', 'Evaluar cuándo añadir datos mejora los resultados.'),
  ('20000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000001', 15, 2, 'Datos desbalanceados', 'Reconocer la importancia de ejemplos representativos.'),
  ('20000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000001', 16, 2, 'Memorizar o entender', 'Explorar el sobreajuste y la generalización.'),
  ('20000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000001', 17, 2, 'Ajustar parámetros', 'Experimentar con parámetros y comparar resultados.'),
  ('20000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000001', 18, 2, 'Comparar modelos', 'Comparar métricas y seleccionar un modelo justificado.'),
  ('20000000-0000-4000-8000-000000000019', '10000000-0000-4000-8000-000000000001', 19, 3, 'Sesgos en los datos', 'Reconocer fuentes sencillas de sesgos en datasets.'),
  ('20000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-000000000001', 20, 3, 'Privacidad de la información', 'Practicar hábitos de protección de datos personales.'),
  ('20000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000001', 21, 3, 'IA justa y segura', 'Evaluar resultados de IA con criterios de equidad.'),
  ('20000000-0000-4000-8000-000000000022', '10000000-0000-4000-8000-000000000001', 22, 3, 'IA en la vida real', 'Identificar aplicaciones responsables en distintos sectores.'),
  ('20000000-0000-4000-8000-000000000023', '10000000-0000-4000-8000-000000000001', 23, 3, 'Proyecto final: construir', 'Planificar y experimentar con un proyecto de IA propio.'),
  ('20000000-0000-4000-8000-000000000024', '10000000-0000-4000-8000-000000000001', 24, 3, 'Proyecto final: presentar', 'Explicar decisiones y aprendizajes del proyecto final.')
ON DUPLICATE KEY UPDATE id = id;

-- Tres variantes educativas reales de la semana 1.
INSERT INTO lessons (id, course_week_id, level_id, title, summary, content_json, duration_minutes, status) VALUES
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, '¿Qué cosas son inteligentes?', 'Descubrimos juntos qué es aprender y cómo algunas máquinas pueden ayudarnos.', '{"schemaVersion":1,"sections":[{"type":"story","title":"¡Hola, explorador!","text":"Nubi encontró juguetes mezclados. ¿Le ayudas a descubrir cuáles son iguales?"},{"type":"learn","title":"Aprender es descubrir","text":"Una persona aprende con práctica. Una máquina aprende viendo muchos ejemplos."},{"type":"play","title":"Agrupa los objetos","text":"Arrastra dibujos al grupo correcto: animales, plantas u objetos."},{"type":"quiz","title":"¿Qué aprendimos?","questions":[{"question":"¿Se aprende practicando?","options":["Sí","No"],"correct":0},{"question":"¿Una máquina necesita ejemplos?","options":["Sí","Nunca"],"correct":0}]},{"type":"reflection","title":"Mi descubrimiento","text":"Hoy aprendí que los ejemplos ayudan a aprender."}]}', 30, 'published'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 2, 'Descubre la inteligencia artificial', 'Exploramos qué significa aprender con ejemplos y ayudar a otras personas.', '{"schemaVersion":1,"sections":[{"type":"story","title":"La misión del robot","text":"Un robot quiere ordenar objetos en una biblioteca escolar."},{"type":"learn","title":"Patrones y ejemplos","text":"La IA puede aprender patrones a partir de datos con ejemplos bien seleccionados."},{"type":"play","title":"Detective de patrones","text":"Clasifica tarjetas y observa cuándo un ejemplo es difícil."},{"type":"quiz","title":"Pon a prueba tus ideas","questions":[{"question":"¿Qué necesita un clasificador para aprender?","options":["Ejemplos","Solo suerte","Una pantalla grande"],"correct":0},{"question":"¿Puede equivocarse una IA?","options":["Sí","Nunca"],"correct":0}]},{"type":"reflection","title":"¿Qué te sorprendió?","text":"Explica un uso positivo de un clasificador."}]}', 30, 'published'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 3, 'Introducción a sistemas inteligentes', 'Comparamos ejemplos, reglas y aprendizaje de patrones con pensamiento crítico.', '{"schemaVersion":1,"sections":[{"type":"story","title":"Un problema del colegio","text":"Clasificar residuos manualmente toma tiempo y causa errores."},{"type":"learn","title":"Datos, reglas y modelos","text":"Un modelo aprende regularidades de ejemplos; su desempeño depende de la calidad y diversidad de esos ejemplos."},{"type":"play","title":"Diseña la clasificación","text":"Propón categorías, posibles errores y un primer pipeline conceptual."},{"type":"quiz","title":"Analiza el concepto","questions":[{"question":"¿Qué puede afectar las predicciones?","options":["Calidad de datos","Color del teclado","Volumen del monitor"],"correct":0},{"question":"¿Qué significa evaluar?","options":["Probar con ejemplos","Copiar respuestas","Eliminar los datos"],"correct":0}]},{"type":"reflection","title":"¿Cómo lo mejorarías?","text":"Describe una limitación y una mejora para el clasificador."}]}', 30, 'published')
ON DUPLICATE KEY UPDATE id = id;

-- Retos piloto de semana 1; la duración es validada por el servidor en hitos posteriores.
INSERT INTO challenges (id, course_week_id, level_id, title, challenge_type, config_json, time_limit_seconds, max_attempts, max_score, status) VALUES
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, 'Reto: encuentra los ejemplos', 'quiz', '{"schemaVersion":1,"instructions":"Elige los ejemplos correctos para ayudar a Nubi.","questions":[{"text":"¿Una máquina puede aprender con ejemplos?","choices":["Sí","No"],"correct":0}]}', 600, 3, 100, 'published'),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 2, 'Reto: clasifica con lógica', 'game', '{"schemaVersion":1,"template":"drag-to-category","instructions":"Clasifica correctamente las tarjetas.","categories":["animal","objeto"],"items":[{"label":"gato","category":"animal"},{"label":"pelota","category":"objeto"}]}', 900, 3, 100, 'published'),
  ('40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 3, 'Reto: analiza el aprendizaje', 'quiz', '{"schemaVersion":1,"instructions":"Explica el papel de los datos en un modelo.","questions":[{"text":"¿Qué puede provocar sesgos en un clasificador?","choices":["Ejemplos poco representativos","Una pantalla pequeña","Tener muchas pestañas"],"correct":0}]}', 1200, 3, 100, 'published')
ON DUPLICATE KEY UPDATE id = id;
