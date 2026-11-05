export type InputKind = 'gray28' | 'rgb64' | 'spec64'
export type ModelSize = 'small' | 'medium' | 'large'
export type TrainingConfig = { epochs: number; learning_rate: number; batch_size: number; model_size: ModelSize }
export type Hardware = { backend: string; gpu: string | null; cores: number | null; memory_gb: number | null; epoch_estimate_ms: number | null }
export type EpochLog = { epoch: number; accuracy: number; loss: number }
export type Misclassified = { file: string; actual: string; predicted: string; confidence: number }
export type RunMetrics = {
  labels: string[]; train_accuracy: number; train_loss: number; test_accuracy: number; test_loss: number
  test_total: number; test_correct: number; per_class: { label: string; total: number; correct: number }[]
  confusion: number[][]; misclassified: Misclassified[]
}
export type LegacyMetrics = { legacy: true; labels: string[]; test_accuracy: number; test_loss: number }
export type TrainingRun = {
  id: string; run_number: number; created_at: string; duration_ms: number; config: TrainingConfig
  hardware: Partial<Hardware>; history: EpochLog[]; metrics: RunMetrics | LegacyMetrics
}
export type DatasetState = {
  file_name: string; labels: string[]; counts: Record<string, number> | null; samples: number; updated_at: string
  locked: boolean; sufficient: boolean; problem: string | null; can_replace: boolean
}
export type TrainingState = {
  project_id: string; project_type: string; owner: boolean; editable: boolean; step: number; min_per_category: number
  dataset: DatasetState | null; preparation: { test_percent: number; split_seed: number } | null
  config: TrainingConfig | null; runs: TrainingRun[]; model: { run_number: number; updated_at: string } | null
}

export const inputKinds: Record<string, InputKind> = {
  character_recognition: 'gray28', drawing_classification: 'gray28',
  image_classification: 'rgb64', hand_gesture_classification: 'rgb64', body_posture_classification: 'rgb64',
  sound_recognition: 'spec64'
}
export const inputShapes: Record<InputKind, [number, number, number]> = { gray28: [28, 28, 1], rgb64: [64, 64, 3], spec64: [64, 64, 1] }
export const inputLabels: Record<InputKind, string> = {
  gray28: '28 × 28 píxeles, escala de grises (28×28×1)',
  rgb64: '64 × 64 píxeles, color (64×64×3)',
  spec64: 'Espectrograma de 64 × 64 (64×64×1)'
}
export const isLegacy = (metrics: RunMetrics | LegacyMetrics): metrics is LegacyMetrics => 'legacy' in metrics && metrics.legacy === true
export const percent = (value: number, digits = 1) => (value * 100).toFixed(digits) + ' %'
