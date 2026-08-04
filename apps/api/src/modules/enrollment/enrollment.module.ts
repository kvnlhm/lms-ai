import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { EnrollmentAccessService } from './application/enrollment-access.service';
import { EnrollmentAdminService } from './application/enrollment-admin.service';
import { MyEnrollmentsService } from './application/my-enrollments.service';
import { AdminEnrollmentsController } from './presentation/controllers/admin-enrollments.controller';
import { MyEnrollmentsController } from './presentation/controllers/my-enrollments.controller';

@Module({
  // Hak "boleh melihat kursus yang belum terbit" dijawab identity lewat port,
  // bukan dibaca sendiri dari tabel role.
  imports: [IdentityModule],
  controllers: [MyEnrollmentsController, AdminEnrollmentsController],
  providers: [EnrollmentAccessService, EnrollmentAdminService, MyEnrollmentsService],
  // Modul lain hanya boleh menanyakan hak akses, bukan membaca tabelnya.
  exports: [EnrollmentAccessService],
})
export class EnrollmentModule {}
