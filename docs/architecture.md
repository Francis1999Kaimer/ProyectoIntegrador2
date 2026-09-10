# Arquitectura del sistema

## Principio principal

AI Blocks Studio separa la experiencia visual del estudiante de la ejecución de machine learning. El navegador nunca entrena modelos; únicamente construye el pipeline y visualiza resultados.

## Flujo principal

1. El estudiante crea un flujo visual en React Flow.
2. El frontend serializa el grafo como JSON.
3. NestJS guarda proyecto, pipeline y metadata.
4. El backend publica un job en Redis.
5. ML-Service consume el job.
6. ML-Service obtiene datasets/artefactos desde MinIO o S3.
7. El worker ejecuta entrenamiento/evaluación/predicción usando CPU/GPU del servidor.
8. Métricas, logs y modelos se almacenan y notifican al backend.
9. NestJS actualiza al frontend mediante WebSocket.

## Capas

### Frontend

React + Vite + React Flow. Responsable de UX, editor de bloques, formularios, visualización de métricas y estado de ejecuciones.

### Backend

NestJS como API/BFF y orquestador. Responsable de seguridad, usuarios, proyectos, persistencia, jobs y comunicación en tiempo real.

### Persistencia

- PostgreSQL: datos relacionales y metadata.
- MinIO/S3: archivos pesados.
- Redis: jobs y eventos efímeros.

### Ejecución ML

Workers Python ejecutados exclusivamente en servidor. Cada ejecución debe estar aislada y limitada por CPU, RAM, GPU, tiempo y almacenamiento.

## Contrato conceptual del pipeline

```json
{
  "version": 1,
  "nodes": [
    { "id": "dataset-1", "type": "dataset", "config": {} },
    { "id": "resize-1", "type": "resize", "config": { "width": 224, "height": 224 } },
    { "id": "cnn-1", "type": "cnn", "config": { "filters": [32, 64], "activation": "relu" } }
  ],
  "edges": [
    { "source": "dataset-1", "target": "resize-1" },
    { "source": "resize-1", "target": "cnn-1" }
  ]
}
```

Este contrato se formalizará después de validar el UX del editor.
