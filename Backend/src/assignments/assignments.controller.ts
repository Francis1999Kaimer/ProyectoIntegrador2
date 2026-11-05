import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Req, UseFilters } from '@nestjs/common';
import { AuthRequest, Roles } from '../auth/auth.policy';
import { ApiErrorFilter } from '../learning/api-error.filter';
import { AssignmentDto, AssignmentPatchDto, GradeDto, SubmissionDto } from './assignments.dto';
import { AssignmentsService } from './assignments.service';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller() @UseFilters(ApiErrorFilter) @Roles('student', 'teacher', 'admin')
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}
  // Debe declararse antes de assignments/:id.
  @Get('assignments/pending') @Header('Cache-Control', 'no-store')
  pending(@Req() req: AuthRequest) { return this.service.pending(req.user!); }
  @Get('classrooms/:id/assignments') @Header('Cache-Control', 'no-store')
  list(@Req() req: AuthRequest, @Param('id', uuid) id: string) { return this.service.list(req.user!, id); }
  @Post('classrooms/:id/assignments') @Roles('teacher', 'admin') @Header('Cache-Control', 'no-store')
  create(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Body() body: AssignmentDto) { return this.service.create(req.user!, id, body); }
  @Get('assignments/:id') @Header('Cache-Control', 'no-store')
  detail(@Req() req: AuthRequest, @Param('id', uuid) id: string) { return this.service.detail(req.user!, id); }
  @Patch('assignments/:id') @Roles('teacher', 'admin') @Header('Cache-Control', 'no-store')
  update(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Body() body: AssignmentPatchDto) { return this.service.update(req.user!, id, body); }
  @Delete('assignments/:id') @Roles('teacher', 'admin') @HttpCode(204)
  remove(@Req() req: AuthRequest, @Param('id', uuid) id: string) { return this.service.remove(req.user!, id); }
  @Put('assignments/:id/submission') @Roles('student') @Header('Cache-Control', 'no-store')
  submit(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Body() body: SubmissionDto) { return this.service.submit(req.user!, id, body); }
  @Put('assignments/:id/submissions/:studentId/grade') @Roles('teacher', 'admin') @Header('Cache-Control', 'no-store')
  grade(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Param('studentId', uuid) studentId: string, @Body() body: GradeDto) { return this.service.grade(req.user!, id, studentId, body); }
}
