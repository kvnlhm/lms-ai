import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@lms/contracts';
import { ApiEnvelope, ApiEnvelopeArray, ApiEnvelopeList, ApiErrors } from '../../../shared/http/api-envelope';
import { Paginated } from '../../../shared/http/response.interceptor';
import type { AuthenticatedUser } from '../../identity/domain/session';
import { CurrentUser } from '../../identity/presentation/decorators';
import { CommunityService } from '../application/community.service';
import { CommunityChannelDto, CommunityCommentDto, CommunityPageQueryDto, CommunityPostBodyDto, CommunityPostDto, CommunityReactionResultDto } from './community.dto';

@ApiTags('community')
@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('channels') @ApiOperation({ summary: 'Daftar channel komunitas aktif' }) @ApiEnvelopeArray(CommunityChannelDto) @ApiErrors(401)
  channels() { return this.community.listChannels(); }

  @Get('feed') @ApiOperation({ summary: 'Feed komunitas lintas channel' }) @ApiEnvelopeList(CommunityPostDto) @ApiErrors(401)
  async feed(@Query() query: CommunityPageQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const page = query.page ?? 1; const pageSize = query.pageSize ?? 20;
    const result = await this.community.listPosts(user.id, page, pageSize);
    return new Paginated(result.posts, page, pageSize, result.total);
  }

  @Get('channels/:slug/posts') @ApiOperation({ summary: 'Post pada sebuah channel' }) @ApiEnvelopeList(CommunityPostDto) @ApiErrors(401, 404)
  async channelPosts(@Param('slug') slug: string, @Query() query: CommunityPageQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const page = query.page ?? 1; const pageSize = query.pageSize ?? 20;
    const result = await this.community.listPosts(user.id, page, pageSize, slug);
    return new Paginated(result.posts, page, pageSize, result.total);
  }

  @Post('channels/:channelId/posts') @HttpCode(201) @ApiEnvelope(CommunityPostDto) @ApiErrors(401, 403, 404, 422)
  createPost(@Param('channelId', new ParseUUIDPipe()) channelId: string, @Body() dto: CommunityPostBodyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.community.createPost(user.id, channelId, dto.body, user.permissions.includes(PERMISSIONS.DISCUSSIONS_MODERATE));
  }

  @Post('posts/:postId/comments') @HttpCode(201) @ApiEnvelope(CommunityCommentDto) @ApiErrors(401, 404, 422)
  comment(@Param('postId', new ParseUUIDPipe()) postId: string, @Body() dto: CommunityPostBodyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.community.addComment(user.id, postId, dto.body);
  }

  @Post('posts/:postId/reaction') @ApiEnvelope(CommunityReactionResultDto) @ApiErrors(401, 404)
  react(@Param('postId', new ParseUUIDPipe()) postId: string, @CurrentUser() user: AuthenticatedUser) { return this.community.toggleReaction(user.id, postId); }
}
