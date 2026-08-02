import type { Metadata } from 'next';
import Link from 'next/link';
import type { Schemas } from '@lms/api-client';
import { AppShell } from '../../../components/app-shell';
import { ArrowLeft } from '../../../components/icons';
import { serverClient, unwrap } from '../../../lib/api';
import { requirePermission } from '../../../lib/session';
import { CourseForm } from './course-form';

type Category = Schemas['AdminCategoryDto'];

export const metadata: Metadata = { title: 'Tambahkan Kursus · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

export default async function NewCoursePage() {
  const user = await requirePermission('courses.manage', '/master/courses/new');

  // Kategori dimuat di sini supaya dapat dipilih sejak awal, sama seperti pada
  // pengaturan kursus. Kegagalannya tidak menghalangi pembuatan kursus —
  // kategori memang opsional — jadi daftarnya cukup dikosongkan.
  let categories: Category[] = [];
  try {
    const client = await serverClient();
    categories = unwrap<Category[]>(await client.GET('/api/v1/admin/course-categories', {}));
  } catch {
    categories = [];
  }

  return (
    <AppShell user={user}>
      <main className="masterContent masterContentNarrow">
        <Link href="/master/courses" className="pill" style={{ marginBottom: 18, display: 'inline-flex' }}>
          <ArrowLeft size={13} /> Kelola Kursus
        </Link>

        <h1 className="pageTitle" style={{ marginBottom: 24 }}>
          Tambahkan Kursus
        </h1>

        <section className="card panel">
          <CourseForm categories={categories} />
        </section>
      </main>
    </AppShell>
  );
}
