#!/usr/bin/env python3
"""Comprueba coincidencia estática de tablas, columnas y FKs: SQL vs Mermaid.
Uso: py -3 database/check_model.py
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
DDL = (ROOT / "database" / "schema.sql").read_text(encoding="utf-8")
DER = (ROOT / "docs" / "DER.md").read_text(encoding="utf-8")
VERIFY = (ROOT / "database" / "verify.sql").read_text(encoding="utf-8")
SEED = (ROOT / "database" / "seed.sql").read_text(encoding="utf-8")

TABLE = re.compile(r"CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\) ENGINE=InnoDB")
COLUMN = re.compile(
    r"^  ([a-z_][a-z_0-9]*) "
    r"(?:SMALLINT|TINYINT|INT|VARCHAR|CHAR|LONGTEXT|TEXT|DATETIME|DATE|DECIMAL|BOOLEAN)\b",
    re.MULTILINE,
)
FK = re.compile(r"FOREIGN KEY \((\w+)\) REFERENCES (\w+)\((\w+)\)")
ENTITY = re.compile(r"^  (\w+) \{\n(.*?)^  \}", re.MULTILINE | re.DOTALL)
ATTR = re.compile(r"^    \w+ (\w+)(?:\s+.*)?$", re.MULTILINE)
REL = re.compile(r'^  (\w+) \|\|--(?:o\{|o\|) (\w+) : "(\w+)"$', re.MULTILINE)

errors = []
sql_tables = {}
sql_relations = set()
for match in TABLE.finditer(DDL):
    name, body = match.groups()
    if name in sql_tables:
        errors.append(f"Tabla SQL duplicada: {name}")
    sql_tables[name] = set(COLUMN.findall(body))
    for child_col, parent, parent_col in FK.findall(body):
        if parent_col != "id":
            errors.append(f"FK inesperada: {name}.{child_col} -> {parent}.{parent_col}")
        sql_relations.add((parent, name, child_col))

block = re.search(r"```mermaid\n([\s\S]*?)\n```", DER)
if block is None:
    errors.append("Falta bloque Mermaid en docs/DER.md.")
    md_tables, md_relations = {}, set()
else:
    diagram = block.group(1)
    md_tables = {}
    for match in ENTITY.finditer(diagram):
        name, body = match.groups()
        if name in md_tables:
            errors.append(f"Entidad Mermaid duplicada: {name}")
        md_tables[name] = set(ATTR.findall(body))
    md_relations = set(REL.findall(diagram))

for table in sorted(set(sql_tables) - set(md_tables)):
    errors.append(f"Falta entidad Mermaid: {table}")
for table in sorted(set(md_tables) - set(sql_tables)):
    errors.append(f"Entidad Mermaid sin tabla SQL: {table}")
for table in sorted(set(sql_tables) & set(md_tables)):
    for field in sorted(sql_tables[table] - md_tables[table]):
        errors.append(f"Falta columna en DER: {table}.{field}")
    for field in sorted(md_tables[table] - sql_tables[table]):
        errors.append(f"Columna sin correspondencia SQL: {table}.{field}")

for relation in sorted(sql_relations - md_relations):
    errors.append(f"Falta FK en DER: {relation}")
for relation in sorted(md_relations - sql_relations):
    errors.append(f"FK Mermaid sin correspondencia SQL: {relation}")

for label, count in [("tables", len(sql_tables)), ("fk", len(sql_relations))]:
    if f"{label}_{count}" not in VERIFY:
        errors.append(f"verify.sql no contiene prueba {label}_{count}")

for statement in ("INSERT INTO levels", "INSERT INTO courses", "INSERT INTO course_weeks",
                  "INSERT INTO lessons", "INSERT INTO challenges"):
    if statement not in SEED:
        errors.append(f"Falta seed: {statement}")
if re.search(r"INSERT\s+INTO\s+users\b", SEED, re.IGNORECASE):
    errors.append("El seed no debe incluir usuarios/contraseñas")

if errors:
    print("FAIL: inconsistencias de diseño:")
    for issue in errors:
        print(" -", issue)
    sys.exit(1)

print(f"PASS: {len(sql_tables)} tablas y {sum(map(len, sql_tables.values()))} columnas coinciden.")
print(f"PASS: {len(sql_relations)} relaciones FK coinciden.")
print("PASS: verify.sql y seed.sql pasan controles estáticos.")
print("PENDIENTE: ejecución de schema/seed/verify en tu MySQL y en MariaDB Plesk.")
