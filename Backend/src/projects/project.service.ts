import { Inject, Injectable } from '@nestjs/common';
import { PROJECT_REPOSITORY, ProjectRepository, PageRequest } from '../repositories/contracts';

// No Prisma dependency here. Future controllers must supply an authorized actor.
@Injectable()
export class ProjectService {
  constructor(@Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository) {}
  listForOwner(ownerId: string, page?: PageRequest) {
    return this.projects.listByOwner(ownerId, page);
  }
  createPersonalProject(ownerId: string, title: string, projectType: string) {
    const cleanTitle = title.trim();
    const cleanType = projectType.trim();
    if (!cleanTitle || cleanTitle.length > 180 || !cleanType || cleanType.length > 40) {
      throw new RangeError('Título o tipo de proyecto inválido.');
    }
    return this.projects.create({ owner_id: ownerId, title: cleanTitle, project_type: cleanType });
  }
}
