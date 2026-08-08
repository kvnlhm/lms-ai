import { ForumService } from './forum.service';

describe('ForumService nested replies', () => {
  test('balasan anak hanya boleh menunjuk balasan utama dalam topik yang sama', async () => {
    const create = jest.fn();
    const prisma = {
      forumBan: { findFirst: jest.fn().mockResolvedValue(null) },
      forumTopic: { findFirst: jest.fn().mockResolvedValue({ id: 'topic-1', courseId: 'course-1', status: 'OPEN' }) },
      forumReply: {
        findFirst: jest.fn().mockResolvedValue({ id: 'reply-1', topicId: 'topic-1', parentReplyId: 'reply-0' }),
        create,
      },
    };
    const service = new ForumService(
      prisma as never,
      { assertActiveAccess: jest.fn().mockResolvedValue({ berhakIsi: true }) } as never,
      { notify: jest.fn() } as never,
    );

    await expect(service.createReply('user-1', 'topic-1', 'Balasan anak', 'reply-1'))
      .rejects.toMatchObject({ status: 422 });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('ForumService gerbang keanggotaan', () => {
  /**
   * Akun gratis membaca diskusi kursus tetapi tidak menulisnya (ADR-032).
   *
   * Jawabannya sudah dibawa `assertActiveAccess`, jadi yang diuji di sini adalah
   * bahwa forum benar-benar membacanya — bukan bahwa keanggotaannya benar.
   */
  function service(berhakIsi: boolean) {
    const prisma = {
      forumBan: { findFirst: jest.fn().mockResolvedValue(null) },
      forumTopic: { create: jest.fn() },
    };
    return {
      prisma,
      forum: new ForumService(
        prisma as never,
        { assertActiveAccess: jest.fn().mockResolvedValue({ berhakIsi }) } as never,
        { notify: jest.fn() } as never,
      ),
    };
  }

  test('akun gratis ditolak 402 saat membuka topik', async () => {
    const { forum, prisma } = service(false);

    await expect(
      forum.createTopic('gratis-1', { courseId: 'course-1', title: 'Tanya', body: 'Isi' }),
    ).rejects.toMatchObject({ code: 'MEMBERSHIP_REQUIRED', status: 402 });
    expect(prisma.forumTopic.create).not.toHaveBeenCalled();
  });

  test('keanggotaan diperiksa sebelum larangan berdiskusi', async () => {
    // Urutannya penting: menanyakan larangan lebih dulu berarti satu kueri
    // tambahan untuk setiap akun gratis yang pasti ditolak sesudahnya.
    const { forum, prisma } = service(false);

    await expect(
      forum.createTopic('gratis-1', { courseId: 'course-1', title: 'Tanya', body: 'Isi' }),
    ).rejects.toMatchObject({ status: 402 });
    expect(prisma.forumBan.findFirst).not.toHaveBeenCalled();
  });
});
