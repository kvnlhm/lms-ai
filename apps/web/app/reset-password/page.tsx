import { ResetPasswordForm } from './reset-password-form';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;
  return (
    <main className="authPage">
      <section className="authCard">
        <h1>Reset password</h1>
        <p className="pageSub">Buat password baru untuk akunmu.</p>
        <ResetPasswordForm token={token} />
      </section>
    </main>
  );
}
