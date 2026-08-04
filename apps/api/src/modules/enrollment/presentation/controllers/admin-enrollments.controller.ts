import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiEnvelopeList, ApiErrors } from '../../../../shared/http/api-envelope';
import { AdminEnrollmentDto, GrantAccessResponseDto } from '../dto/admin-enrollment.response';
import { PERMISSIONS } from '@lms/contracts';
import type { Request } from 'express';
import { AuditService } from '../../../../shared/audit/audit.service';
import { Paginated } from '../../../../shared/http/response.interceptor';
import type { AuthenticatedUser } from '../../../identity/domain/session';
import { CurrentUser, RequirePermissions } from '../../../identity/presentation/decorators';
import { EnrollmentAdminService } from '../../application/enrollment-admin.service';
import { GrantAccessDto, ListEnrollmentsDto } from '../dto/admin-enrollment.dto';

@ApiTags('admin-enrollment')
@RequirePermissions(PERMISSIONS.ENROLLMENTS_MANAGE)
@Controller('admin')
export class AdminEnrollmentsController {
  constructor(
    private readonly enrollments: EnrollmentAdminService,
    private readonly audit: AuditService,
  ) {}

  @Get('courses/:courseId/enrollments')
  @ApiOperation({ summary: 'Daftar pelajar pada sebuah kursus' })
  @ApiEnvelopeList(AdminEnrollmentDto)
  @ApiErrors(401, 403, 404, 422)
  async list(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Query() query: ListEnrollmentsDto,
  ) {
    const { items, total } = await this.enrollments.listForCourse({ courseId, ...query });
    return new Paginated(items, query.page, query.pageSize, total);
  }

  @Post('courses/:courseId/enrollments')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Memberi akses kursus ke sejumlah pelajar',
    description:
      'Mengembalikan hasil per pengguna. Satu pengguna yang gagal tidak membatalkan yang lain.',
  })
  @ApiEnvelope(GrantAccessResponseDto)
  @ApiErrors(401, 403, 404, 422)
  async grant(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Body() dto: GrantAccessDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const results = await this.enrollments.grantAccess(
      courseId,
      { userIds: dto.userIds },
      user.id,
    );

    await this.audit.record({
      actorUserId: user.id,
      action: 'enrollment.granted',
      targetType: 'course',
      targetId: courseId,
      after: { results },
      requestId: request.requestId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? undefined,
    });

    return { results };
  }

}
