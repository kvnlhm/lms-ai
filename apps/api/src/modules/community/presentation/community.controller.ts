import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@lms/contracts';
import { ApiEnvelope, ApiEnvelopeArray, ApiEnvelopeList, ApiErrors } from '../../../shared/http/api-envelope';
import { Paginated } from '../../../shared/http/response.interceptor';
import type { AuthenticatedUser } from '../../identity/domain/session';
import { CurrentUser, RequirePermissions } from '../../identity/presentation/decorators';
import { CommunityService } from '../application/community.service';
import { CommunityChannelDto, CommunityChecklistResultDto, CommunityCommentDto, CommunityPageQueryDto, CommunityPostBodyDto, CommunityPostDto, CommunityReactionResultDto, SetCommunityChecklistDto, SetCommunityPinnedDto } from './community.dto';

/** Pemegang izin moderasi diskusi; dipakai berulang di controller ini. */
function moderator(user: AuthenticatedUser): boolean {
  return user.permissions.includes(PERMISSIONS.DISCUSSIONS_MODERATE);
}

@ApiTags('community')
@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('channels') @ApiOperation({ summary: 'Daftar channel komunitas aktif' }) @ApiEnvelopeArray(CommunityChannelDto) @ApiErrors(401)
  channels() { return this.community.listChannels(); }

  @Get('sidebar-channels') @ApiOperation({ summary: 'Pintasan channel yang dipilih Master untuk sidebar Pelajar' }) @ApiEnvelopeArray(CommunityChannelDto) @ApiErrors(401)
  sidebarChannels() { return this.community.listSidebarChannels(); }

  @Get('feed') @ApiOperation({ summary: 'Feed komunitas lintas channel' }) @ApiEnvelopeList(CommunityPostDto) @ApiErrors(401)
  async feed(@Query() query: CommunityPageQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const page = query.page ?? 1; const pageSize = query.pageSize ?? 20;
    const result = await this.community.listPosts(user.id, page, pageSize, moderator(user));
    return new Paginated(result.posts, page, pageSize, result.total);
  }

  @Get('channels/:channelSlug/:subchannelSlug/posts') @ApiOperation({ summary: 'Post pada sebuah sub-channel' }) @ApiEnvelopeList(CommunityPostDto) @ApiErrors(401, 404)
  async channelPosts(@Param('channelSlug') channelSlug: string, @Param('subchannelSlug') subchannelSlug: string, @Query() query: CommunityPageQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const page = query.page ?? 1; const pageSize = query.pageSize ?? 20;
    const result = await this.community.listPosts(user.id, page, pageSize, moderator(user), channelSlug, subchannelSlug);
    return new Paginated(result.posts, page, pageSize, result.total);
  }

  @Post('subchannels/:subchannelId/posts') @HttpCode(201) @ApiEnvelope(CommunityPostDto) @ApiErrors(401, 403, 404, 422)
  createPost(@Param('subchannelId', new ParseUUIDPipe()) subchannelId: string, @Body() dto: CommunityPostBodyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.community.createPost(user.id, subchannelId, dto.body, moderator(user), dto.checklistTitle);
  }

  @Get('channels/:channelSlug/:subchannelSlug/pinned') @ApiOperation({ summary: 'Tulisan tersemat pada sebuah sub-channel' }) @ApiEnvelopeArray(CommunityPostDto) @ApiErrors(401)
  pinned(@Param('channelSlug') channelSlug: string, @Param('subchannelSlug') subchannelSlug: string, @CurrentUser() user: AuthenticatedUser) {
    return this.community.listPinned(user.id, channelSlug, subchannelSlug, moderator(user));
  }

  @Patch('posts/:postId') @ApiOperation({ summary: 'Mengubah tulisan sendiri' }) @ApiEnvelope(CommunityPostDto) @ApiErrors(401, 403, 404, 422)
  updatePost(@Param('postId', new ParseUUIDPipe()) postId: string, @Body() dto: CommunityPostBodyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.community.updatePost(user.id, postId, dto.body, moderator(user), dto.checklistTitle);
  }

  // Menyematkan adalah tindakan moderasi, jadi izinnya ditegakkan di sini —
  // bukan disimpulkan dari `canPin` yang dikirim ke antarmuka.
  @Patch('posts/:postId/pin')
  @RequirePermissions(PERMISSIONS.DISCUSSIONS_MODERATE)
  @ApiOperation({ summary: 'Menyematkan tulisan atau melepas sematannya' })
  @ApiEnvelope(CommunityPostDto) @ApiErrors(401, 403, 404, 422)
  setPinned(@Param('postId', new ParseUUIDPipe()) postId: string, @Body() dto: SetCommunityPinnedDto, @CurrentUser() user: AuthenticatedUser) {
    return this.community.setPinned(user.id, postId, dto.isPinned);
  }

  @Delete('posts/:postId') @HttpCode(204) @ApiOperation({ summary: 'Menghapus tulisan sendiri, atau tulisan siapa pun bagi moderator' }) @ApiErrors(401, 403, 404)
  deletePost(@Param('postId', new ParseUUIDPipe()) postId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.community.deletePost(user.id, postId, moderator(user));
  }

  @Patch('comments/:commentId') @ApiOperation({ summary: 'Mengubah balasan sendiri' }) @ApiEnvelope(CommunityCommentDto) @ApiErrors(401, 403, 404, 422)
  updateComment(@Param('commentId', new ParseUUIDPipe()) commentId: string, @Body() dto: CommunityPostBodyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.community.updateComment(user.id, commentId, dto.body);
  }

  @Delete('comments/:commentId') @HttpCode(204) @ApiOperation({ summary: 'Menghapus balasan sendiri, atau balasan siapa pun bagi moderator' }) @ApiErrors(401, 403, 404)
  deleteComment(@Param('commentId', new ParseUUIDPipe()) commentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.community.deleteComment(user.id, commentId, moderator(user));
  }

  @Get('posts/:postId/comments') @ApiOperation({ summary: 'Seluruh balasan sebuah tulisan' }) @ApiEnvelopeList(CommunityCommentDto) @ApiErrors(401, 404)
  async comments(@Param('postId', new ParseUUIDPipe()) postId: string, @Query() query: CommunityPageQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const page = query.page ?? 1; const pageSize = query.pageSize ?? 20;
    const result = await this.community.listComments(user.id, postId, page, pageSize, moderator(user));
    return new Paginated(result.items, page, pageSize, result.total);
  }

  @Post('posts/:postId/comments') @HttpCode(201) @ApiEnvelope(CommunityCommentDto) @ApiErrors(401, 404, 422)
  comment(@Param('postId', new ParseUUIDPipe()) postId: string, @Body() dto: CommunityPostBodyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.community.addComment(user.id, postId, dto.body);
  }

  // Reaksi adalah saklar, bukan pembuatan sumber daya baru: 200, sama seperti
  // padanannya di forum. Tanpa ini NestJS memakai 201 bawaan POST.
  @Post('posts/:postId/reaction') @HttpCode(200) @ApiEnvelope(CommunityReactionResultDto) @ApiErrors(401, 404)
  react(@Param('postId', new ParseUUIDPipe()) postId: string, @CurrentUser() user: AuthenticatedUser) { return this.community.toggleReaction(user.id, postId); }

  @Patch('posts/:postId/checklist') @ApiOperation({ summary: 'Menyimpan status checklist pengguna dari session' })
  @ApiEnvelope(CommunityChecklistResultDto) @ApiErrors(401, 404, 422)
  checklist(@Param('postId', new ParseUUIDPipe()) postId: string, @Body() dto: SetCommunityChecklistDto, @CurrentUser() user: AuthenticatedUser) {
    return this.community.setChecklistCompleted(user.id, postId, dto.completed);
  }
}
