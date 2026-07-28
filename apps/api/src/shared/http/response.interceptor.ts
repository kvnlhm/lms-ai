import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { type Observable, map } from 'rxjs';

/** Penanda bahwa handler sudah mengembalikan daftar berhalaman. */
export class Paginated<T> {
  constructor(
    readonly items: T[],
    readonly page: number,
    readonly pageSize: number,
    readonly total: number,
  ) {}
}

/**
 * Membungkus setiap respons sukses ke dalam amplop `{ data, meta }` sesuai
 * docs/api/API_CONTRACT.md bagian 2, supaya controller cukup mengembalikan
 * payload polos.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = request.requestId;

    return next.handle().pipe(
      map((payload) => {
        if (payload === undefined || payload === null) return undefined;

        if (payload instanceof Paginated) {
          return {
            data: payload.items,
            meta: {
              page: payload.page,
              pageSize: payload.pageSize,
              total: payload.total,
              totalPages: Math.max(1, Math.ceil(payload.total / payload.pageSize)),
              requestId,
            },
          };
        }

        return { data: payload, meta: { requestId } };
      }),
    );
  }
}
