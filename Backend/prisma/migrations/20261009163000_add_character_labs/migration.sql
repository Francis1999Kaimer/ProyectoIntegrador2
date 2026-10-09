CREATE TABLE `character_labs` (
  `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `dataset_file_name` VARCHAR(180) NOT NULL,
  `dataset_content_type` VARCHAR(80) NOT NULL,
  `dataset_bytes` LONGBLOB NOT NULL,
  `dataset_labels_json` LONGTEXT NOT NULL,
  `dataset_samples` INT UNSIGNED NOT NULL,
  `dataset_updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `model_file_name` VARCHAR(180) NULL,
  `model_content_type` VARCHAR(80) NULL,
  `model_bytes` LONGBLOB NULL,
  `training_metrics_json` LONGTEXT NULL,
  `training_updated_at` DATETIME NULL,
  PRIMARY KEY (`project_id`),
  CONSTRAINT `fk_character_labs_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `chk_character_labs_dataset_labels_json` CHECK (JSON_VALID(`dataset_labels_json`) = 1),
  CONSTRAINT `chk_character_labs_training_metrics_json` CHECK (`training_metrics_json` IS NULL OR JSON_VALID(`training_metrics_json`) = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
