import { Global, Module } from '@nestjs/common';
import { NotificationService } from './application/notification.service';
import { NotificationController } from './presentation/notification.controller';

/**
 * Global karena hampir setiap modul domain perlu memancarkan notifikasi, dan
 * mengimpornya satu per satu hanya akan menambah kebisingan tanpa menambah
 * batasan apa pun — service ini tidak menyentuh persistence modul lain.
 */
@Global()
@Module({
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
