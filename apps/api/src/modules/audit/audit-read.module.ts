import { Module } from '@nestjs/common';
import { AuditLogService } from './application/audit-log.service';
import { AuditLogController } from './presentation/audit-log.controller';

/**
 * Sisi baca audit log. Penulisannya ada di `shared/audit`, karena hampir
 * setiap modul perlu mencatat tanpa perlu tahu cara membacanya.
 */
@Module({
  controllers: [AuditLogController],
  providers: [AuditLogService],
})
export class AuditReadModule {}
