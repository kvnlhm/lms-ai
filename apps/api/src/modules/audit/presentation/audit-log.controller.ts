import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@lms/contracts';
import { ApiEnvelope, ApiEnvelopeList, ApiErrors } from '../../../shared/http/api-envelope';
import { Paginated } from '../../../shared/http/response.interceptor';
import { RequirePermissions } from '../../identity/presentation/decorators';
import { AuditLogService } from '../application/audit-log.service';
import { AuditLogActionsDto, AuditLogEntryDto, ListAuditLogQueryDto } from './audit-log.dto';

@ApiTags('audit')
@Controller()
export class AuditLogController {
  constructor(private readonly auditLogs: AuditLogService) {}

  @Get('admin/audit-logs')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'Riwayat tindakan administratif, terbaru lebih dulu' })
  @ApiEnvelopeList(AuditLogEntryDto)
  @ApiErrors(401, 403, 422)
  async list(@Query() query: ListAuditLogQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { total, items } = await this.auditLogs.list(
      {
        actorUserId: query.actorUserId,
        action: query.action,
        targetType: query.targetType,
        targetId: query.targetId,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
      page,
      pageSize,
    );
    return new Paginated(items, page, pageSize, total);
  }

  @Get('admin/audit-logs/actions')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'Jenis tindakan yang pernah tercatat, untuk mengisi penyaring' })
  @ApiEnvelope(AuditLogActionsDto)
  @ApiErrors(401, 403)
  async actions() {
    return { actions: await this.auditLogs.actions() };
  }
}
