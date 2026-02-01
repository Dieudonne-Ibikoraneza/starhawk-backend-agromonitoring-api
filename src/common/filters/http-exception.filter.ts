import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let validationErrors: Record<string, string[]> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const msg = (exceptionResponse as { message?: string | string[] }).message;
        if (Array.isArray(msg)) {
          // Handle validation errors
          validationErrors = this.formatValidationErrors(msg);
          message = 'Validation failed';
        } else {
          message = msg || exception.message;
          message = String(message);
        }
      } else {
        message = String(exceptionResponse);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const errorResponse = {
      type: 'about:blank',
      title: this.getTitleForStatus(status),
      status,
      detail: message,
      instance: request.url,
      timestamp: new Date().toISOString(),
      ...(Object.keys(validationErrors).length > 0 && { validationErrors }),
    };

    response.status(status).json(errorResponse);
  }

  private getTitleForStatus(status: number): string {
    const titles: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
    };
    return titles[status] || 'Error';
  }

  private formatValidationErrors(
    messages: string[],
  ): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    messages.forEach((message) => {
      const match = message.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, field, errorMessage] = match;
        if (!errors[field]) {
          errors[field] = [];
        }
        errors[field].push(errorMessage);
      } else {
        if (!errors['general']) {
          errors['general'] = [];
        }
        errors['general'].push(message);
      }
    });
    return errors;
  }
}

