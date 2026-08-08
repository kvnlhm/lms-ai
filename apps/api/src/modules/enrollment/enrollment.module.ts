import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { IdentityModule } from '../identity/identity.module';
import { EnrollmentAccessService } from './application/enrollment-access.service';
import { EnrollmentAdminService } from './application/enrollment-admin.service';
import { MyEnrollmentsService } from './application/my-enrollments.service';
import { AdminEnrollmentsController } from './presentation/controllers/admin-enrollments.controller';
import { MyEnrollmentsController } from './presentation/controllers/my-enrollments.controller';

@Module({
  // Hak "boleh melihat kursus yang belum terbit" dijawab identity lewat port,
  // bukan dibaca sendiri dari tabel role. Hak "anggota berbayar" dijawab
  // commerce lewat `MEMBERSHIP_ACCESS`, dengan alasan yang sama (ADR-032).
  imports: [IdentityModule, CommerceModule],
  controllers: [MyEnrollmentsController, AdminEnrollmentsController],
  providers: [EnrollmentAccessService, EnrollmentAdminService, MyEnrollmentsService],
  // Modul lain hanya boleh menanyakan hak akses, bukan membaca tabelnya.
  exports: [EnrollmentAccessService],
})
export class EnrollmentModule {}
