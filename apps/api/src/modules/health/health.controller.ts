import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { Public } from '../identity/presentation/decorators';
import { SkipRateLimit } from '../../shared/http/rate-limit.decorator';

@ApiTags('health')
@Controller('health')
@SkipRateLimit()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness: proses berjalan. Tidak menyentuh dependency. */
  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return { status: 'ok' };
  }

  /**
   * Readiness: siap menerima trafik.
   * Redis ikut diperiksa karena tanpa Redis tidak ada request terautentikasi
   * yang dapat dilayani (ADR-003).
   */
  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  async ready() {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const healthy = database && redis;
    const body = {
      status: healthy ? 'ok' : 'degraded',
      checks: { database, redis },
    };
    if (!healthy) throw new ServiceUnavailableException(body);
    return body;
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      return await this.redis.ping();
    } catch {
      return false;
    }
  }
}
