import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiEnvelopeList, ApiErrors } from '../../../../shared/http/api-envelope';
import { CourseDetailDto, CourseListItemDto } from '../dto/course.response';
import { Paginated } from '../../../../shared/http/response.interceptor';
import type { AuthenticatedUser } from '../../../identity/domain/session';
import { CurrentUser } from '../../../identity/presentation/decorators';
import { CourseCatalogService } from '../../application/course-catalog.service';
import { ListCoursesDto } from '../dto/list-courses.dto';

@ApiTags('catalog')
@Controller('courses')
export class CoursesController {
  constructor(private readonly catalog: CourseCatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Katalog kursus yang sudah terbit' })
  @ApiEnvelopeList(CourseListItemDto)
  @ApiErrors(401, 422)
  async list(@Query() query: ListCoursesDto, @CurrentUser() user: AuthenticatedUser) {
    const { items, total } = await this.catalog.list(query, user.id);
    return new Paginated(items, query.page, query.pageSize, total);
  }

  @Get(':courseId')
  @ApiOperation({ summary: 'Detail kursus beserta status akses pengguna' })
  @ApiEnvelope(CourseDetailDto)
  @ApiErrors(401, 404)
  async detail(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalog.detail(courseId, user.id);
  }
}
