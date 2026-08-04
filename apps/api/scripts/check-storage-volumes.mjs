/**
 * Menjaga agar setiap direktori penyimpanan punya volume yang benar-benar
 * dipasang.
 *
 * Cacat yang mendorong penjaga ini lolos dari seluruh tes: `LessonMaterial`
 * menulis ke `/data/materials`, nginx menyajikannya dari `/data/materials`, dan
 * tidak ada satu pun volume di sana. Unggahan "berhasil" ke filesystem
 * sementara kontainer, penyajiannya 404, dan berkasnya lenyap pada deploy
 * berikutnya. Tes tidak dapat melihatnya karena tes tidak menjalankan compose,
 * dan verifikasi deploy tidak melihatnya karena seluruh kontainer memang sehat.
 */
import { readFile } from 'node:fs/promises';

const konfigurasi = await readFile(new URL('../src/config/configuration.ts', import.meta.url), 'utf8');
const compose = await readFile(new URL('../../../docker-compose.coolify.yml', import.meta.url), 'utf8');
const nginx = await readFile(new URL('../../../deploy/nginx/coolify.conf.template', import.meta.url), 'utf8');

/** Direktori bawaan yang disebut konfigurasi, mis. '/data/videos'. */
const direktori = [...new Set([...konfigurasi.matchAll(/'(\/data\/[a-z-]+)'/g)].map((m) => m[1]))];

if (direktori.length === 0) {
  console.error('Tidak menemukan satu pun direktori /data pada configuration.ts.');
  console.error('Penjaga ini bergantung pada bentuk itu; perbarui polanya bila konfigurasinya berubah.');
  process.exit(1);
}

/**
 * Aturannya tidak seragam, dan itu disengaja.
 *
 * Setiap direktori wajib dipasang pada layanan api — tanpa itu berkasnya
 * ditulis ke filesystem sementara kontainer dan lenyap pada deploy berikutnya.
 * Pemasangan di gateway hanya wajib bagi direktori yang memang disajikan nginx
 * lewat `alias`; avatar dan thumbnail disajikan API sendiri, jadi menuntut
 * volume di gateway untuk keduanya justru salah.
 *
 * Versi pertama penjaga ini memeriksa "path muncul di mana pun", dan versi
 * kedua menuntut keduanya. Kontrol negatif membongkar yang pertama; menjalankan
 * yang kedua membongkar bahwa aturannya sendiri keliru.
 */
const disajikanNginx = new Set(
  [...nginx.matchAll(/alias\s+(\/data\/[a-z-]+)\/?;/g)].map((m) => m[1]),
);

const kurang = direktori.flatMap((dir) => {
  const alasan = [];
  if (!compose.includes(`:${dir}\n`)) alasan.push('api (tulis)');
  if (disajikanNginx.has(dir) && !compose.includes(`:${dir}:ro`)) {
    alasan.push('gateway (baca saja, karena nginx menyajikannya)');
  }
  return alasan.length > 0 ? [`${dir} — belum dipasang di ${alasan.join(' dan ')}`] : [];
});

if (kurang.length > 0) {
  console.error('Direktori penyimpanan tanpa volume pada docker-compose.coolify.yml:\n');
  for (const dir of kurang) console.error(`  ${dir}`);
  console.error(
    '\nTambahkan volumenya pada layanan api (tulis) dan gateway (baca saja), lalu\n' +
      'daftarkan namanya di bagian `volumes:`. Tanpa itu berkasnya hilang tiap deploy.',
  );
  process.exit(1);
}

console.log(
  `Seluruh ${direktori.length} direktori penyimpanan sudah punya volume; ` +
    `${disajikanNginx.size} di antaranya juga terpasang di gateway.`,
);
