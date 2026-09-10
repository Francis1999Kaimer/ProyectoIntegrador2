# Plan UX/UI del Frontend

## Meta de esta fase

Validar la experiencia completa de un estudiante antes de integrar backend o ML real. Toda la aplicación funcionará inicialmente con datos mock.

## Flujo UX a prototipar

1. Inicio / dashboard.
2. Crear proyecto.
3. Cargar dataset.
4. Preparar datos.
5. Seleccionar y configurar modelo.
6. Construir pipeline en el editor de bloques.
7. Ejecutar entrenamiento simulado.
8. Revisar métricas y matriz de confusión.
9. Probar una predicción.
10. Ver código generado / exportar.

## Orden de implementación

### Fase 1 — Base visual
- Inicializar React + TypeScript + Vite.
- Definir tokens visuales: tipografía, espaciado, radios, sombras y colores.
- Crear layout global: header, sidebar, content y panel derecho.
- Configurar React Router.

### Fase 2 — Navegación y pantallas
- Dashboard.
- Wizard de nuevo proyecto.
- Dataset.
- Preparación de datos.
- Selección de modelo.
- Evaluación y predicción.

Todo con mocks y navegación funcional.

### Fase 3 — Editor visual
- Integrar React Flow.
- Paleta de bloques por categorías.
- Drag & drop.
- Conectores tipados.
- Panel de propiedades.
- Zoom, pan, delete, undo/redo básico.
- Serialización del grafo a JSON.

### Fase 4 — Simulación ML
- Botón Ejecutar.
- Estados queued/running/completed/error simulados.
- Barra de progreso.
- Métricas mock por época.
- Accuracy/loss.
- Matriz de confusión.
- Predicción de ejemplo.

### Fase 5 — Validación UX
- Recorrer el flujo completo como estudiante principiante.
- Corregir pasos confusos.
- Revisar mensajes de error y estados vacíos.
- Validar responsive mínimo para laptop/tablet.
- Congelar contratos UI antes de conectar API real.

## Primer conjunto de bloques del MVP

### Datos
- Dataset imágenes
- Dataset CSV
- Train / Validation / Test split

### Preparación
- Resize
- Normalizar
- Seleccionar columnas

### Modelos
- Regresión logística
- Árbol de decisión
- Red neuronal
- CNN

### Ejecución
- Entrenar
- Evaluar
- Predecir

## Definición de terminado para esta fase

El usuario debe poder crear un proyecto desde cero y completar todo el recorrido hasta una predicción simulada sin que exista backend real. El editor debe producir un JSON reproducible del pipeline.
