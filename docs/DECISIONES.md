# Decisiones técnicas — AI Blocks Studio (APF2)

Registro de las decisiones aprobadas para la segunda entrega. Las decisiones se pueden revisar si los requisitos del profesor o el hosting lo exigen; cada cambio debe reflejarse en la arquitectura, SQL y documentación.

| ID | Decisión | Justificación |
|---|---|---|
| ADR-001 | Mantener React/Vite/React Flow existente | Reutilizar el frontend funcional y evitar una reescritura. |
| ADR-002 | Crear API NestJS TypeScript | Separación de presentación, negocio, seguridad y persistencia. |
| ADR-003 | MySQL local (`aiblockstudio`) → MariaDB en Plesk | Infraestructura disponible; permite modelo físico y script SQL exigidos por APF2. |
| ADR-004 | Prisma (`mysql`) + interfaces Repository | Patrón de acceso a datos demostrable, consultas tipadas y desacoplamiento. |
| ADR-005 | Asegurar compatibilidad entre motores | MySQL y MariaDB difieren en ciertos tipos/funciones; verificar versiones reales y ejecutar migraciones/pruebas en ambos. |
| ADR-006 | Roles `student`, `teacher`, `admin`, acceso protegido por backend | El frontend no constituye frontera de seguridad; validar pertenencia y permisos en servicios/consultas. |
| ADR-007 | No implementar Supabase ni PostgreSQL en APF2 | Se adoptó el hosting Plesk/MariaDB propio. La rúbrica exige diseño físico y SQL. |
| ADR-008 | Focalizar demo APF2 en un flujo vertical | Login → datos reales → editor/workspace guardado → ejecución pedagógica → resultado persistido. |
| ADR-009 | `SimulationProvider` determinista básico en APF2; ML real después | Reducir dependencias de GPU y costo; preservar posibilidad de implementar workers reales más adelante. |
| ADR-010 | Docker Compose opcional; MySQL instalado en Windows es la BD local predeterminada | Evitar colisión con el servicio local de puerto 3306; MariaDB Docker usa 3307. |
| ADR-011 | Secretos nunca se incorporan al repo | `.env.example` solo contiene marcadores de reemplazo; `.env` real está ignorado por Git. |
| ADR-012 | No afirmar replicación, alta disponibilidad, backups ni despliegue sin evidencias | El informe debe separar una **estrategia propuesta** de una **configuración efectivamente verificada**. |

## Pendientes explícitos

- Hito 2: definir relaciones, diagrama físico, SQL y datos iniciales coherentes.
- Hito 3: comprobar conexión real de NestJS/Prisma a MySQL local.
- Hito 5: seleccionar estrategia concreta de token/cookies y almacenamiento seguro de sesiones.
- Hito 8: especificar parámetros y validación de la simulación pedagógica.
- Hito 12: conocer versión de MariaDB, disponibilidad Node.js y límites del hosting Plesk.
- APF1: recoger las observaciones exactas del docente y documentar su levantamiento.

## Compatibilidad MySQL/MariaDB

No se presupone equivalencia binaria de tipos o funciones. En particular, el grafo del editor se transporta como JSON y deberá validarse en API; el tipo SQL de almacenamiento se definirá en el hito 2 con una migración verificable en ambos motores.
