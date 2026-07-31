import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@lms/contracts';
import type { Request, Response } from 'express';
import { AuditService } from '../../../shared/audit/audit.service';
import { ApiEnvelope, ApiErrors } from '../../../shared/http/api-envelope';
import type { AuthenticatedUser } from '../../identity/domain/session';
import { CurrentUser, RequirePermissions } from '../../identity/presentation/decorators';
import { csvFilename, toCsv } from '../application/csv';
import {
  REPORT_KEYS,
  REPORT_LABELS,
  type ReportKey,
  ReportService,
} from '../application/report.service';
import { ReportCatalogDto, ReportKeyParamDto, ReportQueryDto } from './reports.dto';

@ApiTags('reports')
@Controller()
export class ReportsController {
  constructor(
    private readonly reports: ReportService,
    private readonly audit: AuditService,
  ) {}

  @Get('admin/reports')
  @RequirePermissions(PERMISSIONS.REPORTS_EXPORT)
  @ApiOperation({ summary: 'Daftar laporan yang tersedia untuk diekspor' })
  @ApiEnvelope(ReportCatalogDto)
  @ApiErrors(401, 403)
  catalog() {
    return {
      reports: REPORT_KEYS.map((key) => ({ key, label: REPORT_LABELS[key] })),
    };
  }

  @Get('admin/reports/:reportKey.csv')
  @RequirePermissions(PERMISSIONS.REPORTS_EXPORT)
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Mengunduh satu laporan sebagai CSV' })
  @ApiErrors(401, 403, 422)
  async download(
    @Param() params: ReportKeyParamDto,
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const key = params.reportKey as ReportKey;
    const filter = {
      courseId: query.courseId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      inactiveDays: query.inactiveDays,
    };

    const table = await this.reports.build(key, filter);
    const generatedAt = new Date();

    // PRD 9: aktivitas ekspor tercatat pada audit log. Yang dicatat adalah
    // laporan, penyaring, dan jumlah baris — bukan isinya, karena audit log
    // bukan tempat menyalin data pribadi seluruh pelajar.
    await this.audit.record({
      actorUserId: user.id,
      action: 'report.exported',
      targetType: 'Report',
      after: { report: key, filter: query, rowCount: table.rows.length },
      requestId: request.requestId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent'),
    });

    // Dikirim langsung, melewati ResponseInterceptor: berkas CSV tidak boleh
    // dibungkus amplop `{ data, meta }`.
    response
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader(
        'Content-Disposition',
        `attachment; filename="${csvFilename(key, generatedAt)}"`,
      )
      // Laporan memuat data pribadi; tidak boleh mengendap di cache perantara.
      .setHeader('Cache-Control', 'no-store')
      .send(toCsv(table));
  }
}
