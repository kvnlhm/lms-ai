import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Memberi setiap request satu ID yang muncul di amplop respons, log, dan
 * audit log, sehingga satu keluhan pengguna dapat ditelusuri lintas layanan.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header('x-request-id');
    req.requestId = isUuid(incoming) ? (incoming as string) : randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | undefined): boolean {
  return typeof value === 'string' && UUID_RE.test(value);
}
