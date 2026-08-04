#!/usr/bin/env node
/**
 * Memastikan setiap kelas CSS yang dipakai komponen benar-benar didefinisikan.
 *
 * Ada satu kelas cacat yang lolos dari typecheck, lint, maupun build: kelas
 * yang tidak pernah ditulis di stylesheet. `.authPage` pernah begitu, dan
 * akibatnya halaman penerimaan undangan serta pengaturan ulang password —
 * tepat tempat pelajar berbayar membuat password pertamanya — tampil tanpa
 * gaya sama sekali. Tidak ada satu pun perkakas yang mengeluh.
 *
 * Pemeriksaan ini tidak menggantikan melihat halamannya dengan mata; ia hanya
 * menutup satu kelas kesalahan yang selama ini tidak terdeteksi sama sekali.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = fileURLToPath(new URL('../app', import.meta.url));
const stylesheet = join(appDir, 'styles.css');

/** Kelas yang datang dari luar stylesheet kita dan memang tidak perlu ada di sana. */
const EXTERNAL = new Set(['dark', 'light']);

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx$/.test(entry) ? [full] : [];
  });
}

const css = readFileSync(stylesheet, 'utf8');
const defined = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1]));

const missing = new Map();

for (const file of walk(appDir)) {
  const source = readFileSync(file, 'utf8');

  // Hanya className dengan nilai literal yang dapat diperiksa dengan andal.
  // Nilai hasil perhitungan dilewati alih-alih ditebak; menebak akan
  // menghasilkan peringatan palsu yang membuat pemeriksaan ini diabaikan.
  const literals = [
    ...source.matchAll(/className=(?:"([^"]*)"|\{`([^`${}]*)`\})/g),
  ].map((match) => match[1] ?? match[2] ?? '');

  for (const value of literals) {
    for (const name of value.split(/\s+/).filter(Boolean)) {
      if (defined.has(name) || EXTERNAL.has(name)) continue;
      const where = missing.get(name) ?? new Set();
      where.add(relative(appDir, file));
      missing.set(name, where);
    }
  }
}

/*
 * Cacat kedua dengan bentuk yang sama: token yang dipakai tetapi tidak pernah
 * didefinisikan. `var(--primary)` yang tidak ada nilainya membuat seluruh
 * deklarasi itu gugur — bukan hanya warnanya yang salah, melainkan tidak ada
 * warna sama sekali — dan tidak ada perkakas yang mengeluh. Empat token
 * (`--primary`, `--surface-2`, `--border`, `--line-strong`) pernah begitu di
 * halaman komunitas, dan cacatnya bertahan sampai seseorang menghitungnya
 * dengan tangan.
 */
const tokenTerdefinisi = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

// `var(--x, merah)` sah walau `--x` tidak ada: nilai cadangannya yang dipakai.
// Yang berbahaya hanya pemakaian tanpa cadangan.
const tokenHilang = new Set(
  [...css.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)]
    .map((m) => m[1])
    .filter((nama) => !tokenTerdefinisi.has(nama)),
);

/*
 * Cacat ketiga: warna merek ditulis sebagai angka, bukan lewat tokennya.
 *
 * Ini yang membuat pergantian merek tidak pernah selesai. Ketika aksen berpindah
 * ke biru listrik, sidebar Master tetap abu-abu, tombol Master tetap hitam,
 * batang analitik berpindah warna di tengah gradien, dan lambang di sidebar
 * memakai tulisan putih yang kontrasnya jatuh ke 1,91:1 — semuanya karena
 * warnanya ditulis langsung dan tidak ikut berubah.
 *
 * Aturannya sengaja sempit: hanya heks yang *persis sama* dengan nilai sebuah
 * token yang ditandai. Menandai setiap warna akan menghasilkan keluhan palsu
 * pada gradien dekoratif dan overlay pemutar, dan penjaga yang berisik akan
 * dimatikan orang. Putih dan hitam murni dikecualikan karena terlalu umum
 * untuk disebut penyimpangan merek.
 */
const UMUM = new Set(['#fff', '#ffffff', '#000', '#000000']);
const blokToken = [...css.matchAll(/(?::root|@media \(prefers-color-scheme)[^{]*\{[\s\S]*?\n\}/g)]
  .map((m) => m[0])
  .join('\n');
const nilaiToken = new Map();
for (const m of blokToken.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g)) {
  const warna = m[2].toLowerCase();
  if (!nilaiToken.has(warna)) nilaiToken.set(warna, m[1]);
}

const warnaLangsung = [];
for (const [nomor, baris] of css.split('\n').entries()) {
  if (blokToken.includes(baris) || baris.trimStart().startsWith('*')) continue;
  for (const m of baris.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const warna = m[0].toLowerCase();
    if (UMUM.has(warna) || !nilaiToken.has(warna)) continue;
    warnaLangsung.push({ nomor: nomor + 1, warna, token: nilaiToken.get(warna) });
  }
}

if (missing.size === 0 && tokenHilang.size === 0 && warnaLangsung.length === 0) {
  console.log('Seluruh kelas, token, dan warna merek CSS sudah pada tempatnya.');
  process.exit(0);
}

if (warnaLangsung.length > 0) {
  console.error(`${warnaLangsung.length} warna ditulis langsung padahal sudah punya token:\n`);
  for (const { nomor, warna, token } of warnaLangsung) {
    console.error(`  styles.css:${nomor}  ${warna}  →  var(${token})`);
  }
  console.error('\nWarna yang ditulis langsung tidak ikut berubah saat merek atau tema berganti.');
}

if (missing.size > 0) {
  console.error(`${missing.size} kelas dipakai tetapi tidak pernah didefinisikan di styles.css:\n`);
  for (const [name, files] of [...missing].sort()) {
    console.error(`  .${name}`);
    for (const file of files) console.error(`      ${file}`);
  }
  console.error('\nTambahkan definisinya, atau perbaiki nama kelas yang salah ketik.');
}

if (tokenHilang.size > 0) {
  console.error(`\n${tokenHilang.size} token dipakai lewat var() tetapi tidak pernah didefinisikan:\n`);
  for (const nama of [...tokenHilang].sort()) {
    const jumlah = [...css.matchAll(new RegExp(`var\\(\\s*${nama}\\s*\\)`, 'g'))].length;
    console.error(`  ${nama}  (${jumlah}x)`);
  }
  console.error('\nDeklarasinya gugur diam-diam. Definisikan tokennya, atau beri nilai cadangan.');
}

process.exit(1);
