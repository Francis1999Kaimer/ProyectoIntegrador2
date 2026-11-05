import { Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { RepositoriesModule } from '../repositories/repositories.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { JwtAuthGuard, RolesGuard } from './auth.guards';

@Module({
  imports: [
    RepositoriesModule, ConfigModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    JwtModule.registerAsync({
      imports: [ConfigModule], inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        // Sin vencimiento: la sesión dura hasta cerrar sesión o la pestaña. Se invalida al cambiar o
        // restablecer la contraseña y al suspender la cuenta, porque cada petición se revisa contra la BD.
        signOptions: { algorithm: 'HS256', issuer: 'aiblocks-api', audience: 'aiblocks-web' },
        verifyOptions: { algorithms: ['HS256'], issuer: 'aiblocks-api', audience: 'aiblocks-web' }
      })
    })
  ],
  controllers: [AuthController],
  providers: [
    AuthService, PasswordService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_PIPE, useValue: new ValidationPipe({
      whitelist: true, forbidNonWhitelisted: true, transform: true,
      validationError: { target: false, value: false }
    }) }
  ],
  exports: [AuthService, PasswordService]
})
export class AuthModule {}
