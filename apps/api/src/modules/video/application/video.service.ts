import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlaybackStatus, Prisma, VideoProvider, VideoStatus } from '@prisma/client';
import { createHmac, randomUUID } from 'node:crypto';
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
import type { LessonVideoCleanupPort } from '../../learning-catalog/application/lesson-video-cleanup.port';
import { BunnyStreamClient } from '../infrastructure/bunny-stream.client';

interface UploadIntent {
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

interface YoutubeVideoInput {
  title: string;
  url: string;
}

/** Status yang berarti berkasnya masih dalam perjalanan dan belum boleh disentuh. */
const PENDING_STATUSES = new Set<VideoStatus>([
  VideoStatus.CREATED,
  VideoStatus.UPLOADING,
  VideoStatus.PROCESSING,
]);

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'youtube-nocookie.com']);

const BUNNY_GUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * GUID video Bunny dari apa pun yang ditempel Master.
 *
 * Orang menempel bermacam hal: GUID telanjang dari dashboard, tautan
 * `iframe.mediadelivery.net/play/…`, atau URL playlist. Yang diambil hanya
 * GUID-nya, dan itulah satu-satunya bagian yang kelak dipakai — URL pemutaran
 * selalu kita susun sendiri dari hostname CDN milik kita, sehingga host apa pun
 * yang ikut tertempel tidak pernah sampai ke pemutar pelajar.
 */
export function parseBunnyVideoId(input: string): string | null {
  const cocok = BUNNY_GUID_PATTERN.exec(input.trim());
  return cocok ? cocok[0].toLowerCase() : null;
}

/** Base64 URL-safe tanpa padding, bentuk yang diminta Bunny. */
function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\n/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * URL playlist HLS Bunny untuk satu video.
 *
 * Tokennya ditanam di **path**, bukan di query string, dan menandatangani
 * seluruh direktori video — bukan satu berkas. Keduanya disengaja, dan
 * keduanya lahir dari bentuk HLS itu sendiri: memutar satu video menuntut tiga
 * lapis permintaan ke path yang berbeda-beda.
 *
 *     /{guid}/playlist.m3u8        induk
 *     /{guid}/720p/video.m3u8      varian, ditunjuk secara relatif
 *     /{guid}/720p/video0.ts       puluhan segmen
 *
 * Menandatangani satu berkas hanya melindungi lapisan pertama; sisanya ditolak
 * 403 dan videonya tidak jalan sama sekali. Menaruh token di query string juga
 * tidak cukup, karena URL relatif di dalam playlist tidak mewarisi query induk
 * — baik pada `hls.js` maupun pemutar bawaan Safari. Sebagai segmen path, ia
 * ikut terbawa dengan sendirinya, sehingga tidak ada pemutar yang perlu ditambal.
 *
 * Skema dan bentuknya tidak diambil dari dokumentasi saja, tetapi diuji satu
 * per satu terhadap pull zone ini: yang diterima adalah HMAC-SHA256 atas
 * `direktori + expires` dengan awalan `HS256-`. Tokennya juga terbukti
 * terbatas pada direktorinya — dipakai untuk GUID lain, CDN menjawab 403.
 *
 * Selama `tokenAuthKey` kosong, URL dikirim tanpa tanda tangan dan
 * perlindungannya bersandar pada pembatasan referrer di sisi Bunny, yang
 * menahan hotlink biasa tetapi dapat dipalsukan.
 */
export function bunnyPlaylistUrl(
  config: { cdnHostname?: string; tokenAuthKey?: string },
  videoId: string,
  expiresAt: Date,
): string | null {
  if (!config.cdnHostname) return null;
  const dir = `/${videoId}/`;
  if (!config.tokenAuthKey) return `https://${config.cdnHostname}${dir}playlist.m3u8`;

  const expires = Math.floor(expiresAt.getTime() / 1000);
  const token = `HS256-${base64url(
    createHmac('sha256', config.tokenAuthKey).update(`${dir}${expires}`).digest(),
  )}`;
  return `https://${config.cdnHostname}/bcdn_token=${token}&expires=${expires}${dir}playlist.m3u8`;
}

/**
 * Mengambil ID video dari berbagai bentuk tautan YouTube yang biasa disalin
 * orang: `watch?v=`, `youtu.be/`, `/embed/`, dan `/shorts/`.
 *
 * Mengembalikan `null` bila tautan bukan YouTube atau ID-nya tidak berbentuk
 * sah, sehingga pemanggil dapat menolak masukan alih-alih menyimpan tautan
 * yang nantinya gagal diputar.
 */
export function parseYoutubeVideoId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  let candidate: string | null = null;

  if (host === 'youtu.be') {
    candidate = url.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (url.pathname === '/watch') {
      candidate = url.searchParams.get('v');
    } else {
      const [segment, value] = url.pathname.split('/').filter(Boolean);
      if (segment === 'embed' || segment === 'shorts' || segment === 'live') {
        candidate = value ?? null;
      }
    }
  }

  return candidate && YOUTUBE_ID_PATTERN.test(candidate) ? candidate : null;
}

/**
 * Membuat identitas yang tetap berguna untuk menelusuri rekaman bocor tanpa
 * menampilkan alamat email lengkap pelajar di layar.
 */
export function playbackWatermarkText(
  fullName: string,
  email: string,
  playbackSessionId: string,
): string {
  const [local = '', domain = ''] = email.trim().toLowerCase().split('@');
  const maskedLocal = local.length <= 2
    ? `${local.slice(0, 1)}*`
    : `${local.slice(0, 2)}${'*'.repeat(Math.min(4, local.length - 2))}`;
  const maskedEmail = domain ? `${maskedLocal}@${domain}` : maskedLocal;
  return `${fullName.trim()} · ${maskedEmail} · ${playbackSessionId.slice(0, 8).toUpperCase()}`;
}

@Injectable()
export class VideoService implements LessonVideoCleanupPort {
  private readonly config: AppConfig['video'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EnrollmentAccessService,
    private readonly bunny: BunnyStreamClient,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.config = config.get('app', { infer: true }).video;
  }

  async createUploadIntent(input: UploadIntent, userId: string) {
    if (this.config.provider !== 'SELF_HOSTED') {
      throw AppError.validation({ provider: ['Provider video yang dikonfigurasi belum didukung.'] });
    }
    if (input.mimeType !== 'video/mp4' || !input.fileName.toLowerCase().endsWith('.mp4')) {
      throw AppError.validation({ file: ['Hanya file MP4 yang didukung.'] });
    }
    if (input.sizeBytes < 1 || input.sizeBytes > this.config.maxUploadBytes) {
      throw AppError.validation({
        sizeBytes: [`Ukuran video harus antara 1 dan ${this.config.maxUploadBytes} byte.`],
      });
    }
    // Tidak ada pelajaran yang disebut di sini. Unggahan masuk ke perpustakaan
    // lebih dulu, lalu pelajaran memilihnya lewat `attachToLesson`. Itulah yang
    // membuat satu berkas dapat dipakai banyak pelajaran tanpa disalin.
    const providerVideoId = randomUUID();
    const asset = await this.prisma.videoAsset.create({
      data: {
        createdBy: userId,
        provider: VideoProvider.SELF_HOSTED,
        providerVideoId,
        originalName: input.fileName.replace(/[^\w.\- ]/g, '_').slice(0, 255),
        title: input.title,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.sizeBytes),
      },
    });
    return {
      videoAssetId: asset.id,
      provider: asset.provider,
      providerVideoId,
      uploadUrl: `/api/v1/admin/videos/${asset.id}/content`,
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(input.sizeBytes) },
    };
  }

  async upload(assetId: string, userId: string, stream: Readable, contentLength: number | undefined) {
    const asset = await this.prisma.videoAsset.findFirst({
      where: { id: assetId, createdBy: userId, deletedAt: null, status: VideoStatus.CREATED },
    });
    if (!asset) throw AppError.notFound();
    if (!contentLength || contentLength !== Number(asset.sizeBytes)) {
      throw AppError.validation({ contentLength: ['Content-Length harus sama dengan upload intent.'] });
    }
    if (contentLength > this.config.maxUploadBytes) {
      throw AppError.validation({ contentLength: ['Ukuran video melewati batas.'] });
    }

    const objectKey = `${asset.id}.mp4`;
    const tempPath = join(this.config.storagePath, `${objectKey}.uploading`);
    const finalPath = join(this.config.storagePath, objectKey);
    // Gateway Nginx berjalan dengan user berbeda dan memasang volume ini
    // read-only. Direktori perlu dapat dilintasi dan MP4 perlu dapat dibaca,
    // sementara mutation tetap hanya tersedia pada volume milik API.
    await mkdir(this.config.storagePath, { recursive: true, mode: 0o755 });
    await chmod(this.config.storagePath, 0o755);
    await this.prisma.videoAsset.update({
      where: { id: asset.id },
      data: { status: VideoStatus.UPLOADING },
    });

    let bytes = 0;
    let header = Buffer.alloc(0);
    const validator = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > contentLength) return callback(new Error('Upload melebihi Content-Length.'));
        if (header.length < 12) header = Buffer.concat([header, chunk]).subarray(0, 12);
        callback(null, chunk);
      },
    });

    try {
      await pipeline(stream, validator, createWriteStream(tempPath, { flags: 'wx', mode: 0o644 }));
      if (bytes !== contentLength || header.length < 12 || header.toString('ascii', 4, 8) !== 'ftyp') {
        throw new Error('Konten bukan MP4 yang valid atau ukurannya tidak lengkap.');
      }
      await rename(tempPath, finalPath);
      // Tidak ada aset lain yang digantikan atau dihapus di sini.
      //
      // Dulu unggahan baru langsung menandai video lama milik pelajaran itu
      // terhapus dan membuang berkasnya. Dalam model perpustakaan hal itu
      // berbahaya: berkas yang dibuang bisa saja masih dipakai pelajaran lain.
      // Melepas dan membuang kini menjadi tindakan eksplisit lewat
      // `detachFromLesson` dan `deleteAsset`.
      await this.prisma.videoAsset.update({
        where: { id: asset.id },
        data: { objectKey, status: VideoStatus.AVAILABLE, processingError: null },
      });
      return {
        videoAssetId: asset.id,
        provider: asset.provider,
        status: VideoStatus.AVAILABLE,
        // Sudah diverifikasi sama dengan `asset.sizeBytes` di awal metode ini.
        sizeBytes: String(contentLength),
      };
    } catch (error) {
      await rm(tempPath, { force: true });
      await rm(finalPath, { force: true });
      await this.prisma.videoAsset.update({
        where: { id: asset.id },
        data: {
          status: VideoStatus.FAILED,
          processingError: error instanceof Error ? error.message.slice(0, 500) : 'Upload gagal.',
        },
      });
      throw AppError.validation({ file: ['Upload MP4 gagal atau konten tidak valid.'] });
    }
  }

  /**
   * Menambahkan video YouTube ke perpustakaan.
   *
   * Tidak digandengkan ke `VIDEO_PROVIDER`: setelan itu menentukan ke mana
   * berkas diunggah untuk seluruh deployment, sedangkan YouTube adalah sumber
   * yang tidak memakai penyimpanan kita sama sekali.
   */
  async createYoutubeVideo(input: YoutubeVideoInput, userId: string) {
    const youtubeVideoId = parseYoutubeVideoId(input.url);
    if (!youtubeVideoId) {
      throw AppError.validation({
        url: ['Tautan YouTube tidak dikenali. Gunakan tautan watch, youtu.be, embed, atau shorts.'],
      });
    }

    const asset = await this.prisma.videoAsset.create({
      data: {
        createdBy: userId,
        provider: VideoProvider.YOUTUBE,
        // Pegangan internal, bukan ID YouTube: kolomnya unik global, sehingga
        // memakai ID YouTube akan melarang satu video masuk perpustakaan dua kali.
        providerVideoId: randomUUID(),
        sourceUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
        title: input.title,
        // Tidak ada berkas yang kita kuasai, jadi metadata berkas dibiarkan kosong.
        status: VideoStatus.AVAILABLE,
      },
    });

    return {
      videoAssetId: asset.id,
      provider: asset.provider,
      status: asset.status,
      youtubeVideoId,
      sourceUrl: asset.sourceUrl,
    };
  }

  /**
   * Menambahkan video Bunny Stream ke perpustakaan.
   *
   * Berkasnya diunggah Master lewat dashboard Bunny; yang didaftarkan di sini
   * adalah GUID-nya. Sebelum ini tidak ada satu pun jalan untuk itu, sehingga
   * satu-satunya aset Bunny yang ada di produksi dibuat lewat SQL langsung.
   *
   * Seperti YouTube, tidak digandengkan ke `VIDEO_PROVIDER`: setelan itu
   * menentukan ke mana berkas diunggah untuk seluruh deployment, sedangkan
   * Bunny adalah asal per-aset yang tidak memakai penyimpanan kita.
   */
  async createBunnyVideo(input: { source: string; title?: string }, userId: string) {
    const videoId = parseBunnyVideoId(input.source);
    if (!videoId) {
      throw AppError.validation({
        source: ['GUID video Bunny tidak dikenali. Tempel GUID dari dashboard Bunny, atau tautan yang memuatnya.'],
      });
    }

    const metadata = await this.bunny.fetchVideo(videoId);
    if (metadata.failed) {
      throw AppError.validation({
        source: ['Video itu gagal diproses di Bunny. Unggah ulang di dashboard Bunny lebih dulu.'],
      });
    }

    const judul = input.title?.trim() || metadata.title || `Video Bunny ${videoId.slice(0, 8)}`;
    try {
      const asset = await this.prisma.videoAsset.create({
        data: {
          createdBy: userId,
          provider: VideoProvider.BUNNY_STREAM,
          // GUID Bunny yang sesungguhnya, bukan pegangan internal seperti pada
          // YouTube: URL playlist disusun langsung dari nilai ini.
          providerVideoId: videoId,
          title: judul,
          sizeBytes: metadata.sizeBytes === null ? null : BigInt(metadata.sizeBytes),
          // Video yang masih ditranskode tetap boleh masuk perpustakaan, tetapi
          // belum boleh diputar; pemutaran menuntut status AVAILABLE.
          status: metadata.ready ? VideoStatus.AVAILABLE : VideoStatus.PROCESSING,
        },
      });
      return {
        videoAssetId: asset.id,
        provider: asset.provider,
        providerVideoId: asset.providerVideoId,
        title: asset.title,
        status: asset.status,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw AppError.validation({ source: ['Video itu sudah ada di perpustakaan.'] });
      }
      throw error;
    }
  }

  /**
   * Isi perpustakaan, beserta pelajaran yang memakai tiap aset.
   *
   * Dulu seluruh isinya dikirim sekaligus — setiap aset lengkap dengan seluruh
   * pemakaiannya — dan penyaringan dilakukan di browser. Itu bekerja selama
   * perpustakaannya kecil, lalu berubah menjadi satu permintaan yang tumbuh
   * tanpa batas seiring video bertambah. Pencarian dan penyaringan kini
   * dikerjakan basis data, dan hasilnya berhalaman.
   */
  async listLibrary(
    params: { search?: string; filter?: 'USED' | 'ORPHAN' | 'PROBLEM' | 'AVAILABLE' },
    page: number,
    pageSize: number,
  ) {
    const where: Prisma.VideoAssetWhereInput = { deletedAt: null };

    if (params.filter === 'USED') where.lessons = { some: {} };
    if (params.filter === 'ORPHAN') where.lessons = { none: {} };
    if (params.filter === 'PROBLEM') where.status = { not: VideoStatus.AVAILABLE };
    if (params.filter === 'AVAILABLE') where.status = VideoStatus.AVAILABLE;

    const kata = params.search?.trim();
    if (kata) {
      // Pelajaran dan kursus ikut dicari karena begitulah Master mengingat
      // sebuah berkas: bukan dari nama filenya, melainkan dari tempat ia
      // dipakai.
      where.OR = [
        { title: { contains: kata, mode: 'insensitive' } },
        { originalName: { contains: kata, mode: 'insensitive' } },
        {
          lessons: {
            some: {
              OR: [
                { title: { contains: kata, mode: 'insensitive' } },
                { module: { course: { title: { contains: kata, mode: 'insensitive' } } } },
              ],
            },
          },
        },
      ];
    }

    const [total, assets] = await this.prisma.$transaction([
      this.prisma.videoAsset.count({ where }),
      this.prisma.videoAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          provider: true,
          status: true,
          originalName: true,
          sizeBytes: true,
          sourceUrl: true,
          createdAt: true,
          lessons: {
            select: {
              id: true,
              title: true,
              module: { select: { course: { select: { id: true, title: true } } } },
            },
            orderBy: { title: 'asc' },
          },
        },
      }),
    ]);

    return {
      total,
      items: assets.map((asset) => ({
        videoAssetId: asset.id,
        title: asset.title,
        provider: asset.provider,
        status: asset.status,
        originalName: asset.originalName,
        // BigInt tidak dapat diserialkan ke JSON, dan ukuran berkas video
        // melampaui Number.MAX_SAFE_INTEGER jauh sebelum itu jadi masalah nyata
        // — tetap dikirim sebagai string supaya tidak ada pembulatan diam-diam.
        sizeBytes: asset.sizeBytes === null ? null : String(asset.sizeBytes),
        sourceUrl: asset.sourceUrl,
        createdAt: asset.createdAt.toISOString(),
        usedBy: asset.lessons.map((lesson) => ({
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          courseId: lesson.module.course.id,
          courseTitle: lesson.module.course.title,
        })),
      })),
    };
  }

  /**
   * Angka yang berlaku untuk seluruh perpustakaan, bukan untuk satu halaman.
   *
   * Dihitung basis data lewat count dan sum, bukan dengan memuat seluruh aset
   * ke memori lalu menjumlahkannya — cara lama itu menjadikan setiap kunjungan
   * ke halaman media sebagai pembacaan penuh tabel.
   */
  async librarySummary() {
    const where: Prisma.VideoAssetWhereInput = { deletedAt: null };
    const [total, used, problem, ukuran] = await this.prisma.$transaction([
      this.prisma.videoAsset.count({ where }),
      this.prisma.videoAsset.count({ where: { ...where, lessons: { some: {} } } }),
      this.prisma.videoAsset.count({
        where: { ...where, status: { not: VideoStatus.AVAILABLE } },
      }),
      this.prisma.videoAsset.aggregate({ where, _sum: { sizeBytes: true } }),
    ]);

    return {
      total,
      used,
      orphan: total - used,
      problem,
      // Hanya berkas yang benar-benar memakai disk kita yang punya sizeBytes;
      // video YouTube tidak menempati apa pun di sini.
      totalBytes: String(ukuran._sum.sizeBytes ?? BigInt(0)),
    };
  }

  /** Memasang aset perpustakaan pada sebuah pelajaran. */
  async attachToLesson(lessonId: string, videoAssetId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, contentType: true },
    });
    if (!lesson) throw AppError.notFound();
    if (lesson.contentType !== 'VIDEO') {
      throw AppError.validation({ lessonId: ['Lesson bukan bertipe VIDEO.'] });
    }

    const asset = await this.prisma.videoAsset.findFirst({
      where: { id: videoAssetId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!asset) throw AppError.notFound();
    if (asset.status !== VideoStatus.AVAILABLE) {
      throw AppError.validation({
        videoAssetId: ['Video belum siap dipakai. Tunggu unggahannya selesai.'],
      });
    }

    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: { videoAssetId: asset.id },
    });
    return { lessonId, videoAssetId: asset.id };
  }

  /**
   * Melepas video dari pelajaran tanpa menyentuh berkasnya.
   *
   * Berkas tetap di perpustakaan karena pelajaran lain mungkin memakainya.
   * Membuangnya dari disk adalah tindakan terpisah lewat `deleteAsset`.
   */
  async detachFromLesson(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, videoAssetId: true },
    });
    if (!lesson) throw AppError.notFound();
    if (lesson.videoAssetId === null) return { lessonId, videoAssetId: null };

    await this.prisma.$transaction(async (tx) => {
      // Sesi yang masih menunjuk pelajaran ini tidak lagi punya video; kunci
      // asingnya juga menolak pelajaran dilepas selama sesi masih ada.
      await tx.videoPlaybackSession.deleteMany({ where: { lessonId } });
      await tx.lesson.update({ where: { id: lessonId }, data: { videoAssetId: null } });
    });
    return { lessonId, videoAssetId: null };
  }

  /**
   * Membuang aset dari perpustakaan beserta berkasnya.
   *
   * Ditolak selama masih ada pelajaran yang memakainya. Inilah satu-satunya
   * jalan berkas video hilang dari disk, sehingga tidak ada penghapusan yang
   * terjadi sebagai efek samping tindakan lain.
   */
  async deleteAsset(videoAssetId: string) {
    const asset = await this.prisma.videoAsset.findFirst({
      where: { id: videoAssetId, deletedAt: null },
      select: {
        id: true,
        objectKey: true,
        status: true,
        _count: { select: { lessons: true } },
      },
    });
    if (!asset) throw AppError.notFound();
    if (asset._count.lessons > 0) {
      throw AppError.validation({
        videoAssetId: [
          `Video masih dipakai ${asset._count.lessons} pelajaran. Lepas dulu dari pelajarannya.`,
        ],
      });
    }
    if (PENDING_STATUSES.has(asset.status)) {
      throw AppError.validation({ videoAssetId: ['Tunggu unggahan selesai sebelum menghapus.'] });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.videoPlaybackSession.deleteMany({ where: { videoAssetId: asset.id } });
      await tx.videoAsset.delete({ where: { id: asset.id } });
    });
    if (asset.objectKey) {
      await rm(join(this.config.storagePath, asset.objectKey), { force: true });
    }
    return { videoAssetId: asset.id, deleted: true };
  }

  async createPlaybackSession(lessonId: string, userId: string, deviceId?: string) {
    const access = await this.access.assertLessonAccess(userId, lessonId);
    const [lesson, user] = await Promise.all([
      this.prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { videoAsset: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, email: true },
      }),
    ]);
    if (!user) throw AppError.notFound();
    const asset =
      lesson?.videoAsset && lesson.videoAsset.deletedAt === null &&
      lesson.videoAsset.status === VideoStatus.AVAILABLE
        ? lesson.videoAsset
        : null;
    if (!asset) throw new AppError('FILE_NOT_AVAILABLE', 409, 'Video belum tersedia.');
    const expiresAt = new Date(Date.now() + this.config.playbackTtlSeconds * 1000);
    const playback = await this.prisma.videoPlaybackSession.create({
      data: {
        videoAssetId: asset.id,
        // Konteks pelajaran ikut disimpan; lihat komentar pada kolomnya.
        lessonId,
        userId,
        enrollmentId: access.enrollmentId,
        deviceId,
        expiresAt,
      },
    });
    // Video sematan diputar oleh penyedia luar, jadi tidak ada berkas yang
    // boleh dialirkan lewat endpoint konten kita.
    const embedded = asset.provider === VideoProvider.YOUTUBE;
    const youtubeVideoId = embedded && asset.sourceUrl ? parseYoutubeVideoId(asset.sourceUrl) : null;

    // Bunny mengantar sendiri bytenya dari CDN, tetapi pemutarnya tetap milik
    // kita: yang dikirim adalah playlist HLS, bukan halaman sematan. Dengan
    // begitu watermark, larangan unduh, dan kelak pelacakan progres tetap ada
    // di tangan aplikasi ini.
    const bunny = asset.provider === VideoProvider.BUNNY_STREAM
      ? bunnyPlaylistUrl(this.config.bunny, asset.providerVideoId, expiresAt)
      : null;

    // Aset Bunny tanpa konfigurasi Bunny tidak punya berkas di penyimpanan
    // kita, jadi jalur berkas hanya akan berujung 404 — dan pelajar diberi
    // tahu "minta Master mengunggah ulang MP4", nasihat yang keliru. Lebih
    // jujur menyebutnya belum tersedia.
    if (asset.provider === VideoProvider.BUNNY_STREAM && !bunny) {
      throw new AppError('FILE_NOT_AVAILABLE', 409, 'Video belum tersedia.');
    }

    return {
      playbackSessionId: playback.id,
      provider: asset.provider,
      providerVideoId: asset.providerVideoId,
      kind: embedded ? ('EMBED' as const) : bunny ? ('HLS' as const) : ('FILE' as const),
      playbackUrl: embedded
        ? null
        : (bunny ?? `/api/v1/playback-sessions/${playback.id}/content`),
      // `youtube-nocookie` supaya pelajar tidak dilacak sebelum menekan putar.
      embedUrl: youtubeVideoId
        ? `https://www.youtube-nocookie.com/embed/${youtubeVideoId}?rel=0&modestbranding=1`
        : null,
      expiresAt: expiresAt.toISOString(),
      drm: { enabled: false, type: 'NONE' },
      watermark: {
        text: playbackWatermarkText(user.fullName, user.email, playback.id),
        mode: 'MOVING' as const,
      },
    };
  }


  async authorisedObject(playbackSessionId: string, userId: string): Promise<string> {
    const playback = await this.prisma.videoPlaybackSession.findFirst({
      where: {
        id: playbackSessionId,
        userId,
        status: PlaybackStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      include: { videoAsset: true },
    });
    if (!playback?.videoAsset.objectKey || playback.videoAsset.status !== VideoStatus.AVAILABLE) {
      throw AppError.notFound();
    }
    // Hak diperiksa terhadap pelajaran yang tercatat pada sesinya, bukan yang
    // diturunkan dari asetnya. Satu aset kini dapat dipakai banyak pelajaran,
    // sehingga aset tidak lagi dapat menjawab pelajaran mana yang berlaku.
    await this.access.assertLessonAccess(userId, playback.lessonId);
    return playback.videoAsset.objectKey;
  }

  /**
   * Melepaskan pelajaran yang akan dihapus dari video yang dipakainya.
   *
   * Aset itu sendiri tidak ikut dihapus: ia milik perpustakaan, bukan milik
   * pelajaran, dan mungkin masih dipakai pelajaran lain. Berkas yang tidak lagi
   * dipakai siapa pun dibuang lewat halaman media, bukan sebagai efek samping
   * penghapusan pelajaran.
   */
  async removeForLessons(lessonIds: string[]): Promise<void> {
    if (lessonIds.length === 0) return;
    await this.prisma.$transaction(async (tx) => {
      // Kunci asing dari sesi ke pelajaran bersifat Restrict, jadi sesi harus
      // pergi lebih dulu agar pelajarannya dapat dihapus pemanggil.
      await tx.videoPlaybackSession.deleteMany({ where: { lessonId: { in: lessonIds } } });
      await tx.lesson.updateMany({
        where: { id: { in: lessonIds } },
        data: { videoAssetId: null },
      });
    });
  }
}
