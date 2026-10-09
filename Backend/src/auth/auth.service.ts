import { BadRequestException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { USER_REPOSITORY, UserRepository } from '../repositories/contracts';
import { PasswordService } from './password.service';
import { isRole, publicUser } from './auth.policy';

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}
  private sessionKey(hash: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET')).update(hash).digest('hex');
  }
  private async credentialsById(id: string) {
    try { return await this.users.findCredentialsById(id); }
    catch { throw new ServiceUnavailableException('Autenticación temporalmente no disponible.'); }
  }
  async login(username: string, password: string) {
    let user;
    try { user = await this.users.findForAuthentication(username); }
    catch { throw new ServiceUnavailableException('Autenticación temporalmente no disponible.'); }
    const matches = await this.passwords.verify(password, user?.password_hash ?? null);
    if (!user || !matches || user.status !== 'active' || !isRole(user.role)) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    const access_token = await this.jwt.signAsync({
      sub: user.id, role: user.role, session: this.sessionKey(user.password_hash), jti: randomUUID()
    });
    return { access_token, token_type: 'Bearer', expires_in: 900, user: publicUser(user) };
  }
  async authenticate(token: string) {
    let payload: { sub?: unknown; session?: unknown };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch { throw new UnauthorizedException('Sesión inválida o vencida.'); }
    if (!payload || typeof payload !== 'object' || typeof payload.sub !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.sub) ||
        typeof payload.session !== 'string' || !/^[0-9a-f]{64}$/.test(payload.session)) {
      throw new UnauthorizedException('Sesión inválida.');
    }
    const user = await this.credentialsById(payload.sub);
    if (!user || user.status !== 'active' || !isRole(user.role) ||
        !timingSafeEqual(Buffer.from(payload.session, 'hex'), Buffer.from(this.sessionKey(user.password_hash), 'hex'))) {
      throw new UnauthorizedException('Sesión inválida.');
    }
    return publicUser(user);
  }
  async changePassword(id: string, current: string, next: string) {
    const user = await this.credentialsById(id);
    if (!user || user.status !== 'active' || !await this.passwords.verify(current, user.password_hash)) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    if (await this.passwords.verify(next, user.password_hash)) {
      throw new BadRequestException('La nueva contraseña debe ser diferente.');
    }
    const hash = await this.passwords.hash(next);
    let updated;
    try { updated = await this.users.updatePassword(id, user.password_hash, hash); }
    catch { throw new ServiceUnavailableException('No se pudo actualizar la contraseña.'); }
    if (!updated) throw new UnauthorizedException('La credencial cambió; vuelve a iniciar sesión.');
    // Session fingerprint changes with password hash, invalidating prior JWTs.
    return { message: 'Contraseña actualizada. Inicia sesión nuevamente.' };
  }
}
