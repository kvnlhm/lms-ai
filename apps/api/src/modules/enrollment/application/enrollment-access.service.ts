import { Inject, Injectable } from '@nestjs/common';
import { EnrollmentStatus, PublicationStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/errors/app-error';
import { COURSE_PREVIEW_ACCESS, type CoursePreviewAccessPort } from './course-preview.port';
import { MEMBERSHIP_ACCESS, type MembershipAccessPort } from '../../../shared/access/membership.port';

export interface CourseAccess {
  /**
   * Kosong untuk akun gratis: tidak ada wadah progres yang dibuat untuknya.
   *
   * Enrollment adalah dasar kolom "Terdaftar" di daftar kursus Master dan dasar
   * seluruh analitik. Membiarkan akun gratis membuat baris di sana membuat angka
   * itu berhenti berarti "pelajar berbayar" tanpa satu pun tanda bahwa artinya
   * sudah berubah (ADR-032).
   */
  enrollmentId: string | null;
  userId: string;
  courseId: string;
  status: EnrollmentStatus | null;
  /**
   * Benar bila kursus dibuka lewat hak pratinjau, bukan karena sudah terbit.
   * Dipakai antarmuka untuk menyatakan bahwa yang terlihat belum tayang bagi
   * pelajar; tanpa itu draf dan kursus terbit tampak persis sama.
   */
  preview: boolean;
  /**
   * Benar bila pemiliknya berhak atas isi pelajaran: anggota berbayar, atau
   * penyusun kursus yang sedang memeriksa materinya sendiri.
   *
   * Akun gratis tetap boleh masuk untuk melihat kurikulumnya, jadi ini bukan
   * hal yang sama dengan "boleh membuka kursus ini".
   */
  berhakIsi: boolean;
}

/**
 * Akses yang sudah dipastikan memiliki wadah progres.
 *
 * Ada supaya jalur yang **menulis** riwayat belajar — kuis dan penandaan selesai
 * — tidak perlu memeriksa `enrollmentId` kosong di setiap barisnya. Pemeriksaan
 * dilakukan sekali di `assertProgressAccess`, dan tipenya yang membawa hasilnya
 * ke seluruh jalur di bawahnya.
 */
export type CourseAccessWithProgress = CourseAccess & {
  enrollmentId: string;
  status: EnrollmentStatus;
};

/**
 * Satu-satunya tempat aturan "boleh membuka kursus ini" ditegakkan.
 *
 * Modul delivery dan progress memanggil service ini, bukan membaca tabel
 * enrollment secara langsung (Architecture bagian 9.3). Dengan begitu aturan
 * akses tidak bercabang di banyak tempat.
 */
@Injectable()
export class EnrollmentAccessService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(COURSE_PREVIEW_ACCESS) private readonly pratinjau: CoursePreviewAccessPort,
    @Inject(MEMBERSHIP_ACCESS) private readonly keanggotaan: MembershipAccessPort,
  ) {}

  async assertActiveAccess(userId: string, courseId: string): Promise<CourseAccess> {
    return this.ensureCourseAccess(userId, courseId);
  }

  /**
   * Apakah orang ini berhak atas isi pelajaran, bukan sekadar atas kurikulumnya.
   *
   * Keanggotaan ditanyakan lebih dulu karena itulah jawaban bagi hampir semua
   * yang sampai ke sini; pertanyaan kedua ke modul identity hanya muncul untuk
   * yang belum terjawab.
   */
  private async berhakIsi(userId: string): Promise<boolean> {
    if (await this.keanggotaan.anggotaBerbayar(userId)) return true;
    return this.pratinjau.bolehPratinjauKursus(userId);
  }

  /**
   * Boleh masuk kursus ini atau tidak, dan bila boleh — sebagai apa.
   *
   * Setiap pengguna terautentikasi boleh masuk untuk melihat kurikulum kursus
   * yang sudah terbit. Yang membedakan anggota berbayar dari akun gratis adalah
   * dua hal: hak atas isi pelajaran, dan keberadaan wadah progres. Akun gratis
   * tidak memperoleh keduanya (ADR-032).
   *
   * Di luar itu ada satu jalan masuk: penyusun kursus boleh membuka kursus yang
   * belum terbit sebagai pratinjau. Tanpa itu, satu-satunya cara memeriksa hasil
   * penyusunan adalah menerbitkannya lebih dulu kepada seluruh pelajar — dan
   * tombol "Pratinjau sebagai pelajar" di editor selama ini hanya menghasilkan
   * 404. Pratinjau memakai jalur yang sama persis dengan pelajar, karena
   * pemeriksaan yang menempuh jalur berbeda tidak membuktikan apa-apa.
   */
  async ensureCourseAccess(userId: string, courseId: string): Promise<CourseAccess> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        status: true,
        modules: {
          where: { isActive: true },
          select: { lessons: { where: { isActive: true, isRequired: true }, select: { id: true } } },
        },
      },
    });
    if (!course) throw AppError.notFound();

    const preview = course.status !== PublicationStatus.PUBLISHED;
    if (preview && !(await this.pratinjau.bolehPratinjauKursus(userId))) {
      // Sengaja 404, bukan 403: keberadaan kursus yang belum terbit bukan
      // sesuatu yang perlu dikonfirmasi kepada yang tidak berhak melihatnya.
      throw AppError.notFound();
    }

    // Kursus yang belum terbit hanya sampai di sini bila hak pratinjaunya sudah
    // terbukti sebaris di atas, jadi tidak perlu ditanyakan dua kali.
    const berhakIsi = preview || (await this.berhakIsi(userId));

    // Akun gratis berhenti di sini: boleh melihat kurikulumnya, tanpa wadah
    // progres dan tanpa hak atas isi pelajarannya.
    if (!berhakIsi) {
      return { enrollmentId: null, userId, courseId, status: null, preview, berhakIsi };
    }

    const requiredLessonsTotal = course.modules.reduce(
      (total, module) => total + module.lessons.length,
      0,
    );

    const enrollment = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { id: true, status: true },
      });
      const enrollment = existing
        ? await tx.enrollment.update({
            where: { id: existing.id },
            data: {
              ...(existing.status === EnrollmentStatus.COMPLETED
                ? {}
                : { status: EnrollmentStatus.ACTIVE }),
              removedAt: null,
            },
          })
        : await tx.enrollment.create({
            data: { userId, courseId, status: EnrollmentStatus.ACTIVE },
          });
      await tx.courseProgress.upsert({
        where: { enrollmentId: enrollment.id },
        create: { enrollmentId: enrollment.id, requiredLessonsTotal },
        update: { requiredLessonsTotal },
      });
      return enrollment;
    });

    return {
      enrollmentId: enrollment.id,
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      status: enrollment.status,
      preview,
      berhakIsi,
    };
  }

  async ensureAllPublishedCourseAccess(userId: string): Promise<void> {
    // Akun gratis tidak memperoleh enrollment, jadi menyusuri katalog untuknya
    // berarti satu kueri per kursus yang hasilnya pasti dibuang.
    if (!(await this.berhakIsi(userId))) return;

    const courses = await this.prisma.course.findMany({
      where: { status: PublicationStatus.PUBLISHED },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    for (const course of courses) {
      await this.ensureCourseAccess(userId, course.id);
    }
  }

  /**
   * Varian untuk lesson: memetakan lesson ke course, memvalidasi akses, lalu
   * menegakkan gerbang isi.
   *
   * Di sinilah paywall pelajaran tinggal, dan hanya di sini. Detail pelajaran,
   * materi, sesi playback video, kuis, dan penandaan progres semuanya melewati
   * fungsi ini — jadi satu pemeriksaan menutup seluruh jalan masuk, bukan lima
   * pemeriksaan yang harus diingat satu per satu.
   */
  async assertLessonAccess(
    userId: string,
    lessonId: string,
  ): Promise<CourseAccess & { lessonId: string }> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        isActive: true,
        isPreview: true,
        module: { select: { isActive: true, courseId: true } },
      },
    });

    if (!lesson || !lesson.isActive || !lesson.module.isActive) throw AppError.notFound();

    const access = await this.assertActiveAccess(userId, lesson.module.courseId);

    // Pelajaran pratinjau adalah contoh barang yang sengaja dibuka Master.
    // Sisanya menuntut keanggotaan — dan 402, bukan 403, karena penolakan ini
    // punya jalan keluar yang dapat ditawarkan.
    if (!access.berhakIsi && !lesson.isPreview) {
      throw AppError.membershipRequired(
        'Pelajaran ini hanya untuk anggota berbayar. Ambil aksesnya untuk membukanya.',
      );
    }

    return { ...access, lessonId: lesson.id };
  }

  /**
   * Varian untuk jalur yang menulis riwayat belajar: kuis dan penandaan selesai.
   *
   * Akun gratis boleh membaca pelajaran pratinjau, tetapi tidak punya wadah
   * progres — pratinjau adalah contoh barang, bukan bagian dari riwayat belajar
   * seseorang. Menuliskan riwayat untuknya menuntut keanggotaan (ADR-032).
   */
  async assertProgressAccess(
    userId: string,
    lessonId: string,
  ): Promise<CourseAccessWithProgress & { lessonId: string }> {
    const access = await this.assertLessonAccess(userId, lessonId);
    if (!access.enrollmentId || !access.status) {
      throw AppError.membershipRequired(
        'Kemajuan belajar dan kuis tercatat untuk anggota berbayar. Ambil aksesnya untuk mulai.',
      );
    }
    return { ...access, enrollmentId: access.enrollmentId, status: access.status };
  }
}
