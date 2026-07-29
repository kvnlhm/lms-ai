import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { jobIdFor } from '../src/outbox/event-routing';
import { OutboxRelayService } from '../src/outbox/outbox-relay.service';
import type { PrismaService } from '../src/infrastructure/prisma.service';

const QUEUE_PREFIX = `lms:test:${process.pid}`;

/**
 * Prasyarat: tidak boleh ada proses worker lain yang berjalan terhadap
 * database yang sama saat test ini dijalankan.
 *
 * Ini bukan kelemahan test, melainkan konsekuensi desain: `FOR UPDATE SKIP
 * LOCKED` membuat beberapa replika relay membagi pekerjaan, sehingga relay
 * yang berjalan di latar akan mengambil baris sebelum test sempat memprosesnya.
 * Hentikan worker (`pkill -f "worker/dist/main.js"`) sebelum menjalankan.
 */
describe('Relay outbox terhadap PostgreSQL dan Redis nyata', () => {
  let prisma: PrismaClient;
  let connection: IORedis;
  let relay: OutboxRelayService;
  let analytics: Queue;
  let notifications: Queue;

  beforeAll(async () => {
    process.env.REDIS_QUEUE_PREFIX = QUEUE_PREFIX;

    prisma = new PrismaClient();
    connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });

    relay = new OutboxRelayService(prisma as unknown as PrismaService, connection);
    // Hanya siapkan antrean. Poller latar sengaja tidak dinyalakan supaya
    // tidak berlomba dengan pemanggilan publishBatch() di test.
    relay.initQueues();

    analytics = new Queue('analytics', { connection, prefix: QUEUE_PREFIX });
    notifications = new Queue('notifications', { connection, prefix: QUEUE_PREFIX });
  });

  afterAll(async () => {
    await relay.onModuleDestroy();
    await analytics.obliterate({ force: true }).catch(() => undefined);
    await notifications.obliterate({ force: true }).catch(() => undefined);
    await analytics.close();
    await notifications.close();
    await prisma.$disconnect();
    connection.disconnect();
  });

  beforeEach(async () => {
    // Seluruh outbox dikosongkan, bukan hanya baris milik test ini.
    // publishBatch() mengembalikan jumlah gabungan, jadi event sisa dari
    // aplikasi akan membuat angkanya tidak dapat diprediksi. Database test
    // memang sekali pakai.
    await prisma.outboxMessage.deleteMany({});
    await analytics.drain(true);
    await notifications.drain(true);
  });

  async function seedEvent(eventType: string): Promise<string> {
    const eventId = randomUUID();
    await prisma.outboxMessage.create({
      data: {
        eventId,
        eventType,
        aggregateType: 'test',
        aggregateId: randomUUID(),
        payload: { userId: randomUUID(), courseId: randomUUID() },
      },
    });
    await waitUntilClaimable(eventId);
    return eventId;
  }

  /**
   * Menjalankan siklus relay sampai seluruh outbox terbit.
   *
   * Kontrak relay adalah "event akhirnya terbit", bukan "terbit pada siklus
   * pertama": `FOR UPDATE SKIP LOCKED` boleh melewati baris yang kebetulan
   * sedang terkunci koneksi lain, dan siklus berikutnya yang mengambilnya.
   * Menuntut keberhasilan pada panggilan pertama berarti menguji jaminan yang
   * memang tidak diberikan, dan membuat test gagal secara acak.
   */
  async function drainOutbox(): Promise<number> {
    let total = 0;
    const deadline = Date.now() + 5_000;

    while (Date.now() < deadline) {
      total += await relay.publishBatch();
      const pending = await prisma.outboxMessage.count({ where: { publishedAt: null } });
      if (pending === 0) return total;
    }
    throw new Error('Outbox tidak pernah kosong dalam batas waktu.');
  }

  /**
   * Menunggu baris yang baru ditulis benar-benar dapat diambil relay.
   *
   * `create()` menulis lewat satu koneksi pool, sedangkan `claimBatch()`
   * membaca lewat koneksi lain. Ada jendela sangat singkat ketika kunci baris
   * dari transaksi penulis belum lepas, sehingga `FOR UPDATE SKIP LOCKED`
   * melewatinya. Di produksi hal itu tidak berakibat apa-apa — poller
   * mengambilnya pada siklus berikutnya — tetapi test yang memanggil
   * publishBatch() satu kali harus menunggu kondisi ini lebih dulu.
   */
  async function waitUntilClaimable(eventId: string): Promise<void> {
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM outbox_messages
        WHERE event_id = ${eventId}::uuid AND published_at IS NULL
        FOR UPDATE SKIP LOCKED
      `;
      if (rows.length > 0) return;
    }
    throw new Error(`Event ${eventId} tidak pernah dapat diambil relay.`);
  }

  it('menerbitkan event ke antrean dan menandainya terbit', async () => {
    const eventId = await seedEvent('learning.lesson_completed');

    expect(await drainOutbox()).toBe(1);

    const jobs = await analytics.getJobs(['waiting', 'delayed', 'active']);
    expect(jobs.map((job) => job.id)).toContain(jobIdFor(eventId, 'analytics'));

    const row = await prisma.outboxMessage.findUniqueOrThrow({ where: { eventId } });
    expect(row.publishedAt).not.toBeNull();
    expect(row.lastError).toBeNull();
  });

  it('mengirim penyelesaian kursus ke dua antrean', async () => {
    const eventId = await seedEvent('learning.course_completed');

    await drainOutbox();

    const analyticsJobs = await analytics.getJobs(['waiting', 'delayed', 'active']);
    const notificationJobs = await notifications.getJobs(['waiting', 'delayed', 'active']);

    expect(analyticsJobs.map((job) => job.id)).toContain(jobIdFor(eventId, 'analytics'));
    expect(notificationJobs.map((job) => job.id)).toContain(jobIdFor(eventId, 'notifications'));
  });

  it('tidak menerbitkan ulang event yang sudah terbit', async () => {
    await seedEvent('learning.lesson_completed');

    expect(await drainOutbox()).toBe(1);
    // Setelah outbox kosong, siklus berikutnya tidak menemukan pekerjaan.
    expect(await relay.publishBatch()).toBe(0);
  });

  it('menghasilkan satu job meskipun relay mengirim event yang sama dua kali', async () => {
    const eventId = await seedEvent('learning.lesson_completed');

    await drainOutbox();
    // Simulasi kegagalan setelah kirim tetapi sebelum tanda terbit tersimpan.
    await prisma.outboxMessage.update({ where: { eventId }, data: { publishedAt: null } });
    await drainOutbox();

    const jobs = await analytics.getJobs(['waiting', 'delayed', 'active']);
    const matching = jobs.filter((job) => job.id === jobIdFor(eventId, 'analytics'));
    // jobId deterministik membuat Redis menolak duplikatnya.
    expect(matching).toHaveLength(1);
  });

  it('menandai terbit event yang belum punya tujuan agar tidak menumpuk', async () => {
    const eventId = await seedEvent('community.discussion_created');

    expect(await drainOutbox()).toBe(1);

    const row = await prisma.outboxMessage.findUniqueOrThrow({ where: { eventId } });
    expect(row.publishedAt).not.toBeNull();
  });

  it('melewati event yang sudah melampaui batas percobaan', async () => {
    const eventId = await seedEvent('learning.lesson_completed');
    await prisma.outboxMessage.update({ where: { eventId }, data: { attempts: 10 } });

    // Berapa pun siklus dijalankan, event ini tidak akan pernah diambil.
    expect(await relay.publishBatch()).toBe(0);
    expect(await relay.publishBatch()).toBe(0);

    const row = await prisma.outboxMessage.findUniqueOrThrow({ where: { eventId } });
    // Barisnya tetap ada untuk diperiksa dan direplay manual.
    expect(row.publishedAt).toBeNull();
  });

  it('menghormati available_at untuk event yang dijadwalkan mundur', async () => {
    const eventId = await seedEvent('learning.lesson_completed');
    await prisma.outboxMessage.update({
      where: { eventId },
      data: { availableAt: new Date(Date.now() + 60_000) },
    });

    expect(await relay.publishBatch()).toBe(0);
    expect(await relay.publishBatch()).toBe(0);
  });
});
