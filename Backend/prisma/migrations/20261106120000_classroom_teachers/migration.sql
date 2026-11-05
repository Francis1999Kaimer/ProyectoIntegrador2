-- Varios docentes por salón: el responsable sigue en classrooms.teacher_id y
-- los docentes adicionales se registran aquí. Solo agrega una tabla.

CREATE TABLE `classroom_teachers` (
  `classroom_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `teacher_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `added_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `added_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`classroom_id`, `teacher_id`),
  KEY `ix_classroom_teachers_teacher` (`teacher_id`),
  KEY `ix_classroom_teachers_added_by` (`added_by`),
  CONSTRAINT `fk_classroom_teachers_classroom` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_classroom_teachers_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_classroom_teachers_added_by` FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
