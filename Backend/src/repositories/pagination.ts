import { PageRequest } from './contracts';
export function pagination(page: PageRequest = {}) {
  const take = page.limit ?? 25;
  const skip = page.offset ?? 0;
  if (!Number.isSafeInteger(take) || take < 1 || take > 100 || !Number.isSafeInteger(skip) || skip < 0) {
    throw new RangeError('Paginación inválida: limit 1–100 y offset entero no negativo.');
  }
  return { take, skip };
}
