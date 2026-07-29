import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { loadConfig } from './config/configuration';
import { OutboxModule } from './infrastructure/outbox/outbox.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { EnrollmentModule } from './modules/enrollment/enrollment.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { PermissionsGuard } from './modules/identity/presentation/guards/permissions.guard';
import { SessionGuard } from './modules/identity/presentation/guards/session.guard';
import { LearningCatalogModule } from './modules/learning-catalog/learning-catalog.module';
import { LearningDeliveryModule } from './modules/learning-delivery/learning-delivery.module';
import { LearningProgressModule } from './modules/learning-progress/learning-progress.module';
import { VideoModule } from './modules/video/video.module';
import { AuditModule } from './shared/audit/audit.module';
import { AllExceptionsFilter } from './shared/http/all-exceptions.filter';
import { RequestContextMiddleware } from './shared/http/request-context.middleware';
import { ResponseInterceptor } from './shared/http/response.interceptor';
import { IdempotencyModule } from './shared/idempotency/idempotency.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [() => ({ app: loadConfig() })],
    }),
    PrismaModule,
    RedisModule,
    OutboxModule,
    IdempotencyModule,
    AuditModule,
    IdentityModule,
    LearningCatalogModule,
    EnrollmentModule,
    LearningDeliveryModule,
    LearningProgressModule,
    VideoModule,
    HealthModule,
  ],
  providers: [
    // Autentikasi berlaku secara default; endpoint publik harus memakai @Public().
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
