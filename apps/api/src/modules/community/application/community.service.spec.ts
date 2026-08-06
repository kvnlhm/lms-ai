import { CommunityService } from './community.service';

describe('CommunityService hierarchy invariants', () => {
  test('sidebar hanya meminta Channel dan Sub-channel yang dipilih Master', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new CommunityService({ communityChannelGroup: { findMany } } as never, {} as never);

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
    } as never, { record: jest.fn() } as never);

    await expect(service.archiveSubchannel('user-1', 'sub-1')).rejects.toMatchObject({ status: 422 });
    expect(update).not.toHaveBeenCalled();
  });

  test('sub-channel pengumuman selalu dibuat baca-saja', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'sub-1', type: 'ANNOUNCEMENTS', isReadOnly: true });
    const service = new CommunityService({
      communityChannelGroup: { findFirst: jest.fn().mockResolvedValue({ id: 'group-1' }) },
      communityChannel: { create },
    } as never, {} as never);

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
    } as never, {} as never);

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
    } as never, {} as never);

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
    const service = new CommunityService(prisma as never, {} as never);

    await expect(service.addComment('student-1', 'post-1', 'Balasan'))
      .rejects.toMatchObject({ status: 403 });
    await expect(service.toggleReaction('student-1', 'post-1'))
      .rejects.toMatchObject({ status: 403 });
    expect(transaction).not.toHaveBeenCalled();
  });
});
