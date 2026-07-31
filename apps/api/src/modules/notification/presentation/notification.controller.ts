import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiEnvelopeArray, ApiErrors } from '../../../shared/http/api-envelope';
import { Paginated } from '../../../shared/http/response.interceptor';
import type { AuthenticatedUser } from '../../identity/domain/session';
import { CurrentUser } from '../../identity/presentation/decorators';
import { NotificationService } from '../application/notification.service';
import {
  ListNotificationsQueryDto,
  MarkAllReadDto,
  NotificationDto,
  UnreadCountDto,
} from './notification.dto';

@ApiTags('notifications')
@Controller('me/notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Notifikasi milik sendiri, terbaru lebih dulu' })
  @ApiEnvelopeArray(NotificationDto)
  @ApiErrors(401)
  async list(@Query() query: ListNotificationsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { total, items } = await this.notifications.list(user.id, {
      unreadOnly: query.unreadOnly ?? false,
      page,
      pageSize,
    });
    return new Paginated(items, page, pageSize, total);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Jumlah notifikasi yang belum dibaca' })
  @ApiEnvelope(UnreadCountDto)
  @ApiErrors(401)
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return { unread: await this.notifications.unreadCount(user.id) };
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Menandai satu notifikasi sebagai dibaca' })
  @ApiErrors(401, 404)
  markRead(
    @Param('notificationId', new ParseUUIDPipe()) notificationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notifications.markRead(user.id, notificationId);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Menandai seluruh notifikasi sebagai dibaca' })
  @ApiEnvelope(MarkAllReadDto)
  @ApiErrors(401)
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.id);
  }
}
