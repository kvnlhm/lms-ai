import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';

const authorSelect = { id: true, fullName: true, avatarUrl: true } as const;

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  listChannels(includeArchived = false) {
    return this.prisma.communityChannel.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: {
        id: true, slug: true, name: true, description: true, position: true,
        isReadOnly: true, archivedAt: true, createdAt: true,
        _count: { select: { posts: { where: { deletedAt: null } } } },
      },
    }).then((rows) => rows.map(({ _count, ...row }) => ({ ...row, postCount: _count.posts })));
  }

  private postSelect(userId: string) {
    return {
      id: true, body: true, isPinned: true, commentCount: true, reactionCount: true,
      lastActivityAt: true, createdAt: true,
      channel: { select: { id: true, slug: true, name: true, isReadOnly: true } },
      author: { select: authorSelect },
      reactions: { where: { userId }, select: { userId: true } },
      comments: {
        where: { deletedAt: null }, orderBy: { createdAt: 'asc' as const }, take: 6,
        select: { id: true, body: true, createdAt: true, author: { select: authorSelect } },
      },
    } satisfies Prisma.CommunityPostSelect;
  }

  async listPosts(userId: string, page: number, pageSize: number, channelSlug?: string) {
    const where: Prisma.CommunityPostWhereInput = {
      deletedAt: null, channel: { archivedAt: null, ...(channelSlug ? { slug: channelSlug } : {}) },
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.communityPost.count({ where }),
      this.prisma.communityPost.findMany({
        where, orderBy: [{ isPinned: 'desc' }, { lastActivityAt: 'desc' }],
        skip: (page - 1) * pageSize, take: pageSize, select: this.postSelect(userId),
      }),
    ]);
    return { total, posts: rows.map(({ reactions, ...post }) => ({ ...post, reactedByMe: reactions.length > 0 })) };
  }

  async createPost(userId: string, channelId: string, body: string, canModerate: boolean) {
    const channel = await this.prisma.communityChannel.findFirst({ where: { id: channelId, archivedAt: null } });
    if (!channel) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Channel tidak ditemukan.');
    if (channel.isReadOnly && !canModerate) throw new AppError('PERMISSION_DENIED', 403, 'Channel ini hanya dapat ditulis oleh Master.');
    const row = await this.prisma.communityPost.create({
      data: { channelId, authorId: userId, body: body.trim() }, select: this.postSelect(userId),
    });
    const { reactions, ...post } = row;
    return { ...post, reactedByMe: reactions.length > 0 };
  }

  async addComment(userId: string, postId: string, body: string) {
    const post = await this.prisma.communityPost.findFirst({ where: { id: postId, deletedAt: null, channel: { archivedAt: null } } });
    if (!post) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Post tidak ditemukan.');
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.communityComment.create({
        data: { postId, authorId: userId, body: body.trim() },
        select: { id: true, body: true, createdAt: true, author: { select: authorSelect } },
      });
      await tx.communityPost.update({ where: { id: postId }, data: { commentCount: { increment: 1 }, lastActivityAt: new Date() } });
      return comment;
    });
  }

  async toggleReaction(userId: string, postId: string) {
    const post = await this.prisma.communityPost.findFirst({ where: { id: postId, deletedAt: null, channel: { archivedAt: null } }, select: { id: true } });
    if (!post) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Post tidak ditemukan.');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.communityReaction.findUnique({ where: { postId_userId: { postId, userId } } });
      if (existing) await tx.communityReaction.delete({ where: { postId_userId: { postId, userId } } });
      else await tx.communityReaction.create({ data: { postId, userId } });
      const reactionCount = await tx.communityReaction.count({ where: { postId } });
      await tx.communityPost.update({ where: { id: postId }, data: { reactionCount } });
      return { reacted: !existing, reactionCount };
    });
  }

  async createChannel(userId: string, input: { name: string; slug?: string; description?: string; position?: number; isReadOnly?: boolean }) {
    const slug = input.slug ?? input.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) throw new AppError('VALIDATION_ERROR', 422, 'Nama channel tidak menghasilkan slug yang valid.');
    try {
      const channel = await this.prisma.communityChannel.create({ data: { ...input, name: input.name.trim(), slug, createdBy: userId } });
      return { ...channel, postCount: 0 };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError('VALIDATION_ERROR', 422, 'Slug channel sudah digunakan.');
      throw error;
    }
  }

  async updateChannel(id: string, input: { name?: string; slug?: string; description?: string; position?: number; isReadOnly?: boolean }) {
    const exists = await this.prisma.communityChannel.findUnique({ where: { id } });
    if (!exists) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Channel tidak ditemukan.');
    const [channel, postCount] = await this.prisma.$transaction([
      this.prisma.communityChannel.update({ where: { id }, data: input }),
      this.prisma.communityPost.count({ where: { channelId: id, deletedAt: null } }),
    ]);
    return { ...channel, postCount };
  }

  async archiveChannel(id: string) {
    const exists = await this.prisma.communityChannel.findUnique({ where: { id } });
    if (!exists) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Channel tidak ditemukan.');
    await this.prisma.communityChannel.update({ where: { id }, data: { archivedAt: new Date() } });
  }
}
