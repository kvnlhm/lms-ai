export type CsvValue = string | number | boolean | Date | null | undefined;

/**
 * Karakter yang membuat Excel dan Google Sheets memperlakukan sel sebagai
 * rumus, bukan teks.
 */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Mengubah satu nilai menjadi sel CSV yang aman.
 *
 * Dua hal terjadi di sini, dan yang kedua adalah alasan fungsi ini ada.
 *
 * Pertama, pelolosan CSV biasa: sel yang memuat pemisah, kutip, atau baris baru
 * dibungkus kutip ganda.
 *
 * Kedua, dan lebih penting: sel yang diawali `=`, `+`, `-`, atau `@` dieksekusi
 * sebagai rumus ketika berkasnya dibuka. Nama pengguna berisi
 * `=HYPERLINK(...)` akan berubah menjadi tautan aktif di layar Master, dan
 * varian yang lebih jauh dapat memanggil perintah eksternal. Data ini datang
 * dari nama, judul, dan isi forum yang ditulis pengguna, jadi anggapannya
 * selalu tidak tepercaya. Awalan kutip satu menetralkannya tanpa mengubah apa
 * yang terbaca manusia.
 */
export function csvCell(value: CsvValue, delimiter = ','): string {
  if (value === null || value === undefined) return '';

  let text: string;
  if (value instanceof Date) text = value.toISOString();
  else if (typeof value === 'boolean') text = value ? 'ya' : 'tidak';
  else text = String(value);

  // Penjagaan hanya berlaku untuk teks. Angka, tanggal, dan boolean dibentuk
  // oleh laporan ini sendiri, bukan oleh pengguna — menetralkannya justru
  // merusak nilai yang sah: angka negatif akan berubah menjadi teks `'-5`
  // yang tidak dapat dijumlahkan di spreadsheet.
  if (typeof value === 'string' && FORMULA_TRIGGERS.some((t) => text.startsWith(t))) {
    text = `'${text}`;
  }

  const needsQuotes =
    text.includes(delimiter) || text.includes('"') || text.includes('\n') || text.includes('\r');
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface CsvTable {
  headers: string[];
  rows: CsvValue[][];
}

/**
 * Menyusun tabel menjadi CSV lengkap.
 *
 * CRLF dipakai karena itu yang diharapkan RFC 4180 dan Excel di Windows.
 * BOM UTF-8 ditambahkan agar Excel membaca nama berhuruf non-ASCII dengan
 * benar; tanpa itu "Ratna Wulandari" masih aman, tetapi judul kursus bertanda
 * baca khas Indonesia berubah menjadi karakter rusak.
 */
export function toCsv(table: CsvTable, delimiter = ','): string {
  const lines = [
    table.headers.map((header) => csvCell(header, delimiter)).join(delimiter),
    ...table.rows.map((row) => row.map((cell) => csvCell(cell, delimiter)).join(delimiter)),
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Nama berkas yang aman dipakai pada header Content-Disposition. */
export function csvFilename(reportKey: string, generatedAt: Date): string {
  // `2026-07-31-140509`: tanggal tetap bertanda hubung agar terbaca, jamnya
  // dirapatkan karena titik dua tidak sah pada nama berkas Windows.
  const [date, time] = generatedAt.toISOString().slice(0, 19).split('T');
  const stamp = `${date}-${time!.replace(/:/g, '')}`;
  return `${reportKey.replace(/[^a-z0-9-]/gi, '')}-${stamp}.csv`;
}
