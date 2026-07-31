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
import { ApiEnvelope, ApiEnvelopeArray, ApiEnvelopeList, ApiErrors } from '../../../shared/http/api-envelope';
import { Paginated } from '../../../shared/http/response.interceptor';
import type { AuthenticatedUser } from '../../identity/domain/session';
import { CurrentUser, RequirePermissions } from '../../identity/presentation/decorators';
import { ForumModerationService } from '../application/forum-moderation.service';
import {
  CreateBanDto,
  ListBansQueryDto,
  ListReportsQueryDto,
  ModerationListQueryDto,
  ReplyBodyDto,
  ResolveReportDto,
  SetBestReplyDto,
  SetPinnedDto,
  SetReplyHiddenDto,
  SetTopicStatusDto,
} from './forum.dto';
import {
  ForumBanCreatedDto,
  ForumBanDto,
  ForumBanRevokedDto,
  ForumReplyCreatedDto,
  ForumReportListItemDto,
  ForumReportResolvedDto,
  ModerationTopicListItemDto,
  ReplyHiddenDto,
  TopicBestReplyDto,
  TopicPinnedDto,
  TopicStatusChangedDto,
} from './forum-response.dto';

@ApiTags('forum-moderation')
@Controller()
@RequirePermissions(PERMISSIONS.DISCUSSIONS_MODERATE)
export class ForumAdminController {
  constructor(private readonly moderation: ForumModerationService) {}

  @Get('admin/forum/topics')
  @ApiOperation({ summary: 'Seluruh topik termasuk yang disembunyikan' })
  @ApiEnvelopeList(ModerationTopicListItemDto)
  @ApiErrors(401, 403)
  async listTopics(@Query() query: ModerationListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { total, topics } = await this.moderation.listTopics({
      courseId: query.courseId,
      status: query.status,
      search: query.search,
      page,
      pageSize,
    });
    return new Paginated(topics, page, pageSize, total);
  }

  @Patch('admin/forum/topics/:topicId/status')
  @ApiOperation({ summary: 'Mengubah status topik: buka, selesai, kunci, sembunyikan' })
  @ApiEnvelope(TopicStatusChangedDto)
  @ApiErrors(401, 403, 404, 422)
  setStatus(
    @Param('topicId', new ParseUUIDPipe()) topicId: string,
    @Body() dto: SetTopicStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.moderation.setTopicStatus(topicId, dto.status, user.id, dto.reason);
  }

  @Patch('admin/forum/topics/:topicId/pin')
  @ApiOperation({ summary: 'Menyematkan atau melepas sematan topik' })
  @ApiEnvelope(TopicPinnedDto)
  @ApiErrors(401, 403, 404, 422)
  setPinned(
    @Param('topicId', new ParseUUIDPipe()) topicId: string,
    @Body() dto: SetPinnedDto,
  ) {
    return this.moderation.setPinned(topicId, dto.isPinned);
  }

  @Patch('admin/forum/topics/:topicId/best-reply')
  @ApiOperation({ summary: 'Menandai atau membatalkan jawaban terbaik' })
  @ApiEnvelope(TopicBestReplyDto)
  @ApiErrors(401, 403, 404, 422)
  setBestReply(
    @Param('topicId', new ParseUUIDPipe()) topicId: string,
    @Body() dto: SetBestReplyDto,
  ) {
    return this.moderation.setBestReply(topicId, dto.replyId ?? null);
  }

  @Post('admin/forum/topics/:topicId/replies')
  @HttpCode(201)
  @ApiOperation({ summary: 'Master ikut menjawab diskusi' })
  @ApiEnvelope(ForumReplyCreatedDto)
  @ApiErrors(401, 403, 404, 422)
  reply(
    @Param('topicId', new ParseUUIDPipe()) topicId: string,
    @Body() dto: ReplyBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.moderation.reply(topicId, user.id, dto.body);
  }

  @Patch('admin/forum/replies/:replyId/hidden')
  @ApiOperation({ summary: 'Menyembunyikan atau menampilkan balasan' })
  @ApiEnvelope(ReplyHiddenDto)
  @ApiErrors(401, 403, 404, 422)
  setReplyHidden(
    @Param('replyId', new ParseUUIDPipe()) replyId: string,
    @Body() dto: SetReplyHiddenDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.moderation.setReplyHidden(replyId, dto.isHidden, user.id, dto.reason);
  }

  @Delete('admin/forum/topics/:topicId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Menghapus topik' })
  @ApiErrors(401, 403, 404)
  deleteTopic(@Param('topicId', new ParseUUIDPipe()) topicId: string) {
    return this.moderation.deleteTopic(topicId);
  }

  @Delete('admin/forum/replies/:replyId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Menghapus balasan' })
  @ApiErrors(401, 403, 404)
  deleteReply(@Param('replyId', new ParseUUIDPipe()) replyId: string) {
    return this.moderation.deleteReply(replyId);
  }

  @Get('admin/forum/reports')
  @ApiOperation({ summary: 'Daftar laporan konten untuk direview' })
  @ApiEnvelopeList(ForumReportListItemDto)
  @ApiErrors(401, 403)
  async listReports(@Query() query: ListReportsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { total, reports } = await this.moderation.listReports(query.status, page, pageSize);
    return new Paginated(reports, page, pageSize, total);
  }

  @Patch('admin/forum/reports/:reportId')
  @ApiOperation({ summary: 'Menutup laporan sebagai ditindak atau diabaikan' })
  @ApiEnvelope(ForumReportResolvedDto)
  @ApiErrors(401, 403, 404, 422)
  resolveReport(
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.moderation.resolveReport(reportId, dto.status, user.id);
  }

  @Get('admin/forum/bans')
  @ApiOperation({ summary: 'Daftar pelajar yang hak berdiskusinya dicabut' })
  @ApiEnvelopeArray(ForumBanDto)
  @ApiErrors(401, 403)
  listBans(@Query() query: ListBansQueryDto) {
    return this.moderation.listBans(query.activeOnly ?? true);
  }

  @Post('admin/forum/bans')
  @HttpCode(201)
  @ApiOperation({ summary: 'Mencabut hak berdiskusi seorang pelajar' })
  @ApiEnvelope(ForumBanCreatedDto)
  @ApiErrors(401, 403, 404, 422)
  ban(@Body() dto: CreateBanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.moderation.ban(
      {
        userId: dto.userId,
        courseId: dto.courseId,
        reason: dto.reason,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      user.id,
    );
  }

  @Delete('admin/forum/bans/:banId')
  @ApiOperation({ summary: 'Mengembalikan hak berdiskusi' })
  @ApiEnvelope(ForumBanRevokedDto)
  @ApiErrors(401, 403, 404)
  revokeBan(
    @Param('banId', new ParseUUIDPipe()) banId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.moderation.revokeBan(banId, user.id);
  }
}
