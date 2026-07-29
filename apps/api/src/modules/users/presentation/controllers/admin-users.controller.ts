import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@lms/contracts';
import { ApiEnvelopeList, ApiErrors } from '../../../../shared/http/api-envelope';
import { Paginated } from '../../../../shared/http/response.interceptor';
import { RequirePermissions } from '../../../identity/presentation/decorators';
import { UserAdminService } from '../../application/user-admin.service';
import { AdminUserListItemDto, ListAdminUsersDto } from '../dto/admin-user.dto';

@ApiTags('admin-users')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UserAdminService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({ summary: 'Mencari dan memfilter pengguna untuk pengelolaan Master' })
  @ApiEnvelopeList(AdminUserListItemDto)
  @ApiErrors(401, 403, 422)
  async list(@Query() query: ListAdminUsersDto) {
    const { items, total } = await this.users.list({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      status: query.status,
      role: query.role,
    });
    return new Paginated(items, query.page, query.pageSize, total);
  }
}
