import request from 'supertest';
import { login, prefix, startHarness, type Harness, type Session } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

interface Group {
  type: string;
  total: number;
  items: { id: string; title: string; subtitle: string | null; url: string }[];
}

describe('Pencarian global', () => {
  let h: Harness;
  let master: Session;
  let student: Session;

  beforeAll(async () => {
    h = await startHarness();
    master = await login(h.server, MASTER.email, MASTER.password);
    student = await login(h.server, STUDENT.email, STUDENT.password);
  });

  afterAll(async () => {
    await h.close();
  });

  const cari = (session: Session, query: string) =>
    request(h.server).get(`${prefix}/search?${query}`).set('Cookie', session.cookie);

  const grup = (body: { data: Group[] }, type: string): Group | undefined =>
    body.data.find((group) => group.type === type);

  it('menolak permintaan tanpa sesi', async () => {
    await request(h.server).get(`${prefix}/search?q=kursus`).expect(401);
  });

  it('menolak kata kunci yang terlalu pendek', async () => {
    await cari(student, 'q=a').expect(422);
  });

  it('menolak jenis yang tidak dikenal', async () => {
    await cari(student, 'q=video&types=rahasia').expect(422);
  });

  it('tidak case-sensitive', async () => {
    const kursus = await h.prisma.course.findFirstOrThrow({
      where: { status: 'PUBLISHED' },
      select: { title: true },
    });
    const kata = kursus.title.split(' ')[0]!;

    const kecil = await cari(master, `q=${encodeURIComponent(kata.toLowerCase())}`).expect(200);
    const besar = await cari(master, `q=${encodeURIComponent(kata.toUpperCase())}`).expect(200);

    expect(grup(kecil.body, 'courses')!.total).toBe(grup(besar.body, 'courses')!.total);
    expect(grup(kecil.body, 'courses')!.total).toBeGreaterThan(0);
  });

  describe('cakupan menurut siapa yang bertanya', () => {
    it('tidak memberi pelajar hasil pengguna sama sekali', async () => {
      // Bukan sekadar kosong: kelompoknya tidak ada, sehingga pencarian tidak
      // dapat dipakai memastikan apakah sebuah alamat terdaftar.
      const response = await cari(student, 'q=master').expect(200);
      expect(grup(response.body, 'users')).toBeUndefined();
    });

    it('memberi Master hasil pengguna', async () => {
      const response = await cari(master, 'q=akademionline').expect(200);
      expect(grup(response.body, 'users')!.total).toBeGreaterThan(0);
    });

    it('menyembunyikan kursus draft dari pelajar', async () => {
      const draft = await h.prisma.course.create({
        data: {
          slug: `draft-cari-${Date.now()}`,
          title: 'Rahasia Peluncuran Kuartal Depan',
          status: 'DRAFT',
        },
        select: { id: true },
      });

      try {
        const pelajar = await cari(student, 'q=Rahasia%20Peluncuran').expect(200);
        expect(grup(pelajar.body, 'courses')!.total).toBe(0);

        const guru = await cari(master, 'q=Rahasia%20Peluncuran').expect(200);
        expect(grup(guru.body, 'courses')!.total).toBe(1);
      } finally {
        await h.prisma.course.delete({ where: { id: draft.id } });
      }
    });

    it('menyembunyikan materi dari kursus yang tidak diikuti pelajar', async () => {
      const luar = await h.prisma.lesson.findFirst({
        where: { module: { course: { enrollments: { none: { userId: student.userId } } } } },
        select: { title: true },
      });
      if (!luar) return;

      const kata = luar.title.split(' ')[0]!;
      const pelajar = await cari(student, `q=${encodeURIComponent(kata)}`).expect(200);
      const judul = grup(pelajar.body, 'lessons')!.items.map((item) => item.title);

      // Judul materi berbayar tidak boleh dapat dipanen tanpa membayar.
      expect(judul).not.toContain(luar.title);
    });

    it('menyembunyikan topik forum yang disembunyikan dari pelajar', async () => {
      const kursus = await h.prisma.enrollment.findFirstOrThrow({
        where: { userId: student.userId, status: 'ACTIVE' },
        select: { courseId: true },
      });
      const topik = await h.prisma.forumTopic.create({
        data: {
          courseId: kursus.courseId,
          authorId: student.userId,
          title: 'Topik Tersembunyi Untuk Uji Pencarian',
          body: 'isi',
          status: 'HIDDEN',
        },
        select: { id: true },
      });

      try {
        const pelajar = await cari(student, 'q=Tersembunyi%20Untuk%20Uji').expect(200);
        expect(grup(pelajar.body, 'forum')!.total).toBe(0);

        const guru = await cari(master, 'q=Tersembunyi%20Untuk%20Uji').expect(200);
        expect(grup(guru.body, 'forum')!.total).toBe(1);
      } finally {
        await h.prisma.forumTopic.delete({ where: { id: topik.id } });
      }
    });

    it('menyembunyikan pengumuman draft dari pelajar', async () => {
      const pengumuman = await h.prisma.announcement.create({
        data: {
          title: 'Draft Pengumuman Uji Pencarian',
          body: 'belum terbit',
          audience: 'ALL_USERS',
          status: 'DRAFT',
          createdBy: master.userId,
        },
        select: { id: true },
      });

      try {
        const pelajar = await cari(student, 'q=Draft%20Pengumuman%20Uji').expect(200);
        expect(grup(pelajar.body, 'announcements')!.total).toBe(0);

        const guru = await cari(master, 'q=Draft%20Pengumuman%20Uji').expect(200);
        expect(grup(guru.body, 'announcements')!.total).toBe(1);
      } finally {
        await h.prisma.announcement.delete({ where: { id: pengumuman.id } });
      }
    });
  });

  describe('penyaring dan batas', () => {
    it('membatasi pada jenis yang diminta', async () => {
      const response = await cari(master, 'q=an&types=courses,lessons').expect(200);
      const jenis = response.body.data.map((group: Group) => group.type).sort();
      expect(jenis).toEqual(['courses', 'lessons']);
    });

    it('menghormati batas hasil per jenis', async () => {
      const response = await cari(master, 'q=an&types=courses&limit=1').expect(200);
      expect(grup(response.body, 'courses')!.items.length).toBeLessThanOrEqual(1);
    });

    it('melaporkan jumlah seluruh kecocokan, bukan hanya yang dikirim', async () => {
      const response = await cari(master, 'q=an&types=lessons&limit=1').expect(200);
      const lessons = grup(response.body, 'lessons')!;
      if (lessons.total > 1) expect(lessons.items).toHaveLength(1);
      expect(lessons.total).toBeGreaterThanOrEqual(lessons.items.length);
    });

    it('memberi seluruh jenis ketika penyaing tidak disebut', async () => {
      const response = await cari(master, 'q=an').expect(200);
      expect(response.body.data.map((group: Group) => group.type).sort()).toEqual(
        ['announcements', 'courses', 'forum', 'lessons', 'users'].sort(),
      );
    });

    it('menyertakan tautan yang dapat dibuka untuk setiap hasil', async () => {
      const response = await cari(master, 'q=an&types=courses').expect(200);
      for (const item of grup(response.body, 'courses')!.items) {
        expect(item.url.startsWith('/')).toBe(true);
      }
    });
  });
});
