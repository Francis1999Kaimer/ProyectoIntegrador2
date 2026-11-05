-- Flujo de entrenamiento (pasos 2 a 6) para los seis tipos de proyecto.
-- Solo agrega columnas y una tabla; no elimina datos existentes.

ALTER TABLE `character_labs`
  ADD COLUMN `dataset_counts_json` LONGTEXT NULL AFTER `dataset_samples`,
  ADD COLUMN `dataset_locked_at` DATETIME NULL AFTER `dataset_updated_at`,
  ADD COLUMN `test_percent` TINYINT UNSIGNED NULL AFTER `dataset_locked_at`,
  ADD COLUMN `split_seed` INT UNSIGNED NULL AFTER `test_percent`,
  ADD COLUMN `training_config_json` LONGTEXT NULL AFTER `split_seed`,
  ADD CONSTRAINT `chk_character_labs_dataset_counts_json` CHECK (`dataset_counts_json` IS NULL OR JSON_VALID(`dataset_counts_json`) = 1),
  ADD CONSTRAINT `chk_character_labs_training_config_json` CHECK (`training_config_json` IS NULL OR JSON_VALID(`training_config_json`) = 1),
  ADD CONSTRAINT `chk_character_labs_test_percent` CHECK (`test_percent` IS NULL OR `test_percent` IN (10, 20, 30));

CREATE TABLE `training_runs` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `project_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `run_number` INT UNSIGNED NOT NULL,
  `config_json` LONGTEXT NOT NULL,
  `hardware_json` LONGTEXT NOT NULL,
  `history_json` LONGTEXT NOT NULL,
  `metrics_json` LONGTEXT NOT NULL,
  `duration_ms` INT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_training_runs_project_number` (`project_id`, `run_number`),
  CONSTRAINT `fk_training_runs_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `chk_training_runs_config_json` CHECK (JSON_VALID(`config_json`) = 1),
  CONSTRAINT `chk_training_runs_hardware_json` CHECK (JSON_VALID(`hardware_json`) = 1),
  CONSTRAINT `chk_training_runs_history_json` CHECK (JSON_VALID(`history_json`) = 1),
  CONSTRAINT `chk_training_runs_metrics_json` CHECK (JSON_VALID(`metrics_json`) = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Proyectos de caracteres que ya tenían un entrenamiento del flujo anterior:
-- el dataset queda fijo y ese entrenamiento pasa a ser el primero del historial.
UPDATE `character_labs`
SET `dataset_locked_at` = `training_updated_at`, `test_percent` = 20, `split_seed` = 1
WHERE `model_bytes` IS NOT NULL AND `training_metrics_json` IS NOT NULL AND `training_updated_at` IS NOT NULL;

INSERT INTO `training_runs` (`id`, `project_id`, `run_number`, `config_json`, `hardware_json`, `history_json`, `metrics_json`, `duration_ms`, `created_at`)
SELECT UUID(), `project_id`, 1,
  JSON_OBJECT('epochs', CAST(JSON_EXTRACT(`training_metrics_json`, '$.epochs') AS UNSIGNED), 'learning_rate', 0.001, 'batch_size', 16, 'model_size', 'medium'),
  JSON_OBJECT(),
  COALESCE(JSON_EXTRACT(`training_metrics_json`, '$.history'), JSON_ARRAY()),
  JSON_OBJECT('legacy', TRUE, 'labels', JSON_EXTRACT(`training_metrics_json`, '$.labels'),
    'test_accuracy', JSON_EXTRACT(`training_metrics_json`, '$.accuracy'), 'test_loss', JSON_EXTRACT(`training_metrics_json`, '$.loss')),
  0, `training_updated_at`
FROM `character_labs`
WHERE `model_bytes` IS NOT NULL AND `training_metrics_json` IS NOT NULL AND `training_updated_at` IS NOT NULL;
