#!/usr/bin/env node
/**
 * Memastikan endpoint yang mengembalikan `Paginated` juga mendokumentasikannya.
 *
 * Interceptor membungkus respons di runtime, jadi sebuah endpoint bisa saja
 * mengirim `meta` berisi page/pageSize/total/totalPages sementara dokumen
 * OpenAPI-nya menyatakan `meta` hanya berisi requestId. Semua tetap hijau:
 * build lolos, typecheck lolos, e2e lolos — karena runtime-nya memang benar.
 *
 * Yang rusak adalah sisi web. Tanpa tipe untuk `meta` paginasi, tidak ada cara
 * bertipe untuk mengetahui ada berapa halaman, sehingga jalan termudah menjadi
 * "ambil halaman pertama dengan pageSize besar dan anggap itu seluruhnya".
 * Isi di luar halaman pertama lalu menjadi tidak terjangkau, tanpa satu pun
 * tanda bahwa ia ada. Pola itu sempat muncul di tiga endpoint sekaligus.
 *
 * Pemeriksaan ini menutup celahnya di tempat asalnya, bukan di setiap
 * pemanggil.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const AKAR = new URL('../src', import.meta.url).pathname;
const RUTE = /^\s*@(Get|Post|Put|Patch|Delete)\(/;

function berkasController(dir) {
  return readdirSync(dir).flatMap((nama) => {
    const jalur = join(dir, nama);
    if (statSync(jalur).isDirectory()) return berkasController(jalur);
    return nama.endsWith('.controller.ts') ? [jalur] : [];
  });
}

const pelanggaran = [];

for (const jalur of berkasController(AKAR)) {
  const baris = readFileSync(jalur, 'utf8').split('\n');

  baris.forEach((isi, index) => {
    if (!isi.includes('new Paginated(')) return;

    // Naik sampai dekorator rute terdekat: di sanalah blok dekorator endpoint
    // ini dimulai.
    let awal = index;
    while (awal >= 0 && !RUTE.test(baris[awal])) awal -= 1;
    if (awal < 0) return;

    const blok = baris.slice(awal, index).join('\n');
    if (!blok.includes('@ApiEnvelopeList(')) {
      pelanggaran.push({
        berkas: jalur.slice(AKAR.length - 3),
        baris: awal + 1,
        rute: baris[awal].trim(),
      });
    }
  });
}

if (pelanggaran.length > 0) {
  console.error('Endpoint berikut mengembalikan Paginated tetapi tidak mendokumentasikannya');
  console.error('dengan @ApiEnvelopeList, sehingga meta paginasinya tidak sampai ke client:\n');
  for (const { berkas, baris, rute } of pelanggaran) {
    console.error(`  ${berkas}:${baris}  ${rute}`);
  }
  console.error('\nGanti @ApiEnvelopeArray menjadi @ApiEnvelopeList, atau tambahkan bila belum ada.');
  process.exit(1);
}

console.log('Seluruh endpoint berhalaman sudah mendokumentasikan meta paginasinya.');
