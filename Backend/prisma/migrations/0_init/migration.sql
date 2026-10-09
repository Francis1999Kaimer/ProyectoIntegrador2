-- AI Blocks Studio | APF2 Hito 2 | esquema físico MySQL 8.0.16+ / MariaDB 10.6+
-- IMPORTANTE: seleccionar previamente la base de datos existente. NO contiene CREATE DATABASE ni DROP TABLE.
-- Ejecutar una sola vez sobre una BD nueva o repetir solo sobre un esquema idéntico.
-- Todas las tablas usan InnoDB + utf8mb4_unicode_ci; los IDs UUID son generados por la aplicación.
-- Fechas DATETIME: la API deberá escribir y leer en UTC.
-- El JSON se guarda en LONGTEXT con CHECK JSON_VALID para compatibilidad MySQL/MariaDB.
-- No guardar contraseñas en claro ni usar la cuenta root en producción.

CREATE TABLE IF NOT EXISTS levels (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(32) NOT NULL,
  name VARCHAR(80) NOT NULL,
  min_age TINYINT UNSIGNED NOT NULL,
  max_age TINYINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_levels_slug (slug),
  CONSTRAINT chk_levels_age CHECK (max_age IS NULL OR max_age >= min_age)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  username VARCHAR(64) NOT NULL,
  email VARCHAR(191) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  display_name VARCHAR(120) NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_role_status (role, status),
  CONSTRAINT chk_users_role CHECK (role IN ('student', 'teacher', 'admin')),
  CONSTRAINT chk_users_status CHECK (status IN ('pending', 'active', 'suspended'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS courses (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  slug VARCHAR(80) NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  total_weeks TINYINT UNSIGNED NOT NULL DEFAULT 24,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_courses_slug (slug),
  CONSTRAINT chk_courses_weeks CHECK (total_weeks BETWEEN 1 AND 52),
  CONSTRAINT chk_courses_status CHECK (status IN ('draft', 'published', 'archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_weeks (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  course_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  week_number TINYINT UNSIGNED NOT NULL,
  phase TINYINT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  objective VARCHAR(300) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_course_weeks_number (course_id, week_number),
  KEY ix_course_weeks_phase (course_id, phase),
  CONSTRAINT fk_course_weeks_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT chk_course_weeks_number CHECK (week_number BETWEEN 1 AND 24),
  CONSTRAINT chk_course_weeks_phase CHECK (phase BETWEEN 1 AND 3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lessons (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  course_week_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  level_id SMALLINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  summary TEXT NOT NULL,
  content_json LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lessons_week_level (course_week_id, level_id),
  KEY ix_lessons_level_status (level_id, status),
  CONSTRAINT fk_lessons_week FOREIGN KEY (course_week_id) REFERENCES course_weeks(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_lessons_level FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_lessons_content CHECK (JSON_VALID(content_json) = 1),
  CONSTRAINT chk_lessons_duration CHECK (duration_minutes BETWEEN 1 AND 180),
  CONSTRAINT chk_lessons_status CHECK (status IN ('draft', 'published', 'archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS classrooms (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  teacher_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  level_id SMALLINT UNSIGNED NOT NULL,
  course_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(120) NOT NULL,
  school_name VARCHAR(180) NULL,
  academic_year SMALLINT UNSIGNED NOT NULL,
  course_start_date DATE NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_classrooms_teacher_status (teacher_id, status),
  KEY ix_classrooms_level (level_id),
  KEY ix_classrooms_course (course_id),
  CONSTRAINT fk_classrooms_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_classrooms_level FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_classrooms_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_classrooms_status CHECK (status IN ('active', 'archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS classroom_enrollments (
  classroom_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  student_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (classroom_id, student_id),
  KEY ix_classroom_enrollments_student (student_id),
  CONSTRAINT fk_enrollments_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guardian_consents (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  student_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  guardian_name VARCHAR(120) NOT NULL,
  guardian_contact_email VARCHAR(191) NULL,
  consent_version VARCHAR(32) NOT NULL,
  consented_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_guardian_consents_student_date (student_id, consented_at),
  CONSTRAINT fk_guardian_consents_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_guardian_consents_dates CHECK (revoked_at IS NULL OR revoked_at >= consented_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  classroom_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  title VARCHAR(180) NOT NULL,
  project_type VARCHAR(40) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_projects_owner_updated (owner_id, updated_at),
  KEY ix_projects_classroom (classroom_id),
  CONSTRAINT fk_projects_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_projects_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT chk_projects_status CHECK (status IN ('draft', 'active', 'completed', 'archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workspaces (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  project_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  blocks_json LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_workspaces_project (project_id),
  CONSTRAINT fk_workspaces_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT chk_workspaces_json CHECK (JSON_VALID(blocks_json) = 1),
  CONSTRAINT chk_workspaces_version CHECK (version > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workspace_versions (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  workspace_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  version INT UNSIGNED NOT NULL,
  blocks_json LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_workspace_versions_number (workspace_id, version),
  CONSTRAINT fk_workspace_versions_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT chk_workspace_versions_json CHECK (JSON_VALID(blocks_json) = 1),
  CONSTRAINT chk_workspace_versions_number CHECK (version > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS simulation_runs (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  workspace_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  requested_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  workspace_version INT UNSIGNED NOT NULL,
  provider VARCHAR(24) NOT NULL DEFAULT 'deterministic',
  status VARCHAR(16) NOT NULL DEFAULT 'queued',
  seed INT UNSIGNED NOT NULL,
  parameters_json LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  metrics_json LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  accuracy DECIMAL(5,4) NULL,
  loss DECIMAL(10,6) NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_simulation_runs_workspace_created (workspace_id, created_at),
  KEY ix_simulation_runs_user_created (requested_by, created_at),
  CONSTRAINT fk_simulation_runs_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_simulation_runs_user FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_sim_runs_provider CHECK (provider IN ('deterministic', 'local', 'openai')),
  CONSTRAINT chk_sim_runs_status CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  CONSTRAINT chk_sim_runs_params CHECK (JSON_VALID(parameters_json) = 1),
  CONSTRAINT chk_sim_runs_metrics CHECK (metrics_json IS NULL OR JSON_VALID(metrics_json) = 1),
  CONSTRAINT chk_sim_runs_accuracy CHECK (accuracy IS NULL OR (accuracy >= 0 AND accuracy <= 1)),
  CONSTRAINT chk_sim_runs_loss CHECK (loss IS NULL OR loss >= 0),
  CONSTRAINT chk_sim_runs_finished CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lesson_progress (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  student_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  lesson_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'not_started',
  completed_sections TINYINT UNSIGNED NOT NULL DEFAULT 0,
  progress_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_opened_at DATETIME NULL,
  completed_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lesson_progress_student_lesson (student_id, lesson_id),
  KEY ix_lesson_progress_lesson (lesson_id),
  CONSTRAINT fk_lesson_progress_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_lesson_progress_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT chk_lesson_progress_status CHECK (status IN ('not_started', 'in_progress', 'completed')),
  CONSTRAINT chk_lesson_progress_percent CHECK (progress_percent <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS challenges (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  course_week_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  level_id SMALLINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  challenge_type VARCHAR(24) NOT NULL,
  config_json LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  time_limit_seconds INT UNSIGNED NULL,
  max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 3,
  max_score DECIMAL(6,2) NOT NULL DEFAULT 100.00,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_challenges_week_level (course_week_id, level_id),
  KEY ix_challenges_level (level_id),
  CONSTRAINT fk_challenges_week FOREIGN KEY (course_week_id) REFERENCES course_weeks(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_challenges_level FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_challenges_type CHECK (challenge_type IN ('quiz', 'blocks', 'game', 'creative')),
  CONSTRAINT chk_challenges_config CHECK (JSON_VALID(config_json) = 1),
  CONSTRAINT chk_challenges_attempts CHECK (max_attempts BETWEEN 1 AND 20),
  CONSTRAINT chk_challenges_max_score CHECK (max_score > 0),
  CONSTRAINT chk_challenges_status CHECK (status IN ('draft', 'published', 'archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS classroom_challenges (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  classroom_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  challenge_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  open_at DATETIME NOT NULL,
  close_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_classroom_challenges_pair (classroom_id, challenge_id),
  KEY ix_classroom_challenges_challenge (challenge_id),
  KEY ix_classroom_challenges_window (classroom_id, open_at, close_at),
  CONSTRAINT fk_classroom_challenges_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_classroom_challenges_challenge FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_classroom_challenges_dates CHECK (close_at > open_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS challenge_attempts (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  classroom_challenge_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  student_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  attempt_no TINYINT UNSIGNED NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'in_progress',
  started_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  submitted_at DATETIME NULL,
  score DECIMAL(6,2) NULL,
  answer_json LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_challenge_attempts_number (classroom_challenge_id, student_id, attempt_no),
  KEY ix_challenge_attempts_student_status (student_id, status),
  CONSTRAINT fk_challenge_attempts_assignment FOREIGN KEY (classroom_challenge_id) REFERENCES classroom_challenges(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_challenge_attempts_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_challenge_attempts_no CHECK (attempt_no BETWEEN 1 AND 20),
  CONSTRAINT chk_challenge_attempts_status CHECK (status IN ('in_progress', 'submitted', 'expired', 'graded')),
  CONSTRAINT chk_challenge_attempts_dates CHECK (expires_at > started_at),
  CONSTRAINT chk_challenge_attempts_answers CHECK (answer_json IS NULL OR JSON_VALID(answer_json) = 1),
  CONSTRAINT chk_challenge_attempts_score CHECK (score IS NULL OR score >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ip_address VARCHAR(45) NULL,
  metadata_json LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_audit_logs_actor_date (actor_id, occurred_at),
  KEY ix_audit_logs_entity_date (entity_type, entity_id, occurred_at),
  KEY ix_audit_logs_occurred (occurred_at),
  CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT chk_audit_logs_json CHECK (metadata_json IS NULL OR JSON_VALID(metadata_json) = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
