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
});
