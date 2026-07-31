import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { RedisService } from '../../infrastructure/redis/redis.service';
import type { EmailService } from '../email/email.service';
import { ErrorMonitorService } from './error-monitor.service';

interface Stubs {
  service: ErrorMonitorService;
  findUnique: jest.Mock;
  upsert: jest.Mock;
  update: jest.Mock;
  send: jest.Mock;
  incr: jest.Mock;
}

function createService(options: { alertMaxPerHour?: number; alertTo?: string } = {}): Stubs {
  const findUnique = jest.fn().mockResolvedValue(null);
  const upsert = jest.fn().mockResolvedValue({});
  const update = jest.fn().mockResolvedValue({});
  const send = jest.fn().mockResolvedValue('SENT');
  const incr = jest.fn().mockResolvedValue(1);

  const prisma = { errorEvent: { findUnique, upsert, update } } as unknown as PrismaService;
  const redis = {
    client: { incr, expire: jest.fn().mockResolvedValue(1) },
  } as unknown as RedisService;
  const email = { enabled: true, send } as unknown as EmailService;

  const app = {
    appName: 'LMS Uji',
    webUrl: 'https://contoh.test',
    redis: { cachePrefix: 'lms:cache:' },
    observability: {
      alertTo: 'alertTo' in options ? options.alertTo : 'operator@contoh.test',
      alertMaxPerHour: options.alertMaxPerHour ?? 10,
      clientReportMaxPerHour: 30,
    },
  } as unknown as AppConfig;

  const service = new ErrorMonitorService(
    prisma,
    redis,
    email,
    { get: () => app } as unknown as ConfigService<{ app: AppConfig }, true>,
  );

  return { service, findUnique, upsert, update, send, incr };
}

const GALAT = {
  source: 'API' as const,
  type: 'TypeError',
  message: 'Tidak dapat membaca properti id',
  route: 'GET /users/:id',
};

describe('ErrorMonitorService', () => {
  it('mengirim peringatan saat galat pertama kali muncul', async () => {
    const { service, send } = createService();
    await service.record(GALAT);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].subject).toContain('Galat baru');
  });

  it('diam untuk kejadian berikutnya dari galat yang sama', async () => {
    const { service, findUnique, send } = createService();
    findUnique.mockResolvedValue({ status: 'OPEN' });

    await service.record(GALAT);

    // Inti dari fitur ini: satu bug yang terjadi ribuan kali tetap satu surat,
    // kalau tidak peringatannya akan diabaikan justru saat paling penting.
    expect(send).not.toHaveBeenCalled();
  });

  it('memberi tahu lagi bila galat yang sudah ditutup muncul kembali', async () => {
    const { service, findUnique, send, upsert } = createService();
    findUnique.mockResolvedValue({ status: 'RESOLVED' });

    await service.record(GALAT);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].subject).toContain('muncul lagi');
    expect(upsert.mock.calls[0][0].update.status).toBe('OPEN');
  });

  it('menambah hitungan, bukan membuat baris baru, untuk galat berulang', async () => {
    const { service, upsert } = createService();
    await service.record(GALAT);
    expect(upsert.mock.calls[0][0].update.occurrences).toEqual({ increment: 1 });
  });

  it('berhenti mengirim setelah anggaran surat per jam habis', async () => {
    const { service, send, incr } = createService({ alertMaxPerHour: 2 });
    incr.mockResolvedValueOnce(3);

    await service.record(GALAT);

    expect(send).not.toHaveBeenCalled();
  });

  it('tetap mencatat walau penerima peringatan belum diatur', async () => {
    const { service, send, upsert } = createService({ alertTo: undefined });
    await service.record(GALAT);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('memotong pesan dan jejak tumpukan yang kepanjangan', async () => {
    const { service, upsert } = createService();
    await service.record({ ...GALAT, message: 'x'.repeat(900), stack: 'y'.repeat(9_000) });

    const created = upsert.mock.calls[0][0].create;
    expect(created.message.length).toBeLessThanOrEqual(501);
    expect(created.stack.length).toBeLessThanOrEqual(4_001);
  });

  it('tidak melempar ketika pencatatan gagal, agar respons pengguna tidak ikut rusak', async () => {
    const { service, upsert } = createService();
    upsert.mockRejectedValue(new Error('database mati'));

    expect(() => service.capture(GALAT)).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
  });
});
