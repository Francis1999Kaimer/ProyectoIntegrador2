-- Tareas del salón y entregas de los alumnos. El curso del salón pasa a ser opcional.
-- Solo agrega tablas y relaja una restricción; no elimina datos.

ALTER TABLE `classrooms`
  MODIFY `course_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;

CREATE TABLE `assignments` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `classroom_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `created_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `description` TEXT NOT NULL,
  `instructions` TEXT NOT NULL,
  `starts_at` DATETIME NOT NULL,
  `ends_at` DATETIME NOT NULL,
  `grade_min` DECIMAL(5,1) NOT NULL,
  `grade_max` DECIMAL(5,1) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_assignments_classroom_end` (`classroom_id`, `ends_at`),
  KEY `ix_assignments_creator` (`created_by`),
  CONSTRAINT `fk_assignments_classroom` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_assignments_creator` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `chk_assignments_dates` CHECK (`ends_at` > `starts_at`),
  CONSTRAINT `chk_assignments_grades` CHECK (`grade_min` >= 0 AND `grade_max` > `grade_min`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `assignment_submissions` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `assignment_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `student_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `run_number` INT UNSIGNED NULL,
  `comment` TEXT NULL,
  `submitted_at` DATETIME NOT NULL,
  `grade` DECIMAL(5,1) NULL,
  `feedback` TEXT NULL,
  `graded_at` DATETIME NULL,
  `graded_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_submissions_assignment_student` (`assignment_id`, `student_id`),
  KEY `ix_submissions_student` (`student_id`),
  KEY `ix_submissions_project` (`project_id`),
  KEY `ix_submissions_grader` (`graded_by`),
  CONSTRAINT `fk_submissions_assignment` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_submissions_student` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_submissions_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_submissions_grader` FOREIGN KEY (`graded_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
