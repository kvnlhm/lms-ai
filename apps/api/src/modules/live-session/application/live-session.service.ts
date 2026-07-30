import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
import { EnrollmentAccessService } from '../../enrollment/application/enrollment-access.service';

/**
 * Penyedia rapat daring yang tautannya diterima. Daftar tertutup ini menutup
 * dua hal sekaligus: salah tempel URL sembarangan, dan penyalahgunaan kolom
 * ini untuk menyebar tautan ke mana pun kepada seluruh peserta kursus.
 */
const ALLOWED_MEETING_HOSTS = [
  'zoom.us',
  'zoomgov.com',
  'meet.google.com',
  'teams.microsoft.com',
  'teams.live.com',
  'whereby.com',
  'meet.jit.si',
] as const;

export function isAllowedMeetingUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return false;
  }
  // Tautan rapat selalu https; http membocorkan tautannya di jaringan.
  if (url.protocol !== 'https:') return false;

  const host = url.hostname.toLowerCase();
  return ALLOWED_MEETING_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

interface UpsertInput {
  courseId: string;
  title: string;
  description?: string;
  joinUrl: string;
  startsAt: Date;
  durationMinutes: number;
}

@Injectable()
export class LiveSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EnrollmentAccessService,
  ) {}

  /**
   * Jadwal untuk pelajar. Tautan gabung hanya menyertai sesi yang belum
   * berakhir, supaya tautan lama tidak terus beredar setelah kelasnya usai.
   */
  async forLearner(userId: string, courseId: string) {
    await this.access.assertActiveAccess(userId, courseId);
    const now = new Date();
    const sessions = await this.prisma.liveSession.findMany({
      where: { courseId, cancelledAt: null },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        startsAt: true,
        durationMinutes: true,
        joinUrl: true,
      },
    });

    return sessions.map((session) => {
      const endsAt = new Date(session.startsAt.getTime() + session.durationMinutes * 60_000);
      const hasEnded = endsAt <= now;
      // Tombol gabung dibuka sejak 15 menit sebelum mulai.
      const opensAt = new Date(session.startsAt.getTime() - 15 * 60_000);
      const joinable = !hasEnded && now >= opensAt;
      return {
        id: session.id,
        title: session.title,
        description: session.description,
        startsAt: session.startsAt,
        durationMinutes: session.durationMinutes,
        endsAt,
        status: hasEnded ? ('ENDED' as const) : joinable ? ('LIVE' as const) : ('UPCOMING' as const),
        joinUrl: hasEnded ? null : session.joinUrl,
      };
    });
  }

  async list(courseId?: string) {
    return this.prisma.liveSession.findMany({
      where: courseId ? { courseId } : {},
      orderBy: { startsAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        joinUrl: true,
        startsAt: true,
        durationMinutes: true,
        cancelledAt: true,
        course: { select: { id: true, title: true } },
      },
    });
  }

  async create(input: UpsertInput, createdBy: string) {
    this.assertValid(input);
    const course = await this.prisma.course.count({ where: { id: input.courseId } });
    if (!course) throw AppError.validation({ courseId: ['Kursus tidak ditemukan.'] });

    return this.prisma.liveSession.create({
      data: {
        courseId: input.courseId,
        title: input.title,
        description: input.description ?? null,
        joinUrl: input.joinUrl.trim(),
        startsAt: input.startsAt,
        durationMinutes: input.durationMinutes,
        createdBy,
      },
      select: { id: true, title: true, startsAt: true, durationMinutes: true },
    });
  }

  async update(id: string, input: Partial<UpsertInput>) {
    const existing = await this.prisma.liveSession.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw AppError.notFound();
    if (input.joinUrl !== undefined && !isAllowedMeetingUrl(input.joinUrl)) {
      throw AppError.validation({ joinUrl: [this.hostHint()] });
    }
    if (input.durationMinutes !== undefined) this.assertDuration(input.durationMinutes);

    return this.prisma.liveSession.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        joinUrl: input.joinUrl?.trim(),
        startsAt: input.startsAt,
        durationMinutes: input.durationMinutes,
      },
      select: { id: true, title: true, startsAt: true, durationMinutes: true },
    });
  }

  /** Membatalkan, bukan menghapus: pelajar yang sudah mencatat jadwalnya
   *  sebaiknya melihat sesi itu hilang dari daftar, dan Master tetap punya
   *  riwayatnya. */
  async cancel(id: string): Promise<void> {
    const existing = await this.prisma.liveSession.findFirst({
      where: { id, cancelledAt: null },
      select: { id: true },
    });
    if (!existing) throw AppError.notFound();
    await this.prisma.liveSession.update({
      where: { id },
      data: { cancelledAt: new Date() },
    });
  }

  private assertValid(input: UpsertInput): void {
    if (!isAllowedMeetingUrl(input.joinUrl)) {
      throw AppError.validation({ joinUrl: [this.hostHint()] });
    }
    this.assertDuration(input.durationMinutes);
  }

  private assertDuration(minutes: number): void {
    if (minutes < 5 || minutes > 600) {
      throw AppError.validation({ durationMinutes: ['Durasi harus antara 5 dan 600 menit.'] });
    }
  }

  private hostHint(): string {
    return `Tautan harus https dan berasal dari penyedia rapat yang didukung: ${ALLOWED_MEETING_HOSTS.join(', ')}.`;
  }
}
