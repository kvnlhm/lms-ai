import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@lms/contracts';
import { ApiEnvelope, ApiEnvelopeList, ApiErrors } from '../../../shared/http/api-envelope';
import { Paginated } from '../../../shared/http/response.interceptor';
import type { AuthenticatedUser } from '../../identity/domain/session';
import { CurrentUser, RequirePermissions } from '../../identity/presentation/decorators';
import { AnnouncementService } from '../application/announcement.service';
import {
  AdminAnnouncementDto,
  AnnouncementUnreadCountDto,
  CreateAnnouncementDto,
  LearnerAnnouncementDto,
  LearnerAnnouncementQueryDto,
  ListAnnouncementQueryDto,
  UpdateAnnouncementDto,
} from './announcement.dto';

@ApiTags('announcements')
@Controller()
export class AnnouncementController {
  constructor(private readonly announcements: AnnouncementService) {}

  // ── Pelajar ────────────────────────────────────────────────

  @Get('me/announcements')
  @ApiOperation({ summary: 'Pengumuman yang relevan dan sedang aktif untukku' })
  @ApiEnvelopeList(LearnerAnnouncementDto)
  @ApiErrors(401)
  async mine(@Query() query: LearnerAnnouncementQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { total, items } = await this.announcements.forLearner(user.id, page, pageSize);
    return new Paginated(items, page, pageSize, total);
  }

  @Get('me/announcements/unread-count')
  @ApiOperation({ summary: 'Jumlah pengumuman aktif yang belum dibaca' })
  @ApiEnvelope(AnnouncementUnreadCountDto)
  @ApiErrors(401)
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return { unread: await this.announcements.unreadCount(user.id) };
  }

  @Post('me/announcements/:announcementId/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menandai pengumuman sudah dibaca' })
  @ApiErrors(401, 404)
  markRead(
    @Param('announcementId', new ParseUUIDPipe()) announcementId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.announcements.markRead(user.id, announcementId);
  }

  // ── Master ─────────────────────────────────────────────────

  @Get('admin/announcements')
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENTS_MANAGE)
  @ApiOperation({ summary: 'Seluruh pengumuman termasuk draft dan yang diarsipkan' })
  @ApiEnvelopeList(AdminAnnouncementDto)
  @ApiErrors(401, 403)
  async list(@Query() query: ListAnnouncementQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { total, items } = await this.announcements.list(query.status, page, pageSize);
    return new Paginated(items, page, pageSize, total);
  }

  @Post('admin/announcements')
  @HttpCode(201)
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENTS_MANAGE)
  @ApiOperation({ summary: 'Membuat pengumuman sebagai draft' })
  @ApiErrors(401, 403, 422)
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.create(
      {
        title: dto.title,
        body: dto.body,
        audience: dto.audience,
        courseId: dto.courseId,
        userIds: dto.userIds,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
      user.id,
    );
  }

  @Patch('admin/announcements/:announcementId')
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENTS_MANAGE)
  @ApiOperation({ summary: 'Mengubah isi, audiens, atau jadwal pengumuman' })
  @ApiErrors(401, 403, 404, 422)
  update(
    @Param('announcementId', new ParseUUIDPipe()) announcementId: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcements.update(announcementId, {
      title: dto.title,
      body: dto.body,
      audience: dto.audience,
      courseId: dto.courseId,
      userIds: dto.userIds,
      publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
    });
  }

  @Post('admin/announcements/:announcementId/publish')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENTS_MANAGE)
  @ApiOperation({ summary: 'Menerbitkan pengumuman dan memberi tahu penerimanya' })
  @ApiErrors(401, 403, 404, 422)
  publish(@Param('announcementId', new ParseUUIDPipe()) announcementId: string) {
    return this.announcements.publish(announcementId);
  }

  @Post('admin/announcements/:announcementId/archive')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENTS_MANAGE)
  @ApiOperation({ summary: 'Mengarsipkan pengumuman agar berhenti tampil' })
  @ApiErrors(401, 403, 404)
  archive(@Param('announcementId', new ParseUUIDPipe()) announcementId: string) {
    return this.announcements.archive(announcementId);
  }

  @Delete('admin/announcements/:announcementId')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENTS_MANAGE)
  @ApiOperation({ summary: 'Menghapus pengumuman' })
  @ApiErrors(401, 403, 404)
  remove(@Param('announcementId', new ParseUUIDPipe()) announcementId: string) {
    return this.announcements.remove(announcementId);
  }
}
