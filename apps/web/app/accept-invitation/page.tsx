import { InvitationForm } from './invitation-form';

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;
  return (
    <main className="authPage">
      <section className="authCard">
        <h1>Aktifkan akun</h1>
        <p className="pageSub">Buat password baru untuk menyelesaikan undangan akunmu.</p>
        <InvitationForm token={token} />
      </section>
    </main>
  );
}
