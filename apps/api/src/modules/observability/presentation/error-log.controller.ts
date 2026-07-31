import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@lms/contracts';
import type { Request } from 'express';
import { ApiEnvelope, ApiEnvelopeList, ApiErrors } from '../../../shared/http/api-envelope';
import { Paginated } from '../../../shared/http/response.interceptor';
import { ErrorMonitorService } from '../../../shared/observability/error-monitor.service';
import type { AuthenticatedUser } from '../../identity/domain/session';
import { CurrentUser, Public, RequirePermissions } from '../../identity/presentation/decorators';
import { ClientErrorRateLimiter } from '../application/client-error-rate-limiter';
import { ErrorLogService } from '../application/error-log.service';
import {
  ErrorEventDto,
  ErrorSummaryDto,
  ListErrorQueryDto,
  ReportClientErrorDto,
} from './error-log.dto';

@ApiTags('observability')
@Controller()
export class ErrorLogController {
  constructor(
    private readonly errors: ErrorLogService,
    private readonly monitor: ErrorMonitorService,
    private readonly limiter: ClientErrorRateLimiter,
  ) {}

  // ── Master ─────────────────────────────────────────────────

  @Get('admin/errors')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'Galat runtime yang tercatat, dikelompokkan per jenis' })
  @ApiEnvelopeList(ErrorEventDto)
  @ApiErrors(401, 403)
  async list(@Query() query: ListErrorQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { total, items } = await this.errors.list(
      { status: query.status, source: query.source },
      page,
      pageSize,
    );
    return new Paginated(items, page, pageSize, total);
  }

  @Get('admin/errors/summary')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'Jumlah galat terbuka, selesai, dan yang terlihat 24 jam terakhir' })
  @ApiEnvelope(ErrorSummaryDto)
  @ApiErrors(401, 403)
  summary() {
    return this.errors.summary();
  }

  @Post('admin/errors/:errorId/resolve')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'Menandai galat sudah ditangani' })
  @ApiEnvelope(ErrorEventDto)
  @ApiErrors(401, 403, 404)
  resolve(@Param('errorId') errorId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.errors.resolve(errorId, user.id);
  }

  @Post('admin/errors/:errorId/reopen')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'Membuka kembali galat yang ternyata belum selesai' })
  @ApiEnvelope(ErrorEventDto)
  @ApiErrors(401, 403, 404)
  reopen(@Param('errorId') errorId: string) {
    return this.errors.reopen(errorId);
  }

  // ── Browser ────────────────────────────────────────────────

  @Post('telemetry/client-errors')
  @Public()
  @HttpCode(202)
  @ApiOperation({ summary: 'Laporan galat dari browser' })
  @ApiErrors(422, 429)
  async report(@Body() dto: ReportClientErrorDto, @Req() request: Request): Promise<void> {
    await this.limiter.consume(request.ip ?? 'unknown');

    // Dicatat langsung, bukan lewat `capture()`, supaya pembatas laju di atas
    // benar-benar membatasi: kalau pencatatannya dilepas ke latar belakang,
    // permintaan tetap dijawab 202 dan tidak ada tekanan balik sama sekali.
    await this.monitor.record({
      source: 'WEB',
      type: dto.type,
      message: dto.message,
      stack: dto.stack,
      route: dto.path,
      context: {
        path: dto.path,
        requestId: request.requestId,
        // Sesi tidak wajib: galat pada halaman login justru yang paling penting.
        userId: request.session?.id,
      },
    });
  }
}
