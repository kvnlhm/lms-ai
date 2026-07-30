import { Module } from '@nestjs/common';
import { UserAdminService } from './application/user-admin.service';
import { AdminUsersController } from './presentation/controllers/admin-users.controller';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [IdentityModule],
  controllers: [AdminUsersController],
  providers: [UserAdminService],
  exports: [UserAdminService],
})
export class UsersModule {}
