# Base de datos de desarrollo

Prisma es el ORM del backend: `Backend/prisma/schema.prisma` describe las tablas para TypeScript y `Backend/prisma/migrations/` conserva los cambios SQL que crean o actualizan la estructura real de MySQL.

La aplicación nunca reinicia la base al arrancar. El comando `npm run start` aplica las migraciones pendientes y completa únicamente los datos didácticos que falten; no borra ni sobrescribe proyectos, usuarios o contenido existente.

En una base nueva o vacía, basta con iniciar el backend. Crea todas las tablas mediante las migraciones y carga el catálogo didáctico idempotente: niveles, curso, 24 semanas, lecciones y retos piloto. También crea, solo si faltan, las cuentas de demostración `aiblocks_demo_student`, `aiblocks_demo_teacher` y `aiblocks_demo_admin`, con la clave de demostración acordada.

Para borrar exclusivamente la base local de desarrollo y reconstruirla:

```powershell
npm.cmd run db:reset:local
```

Luego inicia el backend para que complete el catálogo y las cuentas demo. No se debe ejecutar `db:reset:local` contra Railway ni ninguna base con datos reales.

Para comprobar que no hay migraciones pendientes:

```powershell
npm.cmd run prisma:status
```

La migración `20261009163000_add_character_labs` añade el almacenamiento privado del ZIP, modelo y métricas del proyecto. Reemplazar un ZIP elimina el modelo anterior; limpiar el laboratorio elimina ambos sin borrar el proyecto.
