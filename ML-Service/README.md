# ML-Service

Servicio de ejecución de machine learning en el servidor.

## Responsabilidades previstas

- Consumir trabajos publicados por el backend.
- Descargar dataset y pipeline.
- Validar configuración del pipeline.
- Ejecutar entrenamiento, evaluación o predicción.
- Usar CPU/GPU del servidor.
- Emitir progreso y métricas.
- Persistir modelos, checkpoints y artefactos.

## Stack propuesto

- Python 3.12+
- PyTorch como primer framework ML
- scikit-learn para modelos clásicos
- TensorFlow como soporte posterior
- Redis Streams para jobs/eventos del MVP
- Docker para aislamiento

## Regla de arquitectura

El entrenamiento no se ejecuta en el navegador ni en la PC del estudiante. Todo trabajo ML ocurre en infraestructura controlada por el servidor.
