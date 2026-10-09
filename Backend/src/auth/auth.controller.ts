import { Body, Controller, Get, Header, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto } from './auth.dto';
import { AllowPasswordChange, AuthRequest, Public, Roles } from './auth.policy';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('login') @HttpCode(200) @Public() @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  login(@Body() body: LoginDto) { return this.auth.login(body.username, body.password); }
  @Get('me') @AllowPasswordChange() @Header('Cache-Control', 'no-store')
  me(@Req() request: AuthRequest) { return request.user; }
  @Post('change-password') @HttpCode(200) @AllowPasswordChange() @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  changePassword(@Req() request: AuthRequest, @Body() body: ChangePasswordDto) {
    return this.auth.changePassword(request.user!.id, body.current_password, body.new_password);
  }
  // Small authorization probes for APF2 evidence; business endpoints belong to hito 6.
  @Get('access/admin') @Roles('admin') @Header('Cache-Control', 'no-store')
  adminAccess() { return { allowed: true }; }
  @Get('access/teacher') @Roles('teacher', 'admin') @Header('Cache-Control', 'no-store')
  teacherAccess() { return { allowed: true }; }
  @Get('access/student') @Roles('student', 'admin') @Header('Cache-Control', 'no-store')
  studentAccess() { return { allowed: true }; }
}
