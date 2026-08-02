import type { Metadata } from 'next';
import { AppShell } from '../components/app-shell';
import { serverClient, unwrap } from '../lib/api';
import { requireUser } from '../lib/session';
import { PasswordForm } from './password-form';
import { ProfileForm } from './profile-form';
import { NotificationPreferencesForm } from './notification-preferences-form';
import { SessionManager } from './session-manager';

export const metadata: Metadata = { title: 'Profil saya · Academy AIPreneur' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireUser('/profile');
  const client = await serverClient();
  const [sessions, preferences] = await Promise.all([
    client.GET('/api/v1/auth/sessions', {}).then(unwrap),
    client.GET('/api/v1/me/notifications/preferences', {}).then(unwrap),
  ]);

  return (
    <AppShell user={user}>
      <main className={user.role === 'MASTER' ? 'masterContent masterContentNarrow' : 'page profilePage'}>
        <div className="pageHead">
          <div className="pageHeadMain">
            <p className="eyebrow">Akun saya</p>
            <h1 className="pageTitle">Profil saya</h1>
            <p className="pageSub">Perbarui informasi yang terlihat pada akun Academy AIPreneur.</p>
          </div>
        </div>
        <ProfileForm user={user} />
        <NotificationPreferencesForm initial={preferences} />
        <PasswordForm />
        <SessionManager sessions={sessions} />
      </main>
    </AppShell>
  );
}
