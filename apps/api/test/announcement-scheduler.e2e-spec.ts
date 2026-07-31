import request from 'supertest';
import { AnnouncementStatus } from '@prisma/client';
import { AnnouncementScheduler } from '../src/modules/announcement/application/announcement-scheduler.service';
import { login, prefix, startHarness, type Harness, type Session } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

describe('Penjadwalan pengumuman', () => {
  let h: Harness;
  let master: Session;
  let scheduler: AnnouncementScheduler;
  let studentId: string;

  beforeAll(async () => {
    h = await startHarness();
    master = await login(h.server, MASTER.email, MASTER.password);
    scheduler = h.app.get(AnnouncementScheduler);

    const student = await h.prisma.user.findFirstOrThrow({
      where: { email: STUDENT.email },
      select: { id: true },
    });
    studentId = student.id;
  });

  afterAll(async () => {
    await h.close();
  });

  beforeEach(async () => {
    await h.prisma.notification.deleteMany({ where: { type: 'ANNOUNCEMENT_PUBLISHED' } });
    await h.prisma.announcement.deleteMany({});
  });

  async function buat(publishedAt: Date): Promise<string> {
    const response = await request(h.server)
      .post(`${prefix}/admin/announcements`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({
        title: 'Kelas tambahan',
        body: 'Ada kelas tambahan minggu depan.',
        audience: 'ALL_USERS',
        publishedAt: publishedAt.toISOString(),
      })
      .expect(201);
    return response.body.data.id as string;
  }

  async function terbitkan(id: string): Promise<void> {
    await request(h.server)
      .post(`${prefix}/admin/announcements/${id}/publish`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .expect(200);
  }

  function jumlahNotifikasi(): Promise<number> {
    return h.prisma.notification.count({
      where: { userId: studentId, type: 'ANNOUNCEMENT_PUBLISHED' },
    });
  }

  it('menahan notifikasi sampai waktunya tiba', async () => {
    const id = await buat(new Date(Date.now() + 3_600_000));
    await terbitkan(id);

    expect(await jumlahNotifikasi()).toBe(0);
    expect(await scheduler.runOnce()).toBe(0);
    expect(await jumlahNotifikasi()).toBe(0);

    // Statusnya sudah PUBLISHED, tetapi belum boleh tampil bagi pelajar.
    const row = await h.prisma.announcement.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe(AnnouncementStatus.PUBLISHED);
    expect(row.notifiedAt).toBeNull();
  });

  it('memberi tahu ketika jadwalnya sudah lewat', async () => {
    const id = await buat(new Date(Date.now() + 3_600_000));
    await terbitkan(id);

    await h.prisma.announcement.update({
      where: { id },
      data: { publishedAt: new Date(Date.now() - 1_000) },
    });

    expect(await scheduler.runOnce()).toBe(1);
    expect(await jumlahNotifikasi()).toBe(1);
  });

  it('tidak mengirim notifikasi yang sama dua kali', async () => {
    const id = await buat(new Date(Date.now() - 1_000));
    await terbitkan(id);

    // Penerbitan langsung sudah memberi tahu; penjadwal tidak boleh mengulang.
    expect(await jumlahNotifikasi()).toBe(1);
    expect(await scheduler.runOnce()).toBe(0);
    expect(await scheduler.runOnce()).toBe(0);
    expect(await jumlahNotifikasi()).toBe(1);
  });

  it('menandai penerbitan langsung sebagai sudah diberitahukan', async () => {
    const id = await buat(new Date(Date.now() - 1_000));
    await terbitkan(id);

    const row = await h.prisma.announcement.findUniqueOrThrow({ where: { id } });
    expect(row.notifiedAt).not.toBeNull();
  });

  it('melewati pengumuman yang sudah berakhir sebelum sempat diberitahukan', async () => {
    const id = await buat(new Date(Date.now() + 3_600_000));
    await terbitkan(id);

    await h.prisma.announcement.update({
      where: { id },
      data: {
        publishedAt: new Date(Date.now() - 7_200_000),
        endsAt: new Date(Date.now() - 3_600_000),
      },
    });

    // Memberitahukannya hanya akan mengarahkan pelajar ke halaman kosong.
    expect(await scheduler.runOnce()).toBe(0);
    expect(await jumlahNotifikasi()).toBe(0);
  });

  it('tidak menerbitkan draft yang jadwalnya sudah lewat', async () => {
    const id = await buat(new Date(Date.now() - 3_600_000));

    // Menerbitkan tetap tindakan sadar seorang Master; jadwal yang lewat tidak
    // boleh membuat tulisan setengah jadi tersiar dengan sendirinya.
    expect(await scheduler.runOnce()).toBe(0);
    const row = await h.prisma.announcement.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe(AnnouncementStatus.DRAFT);
    expect(await jumlahNotifikasi()).toBe(0);
  });

  it('membuat pengumuman terjadwal tampil bagi pelajar setelah waktunya', async () => {
    const id = await buat(new Date(Date.now() + 3_600_000));
    await terbitkan(id);

    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const sebelum = await request(h.server)
      .get(`${prefix}/me/announcements`)
      .set('Cookie', student.cookie)
      .expect(200);
    expect(sebelum.body.data).toHaveLength(0);

    await h.prisma.announcement.update({
      where: { id },
      data: { publishedAt: new Date(Date.now() - 1_000) },
    });

    const sesudah = await request(h.server)
      .get(`${prefix}/me/announcements`)
      .set('Cookie', student.cookie)
      .expect(200);
    expect(sesudah.body.data).toHaveLength(1);
  });
});
