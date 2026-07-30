import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditService } from '../../../../shared/audit/audit.service';
import { ApiEnvelope, ApiErrors } from '../../../../shared/http/api-envelope';
import { CurrentUser } from '../decorators';
import type { AuthenticatedUser } from '../../domain/session';
import {
  NotificationPreferenceDto,
  UpdateNotificationPreferenceDto,
} from '../dto/notification-preference.dto';

@ApiTags('profile')
@Controller('me/notifications/preferences')
export class ProfilePreferencesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Melihat preferensi notifikasi sendiri' })
  @ApiEnvelope(NotificationPreferenceDto)
  async get(@CurrentUser() user: AuthenticatedUser): Promise<NotificationPreferenceDto> {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId: user.id },
    });
    return preference ?? {
      announcementsEnabled: true,
      courseUpdatesEnabled: true,
      learningRemindersEnabled: true,
    };
  }

  @Put()
  @ApiOperation({ summary: 'Memperbarui preferensi notifikasi sendiri' })
  @ApiEnvelope(NotificationPreferenceDto)
  @ApiErrors(422)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferenceDto,
    @Req() request: Request,
  ): Promise<NotificationPreferenceDto> {
    const preference = await this.prisma.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...dto },
      update: dto,
    });
    await this.audit.record({
      actorUserId: user.id,
      action: 'user.notification_preferences_updated',
      targetType: 'user',
      targetId: user.id,
      after: { changedFields: Object.keys(dto) },
      requestId: request.requestId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? undefined,
    });
    return preference;
  }
}
