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
      { assertActiveAccess: jest.fn() } as never,
      { notify: jest.fn() } as never,
    );

    await expect(service.createReply('user-1', 'topic-1', 'Balasan anak', 'reply-1'))
      .rejects.toMatchObject({ status: 422 });
    expect(create).not.toHaveBeenCalled();
  });
});
