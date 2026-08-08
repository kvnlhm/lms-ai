import { Injectable } from '@nestjs/common';
import { CommunityChannelType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { AppError } from '../../../shared/errors/app-error';
import { CommunityAttachmentService } from './community-attachment.service';

const authorSelect = { id: true, fullName: true, avatarUrl: true } as const;

/** Balasan yang ikut terbawa bersama tulisannya; sisanya diambil terpisah. */
const PRATINJAU_BALASAN = 6;

type PollRow = {
  id: string;
  options: { id: string; label: string; position: number; _count: { votes: number } }[];
  votes: { optionId: string }[];
};

/** Pilihan polling: minimal dua, karena satu pilihan bukan pertanyaan. */
const POLLING_MIN = 2;
const POLLING_MAKS = 6;

const commentSelect = {
  id: true, body: true, editedAt: true, createdAt: true, author: { select: authorSelect },
} as const;

/** Id sub-channel bertipe checklist saja; dipakai untuk membatasi hitungan progres. */
function checklistChannelIds(groups: { subchannels: { id: string; type: CommunityChannelType }[] }[]): string[] {
  return groups.flatMap((group) => group.subchannels.filter((item) => item.type === CommunityChannelType.CHECKLIST).map((item) => item.id));
}

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly attachments: CommunityAttachmentService,
  ) {}

  /**
   * Berapa item checklist yang sudah diselesaikan pengguna ini, per sub-channel.
   *
   * Dihitung di server, bukan dari tulisan yang kebetulan sudah termuat di
   * layar. Feed dipenggal per halaman, jadi menghitungnya di antarmuka akan
   * memberi "2 dari 3" pada checklist yang sebenarnya berisi lima item hanya
   * karena dua sisanya belum ikut terkirim.
   */
  private async checklistCompletedCounts(userId: string | undefined, channelIds: string[]): Promise<Map<string, number>> {
    if (!userId || channelIds.length === 0) return new Map();
    const rows = await this.prisma.communityPost.groupBy({
      by: ['channelId'],
      where: { channelId: { in: channelIds }, deletedAt: null, checklistCompletions: { some: { userId } } },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.channelId, row._count._all]));
  }

  async listChannels(includeArchived = false, userId?: string) {
    const groups = await this.prisma.communityChannelGroup.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: {
        id: true, slug: true, name: true, description: true, position: true, showInSidebar: true,
        archivedAt: true, createdAt: true,
        subchannels: {
          where: includeArchived ? {} : { archivedAt: null },
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
          select: {
            id: true, slug: true, name: true, description: true, position: true, type: true,
            isReadOnly: true, allowReplies: true, showInSidebar: true, archivedAt: true, createdAt: true,
            _count: { select: { posts: { where: { deletedAt: null } } } },
          },
        },
      },
    });
    const selesai = await this.checklistCompletedCounts(userId, checklistChannelIds(groups));
    return groups.map((group) => ({
      ...group,
      subchannels: group.subchannels.map(({ _count, ...subchannel }) => ({
        ...subchannel, postCount: _count.posts,
        checklistCompletedCount: subchannel.type === CommunityChannelType.CHECKLIST ? selesai.get(subchannel.id) ?? 0 : 0,
      })),
    }));
  }

  /** Hanya pintasan yang dipilih Master; halaman Komunitas tetap melihat semua Channel aktif. */
  async listSidebarChannels(userId?: string) {
    const groups = await this.prisma.communityChannelGroup.findMany({
      where: { archivedAt: null, showInSidebar: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: {
        id: true, slug: true, name: true, description: true, position: true, showInSidebar: true,
        subchannels: {
          where: { archivedAt: null, showInSidebar: true },
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
          select: {
            id: true, slug: true, name: true, description: true, position: true, type: true,
            isReadOnly: true, allowReplies: true, showInSidebar: true,
            _count: { select: { posts: { where: { deletedAt: null } } } },
          },
        },
      },
    });
    const selesai = await this.checklistCompletedCounts(userId, checklistChannelIds(groups));
    return groups.map((group) => ({
      ...group,
      subchannels: group.subchannels.map(({ _count, ...subchannel }) => ({
        ...subchannel, postCount: _count.posts,
        checklistCompletedCount: subchannel.type === CommunityChannelType.CHECKLIST ? selesai.get(subchannel.id) ?? 0 : 0,
      })),
    }));
  }

  private postSelect(userId: string) {
    return {
      id: true, title: true, body: true, isPinned: true, commentCount: true, reactionCount: true,
      lastActivityAt: true, editedAt: true, createdAt: true,
      channel: { select: {
        id: true, slug: true, name: true, type: true, isReadOnly: true, allowReplies: true,
        group: { select: { slug: true, name: true } },
      } },
      author: { select: authorSelect },
      attachments: { orderBy: { position: 'asc' as const }, select: { id: true, originalName: true, mimeType: true, sizeBytes: true, position: true, createdAt: true, width: true, height: true } },
      poll: { select: {
        id: true,
        options: { orderBy: { position: 'asc' as const }, select: { id: true, label: true, position: true, _count: { select: { votes: true } } } },
        votes: { where: { userId }, select: { optionId: true } },
      } },
      reactions: { where: { userId }, select: { userId: true } },
      checklistCompletions: { where: { userId }, select: { userId: true } },
      comments: {
        // `take` negatif: enam balasan *terakhir*, tetap dalam urutan baca.
        // Dulu enam yang pertama, sehingga pada tulisan yang ramai percakapan
        // terbarunya justru yang tidak pernah terlihat.
        where: { deletedAt: null }, orderBy: { createdAt: 'asc' as const }, take: -PRATINJAU_BALASAN,
        select: commentSelect,
      },
    } satisfies Prisma.CommunityPostSelect;
  }

  /**
   * Kewenangan atas satu tulisan, dijawab server alih-alih ditebak antarmuka.
   *
   * Menyunting hanya milik penulisnya — termasuk terhadap Master. Kewenangan
   * moderasi adalah kuasa untuk *menghapus* tulisan yang tidak pantas, bukan
   * kuasa menaruh kata-kata baru ke dalam mulut orang lain.
   */
  private hak(authorId: string, userId: string, canModerate: boolean) {
    return { canEdit: authorId === userId, canDelete: authorId === userId || canModerate };
  }

  /** Kewenangan yang hanya ada pada tulisan, bukan pada balasan. */
  private hakTulisan(authorId: string, userId: string, canModerate: boolean) {
    return { ...this.hak(authorId, userId, canModerate), canPin: canModerate };
  }

  private sajikanPost<T extends { author: { id: string }; comments: { author: { id: string } }[]; reactions: unknown[]; checklistCompletions: unknown[] }>(
    row: T,
    userId: string,
    canModerate: boolean,
  ) {
    const { reactions, checklistCompletions, comments, channel, attachments, poll, ...post } = row as T & { channel?: { type?: CommunityChannelType; group?: { slug: string; name: string } }; attachments?: { sizeBytes: bigint }[]; poll?: PollRow | null };
    const hakTulisan = this.hakTulisan(row.author.id, userId, canModerate);
    const daftarLampiran = (attachments ?? []).map((item) => ({ ...item, sizeBytes: item.sizeBytes.toString() }));
    return {
      ...post,
      attachments: daftarLampiran,
      poll: poll ? this.sajikanPoll(poll) : null,
      // Checklist berlampir satu berkas dan antarmukanya membacanya sebagai satu
      // nilai. Dipertahankan supaya halaman checklist tidak perlu tahu bahwa
      // modelnya berubah menjadi jamak.
      attachment: daftarLampiran[0] ?? null,
      ...(channel ? { channel: {
        ...channel,
        groupSlug: channel.group?.slug,
        groupName: channel.group?.name,
        group: undefined,
      } } : {}),
      reactedByMe: reactions.length > 0,
      completedByMe: checklistCompletions.length > 0,
      comments: comments.map((comment) => ({ ...comment, ...this.hak(comment.author.id, userId, canModerate) })),
      ...hakTulisan,
      // Item checklist adalah konten terkelola, bukan ucapan pengguna dalam
      // forum. Master perlu dapat memperbaiki langkah yang dilihat semuanya.
      ...(canModerate && channel?.type === CommunityChannelType.CHECKLIST ? { canEdit: true } : {}),
    };
  }

  /**
   * Tulisan pada feed atau pada satu channel.
   *
   * Urutannya berbeda karena keduanya menjawab pertanyaan berbeda. Feed
   * menjawab "apa yang sedang ramai", jadi tersemat dulu lalu aktivitas
   * terakhir. Percakapan satu channel menjawab "apa yang terjadi, berurutan" —
   * di sana `lastActivityAt` justru merusak: satu balasan pada pesan lama
   * melompatkannya ke posisi terbaru, dan riwayat tersusun ulang di bawah mata
   * pembacanya.
   */
  async listPosts(userId: string, page: number, pageSize: number, canModerate: boolean, groupSlug?: string, channelSlug?: string) {
    const where: Prisma.CommunityPostWhereInput = {
      deletedAt: null,
      channel: {
        archivedAt: null,
        group: { archivedAt: null, ...(groupSlug ? { slug: groupSlug } : {}) },
        ...(channelSlug ? { slug: channelSlug } : {}),
      },
    };
    // `id` sebagai pemutus seri: tanpa itu dua pesan dengan waktu yang sama
    // dapat bertukar tempat antar halaman, lalu satu di antaranya terlewat.
    const orderBy: Prisma.CommunityPostOrderByWithRelationInput[] = channelSlug
      ? [{ createdAt: 'desc' }, { id: 'desc' }]
      : [{ isPinned: 'desc' }, { lastActivityAt: 'desc' }, { id: 'desc' }];
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.communityPost.count({ where }),
      this.prisma.communityPost.findMany({
        where, orderBy,
        skip: (page - 1) * pageSize, take: pageSize, select: this.postSelect(userId),
      }),
    ]);
    return { total, posts: rows.map((row) => this.sajikanPost(row, userId, canModerate)) };
  }

  async getChecklistItem(userId: string, postId: string, canModerate: boolean) {
    const row = await this.prisma.communityPost.findFirst({
      where: {
        id: postId,
        deletedAt: null,
        channel: { type: CommunityChannelType.CHECKLIST, archivedAt: null, group: { archivedAt: null } },
      },
      select: this.postSelect(userId),
    });
    if (!row) throw AppError.notFound();

    const urutan = await this.prisma.communityPost.findMany({
      where: { channelId: row.channel.id, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    const index = urutan.findIndex((item) => item.id === postId);
    if (index < 0) throw AppError.notFound();

    return {
      ...this.sajikanPost(row, userId, canModerate),
      previousPostId: urutan[index - 1]?.id ?? null,
      nextPostId: urutan[index + 1]?.id ?? null,
      position: index + 1,
      total: urutan.length,
    };
  }

  /**
   * Seluruh balasan sebuah tulisan, berhalaman.
   *
   * Pratinjau pada daftar tulisan hanya membawa enam terakhir. Tanpa jalan ini,
   * balasan ketujuh dan seterusnya tidak pernah dapat dibaca lagi sekalipun
   * penghitungnya tetap menyebut jumlah penuhnya.
   */
  async listComments(userId: string, postId: string, page: number, pageSize: number, canModerate: boolean) {
    const post = await this.prisma.communityPost.findFirst({
      where: { id: postId, deletedAt: null, channel: { archivedAt: null, group: { archivedAt: null } } },
      select: { id: true },
    });
    if (!post) throw AppError.notFound();

    const where: Prisma.CommunityCommentWhereInput = { postId, deletedAt: null };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.communityComment.count({ where }),
      this.prisma.communityComment.findMany({
        where, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize, take: pageSize, select: commentSelect,
      }),
    ]);
    return { total, items: rows.map((row) => ({ ...row, ...this.hak(row.author.id, userId, canModerate) })) };
  }

  /**
   * Menerbitkan satu tulisan beserta lampirannya.
   *
   * Pembuatan dan pengikatan lampiran berada dalam satu transaksi. Kalau
   * dipisah, tulisan sudah muncul di feed sementara lampirannya masih menyusul,
   * dan lampiran yang ditolak — milik orang lain, atau sudah dipakai postingan
   * lain — meninggalkan tulisan yang sudah terbaca orang tanpa gambarnya.
   */
  async createPost(userId: string, channelId: string, body: string, canModerate: boolean, title?: string, attachmentIds: string[] = [], pollOptions?: string[]) {
    const channel = await this.prisma.communityChannel.findFirst({ where: { id: channelId, archivedAt: null, group: { archivedAt: null } } });
    if (!channel) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Channel tidak ditemukan.');
    if ((channel.isReadOnly || channel.type === CommunityChannelType.ANNOUNCEMENTS) && !canModerate) throw new AppError('PERMISSION_DENIED', 403, 'Channel ini hanya dapat ditulis oleh Master.');
    if (channel.type === CommunityChannelType.CHECKLIST && !title?.trim()) throw new AppError('VALIDATION_ERROR', 422, 'Judul checklist wajib diisi.');
    const pilihan = this.pilihanPolling(pollOptions);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.communityPost.create({
        data: {
          channelId, authorId: userId, body: body.trim(),
          title: title?.trim() || null,
        },
        select: { id: true },
      });
      await this.attachments.bind(tx, created.id, userId, attachmentIds);
      if (pilihan) {
        await tx.communityPoll.create({
          data: { postId: created.id, options: { create: pilihan.map((label, position) => ({ label, position })) } },
        });
      }
      return tx.communityPost.findUniqueOrThrow({ where: { id: created.id }, select: this.postSelect(userId) });
    });
    return this.sajikanPost(row, userId, canModerate);
  }

  /**
   * Bentuk polling untuk klien.
   *
   * Jumlah suara ikut dikirim sebelum orangnya memilih. Menyembunyikannya
   * sampai seseorang ikut memilih memaksa orang menekan pilihan hanya untuk
   * dapat melihat hasilnya — dan suara yang lahir dari rasa penasaran bukan
   * pendapat.
   */
  private sajikanPoll(poll: PollRow) {
    const options = poll.options.map((option) => ({
      id: option.id, label: option.label, position: option.position, voteCount: option._count.votes,
    }));
    return {
      id: poll.id,
      options,
      totalVotes: options.reduce((jumlah, option) => jumlah + option.voteCount, 0),
      myOptionId: poll.votes[0]?.optionId ?? null,
    };
  }

  /**
   * Memberi atau memindahkan suara.
   *
   * `upsert` pada pasangan (polling, pemilih): memilih ulang memindahkan suara
   * alih-alih menambah yang kedua. UNIQUE di basis data yang menegakkannya,
   * jadi dua permintaan yang tiba bersamaan pun tidak dapat menghasilkan dua
   * suara dari orang yang sama.
   */
  async votePoll(userId: string, postId: string, optionId: string) {
    const option = await this.prisma.communityPollOption.findFirst({
      where: { id: optionId, poll: { post: { id: postId, deletedAt: null, channel: { archivedAt: null, group: { archivedAt: null } } } } },
      select: { id: true, pollId: true },
    });
    if (!option) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Pilihan polling tidak ditemukan.');

    await this.prisma.communityPollVote.upsert({
      where: { pollId_userId: { pollId: option.pollId, userId } },
      create: { pollId: option.pollId, optionId: option.id, userId },
      update: { optionId: option.id },
    });

    const poll = await this.prisma.communityPoll.findUniqueOrThrow({
      where: { id: option.pollId },
      select: {
        id: true,
        options: { orderBy: { position: 'asc' }, select: { id: true, label: true, position: true, _count: { select: { votes: true } } } },
        votes: { where: { userId }, select: { optionId: true } },
      },
    });
    return this.sajikanPoll(poll);
  }

  /**
   * Membersihkan pilihan polling, atau menolaknya.
   *
   * Pilihan kosong dan kembar dibuang lebih dulu, baru jumlahnya diperiksa:
   * mengirim ["Ya", "Ya", ""] adalah satu pilihan sungguhan, bukan tiga, dan
   * menerimanya berarti menerbitkan polling yang tidak dapat dijawab.
   */
  private pilihanPolling(options?: string[]) {
    if (!options || options.length === 0) return undefined;
    const bersih = [...new Set(options.map((item) => item.trim()).filter(Boolean))];
    if (bersih.length < POLLING_MIN || bersih.length > POLLING_MAKS) {
      throw new AppError('VALIDATION_ERROR', 422, `Polling perlu ${POLLING_MIN} sampai ${POLLING_MAKS} pilihan yang berbeda.`);
    }
    return bersih;
  }

  async addComment(userId: string, postId: string, body: string) {
    const post = await this.prisma.communityPost.findFirst({
      where: { id: postId, deletedAt: null, channel: { archivedAt: null, group: { archivedAt: null } } },
      select: { id: true, channel: { select: { type: true, allowReplies: true } } },
    });
    if (!post) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Post tidak ditemukan.');
    if (!post.channel.allowReplies || post.channel.type === CommunityChannelType.ANNOUNCEMENTS || post.channel.type === CommunityChannelType.CHECKLIST) throw new AppError('PERMISSION_DENIED', 403, 'Sub-channel ini tidak menerima balasan.');
    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.communityComment.create({
        data: { postId, authorId: userId, body: body.trim() },
        select: { id: true, body: true, editedAt: true, createdAt: true, author: { select: authorSelect } },
      });
      await tx.communityPost.update({ where: { id: postId }, data: { commentCount: { increment: 1 }, lastActivityAt: new Date() } });
      return created;
    });
    // Penulisnya sendiri, jadi kedua kewenangan pasti menyala; disebut tegas
    // supaya antarmuka tidak perlu menyimpulkannya sendiri.
    return { ...comment, canEdit: true, canDelete: true };
  }

  // ─────────────────────────────────────────────
  // Menyunting dan menghapus
  // ─────────────────────────────────────────────

  /**
   * Mengubah tulisan sendiri, atau item checklist sebagai Master.
   *
   * `editedAt` diisi supaya jejaknya terlihat pembaca lain. Percakapan yang
   * dapat berubah diam-diam setelah dibaca orang lebih buruk daripada
   * percakapan yang tidak dapat diubah sama sekali.
   */
  async updatePost(userId: string, postId: string, body: string, canModerate: boolean, title?: string, attachmentIds?: string[]) {
    const post = await this.prisma.communityPost.findFirst({
      where: { id: postId, deletedAt: null, channel: { archivedAt: null, group: { archivedAt: null } } },
      select: { id: true, authorId: true, title: true, body: true, channelId: true, channel: { select: { type: true } } },
    });
    if (!post) throw AppError.notFound();
    const mengelolaChecklist = canModerate && post.channel.type === CommunityChannelType.CHECKLIST;
    if (post.authorId !== userId && !mengelolaChecklist) throw AppError.permissionDenied();
    if (post.channel.type === CommunityChannelType.CHECKLIST && !title?.trim()) throw new AppError('VALIDATION_ERROR', 422, 'Judul checklist wajib diisi.');

    let removed: string[] = [];
    const updateData = {
      body: body.trim(), editedAt: new Date(),
      ...(title !== undefined ? { title: title.trim() || null } : {}),
    };
    const row = attachmentIds === undefined
      ? await this.prisma.communityPost.update({ where: { id: postId }, data: updateData, select: this.postSelect(userId) })
      : await this.prisma.$transaction(async (tx) => {
        const updated = await tx.communityPost.update({
          where: { id: postId },
          data: updateData,
          select: this.postSelect(userId),
        });
        removed = await this.attachments.replace(tx, postId, userId, attachmentIds);
        return updated;
      });
    for (const objectKey of removed) await this.attachments.removeObject(objectKey);
    if (post.authorId !== userId) {
      await this.audit.record({
        actorUserId: userId,
        action: 'community.checklist_item.update',
        targetType: 'CommunityPost',
        targetId: postId,
        before: { authorId: post.authorId, channelId: post.channelId, title: post.title, body: post.body },
        after: { body: body.trim(), title: title!.trim() },
      });
    }
    return this.sajikanPost(row, userId, canModerate);
  }

  /**
   * Menghapus tulisan: penulisnya, atau Master atas tulisan siapa pun.
   *
   * Penghapusan oleh Master dicatat ke audit lengkap dengan isi aslinya —
   * kuasa menghapus ucapan orang lain harus meninggalkan jejak yang dapat
   * ditagih, dan tanpa salinan isinya catatan itu tidak dapat ditinjau.
   */
  async deletePost(userId: string, postId: string, canModerate: boolean): Promise<void> {
    const post = await this.prisma.communityPost.findFirst({
      where: { id: postId, deletedAt: null, channel: { archivedAt: null, group: { archivedAt: null } } },
      select: { id: true, authorId: true, body: true, channelId: true },
    });
    if (!post) throw AppError.notFound();
    if (post.authorId !== userId && !canModerate) throw AppError.permissionDenied();

    // Soft delete: balasan orang lain di dalamnya tidak ikut lenyap dari
    // riwayat, sama seperti penghapusan topik di forum.
    await this.prisma.communityPost.update({ where: { id: postId }, data: { deletedAt: new Date() } });

    if (post.authorId !== userId) {
      await this.audit.record({
        actorUserId: userId,
        action: 'community.post.delete',
        targetType: 'CommunityPost',
        targetId: postId,
        before: { authorId: post.authorId, channelId: post.channelId, body: post.body },
      });
    }
  }

  /**
   * Menyematkan tulisan, atau melepas sematannya.
   *
   * Kolomnya sudah ada sejak awal dan ikut menentukan urutan feed, tetapi tidak
   * pernah ada cara menyalakannya — jadi "Disematkan" adalah lencana yang tidak
   * mungkin muncul. Kewenangannya moderasi, bukan kepemilikan: menyematkan
   * berarti memutuskan apa yang dilihat semua orang lebih dulu, dan itu bukan
   * hak penulis atas tulisannya sendiri.
   */
  async setPinned(userId: string, postId: string, isPinned: boolean) {
    const post = await this.prisma.communityPost.findFirst({
      where: { id: postId, deletedAt: null, channel: { archivedAt: null, group: { archivedAt: null } } },
      select: { id: true, isPinned: true, channelId: true },
    });
    if (!post) throw AppError.notFound();

    // Sudah pada keadaan yang diminta: jangan mengarang entri audit untuk
    // tindakan yang tidak mengubah apa pun.
    if (post.isPinned === isPinned) {
      const row = await this.prisma.communityPost.findUniqueOrThrow({
        where: { id: postId }, select: this.postSelect(userId),
      });
      return this.sajikanPost(row, userId, true);
    }

    const row = await this.prisma.communityPost.update({
      where: { id: postId }, data: { isPinned }, select: this.postSelect(userId),
    });
    await this.audit.record({
      actorUserId: userId,
      action: isPinned ? 'community.post.pin' : 'community.post.unpin',
      targetType: 'CommunityPost',
      targetId: postId,
      before: { isPinned: post.isPinned, channelId: post.channelId },
      after: { isPinned },
    });
    return this.sajikanPost(row, userId, true);
  }

  /**
   * Tulisan tersemat pada sebuah channel.
   *
   * Diambil terpisah karena sematan justru berguna pada pesan yang sudah lama
   * lewat dari layar — kalau hanya diambil bersama halaman percakapan, ia ikut
   * tergulung hilang dan sematannya tidak ada gunanya.
   */
  async listPinned(userId: string, groupSlug: string, channelSlug: string, canModerate: boolean) {
    const rows = await this.prisma.communityPost.findMany({
      where: { deletedAt: null, isPinned: true, channel: { archivedAt: null, slug: channelSlug, group: { archivedAt: null, slug: groupSlug } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      // Sematan yang terlalu banyak berhenti menjadi penanda. Batasnya keras
      // supaya bilah sematan tidak pernah menelan percakapannya.
      take: 10,
      select: this.postSelect(userId),
    });
    return rows.map((row) => this.sajikanPost(row, userId, canModerate));
  }

  async updateComment(userId: string, commentId: string, body: string) {
    const comment = await this.prisma.communityComment.findFirst({
      where: { id: commentId, deletedAt: null, post: { deletedAt: null, channel: { archivedAt: null, group: { archivedAt: null } } } },
      select: { id: true, authorId: true },
    });
    if (!comment) throw AppError.notFound();
    if (comment.authorId !== userId) throw AppError.permissionDenied();

    const row = await this.prisma.communityComment.update({
      where: { id: commentId },
      data: { body: body.trim(), editedAt: new Date() },
      select: { id: true, body: true, editedAt: true, createdAt: true, author: { select: authorSelect } },
    });
    return { ...row, canEdit: true, canDelete: true };
  }

  async deleteComment(userId: string, commentId: string, canModerate: boolean): Promise<void> {
    const comment = await this.prisma.communityComment.findFirst({
      where: { id: commentId, deletedAt: null, post: { deletedAt: null, channel: { archivedAt: null, group: { archivedAt: null } } } },
      select: { id: true, authorId: true, body: true, postId: true },
    });
    if (!comment) throw AppError.notFound();
    if (comment.authorId !== userId && !canModerate) throw AppError.permissionDenied();

    await this.prisma.$transaction(async (tx) => {
      await tx.communityComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
      // Dihitung ulang, bukan dikurangi satu: pengurangan buta dapat membawa
      // penghitungnya ke angka negatif bila pernah melenceng sekali saja.
      const commentCount = await tx.communityComment.count({ where: { postId: comment.postId, deletedAt: null } });
      await tx.communityPost.update({ where: { id: comment.postId }, data: { commentCount } });
    });

    if (comment.authorId !== userId) {
      await this.audit.record({
        actorUserId: userId,
        action: 'community.comment.delete',
        targetType: 'CommunityComment',
        targetId: commentId,
        before: { authorId: comment.authorId, postId: comment.postId, body: comment.body },
      });
    }
  }

  async toggleReaction(userId: string, postId: string) {
    const post = await this.prisma.communityPost.findFirst({
      where: { id: postId, deletedAt: null, channel: { archivedAt: null, group: { archivedAt: null } } },
      select: { id: true, channel: { select: { type: true } } },
    });
    if (!post) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Post tidak ditemukan.');
    if (post.channel.type === CommunityChannelType.ANNOUNCEMENTS) throw new AppError('PERMISSION_DENIED', 403, 'Pengumuman tidak menerima reaksi.');
    if (post.channel.type === CommunityChannelType.CHECKLIST) throw new AppError('PERMISSION_DENIED', 403, 'Checklist tidak menerima reaksi.');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.communityReaction.findUnique({ where: { postId_userId: { postId, userId } } });
      if (existing) await tx.communityReaction.delete({ where: { postId_userId: { postId, userId } } });
      else await tx.communityReaction.create({ data: { postId, userId } });
      const reactionCount = await tx.communityReaction.count({ where: { postId } });
      await tx.communityPost.update({ where: { id: postId }, data: { reactionCount } });
      return { reacted: !existing, reactionCount };
    });
  }

  async setChecklistCompleted(userId: string, postId: string, completed: boolean) {
    const post = await this.prisma.communityPost.findFirst({
      where: { id: postId, deletedAt: null, channel: { archivedAt: null, group: { archivedAt: null } } },
      select: { id: true, channel: { select: { type: true } } },
    });
    if (!post) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Item checklist tidak ditemukan.');
    if (post.channel.type !== CommunityChannelType.CHECKLIST) throw new AppError('VALIDATION_ERROR', 422, 'Tulisan ini bukan item checklist.');
    if (completed) {
      await this.prisma.communityChecklistCompletion.upsert({
        where: { postId_userId: { postId, userId } }, create: { postId, userId }, update: {},
      });
    } else {
      await this.prisma.communityChecklistCompletion.deleteMany({ where: { postId, userId } });
    }
    return { completed };
  }

  async createChannel(userId: string, input: { name: string; slug?: string; description?: string; position?: number; subchannelName: string; subchannelDescription?: string; subchannelType?: CommunityChannelType; isReadOnly?: boolean; allowReplies?: boolean; showInSidebar?: boolean }) {
    const slug = input.slug ?? input.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) throw new AppError('VALIDATION_ERROR', 422, 'Nama channel tidak menghasilkan slug yang valid.');
    const subchannelSlug = input.subchannelName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!subchannelSlug) throw new AppError('VALIDATION_ERROR', 422, 'Nama sub-channel tidak menghasilkan slug yang valid.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const channel = await tx.communityChannelGroup.create({
          data: { name: input.name.trim(), slug, description: input.description, position: input.position, showInSidebar: input.showInSidebar, createdBy: userId },
        });
        const type = input.subchannelType ?? CommunityChannelType.CHAT;
        const subchannel = await tx.communityChannel.create({
          data: { groupId: channel.id, name: input.subchannelName.trim(), slug: subchannelSlug, description: input.subchannelDescription, type, isReadOnly: type === CommunityChannelType.ANNOUNCEMENTS ? true : input.isReadOnly, allowReplies: type === CommunityChannelType.ANNOUNCEMENTS ? false : input.allowReplies, showInSidebar: input.showInSidebar, createdBy: userId },
        });
        return { ...channel, subchannels: [{ ...subchannel, postCount: 0, checklistCompletedCount: 0 }] };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError('VALIDATION_ERROR', 422, 'Slug channel sudah digunakan.');
      throw error;
    }
  }

  async updateChannel(id: string, input: { name?: string; slug?: string; description?: string; position?: number; showInSidebar?: boolean }) {
    const exists = await this.prisma.communityChannelGroup.findUnique({ where: { id } });
    if (!exists) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Channel tidak ditemukan.');
    await this.prisma.communityChannelGroup.update({ where: { id }, data: input });
    return (await this.listChannels(true)).find((item) => item.id === id)!;
  }

  /**
   * Mengarsipkan channel: menyembunyikannya beserta seluruh isinya.
   *
   * Isinya tidak dihapus, hanya tersaring dari setiap pertanyaan. Karena satu
   * tekan tombol dapat melenyapkan seluruh percakapan sebuah ruang dari mata
   * semua orang, tindakannya dicatat — dan `restoreChannel` adalah jalan
   * pulangnya.
   */
  async archiveChannel(userId: string, id: string) {
    const channel = await this.prisma.communityChannelGroup.findUnique({
      where: { id }, select: { id: true, name: true, slug: true, archivedAt: true },
    });
    if (!channel) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Channel tidak ditemukan.');
    if (channel.archivedAt) return;

    await this.prisma.communityChannelGroup.update({ where: { id }, data: { archivedAt: new Date() } });
    await this.audit.record({
      actorUserId: userId,
      action: 'community.channel.archive',
      targetType: 'CommunityChannelGroup',
      targetId: id,
      before: { name: channel.name, slug: channel.slug },
    });
  }

  /**
   * Mengembalikan channel yang diarsipkan, beserta seluruh isinya.
   *
   * Slug-nya tidak pernah dilepas selama diarsipkan — kolomnya unik global —
   * sehingga tidak ada channel lain yang sempat merebutnya dan pemulihan ini
   * tidak dapat bertabrakan.
   */
  async restoreGroup(userId: string, id: string) {
    const channel = await this.prisma.communityChannelGroup.findUnique({ where: { id } });
    if (!channel) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Channel tidak ditemukan.');

    await this.prisma.communityChannelGroup.update({ where: { id }, data: { archivedAt: null } });
    if (channel.archivedAt) {
      await this.audit.record({
        actorUserId: userId,
        action: 'community.channel.restore',
        targetType: 'CommunityChannelGroup',
        targetId: id,
        before: { archivedAt: channel.archivedAt },
      });
    }
    return (await this.listChannels(true)).find((item) => item.id === id)!;
  }

  async deleteChannelPermanently(userId: string, id: string) {
    const channel = await this.prisma.communityChannelGroup.findUnique({
      where: { id }, select: { id: true, name: true, slug: true, archivedAt: true },
    });
    if (!channel) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Channel tidak ditemukan.');
    if (!channel.archivedAt) throw new AppError('VALIDATION_ERROR', 422, 'Arsipkan channel sebelum menghapusnya permanen.');
    await this.audit.record({
      actorUserId: userId, action: 'community.channel.delete_permanently',
      targetType: 'CommunityChannelGroup', targetId: id,
      before: { name: channel.name, slug: channel.slug, archivedAt: channel.archivedAt },
    });
    await this.prisma.communityChannelGroup.delete({ where: { id } });
  }

  async createSubchannel(userId: string, groupId: string, input: { name: string; slug?: string; description?: string; position?: number; type?: CommunityChannelType; isReadOnly?: boolean; allowReplies?: boolean; showInSidebar?: boolean }) {
    const group = await this.prisma.communityChannelGroup.findFirst({ where: { id: groupId, archivedAt: null } });
    if (!group) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Channel tidak ditemukan.');
    const slug = input.slug ?? input.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) throw new AppError('VALIDATION_ERROR', 422, 'Nama sub-channel tidak menghasilkan slug yang valid.');
    try {
      const type = input.type ?? CommunityChannelType.CHAT;
      const subchannel = await this.prisma.communityChannel.create({ data: { ...input, type, isReadOnly: type === CommunityChannelType.ANNOUNCEMENTS ? true : input.isReadOnly, allowReplies: type === CommunityChannelType.ANNOUNCEMENTS ? false : input.allowReplies, groupId, slug, name: input.name.trim(), createdBy: userId } });
      return { ...subchannel, postCount: 0, checklistCompletedCount: 0 };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError('VALIDATION_ERROR', 422, 'Slug sub-channel sudah digunakan dalam channel ini.');
      throw error;
    }
  }

  async updateSubchannel(id: string, input: { name?: string; slug?: string; description?: string; position?: number; type?: CommunityChannelType; isReadOnly?: boolean; allowReplies?: boolean; showInSidebar?: boolean }) {
    const exists = await this.prisma.communityChannel.findUnique({ where: { id } });
    if (!exists) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Sub-channel tidak ditemukan.');
    const [subchannel, postCount] = await this.prisma.$transaction([
      this.prisma.communityChannel.update({ where: { id }, data: { ...input, ...(input.type === CommunityChannelType.ANNOUNCEMENTS ? { isReadOnly: true, allowReplies: false } : {}) } }),
      this.prisma.communityPost.count({ where: { channelId: id, deletedAt: null } }),
    ]);
    return { ...subchannel, postCount, checklistCompletedCount: 0 };
  }

  async archiveSubchannel(userId: string, id: string) {
    const subchannel = await this.prisma.communityChannel.findUnique({ where: { id } });
    if (!subchannel) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Sub-channel tidak ditemukan.');
    if (subchannel.archivedAt) return;
    const activeSiblings = await this.prisma.communityChannel.count({ where: { groupId: subchannel.groupId, archivedAt: null } });
    if (activeSiblings <= 1) throw new AppError('VALIDATION_ERROR', 422, 'Channel harus memiliki minimal satu sub-channel aktif.');
    await this.prisma.communityChannel.update({ where: { id }, data: { archivedAt: new Date() } });
    await this.audit.record({ actorUserId: userId, action: 'community.subchannel.archive', targetType: 'CommunityChannel', targetId: id, before: { name: subchannel.name, slug: subchannel.slug } });
  }

  async restoreSubchannel(userId: string, id: string) {
    const subchannel = await this.prisma.communityChannel.findUnique({ where: { id } });
    if (!subchannel) throw new AppError('RESOURCE_NOT_FOUND', 404, 'Sub-channel tidak ditemukan.');
    const [restored, postCount] = await this.prisma.$transaction([
      this.prisma.communityChannel.update({ where: { id }, data: { archivedAt: null } }),
      this.prisma.communityPost.count({ where: { channelId: id, deletedAt: null } }),
    ]);
    if (subchannel.archivedAt) await this.audit.record({ actorUserId: userId, action: 'community.subchannel.restore', targetType: 'CommunityChannel', targetId: id, before: { archivedAt: subchannel.archivedAt } });
    return { ...restored, postCount, checklistCompletedCount: 0 };
  }
}
