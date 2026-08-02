import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '../../../components/app-shell';
import { ArrowLeft } from '../../../components/icons';
import { requirePermission } from '../../../lib/session';
import { CourseForm } from './course-form';

export const metadata: Metadata = { title: 'Kursus baru · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

export default async function NewCoursePage() {
  const user = await requirePermission('courses.manage', '/master/courses/new');

  return (
    <AppShell user={user}>
      <main className="masterContent masterContentNarrow">
        <Link href="/master/courses" className="pill" style={{ marginBottom: 18, display: 'inline-flex' }}>
          <ArrowLeft size={13} /> Kelola Kursus
        </Link>

        <h1 className="pageTitle" style={{ marginBottom: 24 }}>
          Kursus baru
        </h1>

        <section className="card panel">
          <CourseForm />
        </section>
      </main>
    </AppShell>
  );
}
