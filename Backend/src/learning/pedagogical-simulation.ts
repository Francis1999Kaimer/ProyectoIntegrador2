import { BadRequestException } from '@nestjs/common';

type GraphNode = { id: string; data: { kind?: unknown } };
type GraphEdge = { source: string; target: string };
type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

export interface PedagogicalSimulation {
  provider: string;
  seed: number;
  parameters: Record<string, unknown>;
  metrics: Record<string, unknown>;
  accuracy: number;
  loss: number;
}

function seedOf(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}
function round(value: number, decimals = 4) { return Number(value.toFixed(decimals)); }
function reaches(edges: GraphEdge[], from: string[], target: Set<string>) {
  const todo = [...from], visited = new Set<string>();
  while (todo.length) {
    const id = todo.shift()!;
    if (target.has(id)) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    todo.push(...edges.filter(edge => edge.source === id).map(edge => edge.target));
  }
  return false;
}

// This provider is intentionally deterministic and pedagogical: it does not train a real ML model.
export function simulatePedagogically(graphJson: string): PedagogicalSimulation {
  const graph = JSON.parse(graphJson) as Graph;
  const kinds = new Map<string, string>();
  for (const node of graph.nodes) if (typeof node.data?.kind === 'string') kinds.set(node.id, node.data.kind);
  const required = ['dataset', 'model', 'train', 'evaluate'];
  if (required.some(kind => ![...kinds.values()].includes(kind))) {
    throw new BadRequestException('El pipeline necesita bloques de datos, modelo, entrenamiento y evaluación.');
  }
  const ids = (kind: string) => [...kinds].filter(([, value]) => value === kind).map(([id]) => id);
  if (!reaches(graph.edges, ids('dataset'), new Set(ids('model'))) ||
      !reaches(graph.edges, ids('model'), new Set(ids('train'))) ||
      !reaches(graph.edges, ids('train'), new Set(ids('evaluate')))) {
    throw new BadRequestException('Conecta el pipeline desde datos hasta evaluación antes de ejecutarlo.');
  }
  const seed = seedOf(graphJson), variance = (seed % 180) / 10000;
  const complexity = Math.min(graph.nodes.length, 12) * 0.003;
  const accuracy = round(Math.min(.965, .79 + complexity + variance));
  const validation = round(Math.max(.65, accuracy - .018 - ((seed >>> 8) % 30) / 10000));
  const precision = round(Math.max(.6, validation - .008 + ((seed >>> 16) % 25) / 10000));
  const recall = round(Math.min(.98, validation + .006 + ((seed >>> 22) % 22) / 10000));
  const f1 = round(2 * precision * recall / (precision + recall));
  const loss = round((1 - validation) * .72, 6);
  const predictedA = 50 + seed % 41;
  return {
    provider: 'deterministic', seed,
    parameters: { mode: 'simulación pedagógica', epochs: 20, node_count: graph.nodes.length, edge_count: graph.edges.length },
    metrics: {
      train_accuracy: accuracy, validation_accuracy: validation, precision, recall, f1, loss,
      epochs: 20, confusion_matrix: [[predictedA, 100 - predictedA], [94 - (seed % 12), 6 + (seed % 12)]],
      prediction: { label: predictedA >= 70 ? 'Clase A' : 'Clase B', confidence: round(.72 + (seed % 20) / 100) }
    }, accuracy: validation, loss
  };
}
