# Base de datos de desarrollo

Prisma es el ORM del backend: `Backend/prisma/schema.prisma` describe las tablas para TypeScript y `Backend/prisma/migrations/` conserva los cambios SQL que crean o actualizan la estructura real de MySQL.

La aplicación nunca reinicia la base al arrancar. El comando `npm run start` aplica las migraciones pendientes y completa únicamente los datos didácticos que falten; no borra ni sobrescribe proyectos, usuarios o contenido existente.

En una base nueva o vacía, basta con iniciar el backend. Crea todas las tablas mediante las migraciones y carga el catálogo didáctico idempotente: niveles, curso, 24 semanas, lecciones y retos piloto.

Para borrar exclusivamente la base local de desarrollo y reconstruirla:

```powershell
npm.cmd run db:reset:local
```

Luego inicia el backend para que complete el catálogo. Las cuentas demo son opcionales y se crean únicamente con `npm.cmd run auth:seed-demo`, porque una aplicación desplegada no debe inventar contraseñas administrativas. No se debe ejecutar `db:reset:local` contra Railway ni ninguna base con datos reales.

Para comprobar que no hay migraciones pendientes:

```powershell
npm.cmd run prisma:status
```

La migración `20261009163000_add_character_labs` añade el almacenamiento privado del ZIP, modelo y métricas del proyecto. Reemplazar un ZIP elimina el modelo anterior; limpiar el laboratorio elimina ambos sin borrar el proyecto.
