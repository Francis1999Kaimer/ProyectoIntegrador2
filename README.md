# ProyectoIntegrador2 — AI Blocks Studio

Plataforma web educativa para aprender inteligencia artificial mediante proyectos, clases y un editor visual de bloques. El alcance de **APF2** es una primera versión integrada, segura y desplegable; no es el producto final de 24 semanas.

## Estado actual

- **Frontend existente:** React, TypeScript, Vite, React Flow y Zustand, con pantallas navegables y datos mock.
- **Backend:** aún pendiente de implementar. Se desarrollará en NestJS como parte de APF2.
- **Base de datos:** arquitectura definida para MySQL local (`aiblockstudio`) y MariaDB en Plesk; esquema SQL e integración pendientes del hito 2.
- **Despliegue:** previsto en Plesk; todavía no desplegado.
- **Hito 1/12:** alineación de arquitectura y documentación. Ver `docs/APF2_HITOS.md`.

## Arquitectura objetivo APF2

```text
Navegador (alumno / profesor / admin)
               |
               v
Frontend (React + Vite + React Flow)
               |
             HTTPS
               |
               v
Backend (NestJS / REST API)
   |-- autenticación, roles y auditoría
   |-- servicios y validación
   |-- Repository Pattern + Prisma
               |
               v
   MySQL local / MariaDB en Plesk
   (usuarios, salones, proyectos,
    workspaces, progreso, resultados)
```

El editor guarda su grafo como JSON a través de la API. El backend es responsable de validar identidades, autorizar el acceso y persistir el trabajo. **El navegador no se conecta directamente a la base de datos.**

Para la demostración de APF2 se prevé un motor de entrenamiento pedagógico determinista con métricas persistidas. El servicio Python/ML, Redis, MinIO y entrenamiento real sobre GPU quedan como **evolución futura opcional**, no como requisito funcional de APF2.

## Estructura

```text
ProyectoIntegrador2/
├── Frontend/              # Frontend existente
├── Backend/               # API NestJS (siguiente fase)
├── ML-Service/            # Reservado para evolución posterior
├── Infrastructure/        # Infraestructura local y futura
├── docs/                  # Arquitectura y evidencias APF2
├── docker-compose.yml     # MariaDB y auxiliares opcionales
├── .env.example           # Plantilla sin secretos
└── README.md
```

## Stack de APF2

- Frontend: React + TypeScript + Vite + React Flow.
- Backend: NestJS + TypeScript.
- Persistencia: Prisma ORM con conector `mysql`; Repository Pattern.
- Desarrollo: MySQL instalado localmente (puerto 3306, BD `aiblockstudio`).
- Producción: MariaDB administrada por Plesk.
- Seguridad: login, roles `student` / `teacher` / `admin`, JWT, hash de contraseñas, validaciones, controles HTTP y auditoría.
- Hosting objetivo: Plesk para frontend compilado y backend Node.js (sujeto a soporte Node.js del hosting).
- Redis/MinIO: opcionales y diferidos; **no son necesarios para levantar el frontend actual**.

## Ejecutar el frontend que ya existe

Se requiere Node.js 22.22 o superior.

```powershell
cd C:\Users\franc\Escritorio\ProyectoIntegrador2\Frontend
npm install
npm run dev
```

Abrir http://localhost:5173. Las rutas actuales siguen usando mocks hasta que se implemente la integración del hito 7.

## Base de datos local (próximo hito)

La configuración acordada es host `127.0.0.1`, puerto `3306`, base `aiblockstudio`. **No utilizar la cuenta administrativa `root` en producción**. En los siguientes hitos se configurará un usuario de aplicación con privilegios mínimos. Nunca subir credenciales o `.env` reales a GitHub; ver `.env.example`.

Si se prefiere una base aislada para pruebas, `docker-compose.yml` incluye un perfil optativo `db-container` en el puerto 3307, evitando conflicto con MySQL instalado en 3306.

## Documentación

- [Arquitectura](docs/architecture.md)
- [Decisiones técnicas](docs/DECISIONES.md)
- [Los 12 hitos APF2](docs/APF2_HITOS.md)
- [Plan UX original](docs/frontend-ux-plan.md)
- [Auditoría responsive](docs/frontend-responsive-audit.md)
