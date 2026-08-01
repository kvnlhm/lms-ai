import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { NotificationsProcessor } from '../src/processors/notifications.processor';
import type { PrismaService } from '../src/infrastructure/prisma.service';
import type { EventJob } from '../src/processors/event-job';

/**
 * Test unit prosesor ini memakai Prisma tiruan, jadi ia membuktikan alurnya
 * benar tetapi tidak membuktikan barisnya benar-benar dapat ditulis.
 *
 * Perbedaan itu bukan teori: pada 31 Juli 2026 seluruh test dan build hijau
 * sementara produksi tidak dapat menyala. Test ini menulis ke PostgreSQL
 * sungguhan supaya nama kolom, tipe enum, dan constraint ikut teruji.
 */
describe('NotificationsProcessor terhadap PostgreSQL nyata', () => {
  let prisma: PrismaClient;
  let processor: NotificationsProcessor;
  let userId: string;
  let courseId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    processor = new NotificationsProcessor(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `notif-${suffix}@contoh.test`,
        passwordHash: 'x',
        fullName: 'Pelajar Uji',
      },
      select: { id: true },
    });
    userId = user.id;

    const course = await prisma.course.create({
      data: { slug: `kursus-uji-${suffix}`, title: 'Dasar Prompt Engineering' },
      select: { id: true },
    });
    courseId = course.id;
  });

  afterEach(async () => {
    // Notifikasi dan preferensi ikut terhapus lewat cascade pada user.
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await prisma.course.delete({ where: { id: courseId } }).catch(() => undefined);
  });

  function job(): EventJob {
    return {
      eventId: randomUUID(),
      eventType: 'learning.course_completed',
      aggregateType: 'enrollment',
      aggregateId: randomUUID(),
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      payload: { userId, courseId, completedAt: new Date().toISOString() },
    };
  }

  it('menulis satu baris notifikasi yang dapat dibaca kembali', async () => {
    await expect(processor.handle(job())).resolves.toEqual({ queued: true });

    const rows = await prisma.notification.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('COURSE_COMPLETED');
    expect(rows[0].linkUrl).toBe(`/courses/${courseId}`);
    expect(rows[0].body).toContain('Dasar Prompt Engineering');
    // Belum dibaca, sehingga ikut terhitung pada lonceng notifikasi.
    expect(rows[0].readAt).toBeNull();
  });

  it('tidak menghasilkan baris kedua saat event yang sama tiba lagi', async () => {
    await processor.handle(job());
    // eventId berbeda, kejadian sama: inilah bentuk duplikat yang sebenarnya
    // dihasilkan relay at-least-once, bukan job yang identik.
    await expect(processor.handle(job())).resolves.toEqual({ queued: false });

    await expect(prisma.notification.count({ where: { userId } })).resolves.toBe(1);
  });

  it('diam bila pelajar mematikan kabar seputar kursus', async () => {
    await prisma.notificationPreference.create({
      data: { userId, courseUpdatesEnabled: false },
    });

    await expect(processor.handle(job())).resolves.toEqual({ queued: false });
    await expect(prisma.notification.count({ where: { userId } })).resolves.toBe(0);
  });
});
