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
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiEnvelope,
  ApiEnvelopeList,
  ApiErrors,
} from '../../../../shared/http/api-envelope';
import {
  AdminCourseDetailDto,
  AdminCourseDto,
  AdminCourseListItemDto,
  AdminLessonDto,
  AdminModuleDto,
  ReorderResultDto,
  CourseThumbnailResponseDto,
} from '../dto/authoring.response';
import { PERMISSIONS } from '@lms/contracts';
import type { Request } from 'express';
import { AuditService } from '../../../../shared/audit/audit.service';
import { Paginated } from '../../../../shared/http/response.interceptor';
import type { AuthenticatedUser } from '../../../identity/domain/session';
import { CurrentUser, RequirePermissions } from '../../../identity/presentation/decorators';
import { CourseAuthoringService } from '../../application/course-authoring.service';
import { CourseThumbnailService } from '../../application/course-thumbnail.service';
import {
  CreateCourseDto,
  CreateLessonDto,
  CreateModuleDto,
  ListAdminCoursesDto,
  ReorderDto,
  UpdateCourseDto,
  UpdateLessonDto,
  UpdateModuleDto,
} from '../dto/authoring.dto';

/**
 * Pengelolaan katalog oleh Master.
 *
 * Seluruh handler menuntut permission `courses.manage`. Pelajar tidak
 * memilikinya, jadi setiap endpoint di sini tertutup baginya tanpa perlu
 * pemeriksaan tambahan per handler.
 */
@ApiTags('admin-catalog')
@RequirePermissions(PERMISSIONS.COURSES_MANAGE)
@Controller('admin')
export class AdminCoursesController {
  constructor(
    private readonly authoring: CourseAuthoringService,
    private readonly thumbnails: CourseThumbnailService,
    private readonly audit: AuditService,
  ) {}

  // ── Kursus ──────────────────────────────────────────────────

  @Get('courses')
  @ApiOperation({ summary: 'Daftar kursus termasuk draf dan arsip' })
  @ApiEnvelopeList(AdminCourseListItemDto)
  @ApiErrors(401, 403, 422)
  async list(@Query() query: ListAdminCoursesDto) {
    const { items, total } = await this.authoring.list(query);
    return new Paginated(items, query.page, query.pageSize, total);
  }

  @Get('courses/:courseId')
  @ApiOperation({ summary: 'Detail kursus lengkap dengan bagian dan pelajaran' })
  @ApiEnvelope(AdminCourseDetailDto)
  @ApiErrors(401, 403, 404)
  async detail(@Param('courseId', new ParseUUIDPipe()) courseId: string) {
    return this.authoring.detail(courseId);
  }

  @Post('courses')
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat kursus baru berstatus draf' })
  @ApiEnvelope(AdminCourseDto)
  @ApiErrors(401, 403, 422)
  async create(
    @Body() dto: CreateCourseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const course = await this.authoring.create(dto, user.id);
    await this.record(request, user, 'course.created', 'course', course.id, undefined, {
      title: course.title,
      slug: course.slug,
    });
    return course;
  }

  @Patch('courses/:courseId')
  @ApiOperation({ summary: 'Memperbarui metadata kursus' })
  @ApiEnvelope(AdminCourseDto)
  @ApiErrors(401, 403, 404, 422)
  async update(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const course = await this.authoring.update(courseId, dto);
    await this.record(request, user, 'course.updated', 'course', courseId, undefined, { ...dto });
    return course;
  }

  @Put('courses/:courseId/thumbnail')
  @HttpCode(200)
  @ApiConsumes('image/jpeg', 'image/png', 'image/webp')
  @ApiBody({ schema: { type: 'string', format: 'binary' } })
  @ApiOperation({ summary: 'Mengunggah atau mengganti thumbnail kursus' })
  @ApiEnvelope(CourseThumbnailResponseDto)
  @ApiErrors(401, 403, 404, 422)
  async uploadThumbnail(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const rawLength = request.header('content-length');
    const result = await this.thumbnails.upload(
      courseId,
      request,
      request.header('content-type'),
      rawLength ? Number.parseInt(rawLength, 10) : undefined,
    );
    await this.record(request, user, 'course.thumbnail_updated', 'course', courseId);
    return result;
  }

  @Delete('courses/:courseId/thumbnail')
  @HttpCode(204)
  @ApiOperation({ summary: 'Menghapus thumbnail kursus' })
  @ApiNoContentResponse({ description: 'Thumbnail kursus dihapus.' })
  @ApiErrors(401, 403, 404)
  async removeThumbnail(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    await this.thumbnails.remove(courseId);
    await this.record(request, user, 'course.thumbnail_removed', 'course', courseId);
  }

  @Post('courses/:courseId/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menerbitkan kursus bila memenuhi syarat' })
  @ApiEnvelope(AdminCourseDto)
  @ApiErrors(401, 403, 404, 422)
  async publish(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const course = await this.authoring.publish(courseId);
    await this.record(request, user, 'course.published', 'course', courseId);
    return course;
  }

  @Post('courses/:courseId/archive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mengarsipkan kursus' })
  @ApiEnvelope(AdminCourseDto)
  @ApiErrors(401, 403, 404)
  async archive(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const course = await this.authoring.archive(courseId);
    await this.record(request, user, 'course.archived', 'course', courseId);
    return course;
  }

  @Delete('courses/:courseId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Menghapus kursus yang belum pernah memiliki enrollment' })
  @ApiNoContentResponse({ description: 'Kursus dihapus.' })
  @ApiErrors(401, 403, 404, 409)
  async remove(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    await this.authoring.remove(courseId);
    await this.record(request, user, 'course.deleted', 'course', courseId);
  }

  // ── Bagian ──────────────────────────────────────────────────

  @Post('courses/:courseId/modules')
  @HttpCode(201)
  @ApiOperation({ summary: 'Menambah bagian pada kursus' })
  @ApiEnvelope(AdminModuleDto)
  @ApiErrors(401, 403, 404, 422)
  async addModule(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Body() dto: CreateModuleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const created = await this.authoring.addModule(courseId, dto);
    await this.record(request, user, 'module.created', 'course_module', created.id, undefined, {
      courseId,
      title: created.title,
    });
    return created;
  }

  @Patch('modules/:moduleId')
  @ApiOperation({ summary: 'Memperbarui bagian' })
  @ApiEnvelope(AdminModuleDto)
  @ApiErrors(401, 403, 404, 422)
  async updateModule(
    @Param('moduleId', new ParseUUIDPipe()) moduleId: string,
    @Body() dto: UpdateModuleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const updated = await this.authoring.updateModule(moduleId, dto);
    await this.record(request, user, 'module.updated', 'course_module', moduleId, undefined, {
      ...dto,
    });
    return updated;
  }

  @Delete('modules/:moduleId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Menghapus bagian yang belum memiliki riwayat belajar' })
  @ApiNoContentResponse({ description: 'Bagian dihapus.' })
  @ApiErrors(401, 403, 404, 409)
  async removeModule(
    @Param('moduleId', new ParseUUIDPipe()) moduleId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    await this.authoring.removeModule(moduleId);
    await this.record(request, user, 'module.deleted', 'course_module', moduleId);
  }

  @Put('courses/:courseId/modules/order')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mengubah urutan bagian' })
  @ApiEnvelope(ReorderResultDto)
  @ApiErrors(401, 403, 404, 422)
  async reorderModules(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Body() dto: ReorderDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    await this.authoring.reorderModules(courseId, dto.ids);
    await this.record(request, user, 'module.reordered', 'course', courseId, undefined, {
      order: dto.ids,
    });
    return { reordered: dto.ids.length };
  }

  // ── Pelajaran ───────────────────────────────────────────────

  @Post('modules/:moduleId/lessons')
  @HttpCode(201)
  @ApiOperation({ summary: 'Menambah pelajaran pada bagian' })
  @ApiEnvelope(AdminLessonDto)
  @ApiErrors(401, 403, 404, 422)
  async addLesson(
    @Param('moduleId', new ParseUUIDPipe()) moduleId: string,
    @Body() dto: CreateLessonDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const created = await this.authoring.addLesson(moduleId, dto);
    await this.record(request, user, 'lesson.created', 'lesson', created.id, undefined, {
      moduleId,
      title: created.title,
    });
    return created;
  }

  @Patch('lessons/:lessonId')
  @ApiOperation({ summary: 'Memperbarui pelajaran' })
  @ApiEnvelope(AdminLessonDto)
  @ApiErrors(401, 403, 404, 422)
  async updateLesson(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @Body() dto: UpdateLessonDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const updated = await this.authoring.updateLesson(lessonId, dto);
    await this.record(request, user, 'lesson.updated', 'lesson', lessonId, undefined, { ...dto });
    return updated;
  }

  @Delete('lessons/:lessonId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Menghapus pelajaran yang belum memiliki riwayat belajar' })
  @ApiNoContentResponse({ description: 'Pelajaran dihapus.' })
  @ApiErrors(401, 403, 404, 409)
  async removeLesson(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    await this.authoring.removeLesson(lessonId);
    await this.record(request, user, 'lesson.deleted', 'lesson', lessonId);
  }

  @Put('modules/:moduleId/lessons/order')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mengubah urutan pelajaran' })
  @ApiEnvelope(ReorderResultDto)
  @ApiErrors(401, 403, 404, 422)
  async reorderLessons(
    @Param('moduleId', new ParseUUIDPipe()) moduleId: string,
    @Body() dto: ReorderDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    await this.authoring.reorderLessons(moduleId, dto.ids);
    await this.record(request, user, 'lesson.reordered', 'course_module', moduleId, undefined, {
      order: dto.ids,
    });
    return { reordered: dto.ids.length };
  }

  private async record(
    request: Request,
    user: AuthenticatedUser,
    action: string,
    targetType: string,
    targetId?: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      actorUserId: user.id,
      action,
      targetType,
      targetId,
      before,
      after,
      requestId: request.requestId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? undefined,
    });
  }
}
