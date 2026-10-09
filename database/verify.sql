-- Consultas de verificación APF2 Hito 2 (solo lectura)
-- Ejecutar después de schema.sql y seed.sql. No cambia registros.
SELECT DATABASE() AS selected_database, VERSION() AS server_version;
SELECT 'tables_17' AS test, COUNT(*) AS actual,
       IF(COUNT(*) = 17, 'PASS', 'FAIL') AS result
FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
  AND table_name IN (
    'levels','users','courses','course_weeks','lessons','classrooms',
    'classroom_enrollments','guardian_consents','projects','workspaces',
    'workspace_versions','simulation_runs','lesson_progress','challenges',
    'classroom_challenges','challenge_attempts','audit_logs'
  );
SELECT 'fk_24' AS test, COUNT(*) AS actual,
       IF(COUNT(*) = 24, 'PASS', 'FAIL') AS result
FROM information_schema.key_column_usage
WHERE table_schema = DATABASE() AND referenced_table_name IS NOT NULL;
SELECT 'levels_3' AS test, COUNT(*) AS actual, IF(COUNT(*) = 3, 'PASS', 'FAIL') AS result FROM levels;
SELECT 'weeks_24' AS test, COUNT(*) AS actual, IF(COUNT(*) = 24, 'PASS', 'FAIL') AS result FROM course_weeks;
SELECT 'lessons_week_1_3' AS test, COUNT(*) AS actual, IF(COUNT(*) = 3, 'PASS', 'FAIL') AS result FROM lessons WHERE course_week_id = '20000000-0000-4000-8000-000000000001';
SELECT 'challenges_week_1_3' AS test, COUNT(*) AS actual, IF(COUNT(*) = 3, 'PASS', 'FAIL') AS result FROM challenges WHERE course_week_id = '20000000-0000-4000-8000-000000000001';
SELECT week_number, title, phase FROM course_weeks ORDER BY week_number;
SELECT l.name AS route_name, s.title AS lesson_title, s.status AS lesson_status
FROM lessons s JOIN levels l ON l.id = s.level_id ORDER BY l.id;
-- Para verificar constraints, inspeccionar SHOW CREATE TABLE workspaces y usar el test SQL
-- de transacción explicada en database/README.md (no se modifica la BD en este archivo).
