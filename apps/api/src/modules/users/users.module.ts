import { Module } from '@nestjs/common';
import { UserAdminService } from './application/user-admin.service';
import { AdminUsersController } from './presentation/controllers/admin-users.controller';

@Module({
  controllers: [AdminUsersController],
  providers: [UserAdminService],
  exports: [UserAdminService],
})
export class UsersModule {}
