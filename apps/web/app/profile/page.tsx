import { AppShell } from '../components/app-shell';
import { requireUser } from '../lib/session';
import { ProfileForm } from './profile-form';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireUser('/profile');

  return (
    <AppShell user={user}>
      <main className={user.role === 'MASTER' ? 'masterContent masterContentNarrow' : 'page profilePage'}>
        <div className="pageHead">
          <div className="pageHeadMain">
            <p className="eyebrow">Akun saya</p>
            <h1 className="pageTitle">Edit profil</h1>
            <p className="pageSub">Perbarui informasi yang terlihat pada akun AIPreneur Academy.</p>
          </div>
        </div>
        <ProfileForm user={user} />
      </main>
    </AppShell>
  );
}
