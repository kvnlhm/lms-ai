import { Module } from '@nestjs/common';
import { ClientErrorRateLimiter } from './application/client-error-rate-limiter';
import { ErrorLogService } from './application/error-log.service';
import { ErrorLogController } from './presentation/error-log.controller';

/**
 * Sisi baca dan sisi lapor. Penulisannya sendiri ada di
 * `shared/observability`, karena exception filter global membutuhkannya
 * sebelum modul mana pun sempat dimuat.
 */
@Module({
  controllers: [ErrorLogController],
  providers: [ErrorLogService, ClientErrorRateLimiter],
})
export class ObservabilityApiModule {}
