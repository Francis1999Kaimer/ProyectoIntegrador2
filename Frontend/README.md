# Frontend — AI Blocks Studio

Prototipo UX/UI navegable del entorno educativo visual para construir modelos de inteligencia artificial.

## Stack

- React 19
- TypeScript
- Vite
- React Router
- React Flow (`@xyflow/react`)
- Zustand
- Lucide React

## Ejecutar localmente

Requiere Node.js 22.22 o superior.

```powershell
cd D:\ProyectoIntegrador2\Frontend
npm install
npm run dev
```

Abrir `http://localhost:5173`.

## Flujo implementado con datos mock

Inicio → Crear proyecto → Dataset → Preparación → Modelo → Editor visual → Entrenamiento → Evaluación → Predicción.

Todavía no se conecta a Backend, PostgreSQL, Redis, MinIO ni ML-Service. El objetivo de esta fase es validar UX/UI y el modelo mental del estudiante antes de implementar la integración real.

## Próximos pasos

1. Validar navegación y jerarquía visual.
2. Convertir componentes grandes en módulos reutilizables.
3. Hacer interactivos los nodos de React Flow.
4. Definir el contrato JSON del pipeline.
5. Persistir el estado mock en localStorage.
6. Recién después conectar NestJS.
