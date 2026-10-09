# ML-Service — reservado para evolución futura

La carpeta forma parte del diseño original de AI Blocks Studio, orientado a entrenamiento real de modelos en servidor (Python, PyTorch, scikit-learn y GPU). **No forma parte del mínimo funcional acordado para APF2**, que prioriza BD, backend, roles, seguridad y despliegue en Plesk.

Para la primera versión se planea un **SimulationProvider determinista y reproducible** en la lógica del backend para actividades educativas. Se podrán registrar métricas y ejecuciones en MySQL/MariaDB sin necesitar workers GPU ni descarga de modelos.

El entrenamiento real con servicios Python, Redis/colas y MinIO/artefactos podrá evaluarse de nuevo en una fase posterior, según presupuesto e infraestructura. No existe aún un ML-Service funcional.
