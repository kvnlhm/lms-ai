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
import { ApiErrors } from '../../../shared/http/api-envelope';
import { Paginated } from '../../../shared/http/response.interceptor';
import type { AuthenticatedUser } from '../../identity/domain/session';
import { CurrentUser } from '../../identity/presentation/decorators';
import { ForumService } from '../application/forum.service';
import {
  CreateTopicDto,
  ListTopicsQueryDto,
  ReplyBodyDto,
  ReportContentDto,
  UpdateTopicDto,
} from './forum.dto';

@ApiTags('forum')
@Controller()
export class ForumController {
  constructor(private readonly forum: ForumService) {}

  @Get('learn/courses/:courseId/forum/topics')
  @ApiOperation({ summary: 'Daftar topik diskusi pada kursus yang diikuti' })
  @ApiErrors(401, 403, 404)
  async listTopics(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Query() query: ListTopicsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { total, topics } = await this.forum.listTopics(user.id, {
      courseId,
      lessonId: query.lessonId,
      status: query.status,
      search: query.search,
      page,
      pageSize,
    });
    return new Paginated(topics, page, pageSize, total);
  }

  @Post('learn/courses/:courseId/forum/topics')
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat topik diskusi baru' })
  @ApiErrors(401, 403, 404, 422)
  createTopic(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Body() dto: CreateTopicDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.forum.createTopic(user.id, { courseId, ...dto });
  }

  @Get('learn/forum/topics/:topicId')
  @ApiOperation({ summary: 'Detail topik beserta balasannya' })
  @ApiErrors(401, 403, 404)
  topicDetail(
    @Param('topicId', new ParseUUIDPipe()) topicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.forum.topicDetail(user.id, topicId);
  }

  @Patch('learn/forum/topics/:topicId')
  @ApiOperation({ summary: 'Mengubah topik milik sendiri' })
  @ApiErrors(401, 403, 404, 409, 422)
  updateTopic(
    @Param('topicId', new ParseUUIDPipe()) topicId: string,
    @Body() dto: UpdateTopicDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.forum.updateTopic(user.id, topicId, dto);
  }

  @Delete('learn/forum/topics/:topicId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Menghapus topik milik sendiri' })
  @ApiErrors(401, 403, 404, 409)
  deleteTopic(
    @Param('topicId', new ParseUUIDPipe()) topicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.forum.deleteTopic(user.id, topicId);
  }

  @Post('learn/forum/topics/:topicId/replies')
  @HttpCode(201)
  @ApiOperation({ summary: 'Membalas diskusi' })
  @ApiErrors(401, 403, 404, 409, 422)
  createReply(
    @Param('topicId', new ParseUUIDPipe()) topicId: string,
    @Body() dto: ReplyBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.forum.createReply(user.id, topicId, dto.body);
  }

  @Patch('learn/forum/replies/:replyId')
  @ApiOperation({ summary: 'Mengubah balasan milik sendiri' })
  @ApiErrors(401, 403, 404, 409, 422)
  updateReply(
    @Param('replyId', new ParseUUIDPipe()) replyId: string,
    @Body() dto: ReplyBodyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.forum.updateReply(user.id, replyId, dto.body);
  }

  @Delete('learn/forum/replies/:replyId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Menghapus balasan milik sendiri' })
  @ApiErrors(401, 403, 404, 409)
  deleteReply(
    @Param('replyId', new ParseUUIDPipe()) replyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.forum.deleteReply(user.id, replyId);
  }

  @Post('learn/forum/topics/:topicId/reactions')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menyalakan atau mematikan reaksi pada topik' })
  @ApiErrors(401, 403, 404)
  reactTopic(
    @Param('topicId', new ParseUUIDPipe()) topicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.forum.toggleReaction(user.id, { topicId });
  }

  @Post('learn/forum/replies/:replyId/reactions')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menyalakan atau mematikan reaksi pada balasan' })
  @ApiErrors(401, 403, 404)
  reactReply(
    @Param('replyId', new ParseUUIDPipe()) replyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.forum.toggleReaction(user.id, { replyId });
  }

  @Post('learn/forum/reports')
  @HttpCode(201)
  @ApiOperation({ summary: 'Melaporkan topik atau balasan kepada Master' })
  @ApiErrors(401, 403, 404, 422)
  report(@Body() dto: ReportContentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.forum.report(user.id, { topicId: dto.topicId, replyId: dto.replyId }, dto.reason);
  }
}
