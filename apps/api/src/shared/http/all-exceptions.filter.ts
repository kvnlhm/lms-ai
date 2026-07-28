import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ErrorCode } from '@lms/contracts';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error';

interface NormalisedError {
  status: number;
  code: ErrorCode;
  message: string;
  fields?: Record<string, string[]>;
}

/**
 * Satu-satunya tempat error diubah menjadi respons HTTP.
 *
 * Detail internal tidak pernah bocor ke klien: exception yang tidak dikenali
 * selalu menjadi INTERNAL_ERROR dengan pesan generik, sementara penyebab
 * aslinya hanya masuk ke log bersama requestId.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const requestId = request.requestId ?? 'unknown';

    const normalised = this.normalise(exception);

    if (normalised.status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} gagal (requestId=${requestId})`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.originalUrl} → ${normalised.status} ${normalised.code} (requestId=${requestId})`,
      );
    }

    response.status(normalised.status).json({
      error: {
        code: normalised.code,
        message: normalised.message,
        ...(normalised.fields ? { fields: normalised.fields } : {}),
        requestId,
      },
    });
  }

  private normalise(exception: unknown): NormalisedError {
    if (exception instanceof AppError) {
      return {
        status: exception.status,
        code: exception.code,
        message: exception.message,
        fields: exception.fields,
      };
    }

    if (exception instanceof UnprocessableEntityException) {
      return {
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Data yang diberikan tidak valid.',
        fields: extractValidationFields(exception),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        code: statusToCode(status),
        message: status >= 500 ? 'Terjadi kesalahan pada server.' : exception.message,
      };
    }

    return {
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan pada server.',
    };
  }
}

function statusToCode(status: number): ErrorCode {
  switch (status) {
    case 401:
      return 'AUTHENTICATION_REQUIRED';
    case 403:
      return 'PERMISSION_DENIED';
    case 404:
      return 'RESOURCE_NOT_FOUND';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR';
  }
}

/** Mengubah pesan class-validator menjadi peta `field -> pesan[]`. */
function extractValidationFields(
  exception: UnprocessableEntityException,
): Record<string, string[]> | undefined {
  const response = exception.getResponse();
  if (typeof response !== 'object' || response === null) return undefined;

  const message = (response as { message?: unknown }).message;
  if (!Array.isArray(message)) return undefined;

  const fields: Record<string, string[]> = {};
  for (const entry of message) {
    if (typeof entry !== 'string') continue;
    const field = entry.split(' ')[0] ?? '_';
    (fields[field] ??= []).push(entry);
  }
  return Object.keys(fields).length > 0 ? fields : undefined;
}
