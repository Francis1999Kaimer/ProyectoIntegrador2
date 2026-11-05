import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Project } from '../repositories/contracts';
import { Actor } from '../repositories/learning.contracts';
import { LearningService } from '../learning/learning.service';
import { DATASET_LIMITS, DatasetRejected, inspectDataset, inspectModelArchive, MIN_TRAINING_PER_CATEGORY, sortLabels, testCount } from './dataset-inspection';
import { BATCH_SIZES, DatasetDto, LEARNING_RATES, MODEL_SIZES, PreparationDto, ReplaceDatasetDto, TrainingConfigDto, TrainingRunDto } from './training.dto';

const META = {
  project_id: true, dataset_file_name: true, dataset_content_type: true, dataset_labels_json: true, dataset_samples: true,
  dataset_counts_json: true, dataset_updated_at: true, dataset_locked_at: true, test_percent: true, split_seed: true,
  training_config_json: true, model_file_name: true, training_updated_at: true
} as const;
type LabMeta = {
  project_id: string; dataset_file_name: string; dataset_content_type: string; dataset_labels_json: string; dataset_samples: number;
  dataset_counts_json: string | null; dataset_updated_at: Date; dataset_locked_at: Date | null; test_percent: number | null;
  split_seed: number | null; training_config_json: string | null; model_file_name: string | null; training_updated_at: Date | null
};
type RunRow = { id: string; run_number: number; config_json: string; hardware_json: string; history_json: string; metrics_json: string; duration_ms: number; created_at: Date };
type Config = { epochs: number; learning_rate: number; batch_size: number; model_size: string };
type DatasetStatus = { counts: Record<string, number> | null; problem: string | null; sufficient: boolean };

@Injectable()
export class TrainingService {
  constructor(private readonly learning: LearningService, private readonly db: PrismaService) {}

  // ---------- Lectura ----------
  async state(actor: Actor, projectId: string) {
    const project = await this.learning.project(actor, projectId);
    return this.view(actor, project);
  }
  async datasetFile(actor: Actor, projectId: string) {
    await this.learning.project(actor, projectId);
    const row = await this.db.character_labs.findUnique({ where: { project_id: projectId }, select: { dataset_file_name: true, dataset_content_type: true, dataset_bytes: true } });
    if (!row) throw new NotFoundException('Aún no hay un dataset para este proyecto.');
    return { file_name: row.dataset_file_name, content_type: row.dataset_content_type, bytes: row.dataset_bytes };
  }
  async modelFile(actor: Actor, projectId: string) {
    await this.learning.project(actor, projectId);
    const row = await this.db.character_labs.findUnique({ where: { project_id: projectId }, select: { model_file_name: true, model_content_type: true, model_bytes: true } });
    if (!row?.model_file_name || !row.model_content_type || !row.model_bytes) throw new NotFoundException('Aún no hay un modelo entrenado para este proyecto.');
    return { file_name: row.model_file_name, content_type: row.model_content_type, bytes: row.model_bytes };
  }

  // ---------- Paso 1 ----------
  async saveInitialDataset(actor: Actor, projectId: string, input: DatasetDto) {
    const project = await this.writable(actor, projectId);
    const { bytes, inspection } = await this.dataset(project, input);
    try {
      await this.db.character_labs.create({ data: {
        project_id: projectId, dataset_file_name: input.file_name, dataset_content_type: input.content_type, dataset_bytes: bytes,
        dataset_labels_json: JSON.stringify(inspection.labels), dataset_samples: inspection.total, dataset_counts_json: JSON.stringify(inspection.counts)
      } });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') throw new ConflictException('Este proyecto ya tiene un dataset. Actualiza la página.');
      throw error;
    }
    return this.view(actor, project);
  }
  async replaceDataset(actor: Actor, projectId: string, input: ReplaceDatasetDto) {
    const project = await this.writable(actor, projectId);
    const lab = await this.lab(projectId);
    if (!lab) throw new NotFoundException('Aún no hay un dataset para reemplazar.');
    if (lab.dataset_updated_at.toISOString() !== new Date(input.expected_updated_at).toISOString()) throw new ConflictException('El dataset cambió. Actualiza la página.');
    const status = await this.status(lab, project.project_type);
    if (lab.dataset_locked_at && status.sufficient) throw new ConflictException('El dataset ya quedó fijo y no se puede reemplazar.');
    const { bytes, inspection } = await this.dataset(project, input);
    // Un segundo más que el anterior: la fecha también sirve para detectar cambios simultáneos.
    const next = new Date(Math.floor(Math.max(Date.now(), lab.dataset_updated_at.getTime() + 1000) / 1000) * 1000);
    await this.db.$transaction(async tx => {
      const updated = await tx.character_labs.updateMany({ where: { project_id: projectId, dataset_updated_at: lab.dataset_updated_at }, data: {
        dataset_file_name: input.file_name, dataset_content_type: input.content_type, dataset_bytes: bytes,
        dataset_labels_json: JSON.stringify(inspection.labels), dataset_samples: inspection.total, dataset_counts_json: JSON.stringify(inspection.counts),
        dataset_updated_at: next, dataset_locked_at: null, test_percent: null, split_seed: null,
        model_file_name: null, model_content_type: null, model_bytes: null, training_metrics_json: null, training_updated_at: null
      } });
      if (updated.count !== 1) throw new ConflictException('El dataset cambió. Actualiza la página.');
      // Solo puede haber entrenamientos previos en proyectos del flujo anterior.
      await tx.training_runs.deleteMany({ where: { project_id: projectId } });
    });
    return this.view(actor, project);
  }
  async lockDataset(actor: Actor, projectId: string) {
    const project = await this.writable(actor, projectId);
    const lab = await this.lab(projectId);
    if (!lab) throw new ConflictException('Primero guarda el dataset.');
    if (!lab.dataset_locked_at) await this.db.character_labs.update({ where: { project_id: projectId }, data: { dataset_locked_at: new Date() } });
    return this.view(actor, project);
  }

  // ---------- Paso 2 ----------
  async savePreparation(actor: Actor, projectId: string, input: PreparationDto) {
    const project = await this.writable(actor, projectId);
    const lab = await this.ready(project, false);
    if (lab.test_percent === input.test_percent) return this.view(actor, project);
    if (await this.db.training_runs.count({ where: { project_id: projectId } })) throw new ConflictException('La división quedó fija con el primer entrenamiento.');
    await this.db.character_labs.update({ where: { project_id: projectId }, data: {
      test_percent: input.test_percent, split_seed: lab.split_seed ?? randomInt(1, 2147483647)
    } });
    return this.view(actor, project);
  }

  // ---------- Paso 3 ----------
  async saveConfig(actor: Actor, projectId: string, input: TrainingConfigDto) {
    const project = await this.writable(actor, projectId);
    await this.ready(project, true);
    const config: Config = { epochs: input.epochs, learning_rate: input.learning_rate, batch_size: input.batch_size, model_size: input.model_size };
    await this.db.character_labs.update({ where: { project_id: projectId }, data: { training_config_json: JSON.stringify(config) } });
    return this.view(actor, project);
  }

  // ---------- Paso 4 ----------
  async createRun(actor: Actor, projectId: string, input: TrainingRunDto) {
    const project = await this.writable(actor, projectId);
    const lab = await this.ready(project, true);
    const saved = this.json<Config>(lab.training_config_json);
    if (!saved) throw new ConflictException('Guarda la configuración en el paso 3.');
    const config = this.config(input.config);
    if (config.epochs !== saved.epochs || config.learning_rate !== saved.learning_rate || config.batch_size !== saved.batch_size || config.model_size !== saved.model_size)
      throw new ConflictException('La configuración cambió. Vuelve al paso 3.');
    const labels = JSON.parse(lab.dataset_labels_json) as string[];
    const counts = (await this.status(lab, project.project_type)).counts!;
    const history = this.history(input.history, config.epochs);
    const metrics = this.metrics(input.metrics, labels, counts, lab.test_percent!);
    const hardware = this.hardware(input.hardware);
    const model = this.archive(input.model_base64, 'El modelo');
    try { await inspectModelArchive(model); } catch (error) { throw this.rejected(error); }
    const last = await this.db.training_runs.findFirst({ where: { project_id: projectId }, orderBy: { run_number: 'desc' }, select: { run_number: true } });
    if (input.run_number !== (last?.run_number ?? 0) + 1) throw new ConflictException('Ya hay un entrenamiento más reciente. Actualiza la página.');
    const now = new Date();
    try {
      await this.db.$transaction(async tx => {
        await tx.training_runs.create({ data: {
          id: randomUUID(), project_id: projectId, run_number: input.run_number, config_json: JSON.stringify(config),
          hardware_json: JSON.stringify(hardware), history_json: JSON.stringify(history), metrics_json: JSON.stringify(metrics),
          duration_ms: input.duration_ms, created_at: now
        } });
        await tx.character_labs.update({ where: { project_id: projectId }, data: {
          model_file_name: `modelo-entrenamiento-${input.run_number}.zip`, model_content_type: 'application/zip', model_bytes: model,
          training_metrics_json: JSON.stringify({ run_number: input.run_number, labels, epochs: config.epochs, accuracy: metrics.test_accuracy, loss: metrics.test_loss, history }),
          training_updated_at: now
        } });
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') throw new ConflictException('Ya hay un entrenamiento más reciente. Actualiza la página.');
      throw error;
    }
    return this.view(actor, project);
  }

  // ---------- Reglas ----------
  private async writable(actor: Actor, projectId: string) {
    const project = await this.learning.project(actor, projectId, true);
    if (project.status === 'archived') throw new BadRequestException('El proyecto está archivado.');
    return project;
  }
  private lab(projectId: string): Promise<LabMeta | null> {
    return this.db.character_labs.findUnique({ where: { project_id: projectId }, select: META }) as Promise<LabMeta | null>;
  }
  /** Dataset fijo y suficiente; con `prepared`, además la división guardada. */
  private async ready(project: Project, prepared: boolean) {
    const lab = await this.lab(project.id);
    if (!lab?.dataset_locked_at) throw new ConflictException('Primero confirma el dataset en el paso 1.');
    const status = await this.status(lab, project.project_type);
    if (!status.sufficient) throw new ConflictException(status.problem ?? 'El dataset no es suficiente para entrenar.');
    if (prepared && !lab.test_percent) throw new ConflictException('Primero guarda la preparación en el paso 2.');
    return lab;
  }
  private async status(lab: LabMeta, projectType: string): Promise<DatasetStatus> {
    let counts = this.json<Record<string, number>>(lab.dataset_counts_json);
    if (!counts) {
      // Datasets guardados antes de este flujo: se cuentan una vez desde el ZIP.
      const row = await this.db.character_labs.findUnique({ where: { project_id: lab.project_id }, select: { dataset_bytes: true } });
      try {
        counts = (await inspectDataset(row!.dataset_bytes, projectType)).counts;
        await this.db.character_labs.update({ where: { project_id: lab.project_id }, data: { dataset_counts_json: JSON.stringify(counts) } });
      } catch (error) {
        if (!(error instanceof DatasetRejected)) throw error;
        return { counts: null, problem: 'El ZIP guardado no cumple el formato actual: ' + error.message, sufficient: false };
      }
    }
    const short = Object.entries(counts).filter(([, count]) => count < MIN_TRAINING_PER_CATEGORY);
    return { counts, sufficient: !short.length, problem: short.length ? `Cada categoría necesita al menos ${MIN_TRAINING_PER_CATEGORY} ejemplos para entrenar.` : null };
  }
  private async dataset(project: Project, input: DatasetDto) {
    const bytes = this.archive(input.archive_base64, 'El dataset');
    let inspection;
    try { inspection = await inspectDataset(bytes, project.project_type); } catch (error) { throw this.rejected(error); }
    if (input.samples !== inspection.total || JSON.stringify(sortLabels(input.labels.map(label => label.trim()))) !== JSON.stringify(inspection.labels))
      throw new BadRequestException('El resumen del ZIP no coincide con su contenido.');
    return { bytes, inspection };
  }
  private rejected(error: unknown) {
    return error instanceof DatasetRejected ? new BadRequestException(error.message) : error;
  }
  private archive(base64: string, subject: string) {
    // Buffer.from acepta Base64 mal formado sin avisar; se valida la forma canónica.
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) throw new BadRequestException(`${subject} no es válido.`);
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length < 4 || bytes.length > DATASET_LIMITS.archiveBytes || bytes[0] !== 0x50 || bytes[1] !== 0x4b)
      throw new BadRequestException(`${subject} debe ser un ZIP de hasta 15 MB.`);
    return bytes;
  }
  private config(value: Record<string, unknown>): Config {
    const { epochs, learning_rate, batch_size, model_size } = value;
    if (!Number.isInteger(epochs) || (epochs as number) < 5 || (epochs as number) > 30 || !LEARNING_RATES.includes(learning_rate as number) ||
        !BATCH_SIZES.includes(batch_size as number) || !MODEL_SIZES.includes(model_size as string)) throw new BadRequestException('La configuración no es válida.');
    return { epochs: epochs as number, learning_rate: learning_rate as number, batch_size: batch_size as number, model_size: model_size as string };
  }
  private history(value: unknown[], epochs: number) {
    if (value.length !== epochs) throw new BadRequestException('El historial no corresponde a las épocas configuradas.');
    return value.map((item, index) => {
      const row = item as Record<string, unknown>;
      if (!row || row.epoch !== index + 1 || !this.ratio(row.accuracy) || !this.loss(row.loss)) throw new BadRequestException('El historial de entrenamiento no es válido.');
      return { epoch: index + 1, accuracy: row.accuracy as number, loss: row.loss as number };
    });
  }
  private metrics(value: Record<string, unknown>, labels: string[], counts: Record<string, number>, testPercent: number) {
    const fail = (): never => { throw new BadRequestException('Las métricas no son válidas.'); };
    const { train_accuracy, train_loss, test_accuracy, test_loss, per_class, confusion, misclassified } = value;
    if (!this.ratio(train_accuracy) || !this.loss(train_loss) || !this.ratio(test_accuracy) || !this.loss(test_loss)) fail();
    if (JSON.stringify(value.labels) !== JSON.stringify(labels)) throw new BadRequestException('El modelo no corresponde a las categorías del dataset.');
    const expected = labels.map(label => testCount(counts[label], testPercent));
    if (!Array.isArray(confusion) || confusion.length !== labels.length) fail();
    const matrix = (confusion as unknown[]).map((row, i) => {
      if (!Array.isArray(row) || row.length !== labels.length || row.some(cell => !Number.isInteger(cell) || cell < 0)) fail();
      if ((row as number[]).reduce((sum, cell) => sum + cell, 0) !== expected[i]) fail();
      return row as number[];
    });
    const total = expected.reduce((sum, count) => sum + count, 0), correct = matrix.reduce((sum, row, i) => sum + row[i], 0);
    if (Math.abs(correct / total - (test_accuracy as number)) > 0.0005) fail();
    if (!Array.isArray(per_class) || per_class.length !== labels.length) fail();
    const perClass = labels.map((label, i) => {
      const row = (per_class as Record<string, unknown>[])[i];
      if (!row || row.label !== label || row.total !== expected[i] || row.correct !== matrix[i][i]) fail();
      return { label, total: expected[i], correct: matrix[i][i] };
    });
    if (!Array.isArray(misclassified) || misclassified.length > 50) fail();
    const errors = (misclassified as Record<string, unknown>[]).map(row => {
      if (!row || typeof row.file !== 'string' || !row.file.length || row.file.length > 300 || !labels.includes(row.actual as string) ||
          !labels.includes(row.predicted as string) || !this.ratio(row.confidence)) fail();
      return { file: row.file as string, actual: row.actual as string, predicted: row.predicted as string, confidence: row.confidence as number };
    });
    return { labels, train_accuracy: train_accuracy as number, train_loss: train_loss as number, test_accuracy: test_accuracy as number,
      test_loss: test_loss as number, test_total: total, test_correct: correct, per_class: perClass, confusion: matrix, misclassified: errors };
  }
  private hardware(value: Record<string, unknown>) {
    const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max ? v : null;
    const number = (v: unknown, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null;
    const backend = text(value.backend, 20);
    if (!backend) throw new BadRequestException('Falta el hardware usado.');
    return { backend, gpu: text(value.gpu, 200), cores: number(value.cores, 1024), memory_gb: number(value.memory_gb, 1024), epoch_estimate_ms: number(value.epoch_estimate_ms, 86400000) };
  }
  private ratio(value: unknown) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1; }
  private loss(value: unknown) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000000; }
  private json<T>(value: string | null): T | null { return value ? JSON.parse(value) as T : null; }

  // ---------- Vista ----------
  private async view(actor: Actor, project: Project) {
    const lab = await this.lab(project.id);
    const runs = lab ? await this.db.training_runs.findMany({ where: { project_id: project.id }, orderBy: { run_number: 'asc' } }) as RunRow[] : [];
    const owner = project.owner_id === actor.id, editable = owner && project.status !== 'archived';
    const status = lab ? await this.status(lab, project.project_type) : null;
    const locked = !!lab?.dataset_locked_at;
    let step = 1;
    if (lab && locked) step = !status!.sufficient || !lab.test_percent ? 2 : runs.length ? 5 : !lab.training_config_json ? 3 : 4;
    return {
      project_id: project.id, project_type: project.project_type, owner, editable, step, min_per_category: MIN_TRAINING_PER_CATEGORY,
      dataset: lab ? {
        file_name: lab.dataset_file_name, labels: JSON.parse(lab.dataset_labels_json) as string[], counts: status!.counts,
        samples: lab.dataset_samples, updated_at: lab.dataset_updated_at, locked, sufficient: status!.sufficient, problem: status!.problem,
        can_replace: editable && (!locked || !status!.sufficient)
      } : null,
      preparation: lab?.test_percent ? { test_percent: lab.test_percent, split_seed: lab.split_seed } : null,
      config: lab ? this.json<Config>(lab.training_config_json) : null,
      runs: runs.map(run => ({
        id: run.id, run_number: run.run_number, created_at: run.created_at, duration_ms: run.duration_ms,
        config: JSON.parse(run.config_json), hardware: JSON.parse(run.hardware_json), history: JSON.parse(run.history_json), metrics: JSON.parse(run.metrics_json)
      })),
      model: lab?.model_file_name && runs.length ? { run_number: runs[runs.length - 1].run_number, updated_at: lab.training_updated_at } : null
    };
  }
}
