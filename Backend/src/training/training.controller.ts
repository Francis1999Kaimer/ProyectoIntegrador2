import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Put, Req, StreamableFile, UseFilters } from '@nestjs/common';
import { AuthRequest, Roles } from '../auth/auth.policy';
import { ApiErrorFilter } from '../learning/api-error.filter';
import { DatasetDto, PreparationDto, ReplaceDatasetDto, TrainingConfigDto, TrainingRunDto } from './training.dto';
import { TrainingService } from './training.service';

const uuid = new ParseUUIDPipe({ version: '4' });
const download = (file: { file_name: string; content_type: string; bytes: Uint8Array }) =>
  new StreamableFile(file.bytes, { type: file.content_type, disposition: `attachment; filename="${file.file_name.replace(/["\\]/g, '_')}"` });

// El mismo flujo para alumno, docente y administrador: solo el propietario modifica;
// el docente del salón y el administrador consultan (reglas de LearningService.project).
@Controller('projects/:id') @UseFilters(ApiErrorFilter) @Roles('student', 'teacher', 'admin')
export class TrainingController {
  constructor(private readonly service: TrainingService) {}
  @Get('training') @Header('Cache-Control', 'no-store')
  state(@Req() req: AuthRequest, @Param('id', uuid) id: string) { return this.service.state(req.user!, id); }
  @Post('dataset') @Header('Cache-Control', 'no-store')
  saveDataset(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Body() body: DatasetDto) { return this.service.saveInitialDataset(req.user!, id, body); }
  @Put('dataset') @Header('Cache-Control', 'no-store')
  replaceDataset(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Body() body: ReplaceDatasetDto) { return this.service.replaceDataset(req.user!, id, body); }
  @Post('dataset/lock') @Header('Cache-Control', 'no-store')
  lockDataset(@Req() req: AuthRequest, @Param('id', uuid) id: string) { return this.service.lockDataset(req.user!, id); }
  @Get('dataset/file') @Header('Cache-Control', 'no-store')
  async datasetFile(@Req() req: AuthRequest, @Param('id', uuid) id: string) { return download(await this.service.datasetFile(req.user!, id)); }
  @Put('training/preparation') @Header('Cache-Control', 'no-store')
  savePreparation(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Body() body: PreparationDto) { return this.service.savePreparation(req.user!, id, body); }
  @Put('training/config') @Header('Cache-Control', 'no-store')
  saveConfig(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Body() body: TrainingConfigDto) { return this.service.saveConfig(req.user!, id, body); }
  @Post('training/runs') @Header('Cache-Control', 'no-store')
  createRun(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Body() body: TrainingRunDto) { return this.service.createRun(req.user!, id, body); }
  @Get('training/model-file') @Header('Cache-Control', 'no-store')
  async modelFile(@Req() req: AuthRequest, @Param('id', uuid) id: string) { return download(await this.service.modelFile(req.user!, id)); }
}
