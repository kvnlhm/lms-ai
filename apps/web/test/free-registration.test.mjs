import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('pendaftaran gratis tidak menempuh alur checkout', async () => {
  const form = await read('../app/daftar-gratis/free-registration-form.tsx');

  // Paket Rp 0 lewat checkout akan melahirkan pesanan PAID, dan pesanan PAID
  // adalah definisi anggota berbayar — jalan itu membatalkan seluruh paywall.
  assert.match(form, /POST\('\/api\/v1\/auth\/free-registrations'/);
  assert.doesNotMatch(form, /registration\/checkout/);
  assert.doesNotMatch(form, /snapToken|midtrans/i);
});

test('halaman daftar gratis menyebut batasnya sebelum orang mendaftar', async () => {
  const page = await read('../app/daftar-gratis/page.tsx');

  assert.match(page, /Daftar gratis/);
  // Menahan keterangan ini menaikkan pendaftaran dan menurunkan kepercayaan
  // pada hal yang sama.
  assert.match(page, /ditandai sebagai contoh|ditandai contoh/);
  assert.match(page, /Membaca diskusi komunitas/);
  assert.match(page, /href="\/register"|href=\{'\/register'\}/);
});

test('halaman jualan menawarkan jalan gratis di bawah tombol bayar', async () => {
  const [form, css] = await Promise.all([
    read('../app/register/registration-form.tsx'),
    read('../app/styles.css'),
  ]);

  assert.match(form, /href="\/daftar-gratis"/);
  assert.match(form, /Daftar gratis dulu/);
  // Di bawah tombol bayar, bukan di kepala halaman: urutannya bagian dari
  // keputusannya.
  assert.ok(
    form.indexOf('regSubmit') < form.indexOf('regFreeHint'),
    'tautan gratis harus berada setelah tombol bayar',
  );
  assert.match(css, /\.regFreeHint \{/);
});

test('pembuktian email dikerjakan lewat POST, bukan saat halamannya dibuka', async () => {
  const [page, komponen] = await Promise.all([
    read('../app/verifikasi-email/page.tsx'),
    read('../app/verifikasi-email/verify-email.tsx'),
  ]);

  // Pemindai tautan dan pra-muat browser rutin membuka setiap URL yang mereka
  // temukan; token sekali pakai yang habis oleh pemindai menyisakan pemiliknya
  // dengan tautan yang sudah terpakai tanpa pernah ia tekan.
  assert.match(komponen, /'use client'/);
  assert.match(komponen, /POST\('\/api\/v1\/auth\/email-verifications'/);
  assert.match(komponen, /useEffect/);

  // Tanpa token, halamannya tidak memasang formulir yang tidak dapat bekerja.
  assert.match(page, /token \?/);
  assert.match(page, /Tautan tidak lengkap/);
});
