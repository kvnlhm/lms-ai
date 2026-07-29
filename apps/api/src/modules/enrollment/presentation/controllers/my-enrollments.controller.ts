import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiEnvelopeArray, ApiErrors } from '../../../../shared/http/api-envelope';
import { MyEnrollmentDto } from '../dto/my-enrollment.response';
import type { AuthenticatedUser } from '../../../identity/domain/session';
import { CurrentUser } from '../../../identity/presentation/decorators';
import { MyEnrollmentsService } from '../../application/my-enrollments.service';

@ApiTags('enrollment')
@Controller('me')
export class MyEnrollmentsController {
  constructor(private readonly enrollments: MyEnrollmentsService) {}

  @Get('enrollments')
  @ApiOperation({ summary: 'Kursus yang dapat diakses pengguna saat ini' })
  @ApiEnvelopeArray(MyEnrollmentDto)
  @ApiErrors(401)
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.enrollments.list(user.id);
  }
}
