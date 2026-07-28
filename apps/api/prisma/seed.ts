import { hash } from '@node-rs/argon2';
import {
  CompletionRule,
  CourseLevel,
  LessonContentType,
  PrismaClient,
  PublicationStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Data awal untuk pengembangan lokal.
 *
 * Kata sandi di sini hanya untuk lingkungan lokal dan sengaja ditulis
 * terang-terangan agar tim dapat masuk tanpa bertanya. Seed ini menolak
 * berjalan di produksi.
 */
const LOCAL_PASSWORDS = {
  master: 'Master#Lokal12345',
  student: 'Pelajar#Lokal12345',
};

const PERMISSIONS: Array<{ code: string; name: string }> = [
  { code: 'users.read', name: 'Melihat pengguna' },
  { code: 'users.manage', name: 'Mengelola pengguna' },
  { code: 'users.security.manage', name: 'Mengelola keamanan pengguna' },
  { code: 'courses.manage', name: 'Mengelola kursus' },
  { code: 'enrollments.manage', name: 'Mengelola enrollment' },
  { code: 'discussions.moderate', name: 'Memoderasi diskusi' },
  { code: 'analytics.read', name: 'Melihat analytics' },
  { code: 'reports.export', name: 'Mengekspor laporan' },
  { code: 'audit.read', name: 'Melihat audit log' },
  { code: 'roles.manage', name: 'Mengelola role dan permission' },
  { code: 'announcements.manage', name: 'Mengelola pengumuman' },
];

const CURRICULUM: Array<{ title: string; lessons: string[] }> = [
  {
    title: 'Instalasi & Setup Editor',
    lessons: [
      'Perbedaan Versi Desktop dan Mobile',
      'Cara Menginstal Editor di PC',
      'Cara Mengakses Editor Lewat Browser',
      'Cara Menginstal Editor dari App Store',
    ],
  },
  {
    title: 'Dasar: Interface & Cara Navigasi',
    lessons: [
      'Tampilan Halaman Login',
      'Tampilan File Proyek',
      'Tampilan Menu Pengaturan',
      'Fungsi-Fungsi Pengaturan',
      'Tampilan Ruang Kerja',
      'Tampilan Timeline Editing',
      'Tampilan Preview Panel',
      'Tampilan Toolbar',
    ],
  },
  {
    title: 'Teknik Editing Praktis',
    lessons: [
      'Ritme Potongan untuk Konten Pendek',
      'Color Grading Dasar',
      'Mixing Audio dan Voice Over',
      'Membuat Hook 3 Detik Pertama',
    ],
  },
  {
    title: 'Publikasi dan Distribusi',
    lessons: [
      'Pengaturan Export untuk Setiap Platform',
      'Menyusun Thumbnail yang Diklik',
      'Menjadwalkan Publikasi Konten',
    ],
  },
];

async function main(): Promise<void> {
  if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error('Seed tidak boleh dijalankan di produksi.');
  }

  console.log('Menyiapkan permission dan role…');

  const permissions = await Promise.all(
    PERMISSIONS.map((permission) =>
      prisma.permission.upsert({
        where: { code: permission.code },
        create: permission,
        update: { name: permission.name },
      }),
    ),
  );

  const masterRole = await prisma.role.upsert({
    where: { code: 'MASTER' },
    create: { code: 'MASTER', name: 'Master' },
    update: {},
  });
  const studentRole = await prisma.role.upsert({
    where: { code: 'STUDENT' },
    create: { code: 'STUDENT', name: 'Pelajar' },
    update: {},
  });

  // Master memegang seluruh permission; Pelajar tidak memegang satu pun.
  // Hak Pelajar berasal dari kepemilikan resource dan enrollment, bukan dari
  // daftar permission (ACCESS_CONTROL_MATRIX).
  await prisma.rolePermission.deleteMany({ where: { roleId: masterRole.id } });
  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({
      roleId: masterRole.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  console.log('Menyiapkan pengguna…');

  const master = await upsertUser({
    email: 'master@akademionline.id',
    fullName: 'Rina Kusuma',
    password: LOCAL_PASSWORDS.master,
    roleId: masterRole.id,
  });

  const student = await upsertUser({
    email: 'pelajar@akademionline.id',
    fullName: 'Freddie',
    password: LOCAL_PASSWORDS.student,
    roleId: studentRole.id,
  });

  const secondStudent = await upsertUser({
    email: 'samuel@akademionline.id',
    fullName: 'Samuel Moses',
    password: LOCAL_PASSWORDS.student,
    roleId: studentRole.id,
  });

  console.log('Menyiapkan katalog…');

  const category = await prisma.courseCategory.upsert({
    where: { slug: 'materi-lanjutan' },
    create: { slug: 'materi-lanjutan', name: 'Materi Lanjutan' },
    update: {},
  });

  const course = await prisma.course.upsert({
    where: { slug: 'video-editing-mastery' },
    create: {
      slug: 'video-editing-mastery',
      title: 'Video Editing Mastery',
      shortDescription: 'Menguasai alur kerja editing video untuk konten pendek dan panjang.',
      description:
        'Kursus ini membawa kamu dari instalasi editor sampai publikasi konten. ' +
        'Setiap bagian berisi latihan yang bisa langsung dipakai di proyek nyata.',
      level: CourseLevel.BEGINNER,
      status: PublicationStatus.PUBLISHED,
      estimatedMinutes: 19 * 6,
      publishedAt: new Date(),
      categoryId: category.id,
      createdBy: master.id,
    },
    update: { status: PublicationStatus.PUBLISHED },
  });

  const secondCourse = await prisma.course.upsert({
    where: { slug: 'ai-mastery' },
    create: {
      slug: 'ai-mastery',
      title: 'AI Mastery',
      shortDescription: 'Menerapkan AI untuk riset, produksi konten, dan otomasi kerja harian.',
      description: 'Materi lanjutan untuk peserta yang sudah terbiasa dengan tools AI dasar.',
      level: CourseLevel.INTERMEDIATE,
      status: PublicationStatus.PUBLISHED,
      estimatedMinutes: 240,
      publishedAt: new Date(),
      categoryId: category.id,
      createdBy: master.id,
    },
    update: { status: PublicationStatus.PUBLISHED },
  });

  // Kursus draf ikut dibuat supaya tes katalog dapat membuktikan bahwa
  // kursus belum terbit tidak pernah bocor ke Pelajar.
  await prisma.course.upsert({
    where: { slug: 'generative-ai-mastery' },
    create: {
      slug: 'generative-ai-mastery',
      title: 'Generative AI Mastery',
      shortDescription: 'Belum terbit.',
      level: CourseLevel.ADVANCED,
      status: PublicationStatus.DRAFT,
      categoryId: category.id,
      createdBy: master.id,
    },
    update: {},
  });

  await prisma.courseModule.deleteMany({ where: { courseId: course.id } });
  for (const [moduleIndex, section] of CURRICULUM.entries()) {
    const courseModule = await prisma.courseModule.create({
      data: {
        courseId: course.id,
        title: section.title,
        position: moduleIndex + 1,
        estimatedMinutes: section.lessons.length * 6,
      },
    });

    await prisma.lesson.createMany({
      data: section.lessons.map((title, lessonIndex) => ({
        moduleId: courseModule.id,
        title,
        position: lessonIndex + 1,
        contentType: LessonContentType.VIDEO,
        estimatedMinutes: 6,
        isRequired: true,
        isPreview: moduleIndex === 0 && lessonIndex === 0,
        completionRule: CompletionRule.MANUAL,
        description: `Materi ${title.toLowerCase()}.`,
      })),
    });
  }

  console.log('Menyiapkan enrollment…');

  for (const learner of [student, secondStudent]) {
    for (const target of [course, secondCourse]) {
      const enrollment = await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: learner.id, courseId: target.id } },
        create: {
          userId: learner.id,
          courseId: target.id,
          enrolledBy: master.id,
          accessStartsAt: new Date(),
        },
        update: {},
      });

      const requiredTotal = await prisma.lesson.count({
        where: { isRequired: true, isActive: true, module: { courseId: target.id, isActive: true } },
      });

      await prisma.courseProgress.upsert({
        where: { enrollmentId: enrollment.id },
        create: { enrollmentId: enrollment.id, requiredLessonsTotal: requiredTotal },
        update: { requiredLessonsTotal: requiredTotal },
      });
    }
  }

  const lessonCount = await prisma.lesson.count({ where: { module: { courseId: course.id } } });

  console.log('');
  console.log('Seed selesai.');
  console.log(`  Kursus "${course.title}": ${CURRICULUM.length} bagian, ${lessonCount} pelajaran.`);
  console.log('');
  console.log('  Akun lokal:');
  console.log(`    Master  → master@akademionline.id  / ${LOCAL_PASSWORDS.master}`);
  console.log(`    Pelajar → pelajar@akademionline.id / ${LOCAL_PASSWORDS.student}`);
  console.log('');
}

async function upsertUser(params: {
  email: string;
  fullName: string;
  password: string;
  roleId: string;
}) {
  const passwordHash = await hash(params.password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const user = await prisma.user.upsert({
    where: { email: params.email },
    create: {
      email: params.email,
      fullName: params.fullName,
      passwordHash,
      emailVerifiedAt: new Date(),
    },
    update: { passwordHash, fullName: params.fullName },
  });

  await prisma.userRole.upsert({
    where: { userId: user.id },
    create: { userId: user.id, roleId: params.roleId },
    update: { roleId: params.roleId },
  });

  return user;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
