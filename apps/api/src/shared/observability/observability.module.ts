import { Global, Module } from '@nestjs/common';
import { ErrorMonitorService } from './error-monitor.service';

/**
 * Global karena exception filter berlaku untuk seluruh aplikasi; tanpa itu
 * setiap modul harus mengimpornya hanya agar galatnya tercatat.
 */
@Global()
@Module({
  providers: [ErrorMonitorService],
  exports: [ErrorMonitorService],
})
export class ObservabilityModule {}
