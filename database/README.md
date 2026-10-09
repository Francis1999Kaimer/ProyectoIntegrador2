# Base de datos — APF2 Hito 2

**No ejecutar importaciones sobre una base de datos que tenga datos importantes sin respaldo.** Estos archivos requieren validación real en tu PC con MySQL y, posteriormente, en MariaDB de Plesk.

| Archivo | Propósito |
|---|---|
| `schema.sql` | 17 tablas base InnoDB con PK, FK, índices y restricciones. |
| `seed.sql` | 3 niveles, 1 curso, 24 semanas, 3 clases piloto y 3 retos piloto de semana 1. No crea usuarios. |
| `verify.sql` | Consultas de verificación reales de tablas, relaciones y datos semilla. |
| `check_model.py` | Comprueba estáticamente que tablas, columnas y relaciones coinciden con el DER. |
| `../docs/DER.md` | Diagrama Mermaid y diccionario físico completo. |

## 1. Actualizar el código y revisar versión del servidor

Desde PowerShell:

```powershell
cd C:\Users\franc\Escritorio\ProyectoIntegrador2
git pull origin main
py -3 database\check_model.py
mysql --version
mysql -u root -p -h 127.0.0.1 -P 3306 -e "SELECT VERSION() AS version_servidor;"
```

La opción `-p` pide contraseña interactivamente; **no la escribas como argumento ni en GitHub**. La consulta `SELECT VERSION()` muestra la versión del servidor, no del cliente. Recomendamos **MySQL >= 8.0.16** o **MariaDB >= 10.6**, debido a las restricciones `CHECK`. Si la versión es anterior, avísanos antes de importar. Si el comando `mysql` no está en PATH, hay que utilizar su ruta de instalación.

## 2. Inspeccionar y crear la base si no existe

```powershell
mysql -u root -p -h 127.0.0.1 -P 3306 -e "SHOW DATABASES LIKE 'aiblockstudio';"
mysql -u root -p -h 127.0.0.1 -P 3306 -e "CREATE DATABASE IF NOT EXISTS aiblockstudio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -h 127.0.0.1 -P 3306 aiblockstudio -e "SHOW TABLES;"
```

Si ya existen tablas **no importes todavía**; primero respalda y confirma que las estructuras sean compatibles. `schema.sql` usa `CREATE TABLE IF NOT EXISTS` pero **no** migra estructuras incompatibles.

## 3. Importar el esquema y el seed

Estos comandos se lanzan desde la raíz del repositorio. En PowerShell usamos `cmd /c` para la redirección de archivos:

```powershell
cmd /c 'mysql --default-character-set=utf8mb4 -u root -p -h 127.0.0.1 -P 3306 aiblockstudio < database\schema.sql'
cmd /c 'mysql --default-character-set=utf8mb4 -u root -p -h 127.0.0.1 -P 3306 aiblockstudio < database\seed.sql'
```

Se pedirá contraseña en ambos comandos. Detenerse si aparece cualquier error SQL.

## 4. Comprobar la base de datos real

```powershell
cmd /c 'mysql --default-character-set=utf8mb4 -u root -p -h 127.0.0.1 -P 3306 aiblockstudio < database\verify.sql'
```

Resultados esperados: `tables_18` = 18/PASS, `fk_25` = 25/PASS, `levels_3` = 3/PASS, `weeks_24` = 24/PASS, `lessons_week_1_3` = 3/PASS y `challenges_week_1_3` = 3/PASS.

El resultado de 18 tablas presupone el flujo actual con Prisma (`Backend\npm.cmd run db:bootstrap`), que añade la tabla `character_labs`. El archivo `schema.sql` queda como referencia del hito 2 y no reemplaza las migraciones de Prisma.

Para evidencias adicionales:

```powershell
mysql -u root -p -h 127.0.0.1 -P 3306 aiblockstudio -e "SHOW TABLES;"
mysql -u root -p -h 127.0.0.1 -P 3306 aiblockstudio -e "SHOW CREATE TABLE workspaces\G"
```

## Alcance de las pruebas

`database/check_model.py` **solo verifica consistencia documental**: no demuestra que MySQL acepte el SQL. Las pruebas de integración y restricciones reales necesitan ejecutarse en tu equipo. El backend futuro accederá mediante **usuario limitado**, no la cuenta administrativa `root`.

Se valida JSON del editor en `LONGTEXT` con `JSON_VALID`, además de validación estructural futura en NestJS. La autorización, el rol de un profesor, la matrícula de un alumno y los plazos de un reto deben comprobarse **en el servidor**, no solo mediante FK.

No se siembran cuentas, credenciales ni datos de niños reales. Las 24 semanas son un esqueleto curricular y únicamente la semana 1 tiene clases/retos piloto en las tres rutas.
