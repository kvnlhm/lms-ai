import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manager = await readFile(new URL('../app/master/access-tiers/tier-manager.tsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');

test('tombol buat paket memiliki jarak yang cukup dari deskripsi', () => {
  assert.match(manager, /className="btn tierCreateButton"/);
  assert.match(css, /\.tierCreateButton\s*\{[^}]*margin-top:\s*18px/);
});

test('pemilihan kursus paket memiliki pencarian dan aksi pilih cepat', () => {
  assert.match(manager, /Cari kursus dalam paket/);
  assert.match(manager, /Pilih semua/);
  assert.match(manager, /Kosongkan/);
  assert.match(css, /\.tierCourseTools/);
});

test('kartu paket tunggal tetap berada di tengah dan form memiliki kode promo', async () => {
  assert.match(css, /\.tierGrid[^}]*justify-content:\s*center/);
  assert.match(css, /\.regPromo/);
  assert.match((await readFile(new URL('../app/register/registration-form.tsx', import.meta.url), 'utf8')), /Kode promo/);
  assert.match(manager, /Kode promo paket/);
  assert.match(manager, /promoCode/);
  assert.match(manager, /Potongan promo/);
  assert.match(manager, /promoDiscountIdr/);
  assert.match((await readFile(new URL('../app/register/registration-form.tsx', import.meta.url), 'utf8')), /Potongan promo/);
});

test('tautan kontak memakai ikon tetapi tetap memiliki nama aksesibel', async () => {
  const page = await readFile(new URL('../app/register/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /aria-label=\{tautan\.label\}/);
  assert.match(page, /title=\{tautan\.label\}/);
});

test('pendaftaran menyediakan halaman syarat dan ketentuan sebelum persetujuan', async () => {
  const form = await readFile(new URL('../app/register/registration-form.tsx', import.meta.url), 'utf8');
  const terms = await readFile(new URL('../app/terms/page.tsx', import.meta.url), 'utf8');
  assert.match(form, /href="\/terms"/);
  assert.match(form, /Syarat dan Ketentuan/);
  assert.match(terms, /Syarat dan Ketentuan/);
  assert.match(terms, /Pembayaran/);
});

test('kolom paket sejajar dan spinner angka mengikuti tema gelap', () => {
  assert.match(css, /\.tierFieldGrid[^}]*align-items:\s*start/);
  assert.match(css, /\.tierFieldGrid input\[type="number"\][^}]*color-scheme:\s*dark/);
});
