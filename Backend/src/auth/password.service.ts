import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
@Injectable()
export class PasswordService {
  private readonly dummyHash = bcrypt.hash('aiblocks-dummy-credential-comparison', 12);
  async verify(password: string, hash: string | null) {
    if (bcrypt.truncates(password)) return false;
    return bcrypt.compare(password, hash ?? await this.dummyHash);
  }
  hash(password: string) {
    if (password.length < 12 || bcrypt.truncates(password)) {
      throw new BadRequestException('La contraseña debe tener al menos 12 caracteres y como máximo 72 bytes UTF-8.');
    }
    return bcrypt.hash(password, 12);
  }
}
