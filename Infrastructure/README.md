# Infrastructure

Servicios auxiliares para desarrollo y despliegue.

## Servicios del MVP

- PostgreSQL: metadata de usuarios, proyectos, pipelines y ejecuciones.
- Redis: cola/eventos para comunicación Backend ↔ ML-Service.
- MinIO: datasets, modelos, checkpoints y artefactos.

## Evolución

En desarrollo se usará Docker Compose. Si el proyecto requiere múltiples workers GPU o alta concurrencia, la capa de ejecución podrá migrar a Kubernetes sin modificar el flujo UX del estudiante.
