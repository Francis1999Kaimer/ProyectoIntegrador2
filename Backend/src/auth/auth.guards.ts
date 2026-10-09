import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthRequest, PASSWORD_CHANGE_ALLOWED, PUBLIC_ROUTE, REQUIRED_ROLES, Role } from './auth.policy';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !/^Bearer [^\s]+$/i.test(header)) {
      throw new UnauthorizedException('Token Bearer requerido.');
    }
    request.user = await this.auth.authenticate(header.slice(7));
    return true;
  }
}
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, targets)) return true;
    const user = context.switchToHttp().getRequest<AuthRequest>().user;
    if (!user) throw new UnauthorizedException('Sesión requerida.');
    if (user.must_change_password && !this.reflector.getAllAndOverride<boolean>(PASSWORD_CHANGE_ALLOWED, targets)) {
      throw new ForbiddenException('Debes cambiar la contraseña antes de continuar.');
    }
    const roles = this.reflector.getAllAndOverride<Role[]>(REQUIRED_ROLES, targets);
    if (roles && !roles.includes(user.role as Role)) throw new ForbiddenException('No tienes permiso para esta acción.');
    return true;
  }
}
