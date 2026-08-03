import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@lms/contracts';
import { ApiEnvelope, ApiEnvelopeArray, ApiEnvelopeList, ApiErrors } from '../../../shared/http/api-envelope';
import { Paginated } from '../../../shared/http/response.interceptor';
import type { AuthenticatedUser } from '../../identity/domain/session';
import { CurrentUser } from '../../identity/presentation/decorators';
import { CommunityService } from '../application/community.service';
import { CommunityChannelDto, CommunityCommentDto, CommunityPageQueryDto, CommunityPostBodyDto, CommunityPostDto, CommunityReactionResultDto } from './community.dto';

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

  @Get('feed') @ApiOperation({ summary: 'Feed komunitas lintas channel' }) @ApiEnvelopeList(CommunityPostDto) @ApiErrors(401)
  async feed(@Query() query: CommunityPageQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const page = query.page ?? 1; const pageSize = query.pageSize ?? 20;
    const result = await this.community.listPosts(user.id, page, pageSize, moderator(user));
    return new Paginated(result.posts, page, pageSize, result.total);
  }

  @Get('channels/:slug/posts') @ApiOperation({ summary: 'Post pada sebuah channel' }) @ApiEnvelopeList(CommunityPostDto) @ApiErrors(401, 404)
  async channelPosts(@Param('slug') slug: string, @Query() query: CommunityPageQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const page = query.page ?? 1; const pageSize = query.pageSize ?? 20;
    const result = await this.community.listPosts(user.id, page, pageSize, moderator(user), slug);
    return new Paginated(result.posts, page, pageSize, result.total);
  }

  @Post('channels/:channelId/posts') @HttpCode(201) @ApiEnvelope(CommunityPostDto) @ApiErrors(401, 403, 404, 422)
  createPost(@Param('channelId', new ParseUUIDPipe()) channelId: string, @Body() dto: CommunityPostBodyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.community.createPost(user.id, channelId, dto.body, moderator(user));
  }

  @Patch('posts/:postId') @ApiOperation({ summary: 'Mengubah tulisan sendiri' }) @ApiEnvelope(CommunityPostDto) @ApiErrors(401, 403, 404, 422)
  updatePost(@Param('postId', new ParseUUIDPipe()) postId: string, @Body() dto: CommunityPostBodyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.community.updatePost(user.id, postId, dto.body);
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

  @Post('posts/:postId/comments') @HttpCode(201) @ApiEnvelope(CommunityCommentDto) @ApiErrors(401, 404, 422)
  comment(@Param('postId', new ParseUUIDPipe()) postId: string, @Body() dto: CommunityPostBodyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.community.addComment(user.id, postId, dto.body);
  }

  // Reaksi adalah saklar, bukan pembuatan sumber daya baru: 200, sama seperti
  // padanannya di forum. Tanpa ini NestJS memakai 201 bawaan POST.
  @Post('posts/:postId/reaction') @HttpCode(200) @ApiEnvelope(CommunityReactionResultDto) @ApiErrors(401, 404)
  react(@Param('postId', new ParseUUIDPipe()) postId: string, @CurrentUser() user: AuthenticatedUser) { return this.community.toggleReaction(user.id, postId); }
}
