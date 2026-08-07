import { CommunityService } from './community.service';

describe('CommunityService hierarchy invariants', () => {
  test('sidebar hanya meminta Channel dan Sub-channel yang dipilih Master', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new CommunityService({ communityChannelGroup: { findMany } } as never, {} as never, {} as never);

    await service.listSidebarChannels();

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { archivedAt: null, showInSidebar: true },
      select: expect.objectContaining({
        subchannels: expect.objectContaining({ where: { archivedAt: null, showInSidebar: true } }),
      }),
    }));
  });

  test('sub-channel aktif terakhir tidak dapat diarsipkan', async () => {
    const update = jest.fn();
    const service = new CommunityService({
      communityChannel: {
        findUnique: jest.fn().mockResolvedValue({ id: 'sub-1', groupId: 'group-1', archivedAt: null }),
        count: jest.fn().mockResolvedValue(1),
        update,
      },
    } as never, { record: jest.fn() } as never, {} as never);

    await expect(service.archiveSubchannel('user-1', 'sub-1')).rejects.toMatchObject({ status: 422 });
    expect(update).not.toHaveBeenCalled();
  });

  test('sub-channel pengumuman selalu dibuat baca-saja', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'sub-1', type: 'ANNOUNCEMENTS', isReadOnly: true });
    const service = new CommunityService({
      communityChannelGroup: { findFirst: jest.fn().mockResolvedValue({ id: 'group-1' }) },
      communityChannel: { create },
    } as never, {} as never, {} as never);

    await service.createSubchannel('master-1', 'group-1', {
      name: 'Pengumuman', type: 'ANNOUNCEMENTS', isReadOnly: false,
    } as never);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'ANNOUNCEMENTS', isReadOnly: true }),
    }));
  });

  test('mengubah kategori menjadi pengumuman juga memaksa baca-saja', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'sub-1', type: 'ANNOUNCEMENTS', isReadOnly: true });
    const service = new CommunityService({
      communityChannel: {
        findUnique: jest.fn().mockResolvedValue({ id: 'sub-1', type: 'POSTS' }),
        update,
      },
      communityPost: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn().mockImplementation(async (operations) => Promise.all(operations)),
    } as never, {} as never, {} as never);

    await service.updateSubchannel('sub-1', { type: 'ANNOUNCEMENTS', isReadOnly: false } as never);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'ANNOUNCEMENTS', isReadOnly: true }),
    }));
  });

  test('pelajar tidak dapat menulis pada sub-channel pengumuman', async () => {
    const create = jest.fn();
    const service = new CommunityService({
      communityChannel: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sub-1', type: 'ANNOUNCEMENTS', isReadOnly: false }),
      },
      communityPost: { create },
    } as never, {} as never, {} as never);

    await expect(service.createPost('student-1', 'sub-1', 'Tidak sah', false))
      .rejects.toMatchObject({ status: 403 });
    expect(create).not.toHaveBeenCalled();
  });

  test('post pengumuman tidak menerima komentar maupun reaksi', async () => {
    const transaction = jest.fn();
    const prisma = {
      communityPost: {
        findFirst: jest.fn().mockResolvedValue({ id: 'post-1', channel: { type: 'ANNOUNCEMENTS' } }),
      },
      $transaction: transaction,
    };
    const service = new CommunityService(prisma as never, {} as never, {} as never);

    await expect(service.addComment('student-1', 'post-1', 'Balasan'))
      .rejects.toMatchObject({ status: 403 });
    await expect(service.toggleReaction('student-1', 'post-1'))
      .rejects.toMatchObject({ status: 403 });
    expect(transaction).not.toHaveBeenCalled();
  });

  test('item checklist tidak menerima komentar maupun reaksi', async () => {
    const service = new CommunityService({
      communityPost: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'post-1', reactionCount: 0, channel: { type: 'CHECKLIST', allowReplies: true },
        }),
      },
      $transaction: jest.fn().mockResolvedValue({
        id: 'comment-1', body: 'Balasan', editedAt: null, createdAt: new Date(), author: { id: 'student-1' },
      }),
    } as never, {} as never, {} as never);

    await expect(service.addComment('student-1', 'post-1', 'Balasan'))
      .rejects.toMatchObject({ status: 403 });
    await expect(service.toggleReaction('student-1', 'post-1'))
      .rejects.toMatchObject({ status: 403 });
  });

  test('sub-channel yang menonaktifkan balasan menolak komentar baru', async () => {
    const transaction = jest.fn();
    const service = new CommunityService({
      communityPost: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'post-1', channel: { type: 'POSTS', allowReplies: false },
        }),
      },
      $transaction: transaction,
    } as never, {} as never, {} as never);

    await expect(service.addComment('student-1', 'post-1', 'Balasan'))
      .rejects.toMatchObject({ status: 403 });
    expect(transaction).not.toHaveBeenCalled();
  });

  test('pengumuman tetap mematikan balasan meskipun client mengaktifkannya', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'sub-1' });
    const service = new CommunityService({
      communityChannelGroup: { findFirst: jest.fn().mockResolvedValue({ id: 'group-1' }) },
      communityChannel: { create },
    } as never, {} as never, {} as never);

    await service.createSubchannel('master-1', 'group-1', {
      name: 'Pengumuman', type: 'ANNOUNCEMENTS', allowReplies: true,
    } as never);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ allowReplies: false }),
    }));
  });

  test('centang checklist disimpan hanya untuk pengguna yang sedang login', async () => {
    const upsert = jest.fn().mockResolvedValue({ postId: 'post-1', userId: 'student-1' });
    const service = new CommunityService({
      communityPost: {
        findFirst: jest.fn().mockResolvedValue({ id: 'post-1', channel: { type: 'CHECKLIST' } }),
      },
      communityChecklistCompletion: { upsert },
    } as never, {} as never, {} as never);

    await expect(service.setChecklistCompleted('student-1', 'post-1', true))
      .resolves.toEqual({ completed: true });
    expect(upsert).toHaveBeenCalledWith({
      where: { postId_userId: { postId: 'post-1', userId: 'student-1' } },
      create: { postId: 'post-1', userId: 'student-1' },
      update: {},
    });
  });

  test('post biasa tidak dapat dicentang sebagai checklist', async () => {
    const upsert = jest.fn();
    const service = new CommunityService({
      communityPost: {
        findFirst: jest.fn().mockResolvedValue({ id: 'post-1', channel: { type: 'POSTS' } }),
      },
      communityChecklistCompletion: { upsert },
    } as never, {} as never, {} as never);

    await expect(service.setChecklistCompleted('student-1', 'post-1', true))
      .rejects.toMatchObject({ status: 422 });
    expect(upsert).not.toHaveBeenCalled();
  });

  test('setiap item checklist menyimpan judul dan kontennya secara terpisah', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'post-1', title: 'Lengkapi profil', body: 'Tambahkan foto dan bio.',
      author: { id: 'master-1' }, comments: [], reactions: [], checklistCompletions: [],
      channel: { id: 'sub-1', type: 'CHECKLIST', group: { slug: 'welcome', name: 'Welcome' } },
    });
    const prisma = {
      communityChannel: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sub-1', type: 'CHECKLIST', isReadOnly: true }),
      },
      communityPost: { create, findUniqueOrThrow: jest.fn().mockImplementation(() => create.mock.results[0].value) },
      $transaction: (jalankan: (tx: unknown) => unknown) => jalankan(prisma),
    };
    const service = new CommunityService(prisma as never, {} as never, { bind: jest.fn() } as never);

    await expect(service.createPost(
      'master-1', 'sub-1', 'Tambahkan foto dan bio.', true, 'Lengkapi profil',
    )).resolves.toMatchObject({
      title: 'Lengkapi profil', body: 'Tambahkan foto dan bio.',
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ title: 'Lengkapi profil', body: 'Tambahkan foto dan bio.' }),
    }));
  });

  test('postingan biasa juga menyimpan judul yang dikirim composer', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'post-judul' });
    const prisma = {
      communityChannel: { findFirst: jest.fn().mockResolvedValue({ id: 'sub-2', type: 'POSTS', isReadOnly: false }) },
      communityPost: { create, findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'post-judul', title: 'Judul post', body: 'Isi', author: { id: 'student-1' }, comments: [], reactions: [], checklistCompletions: [], channel: { id: 'sub-2', type: 'POSTS', group: { slug: 'komunitas', name: 'Komunitas' } }, attachments: [] }) },
      $transaction: (jalankan: (tx: unknown) => unknown) => jalankan(prisma),
    };
    const service = new CommunityService(prisma as never, {} as never, { bind: jest.fn() } as never);
    await service.createPost('student-1', 'sub-2', 'Isi', false, 'Judul post');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: 'Judul post' }) }));
  });

  test('lampiran diikat di dalam transaksi yang sama dengan pembuatan tulisannya', async () => {
    // Kalau pengikatannya di luar transaksi, tulisan sudah terlihat di feed
    // sementara lampirannya menyusul — dan lampiran yang ditolak meninggalkan
    // tulisan yang sudah terbaca orang tanpa gambarnya.
    const created = {
      id: 'post-9', title: null, body: 'Ini gambarnya.',
      author: { id: 'pelajar-1' }, comments: [], reactions: [], checklistCompletions: [],
      channel: { id: 'sub-2', type: 'POSTS', group: { slug: 'komunitas', name: 'Komunitas' } },
      attachments: [],
    };
    const bind = jest.fn();
    const prisma = {
      communityChannel: { findFirst: jest.fn().mockResolvedValue({ id: 'sub-2', type: 'POSTS', isReadOnly: false }) },
      communityPost: { create: jest.fn().mockResolvedValue({ id: 'post-9' }), findUniqueOrThrow: jest.fn().mockResolvedValue(created) },
      $transaction: (jalankan: (tx: unknown) => unknown) => jalankan(prisma),
    };
    const service = new CommunityService(prisma as never, {} as never, { bind } as never);

    await service.createPost('pelajar-1', 'sub-2', 'Ini gambarnya.', false, undefined, ['a', 'b']);

    expect(bind).toHaveBeenCalledWith(prisma, 'post-9', 'pelajar-1', ['a', 'b']);
  });

  test('item checklist baru wajib memiliki judul', async () => {
    const create = jest.fn();
    const service = new CommunityService({
      communityChannel: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sub-1', type: 'CHECKLIST', isReadOnly: true }),
      },
      communityPost: { create },
    } as never, {} as never, {} as never);

    await expect(service.createPost('master-1', 'sub-1', 'Konten saja', true))
      .rejects.toMatchObject({ status: 422 });
    expect(create).not.toHaveBeenCalled();
  });

  test('detail checklist membawa urutan sebelumnya dan berikutnya', async () => {
    const service = new CommunityService({
      communityPost: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'post-2', title: 'Langkah kedua', body: 'Baca isi ini.',
          author: { id: 'master-1' }, comments: [], reactions: [], checklistCompletions: [],
          channel: { id: 'sub-1', type: 'CHECKLIST', group: { slug: 'welcome', name: 'Welcome' } },
        }),
        findMany: jest.fn().mockResolvedValue([{ id: 'post-1' }, { id: 'post-2' }, { id: 'post-3' }]),
      },
    } as never, {} as never, {} as never);

    await expect(service.getChecklistItem('student-1', 'post-2', false)).resolves.toMatchObject({
      id: 'post-2', position: 2, total: 3,
      previousPostId: 'post-1', nextPostId: 'post-3', completedByMe: false,
    });
  });

  test('channel aktif tidak dapat dihapus permanen', async () => {
    const remove = jest.fn();
    const service = new CommunityService({
      communityChannelGroup: {
        findUnique: jest.fn().mockResolvedValue({ id: 'group-1', name: 'Welcome', archivedAt: null }),
        delete: remove,
      },
    } as never, { record: jest.fn() } as never, {} as never);

    await expect(service.deleteChannelPermanently('master-1', 'group-1'))
      .rejects.toMatchObject({ status: 422 });
    expect(remove).not.toHaveBeenCalled();
  });

  test('Master dapat menyunting item checklist meskipun dibuat pengguna lain', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'post-1', title: 'Judul baru', body: 'Isi baru', author: { id: 'student-1' }, comments: [], reactions: [], checklistCompletions: [],
      channel: { id: 'sub-1', type: 'CHECKLIST', group: { slug: 'welcome', name: 'Welcome' } },
    });
    const record = jest.fn();
    const service = new CommunityService({
      communityPost: {
        findFirst: jest.fn().mockResolvedValue({ id: 'post-1', authorId: 'student-1', title: 'Judul lama', body: 'Isi lama', channelId: 'sub-1', channel: { type: 'CHECKLIST' } }),
        update,
      },
    } as never, { record } as never, {} as never);

    await expect(service.updatePost('master-1', 'post-1', 'Isi baru', true, 'Judul baru'))
      .resolves.toMatchObject({ body: 'Isi baru', canEdit: true });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'community.checklist_item.update', targetId: 'post-1',
      before: expect.objectContaining({ title: 'Judul lama', body: 'Isi lama' }),
      after: { title: 'Judul baru', body: 'Isi baru' },
    }));
  });

  test('Master tetap tidak dapat menulis ulang post forum milik pengguna lain', async () => {
    const update = jest.fn();
    const service = new CommunityService({
      communityPost: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'post-1', authorId: 'student-1', body: 'Ucapan pelajar', channelId: 'sub-1', channel: { type: 'POSTS' },
        }),
        update,
      },
    } as never, { record: jest.fn() } as never, {} as never);

    await expect(service.updatePost('master-1', 'post-1', 'Ditulis ulang', true))
      .rejects.toMatchObject({ status: 403 });
    expect(update).not.toHaveBeenCalled();
  });
  test('progres checklist dihitung dari basis data, bukan dari tulisan yang termuat feed', async () => {
    // Feed dipenggal per halaman. Kalau progresnya dihitung dari tulisan yang
    // kebetulan sudah terkirim, checklist berisi lima langkah akan tampil
    // "1 dari 2" hanya karena tiga sisanya belum ikut halaman pertama.
    const groupBy = jest.fn().mockResolvedValue([{ channelId: 'sub-checklist', _count: { _all: 3 } }]);
    const service = new CommunityService({
      communityChannelGroup: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'group-1', slug: 'selamat-datang', name: 'Selamat Datang', description: null, position: 0, showInSidebar: true,
          archivedAt: null, createdAt: new Date(),
          subchannels: [
            { id: 'sub-checklist', slug: 'welcome', name: 'Welcome Checklist', description: null, position: 0, type: 'CHECKLIST', isReadOnly: true, allowReplies: true, showInSidebar: true, archivedAt: null, createdAt: new Date(), _count: { posts: 5 } },
            { id: 'sub-chat', slug: 'mulai', name: 'Mulai Disini', description: null, position: 1, type: 'POSTS', isReadOnly: false, allowReplies: true, showInSidebar: true, archivedAt: null, createdAt: new Date(), _count: { posts: 9 } },
          ],
        }]),
      },
      communityPost: { groupBy },
    } as never, {} as never, {} as never);

    const [group] = await service.listChannels(false, 'student-1');
    const [checklist, posts] = group.subchannels;
    expect(checklist).toMatchObject({ postCount: 5, checklistCompletedCount: 3 });
    // Sub-channel bukan checklist tidak ikut dihitung dan tidak ikut ditanyakan.
    expect(posts).toMatchObject({ postCount: 9, checklistCompletedCount: 0 });
    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ channelId: { in: ['sub-checklist'] } }),
    }));
  });

  test('tanpa pengguna, progres checklist tidak ditanyakan sama sekali', async () => {
    const groupBy = jest.fn();
    const service = new CommunityService({
      communityChannelGroup: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'group-1', slug: 'selamat-datang', name: 'Selamat Datang', description: null, position: 0, showInSidebar: true,
          archivedAt: null, createdAt: new Date(),
          subchannels: [{ id: 'sub-checklist', slug: 'welcome', name: 'Welcome Checklist', description: null, position: 0, type: 'CHECKLIST', isReadOnly: true, allowReplies: true, showInSidebar: true, archivedAt: null, createdAt: new Date(), _count: { posts: 5 } }],
        }]),
      },
      communityPost: { groupBy },
    } as never, {} as never, {} as never);

    const [group] = await service.listChannels(true);
    expect(group.subchannels[0]).toMatchObject({ checklistCompletedCount: 0 });
    expect(groupBy).not.toHaveBeenCalled();
  });
});

describe('jajak pendapat', () => {
  function layanan(prismaExtra: Record<string, unknown> = {}) {
    const prisma = {
      communityChannel: { findFirst: jest.fn().mockResolvedValue({ id: 'sub-2', type: 'POSTS', isReadOnly: false }) },
      communityPost: {
        create: jest.fn().mockResolvedValue({ id: 'post-9' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'post-9', title: null, body: 'Pilih satu.', author: { id: 'pelajar-1' },
          comments: [], reactions: [], checklistCompletions: [], attachments: [], poll: null,
          channel: { id: 'sub-2', type: 'POSTS', group: { slug: 'g', name: 'G' } },
        }),
      },
      communityPoll: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
      communityPollOption: { findFirst: jest.fn() },
      communityPollVote: { upsert: jest.fn() },
      $transaction: (jalankan: (tx: unknown) => unknown) => jalankan(prisma),
      ...prismaExtra,
    };
    return { prisma, service: new CommunityService(prisma as never, {} as never, { bind: jest.fn() } as never) };
  }

  test('pilihan kosong dan kembar dibuang sebelum jumlahnya diperiksa', async () => {
    // ["Ya", "Ya", ""] adalah satu pilihan sungguhan, bukan tiga. Menerimanya
    // berarti menerbitkan polling yang tidak dapat dijawab.
    const { service, prisma } = layanan();
    await expect(service.createPost('pelajar-1', 'sub-2', 'Pilih satu.', false, undefined, [], ['Ya', 'Ya', '  ']))
      .rejects.toMatchObject({ status: 422 });
    expect(prisma.communityPoll.create).not.toHaveBeenCalled();
  });

  test('pilihan yang sah dibuat berurutan bersama postingannya', async () => {
    const { service, prisma } = layanan();
    await service.createPost('pelajar-1', 'sub-2', 'Pilih satu.', false, undefined, [], ['Ya', 'Tidak']);
    expect(prisma.communityPoll.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        postId: 'post-9',
        options: { create: [{ label: 'Ya', position: 0 }, { label: 'Tidak', position: 1 }] },
      }),
    }));
  });

  test('postingan tanpa polling tidak membuat baris polling', async () => {
    const { service, prisma } = layanan();
    await service.createPost('pelajar-1', 'sub-2', 'Tulisan biasa.', false);
    expect(prisma.communityPoll.create).not.toHaveBeenCalled();
  });

  test('memilih ulang memindahkan suara, bukan menambah yang kedua', async () => {
    const upsert = jest.fn();
    const { service } = layanan({
      communityPollOption: { findFirst: jest.fn().mockResolvedValue({ id: 'opt-2', pollId: 'poll-1' }) },
      communityPollVote: { upsert },
      communityPoll: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'poll-1', options: [], votes: [] }), create: jest.fn() },
    });

    await service.votePoll('pelajar-1', 'post-9', 'opt-2');

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { pollId_userId: { pollId: 'poll-1', userId: 'pelajar-1' } },
      update: { optionId: 'opt-2' },
    }));
  });

  test('pilihan milik polling lain ditolak 404', async () => {
    const { service } = layanan({ communityPollOption: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(service.votePoll('pelajar-1', 'post-9', 'opt-asing')).rejects.toMatchObject({ status: 404 });
  });
});
