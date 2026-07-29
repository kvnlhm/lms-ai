import { Prisma } from '@prisma/client';
import { AnalyticsProcessor } from './analytics.processor';
import type { PrismaService } from '../infrastructure/prisma.service';
import type { EventJob } from './event-job';

function job(overrides: Partial<EventJob> = {}): EventJob {
  return {
    eventId: '11111111-1111-4111-8111-111111111111',
    eventType: 'learning.lesson_completed',
    aggregateType: 'enrollment',
    aggregateId: '22222222-2222-4222-8222-222222222222',
    schemaVersion: 1,
    occurredAt: '2026-07-29T03:00:00.000Z',
    payload: {
      userId: '33333333-3333-4333-8333-333333333333',
      courseId: '44444444-4444-4444-8444-444444444444',
      lessonId: '55555555-5555-4555-8555-555555555555',
      activeSeconds: 120,
    },
    ...overrides,
  };
}

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('AnalyticsProcessor', () => {
  it('menyimpan event dengan event_uuid dari outbox', async () => {
    const create = jest.fn().mockResolvedValue({});
    const processor = new AnalyticsProcessor({
      learningEvent: { create },
    } as unknown as PrismaService);

    const result = await processor.handle(job());

    expect(result).toEqual({ stored: true });
    const data = create.mock.calls[0][0].data;
    expect(data.eventUuid).toBe('11111111-1111-4111-8111-111111111111');
    expect(data.eventName).toBe('learning.lesson_completed');
    expect(data.durationSeconds).toBe(120);
    expect(data.occurredAt).toEqual(new Date('2026-07-29T03:00:00.000Z'));
  });

  it('memperlakukan pelanggaran unik sebagai event yang sudah diproses', async () => {
    const create = jest.fn().mockRejectedValue(uniqueViolation());
    const processor = new AnalyticsProcessor({
      learningEvent: { create },
    } as unknown as PrismaService);

    // Pengiriman ganda tidak boleh menggagalkan job; kalau gagal, BullMQ akan
    // mencoba lagi selamanya untuk event yang sebenarnya sudah tercatat.
    await expect(processor.handle(job())).resolves.toEqual({ stored: false });
  });

  it('melempar ulang kegagalan selain pelanggaran unik', async () => {
    const create = jest.fn().mockRejectedValue(new Error('koneksi terputus'));
    const processor = new AnalyticsProcessor({
      learningEvent: { create },
    } as unknown as PrismaService);

    // Kegagalan transient harus naik ke BullMQ supaya job dicoba ulang.
    await expect(processor.handle(job())).rejects.toThrow('koneksi terputus');
  });

  it('menerima payload tanpa field opsional', async () => {
    const create = jest.fn().mockResolvedValue({});
    const processor = new AnalyticsProcessor({
      learningEvent: { create },
    } as unknown as PrismaService);

    await processor.handle(job({ payload: {} }));

    const data = create.mock.calls[0][0].data;
    expect(data.userId).toBeNull();
    expect(data.lessonId).toBeNull();
    expect(data.durationSeconds).toBeNull();
    expect(data.source).toBe('COURSE_PLAYER');
  });
});
