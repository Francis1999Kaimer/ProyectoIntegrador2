# Hoja de ruta — APF2 (12 hitos)

El proyecto busca una **primera versión verificable** (aproximadamente la mitad del producto final). Los estados describen trabajo confirmado en GitHub y no equivalen a pruebas en el PC o Plesk.

| Nº | Hito | Estado |
|---|---|---|
| 1 | Alinear arquitectura, README, entorno MySQL/MariaDB y Plesk | **Completado (documentación/configuración)** |
| 2 | Diseñar modelo físico de BD, SQL, seed, relaciones e índices | Pendiente |
| 3 | Inicializar Backend NestJS, Prisma, configuración y health check | Pendiente |
| 4 | Implementar Repository Pattern y diagrama de clases | Pendiente |
| 5 | Implementar login, JWT, roles y permisos | Pendiente |
| 6 | Implementar APIs reales: alumnos, salones, proyectos, workspaces, progreso | Pendiente |
| 7 | Conectar frontend existente a backend y sustituir mocks esenciales | Pendiente |
| 8 | Persistir editor React Flow y resultados de entrenamiento pedagógico | Pendiente |
| 9 | Implementar validaciones, controles de seguridad y auditoría | Pendiente |
| 10 | Preparar documentación APF2: BD, replicación, cifrado, pruebas y despliegue | Pendiente |
| 11 | Implementar y ejecutar pruebas unitarias/integración/seguridad con evidencias | Pendiente |
| 12 | Preparar y ejecutar despliegue Plesk + MariaDB, validar en cloud | Pendiente |

## Requisitos transversales

- Levantar el **100 % de las observaciones del APF1** documentadas por el profesor.
- Mantener la aplicación compilable tras cada hito.
- Trabajar mediante rama, PR y merge; no publicar secretos.
- El modelo físico y el script SQL deben mantenerse consistentes.
- El informe de replicación debe distinguir la arquitectura propuesta de la efectivamente configurada.
- Adjuntar capturas reales de pruebas, seguridad y Plesk, sin simular evidencias.

## Alcance de este PR (hito 1)

- Documentar la arquitectura APF2 centrada en NestJS y MySQL/MariaDB.
- Retirar referencias a PostgreSQL/Supabase como stack activo.
- Documentar `aiblockstudio` local en 3306 y la alternativa Docker en 3307.
- Registrar decisiones, límites del alcance y secuencia de hitos.
- Mantener el frontend existente sin cambiar su comportamiento.

**El hito 1 no crea tablas SQL, no levanta un backend y no despliega nada.** Esas actividades pertenecen a los hitos siguientes.
