import {
  ExceptionFilter,
  Catch,
  HttpException,
  ArgumentsHost,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    if (host.getType() !== 'http') return;

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as Record<string, unknown>).message ?? exception.message;

    this.logger.warn(`HTTP ${status}: ${JSON.stringify(message)}`);

    response.status(status).json({
      status: 'error',
      code: status,
      message,
      data: null,
    });
  }
}
