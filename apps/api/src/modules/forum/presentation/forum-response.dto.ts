import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ForumReportStatus, ForumTopicStatus } from '@prisma/client';

/**
 * Bentuk respons forum yang dinyatakan eksplisit.
 *
 * Sebelumnya ke-24 handler forum tidak punya satu pun skema respons, sehingga
 * dokumen OpenAPI hanya menyebut "200 OK" tanpa isi dan client hasil generate
 * mengembalikan `unknown` — memaksa sisi web melakukan cast buta yang tidak
 * pernah diperiksa siapa pun.
 *
 * Kelas-kelas ini mendokumentasikan apa yang benar-benar dikirim. Bila suatu
 * saat `select` di service diganti `include`, perbedaannya menjadi terlihat di
 * sini alih-alih diam-diam ikut terkirim.
 */
export class ForumAuthorDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fullName!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) avatarUrl!: string | null;
}

export class ForumReactionCountDto {
  @ApiProperty() reactions!: number;
}

export class ForumTopicListItemDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: ForumTopicStatus }) status!: ForumTopicStatus;
  @ApiProperty() isPinned!: boolean;
  @ApiProperty() replyCount!: number;
  @ApiProperty({ format: 'date-time' }) lastActivityAt!: Date;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' }) lessonId!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' }) moduleId!: string | null;
  @ApiProperty({ type: ForumAuthorDto }) author!: ForumAuthorDto;
  @ApiProperty({ type: ForumReactionCountDto }) _count!: ForumReactionCountDto;
}

export class ForumReplyDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
  @ApiProperty({ type: ForumAuthorDto }) author!: ForumAuthorDto;
  @ApiProperty({ type: ForumReactionCountDto }) _count!: ForumReactionCountDto;

  @ApiProperty({ description: 'Benar bila pengguna ini sedang menyukainya.' })
  reactedByMe!: boolean;
}

export class ForumTopicDetailDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) courseId!: string;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' }) moduleId!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' }) lessonId!: string | null;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ enum: ForumTopicStatus }) status!: ForumTopicStatus;
  @ApiProperty() isPinned!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  bestReplyId!: string | null;
  @ApiProperty() replyCount!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
  @ApiProperty({ type: ForumAuthorDto }) author!: ForumAuthorDto;
  @ApiProperty({ type: ForumReactionCountDto }) _count!: ForumReactionCountDto;
  @ApiProperty({ type: [ForumReplyDto] }) replies!: ForumReplyDto[];

  @ApiProperty({
    description: 'Salah bila diskusi terkunci atau hak berpartisipasi sedang dicabut',
  })
  canParticipate!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  participationBlockedReason!: string | null;

  /**
   * Reaksi adalah saklar: menekannya dua kali mengembalikan keadaan semula.
   * Tanpa penanda ini antarmuka tidak dapat menunjukkan mana yang sedang
   * disukai pengguna, sehingga setelah halaman dimuat ulang ia hanya melihat
   * angka tanpa tahu apakah dirinya termasuk di dalamnya.
   */
  @ApiProperty({ description: 'Benar bila pengguna ini sedang menyukai topiknya.' })
  reactedByMe!: boolean;

  @ApiProperty({ description: 'Benar bila topik ini milik pengguna dan masih boleh diubah.' })
  canManage!: boolean;
}

export class ForumTopicCreatedDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: ForumTopicStatus }) status!: ForumTopicStatus;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}

export class ForumTopicUpdatedDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

export class ForumReplyCreatedDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}

export class ForumReplyUpdatedDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

export class ForumReactionResultDto {
  @ApiProperty({ description: 'Keadaan setelah tombol ditekan' }) reacted!: boolean;
  @ApiProperty() total!: number;
}

export class ForumReportCreatedDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ForumReportStatus }) status!: ForumReportStatus;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}

// ── Sisi moderasi ──────────────────────────────────────────────

export class ForumCourseRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
}

/**
 * Penulis dari mata Master.
 *
 * Sengaja berbeda dari `ForumAuthorDto`: `authorSelect` di
 * `ForumModerationService` mengirim surel dan tidak mengirim foto, kebalikan
 * dari yang dilihat sesama pelajar. Selama keduanya memakai satu kelas, sisi
 * web merender `author.avatarUrl` yang tidak pernah ada — cabang yang mustahil
 * menyala — sementara surelnya, satu-satunya cara membedakan dua pelajar
 * bernama sama sebelum mencabut haknya, tidak pernah terlihat.
 */
export class ModerationAuthorDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ format: 'email' }) email!: string;
}

// Harus berada di atas pemakainya: dekorator dievaluasi saat kelas
// didefinisikan, jadi rujukan ke kelas yang belum dideklarasikan akan melempar
// ReferenceError saat modul dimuat — bukan saat endpointnya dipanggil.
export class ForumReportCountDto {
  @ApiProperty() reports!: number;
}

export class ModerationCountDto {
  @ApiProperty() reports!: number;
  @ApiProperty() reactions!: number;
}

export class ModerationReplyDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ description: 'Benar bila balasan ini tidak terlihat pelajar.' })
  isHidden!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) moderationReason!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
  @ApiProperty({ type: ModerationAuthorDto }) author!: ModerationAuthorDto;
  @ApiProperty({ type: ModerationCountDto }) _count!: ModerationCountDto;
}

/**
 * Isi utuh satu diskusi, termasuk balasan yang disembunyikan.
 *
 * Pelajar mendapat `ForumTopicDetailDto` yang menyaringnya; Master justru
 * membutuhkannya untuk dapat menampilkannya kembali.
 */
export class ModerationTopicThreadDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) courseId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ enum: ForumTopicStatus }) status!: ForumTopicStatus;
  @ApiProperty() isPinned!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  bestReplyId!: string | null;
  @ApiProperty() replyCount!: number;
  @ApiPropertyOptional({ type: String, nullable: true }) moderationReason!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  moderatedAt!: Date | null;
  @ApiProperty({ format: 'date-time' }) lastActivityAt!: Date;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: ModerationAuthorDto }) author!: ModerationAuthorDto;
  @ApiProperty({ type: ForumCourseRefDto }) course!: ForumCourseRefDto;
  @ApiProperty({ type: ModerationCountDto }) _count!: ModerationCountDto;
  @ApiProperty({ type: [ModerationReplyDto] }) replies!: ModerationReplyDto[];
}

export class ModerationTopicListItemDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: ForumTopicStatus }) status!: ForumTopicStatus;
  @ApiProperty() isPinned!: boolean;
  @ApiProperty() replyCount!: number;
  @ApiProperty({ format: 'date-time' }) lastActivityAt!: Date;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiPropertyOptional({ type: String, nullable: true }) moderationReason!: string | null;
  @ApiProperty({ type: ModerationAuthorDto }) author!: ModerationAuthorDto;
  @ApiProperty({ type: ForumCourseRefDto }) course!: ForumCourseRefDto;
  @ApiProperty({ type: ForumReportCountDto }) _count!: ForumReportCountDto;
}

export class TopicStatusChangedDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ForumTopicStatus }) status!: ForumTopicStatus;
  @ApiPropertyOptional({ type: String, nullable: true }) moderationReason!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  moderatedAt!: Date | null;
}

export class TopicPinnedDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() isPinned!: boolean;
}

export class TopicBestReplyDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  bestReplyId!: string | null;
  @ApiProperty({ enum: ForumTopicStatus }) status!: ForumTopicStatus;
}

export class ReplyHiddenDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() isHidden!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) moderationReason!: string | null;
}

export class ForumTopicRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ enum: ForumTopicStatus }) status?: ForumTopicStatus;
}

export class ReportedReplyDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() body!: string;
  @ApiProperty() isHidden!: boolean;
  @ApiProperty({ type: ForumTopicRefDto }) topic!: ForumTopicRefDto;
}

export class ForumReportListItemDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() reason!: string;
  @ApiProperty({ enum: ForumReportStatus }) status!: ForumReportStatus;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: ModerationAuthorDto }) reporter!: ModerationAuthorDto;
  @ApiPropertyOptional({ type: ForumTopicRefDto, nullable: true })
  topic!: ForumTopicRefDto | null;
  @ApiPropertyOptional({ type: ReportedReplyDto, nullable: true })
  reply!: ReportedReplyDto | null;
}

export class ForumReportResolvedDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ForumReportStatus }) status!: ForumReportStatus;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  reviewedAt!: Date | null;
}

export class ForumBanDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() reason!: string;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  expiresAt!: Date | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  revokedAt!: Date | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: ModerationAuthorDto }) user!: ModerationAuthorDto;
  @ApiProperty({ type: ModerationAuthorDto }) issuer!: ModerationAuthorDto;
  @ApiPropertyOptional({ type: ForumCourseRefDto, nullable: true })
  course!: ForumCourseRefDto | null;
}

export class ForumBanCreatedDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() reason!: string;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  expiresAt!: Date | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}

export class ForumBanRevokedDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  revokedAt!: Date | null;
}
