# ProyectoIntegrador2 — AI Blocks Studio

Plataforma educativa web para que estudiantes construyan flujos de inteligencia artificial mediante bloques visuales.

## Objetivo

El estudiante diseña un pipeline visual en el navegador. El frontend serializa ese grafo a JSON, el backend lo persiste y orquesta trabajos, y los workers de ML ejecutan entrenamiento, evaluación y predicción exclusivamente en el servidor.

## Arquitectura objetivo

```text
Estudiante
   |
   v
Frontend (React + Vite + React Flow)
   |
   | REST / WebSocket
   v
Backend (NestJS)
   |--------> PostgreSQL  [usuarios, proyectos, metadata]
   |--------> MinIO / S3  [datasets, modelos, artefactos]
   |--------> Redis       [cola / eventos]
                    |
                    v
              ML-Service
          Python + framework ML
                    |
                    v
             CPU / GPU servidor
```

## Estructura

```text
ProyectoIntegrador2/
├── Frontend/          # Aplicación web y editor visual
├── Backend/           # API, autenticación y orquestación
├── ML-Service/        # Workers de entrenamiento/evaluación/predicción
├── Infrastructure/    # Servicios e infraestructura local
├── docs/              # Arquitectura y planes técnicos
├── docker-compose.yml
├── .env.example
└── README.md
```

## Stack propuesto

- Frontend: React, TypeScript, Vite, React Flow.
- Backend: NestJS, TypeScript, Prisma.
- Base de datos: PostgreSQL.
- Cola/eventos: Redis (Redis Streams para el MVP).
- Objetos: MinIO en desarrollo, S3-compatible en producción.
- ML: Python, PyTorch / TensorFlow / scikit-learn según bloque.
- Ejecución ML: contenedores Docker en servidor; Kubernetes cuando sea necesario escalar.
- Tiempo real: WebSocket desde NestJS al navegador.

## Prioridad actual

La primera fase es exclusivamente UX/UI del frontend usando datos mock. No se requiere Backend ni ML-Service para validar el flujo de usuario.

Ver `docs/frontend-ux-plan.md`.
