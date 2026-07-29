import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/prisma.service';
import { readNumber, readString, type EventJob } from './event-job';

/**
 * Menulis fakta perilaku belajar ke `learning_events`.
 *
 * Idempotensi datang dari constraint unik pada `event_uuid`: percobaan kedua
 * atas event yang sama ditolak database (P2002) dan diperlakukan sebagai
 * sudah selesai. Ini bertahan terhadap pengiriman ganda dari relay maupun
 * percobaan ulang BullMQ, tanpa perlu penguncian tambahan.
 */
@Injectable()
export class AnalyticsProcessor {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(job: EventJob): Promise<{ stored: boolean }> {
    const payload = job.payload ?? {};

    try {
      await this.prisma.learningEvent.create({
        data: {
          eventUuid: job.eventId,
          eventName: job.eventType,
          schemaVersion: job.schemaVersion,
          userId: readString(payload, 'userId'),
          learningSession: readString(payload, 'learningSessionId'),
          courseId: readString(payload, 'courseId'),
          lessonId: readString(payload, 'lessonId'),
          occurredAt: new Date(job.occurredAt),
          durationSeconds: readNumber(payload, 'activeSeconds'),
          source: readString(payload, 'source') ?? 'COURSE_PLAYER',
          metadata: payload as Prisma.InputJsonValue,
        },
      });
      return { stored: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        this.logger.debug(`Event ${job.eventId} sudah tercatat; dilewati.`);
        return { stored: false };
      }
      throw error;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
