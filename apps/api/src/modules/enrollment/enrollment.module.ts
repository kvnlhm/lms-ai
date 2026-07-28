import { Module } from '@nestjs/common';
import { EnrollmentAccessService } from './application/enrollment-access.service';
import { MyEnrollmentsService } from './application/my-enrollments.service';
import { MyEnrollmentsController } from './presentation/controllers/my-enrollments.controller';

@Module({
  controllers: [MyEnrollmentsController],
  providers: [EnrollmentAccessService, MyEnrollmentsService],
  // Modul lain hanya boleh menanyakan hak akses, bukan membaca tabelnya.
  exports: [EnrollmentAccessService],
})
export class EnrollmentModule {}
