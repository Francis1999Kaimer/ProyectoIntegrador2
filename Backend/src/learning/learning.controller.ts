import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseFilters } from '@nestjs/common';
import { AuthRequest, Roles } from '../auth/auth.policy';
import { LearningService } from './learning.service';
import { ApiErrorFilter } from './api-error.filter';
import { ClassroomDto, ClassroomPatchDto, ConsentDto, EnrollmentDto, PageDto, ProgressDto, ProjectDto, ProjectPatchDto, StudentDto, StudentStatusDto, TeacherDto, TeacherStatusDto, WorkspaceDto } from './learning.dto';

const uuid = new ParseUUIDPipe({ version: '4' });
@Controller() @UseFilters(ApiErrorFilter) @Roles('student', 'teacher', 'admin')
export class LearningController {
  constructor(private readonly service: LearningService) {}
  @Get('catalog') @Header('Cache-Control', 'no-store')
  catalog() { return this.service.catalog(); }
  @Get('students') @Roles('teacher', 'admin') @Header('Cache-Control', 'no-store')
  students(@Req() req: AuthRequest, @Query() page: PageDto) { return this.service.students(req.user!, page); }
  @Post('students') @Roles('admin') @Header('Cache-Control', 'no-store')
  createStudent(@Body() body: StudentDto) { return this.service.createStudent(body); }
  @Patch('students/:id/status') @Roles('admin') @Header('Cache-Control', 'no-store')
  studentStatus(@Param('id', uuid) id: string, @Body() body: StudentStatusDto) { return this.service.studentStatus(id, body.status); }
  @Post('students/:id/consents') @Roles('admin') @Header('Cache-Control', 'no-store')
  consent(@Param('id', uuid) id: string, @Body() body: ConsentDto) { return this.service.consent(id, body); }
  @Get('students/:id/consents/current') @Roles('admin') @Header('Cache-Control', 'no-store')
  currentConsent(@Param('id', uuid) id: string) { return this.service.currentConsent(id); }
  @Delete('students/:id/consents/current') @Roles('admin') @HttpCode(204)
  revokeConsent(@Param('id', uuid) id: string) { return this.service.revokeConsent(id); }
  @Get('teachers') @Roles('admin') @Header('Cache-Control', 'no-store')
  teachers(@Query() page: PageDto) { return this.service.teachers(page); }
  @Post('teachers') @Roles('admin') @Header('Cache-Control', 'no-store')
  createTeacher(@Body() body: TeacherDto) { return this.service.createTeacher(body); }
  @Patch('teachers/:id/status') @Roles('admin') @Header('Cache-Control', 'no-store')
  teacherStatus(@Param('id', uuid) id: string, @Body() body: TeacherStatusDto) { return this.service.teacherStatus(id, body.status); }
  @Get('classrooms') @Header('Cache-Control', 'no-store')
  classrooms(@Req() req: AuthRequest, @Query() page: PageDto) { return this.service.classrooms(req.user!, page); }
  @Get('classrooms/:id') @Header('Cache-Control', 'no-store')
  classroom(@Req() req: AuthRequest, @Param('id', uuid) id: string) { return this.service.classroom(req.user!, id); }
  @Post('classrooms') @Roles('teacher', 'admin') @Header('Cache-Control', 'no-store')
  createClassroom(@Req() req: AuthRequest, @Body() body: ClassroomDto) { return this.service.createClassroom(req.user!, body); }
  @Patch('classrooms/:id') @Roles('teacher', 'admin') @Header('Cache-Control', 'no-store')
  updateClassroom(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Body() body: ClassroomPatchDto) { return this.service.updateClassroom(req.user!, id, body); }
  @Get('classrooms/:id/students') @Roles('teacher', 'admin') @Header('Cache-Control', 'no-store')
  classroomStudents(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Query() page: PageDto) { return this.service.classroomStudents(req.user!, id, page); }
  @Get('classrooms/:id/eligible-students') @Roles('teacher', 'admin') @Header('Cache-Control', 'no-store')
  eligibleStudents(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Query() page: PageDto) { return this.service.eligibleStudents(req.user!, id, page); }
  @Post('classrooms/:id/students') @Roles('teacher', 'admin') @HttpCode(200) @Header('Cache-Control', 'no-store')
  enroll(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Body() body: EnrollmentDto) { return this.service.enroll(req.user!, id, body.student_id); }
  @Delete('classrooms/:id/students/:studentId') @Roles('teacher', 'admin') @HttpCode(204)
  unenroll(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Param('studentId', uuid) studentId: string) { return this.service.unenroll(req.user!, id, studentId); }
  @Get('classrooms/:id/lessons') @Header('Cache-Control', 'no-store')
  lessons(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Query() page: PageDto) { return this.service.lessons(req.user!, id, page); }
  @Get('projects') @Header('Cache-Control', 'no-store')
  projects(@Req() req: AuthRequest, @Query() page: PageDto) { return this.service.projects(req.user!, page); }
  @Get('projects/:id') @Header('Cache-Control', 'no-store')
  project(@Req() req: AuthRequest, @Param('id', uuid) id: string) { return this.service.project(req.user!, id); }
  @Post('projects') @Header('Cache-Control', 'no-store')
  createProject(@Req() req: AuthRequest, @Body() body: ProjectDto) { return this.service.createProject(req.user!, body); }
  @Patch('projects/:id') @Header('Cache-Control', 'no-store')
  updateProject(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Body() body: ProjectPatchDto) { return this.service.updateProject(req.user!, id, body); }
  @Get('projects/:id/workspace') @Header('Cache-Control', 'no-store')
  workspace(@Req() req: AuthRequest, @Param('id', uuid) id: string) { return this.service.workspace(req.user!, id); }
  @Put('projects/:id/workspace') @Header('Cache-Control', 'no-store')
  saveWorkspace(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Body() body: WorkspaceDto) { return this.service.saveWorkspace(req.user!, id, body); }
  @Get('projects/:id/simulations') @Header('Cache-Control', 'no-store')
  simulations(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Query() page: PageDto) { return this.service.simulations(req.user!, id, page); }
  @Post('projects/:id/simulations') @Header('Cache-Control', 'no-store')
  simulate(@Req() req: AuthRequest, @Param('id', uuid) id: string) { return this.service.simulate(req.user!, id); }
  @Get('progress') @Roles('student') @Header('Cache-Control', 'no-store')
  myProgress(@Req() req: AuthRequest, @Query() page: PageDto) { return this.service.progress(req.user!, req.user!.id, page); }
  @Get('students/:id/progress') @Roles('teacher', 'admin') @Header('Cache-Control', 'no-store')
  progress(@Req() req: AuthRequest, @Param('id', uuid) id: string, @Query() page: PageDto) { return this.service.progress(req.user!, id, page); }
  @Put('progress/:lessonId') @Roles('student') @Header('Cache-Control', 'no-store')
  saveProgress(@Req() req: AuthRequest, @Param('lessonId', uuid) id: string, @Body() body: ProgressDto) { return this.service.saveProgress(req.user!, id, body.completed_sections); }
}
