import { NotificationsProcessor } from './notifications.processor';
import type { PrismaService } from '../infrastructure/prisma.service';
import type { EventJob } from './event-job';

const USER = '33333333-3333-4333-8333-333333333333';
const COURSE = '44444444-4444-4444-8444-444444444444';

function job(overrides: Partial<EventJob> = {}): EventJob {
  return {
    eventId: '11111111-1111-4111-8111-111111111111',
    eventType: 'learning.course_completed',
    aggregateType: 'enrollment',
    aggregateId: '22222222-2222-4222-8222-222222222222',
    schemaVersion: 1,
    occurredAt: '2026-08-01T03:00:00.000Z',
    payload: { userId: USER, courseId: COURSE, completedAt: '2026-08-01T03:00:00.000Z' },
    ...overrides,
  };
}

interface Stub {
  count?: number;
  courseUpdatesEnabled?: boolean | null;
  courseTitle?: string | null;
}

function prisma(stub: Stub = {}) {
  const create = jest.fn().mockResolvedValue({});
  const service = {
    notification: {
      count: jest.fn().mockResolvedValue(stub.count ?? 0),
      create,
    },
    notificationPreference: {
      findUnique: jest.fn().mockResolvedValue(
        stub.courseUpdatesEnabled === null || stub.courseUpdatesEnabled === undefined
          ? null
          : { courseUpdatesEnabled: stub.courseUpdatesEnabled },
      ),
    },
    course: {
      findUnique: jest.fn().mockResolvedValue(
        stub.courseTitle === null ? null : { title: stub.courseTitle ?? 'Dasar Prompt Engineering' },
      ),
    },
  };
  return { service, create };
}

describe('NotificationsProcessor', () => {
  it('menulis notifikasi in-app saat kursus selesai', async () => {
    const { service, create } = prisma();
    const processor = new NotificationsProcessor(service as unknown as PrismaService);

    await expect(processor.handle(job())).resolves.toEqual({ queued: true });

    const data = create.mock.calls[0][0].data;
    expect(data.userId).toBe(USER);
    expect(data.type).toBe('COURSE_COMPLETED');
    // Acceptance criteria PRD 7.14: notifikasi harus punya tautan ke objeknya.
    expect(data.linkUrl).toBe(`/courses/${COURSE}`);
    expect(data.body).toContain('Dasar Prompt Engineering');
  });

  it('mengabaikan event selain kursus selesai', async () => {
    const { service, create } = prisma();
    const processor = new NotificationsProcessor(service as unknown as PrismaService);

    await expect(
      processor.handle(job({ eventType: 'learning.lesson_completed' })),
    ).resolves.toEqual({ queued: false });
    expect(create).not.toHaveBeenCalled();
  });

  it('tidak menulis dua kali untuk kursus yang sama', async () => {
    // Relay outbox at-least-once: event yang sama dapat tiba lagi.
    const { service, create } = prisma({ count: 1 });
    const processor = new NotificationsProcessor(service as unknown as PrismaService);

    await expect(processor.handle(job())).resolves.toEqual({ queued: false });
    expect(create).not.toHaveBeenCalled();
  });

  it('menghormati pelajar yang mematikan kabar kursus', async () => {
    const { service, create } = prisma({ courseUpdatesEnabled: false });
    const processor = new NotificationsProcessor(service as unknown as PrismaService);

    await expect(processor.handle(job())).resolves.toEqual({ queued: false });
    expect(create).not.toHaveBeenCalled();
  });

  it('tetap mengirim bila pelajar belum punya baris preferensi', async () => {
    const { service, create } = prisma({ courseUpdatesEnabled: null });
    const processor = new NotificationsProcessor(service as unknown as PrismaService);

    await expect(processor.handle(job())).resolves.toEqual({ queued: true });
    expect(create).toHaveBeenCalled();
  });

  it('melewati payload tanpa userId atau courseId tanpa melempar', async () => {
    // Payload cacat tidak akan membaik bila dicoba ulang; melempar di sini
    // membuat BullMQ mengulangnya tanpa henti.
    const { service, create } = prisma();
    const processor = new NotificationsProcessor(service as unknown as PrismaService);

    await expect(processor.handle(job({ payload: {} }))).resolves.toEqual({ queued: false });
    expect(create).not.toHaveBeenCalled();
  });

  it('melewati kursus yang sudah tidak ada', async () => {
    const { service, create } = prisma({ courseTitle: null });
    const processor = new NotificationsProcessor(service as unknown as PrismaService);

    await expect(processor.handle(job())).resolves.toEqual({ queued: false });
    expect(create).not.toHaveBeenCalled();
  });

  it('meneruskan kegagalan database supaya job dicoba ulang', async () => {
    const { service } = prisma();
    service.notification.create.mockRejectedValue(new Error('koneksi terputus'));
    const processor = new NotificationsProcessor(service as unknown as PrismaService);

    await expect(processor.handle(job())).rejects.toThrow('koneksi terputus');
  });
});
