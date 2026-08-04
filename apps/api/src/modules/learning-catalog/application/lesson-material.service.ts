import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { chmod, mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import type { AppConfig } from '../../../config/configuration';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
import { EnrollmentAccessService } from '../../enrollment/application/enrollment-access.service';

/** Setiap PDF diawali `%PDF-`; empat byte pertama sudah cukup memastikannya. */
const TANDA_PDF = '%PDF';

/**
 * Berkas materi pelajaran, mis. PDF.
 *
 * Sebelumnya jenis pelajaran PDF hanya dapat menunjuk `externalUrl`, sehingga
 * satu-satunya cara memberi dokumen adalah menaruhnya di layanan lain dengan
 * tautan yang dapat disalin dan dibagikan siapa pun. Berkas di sini tidak
 * pernah punya URL publik: penyajiannya melewati pemeriksaan hak yang sama
 * dengan video, lalu diserahkan ke reverse proxy lewat X-Accel-Redirect.
 */
@Injectable()
export class LessonMaterialService {
  private readonly config: AppConfig['lessonMaterial'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EnrollmentAccessService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.config = config.get('app', { infer: true }).lessonMaterial;
  }

  /**
   * Menerima unggahan sebagai aliran, bukan menampungnya lebih dulu di memori.
   *
   * Isinya diperiksa sambil mengalir: byte awal harus benar-benar `%PDF`, dan
   * panjangnya harus cocok dengan `Content-Length`. Berkas ditulis ke nama
   * sementara dan baru dipindahkan setelah keduanya terbukti, sehingga
   * kegagalan di tengah jalan tidak pernah meninggalkan PDF setengah jadi yang
   * terlanjur dianggap sah.
   */
  async upload(
    lessonId: string,
    userId: string,
    stream: Readable,
    originalName: string,
    contentLength: number | undefined,
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, material: { select: { id: true, objectKey: true } } },
    });
    if (!lesson) throw AppError.notFound();

    if (!contentLength || contentLength < 1) {
      throw AppError.validation({ contentLength: ['Content-Length wajib diisi.'] });
    }
    if (contentLength > this.config.maxUploadBytes) {
      throw AppError.validation({
        contentLength: [`Ukuran materi melewati batas ${this.config.maxUploadBytes} byte.`],
      });
    }

    const objectKey = `${randomUUID()}.pdf`;
    const tempPath = join(this.config.storagePath, `${objectKey}.uploading`);
    const finalPath = join(this.config.storagePath, objectKey);
    // Gateway memasang volume ini read-only dan berjalan sebagai user lain:
    // direktorinya perlu dapat dilintasi, berkasnya perlu dapat dibaca.
    await mkdir(this.config.storagePath, { recursive: true, mode: 0o755 });
    await chmod(this.config.storagePath, 0o755);

    let bytes = 0;
    let awal = Buffer.alloc(0);
    const pemeriksa = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > contentLength) return callback(new Error('Unggahan melebihi Content-Length.'));
        if (awal.length < 4) awal = Buffer.concat([awal, chunk]).subarray(0, 4);
        callback(null, chunk);
      },
    });

    try {
      await pipeline(stream, pemeriksa, createWriteStream(tempPath, { flags: 'wx', mode: 0o644 }));
      if (bytes !== contentLength) throw new Error('Unggahan tidak lengkap.');
      if (awal.toString('ascii') !== TANDA_PDF) throw new Error('Berkas bukan PDF.');
      await rename(tempPath, finalPath);
    } catch (error) {
      await rm(tempPath, { force: true });
      throw AppError.validation({
        file: [error instanceof Error ? error.message : 'Materi gagal diunggah.'],
      });
    }

    const material = await this.prisma.lessonMaterial.upsert({
      where: { lessonId },
      create: {
        lessonId,
        objectKey,
        originalName: originalName.replace(/[^\w.\- ]/g, '_').slice(0, 255),
        mimeType: 'application/pdf',
        sizeBytes: BigInt(contentLength),
        createdBy: userId,
      },
      update: {
        objectKey,
        originalName: originalName.replace(/[^\w.\- ]/g, '_').slice(0, 255),
        sizeBytes: BigInt(contentLength),
        createdBy: userId,
      },
    });

    // Berkas lama dibuang setelah barisnya menunjuk yang baru, bukan sebelum:
    // kalau urutannya terbalik dan penyimpanannya gagal, pelajaran itu akan
    // menunjuk berkas yang sudah tidak ada.
    if (lesson.material && lesson.material.objectKey !== objectKey) {
      await rm(join(this.config.storagePath, lesson.material.objectKey), { force: true });
    }

    return this.sajikan(material);
  }

  async remove(lessonId: string): Promise<void> {
    const material = await this.prisma.lessonMaterial.findUnique({ where: { lessonId } });
    if (!material) throw AppError.notFound();
    await this.prisma.lessonMaterial.delete({ where: { lessonId } });
    await rm(join(this.config.storagePath, material.objectKey), { force: true });
  }

  /**
   * Kunci berkas untuk pelajar yang berhak, dipakai reverse proxy.
   *
   * Haknya diperiksa di sini dan hanya di sini; `objectKey` tidak pernah keluar
   * ke browser, sehingga mengetahui id pelajaran saja tidak memberi akses.
   */
  async authorisedObject(lessonId: string, userId: string): Promise<string> {
    await this.access.assertLessonAccess(userId, lessonId);
    const material = await this.prisma.lessonMaterial.findUnique({ where: { lessonId } });
    if (!material) throw AppError.notFound();
    return material.objectKey;
  }

  private sajikan(material: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: bigint;
    createdAt: Date;
  }) {
    return {
      id: material.id,
      originalName: material.originalName,
      mimeType: material.mimeType,
      // String, bukan angka: ukuran berkas dapat melampaui batas aman JSON.
      sizeBytes: material.sizeBytes.toString(),
      createdAt: material.createdAt,
    };
  }
}
