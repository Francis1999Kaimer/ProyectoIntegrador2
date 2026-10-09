import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { DataConflict, DataMissing } from '../repositories/learning.contracts';

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    let status = 503;
    let body: unknown = { statusCode: status, message: 'Servicio temporalmente no disponible.' };
    if (error instanceof HttpException) {
      status = error.getStatus();
      body = error.getResponse();
    } else if (error instanceof DataConflict || error instanceof DataMissing) {
      status = error instanceof DataConflict ? 409 : 404;
      body = { statusCode: status, message: status === 409 ? 'Conflicto de datos o versión. Recarga e intenta de nuevo.' : 'Recurso no encontrado.' };
    }
    // No raw ORM error, stack, request body, token or guardian details in responses/logs.
    response.setHeader('Cache-Control', 'no-store');
    response.status(status).json(body);
  }
}
