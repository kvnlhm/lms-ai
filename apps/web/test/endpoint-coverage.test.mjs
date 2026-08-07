import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * Penjaga terhadap satu pola yang berulang di repo ini: server sanggup
 * menjawab, tetapi tidak ada satu pun antarmuka yang bertanya.
 *
 * Endpoint yang tidak pernah dipanggil bukan selalu cacat — webhook, health
 * check, dan berkas yang ditarik langsung oleh tag `<video>`/`<img>` memang
 * tidak dipanggil dari kode. Karena itu daftar pengecualiannya ditulis tegas:
 * menambah satu baris ke sana adalah keputusan sadar, bukan kelalaian.
 */

const web = new URL('../app/', import.meta.url);
const spec = JSON.parse(await readFile(new URL('../../api/openapi.json', import.meta.url), 'utf8'));

/** Endpoint yang memang bukan urusan kode web, beserta alasannya. */
const DILUAR_JANGKAUAN_WEB = new Map([
  ['/api/v1/webhooks/midtrans', 'dipanggil Midtrans'],
  ['/api/v1/webhooks/resend', 'dipanggil Resend'],
  ['/api/v1/webhooks/whatsapp', 'dipanggil Meta'],
  ['/api/v1/health/live', 'dipanggil orkestrator kontainer'],
  ['/api/v1/health/ready', 'dipanggil orkestrator kontainer'],
  ['/api/v1/auth/avatars/{filename}', 'ditarik langsung oleh tag <img>'],
  ['/api/v1/courses/thumbnails/{filename}', 'ditarik langsung oleh tag <img>'],
  ['/api/v1/playback-sessions/{playbackSessionId}/content', 'ditarik langsung oleh tag <video>'],
  ['/api/v1/admin/videos/{videoAssetId}/content', 'diunggah lewat XHR agar ada progres'],
  ['/api/v1/admin/reports/{reportKey}.csv', 'diunduh lewat href, bukan fetch'],
  ['/api/v1/admin/lessons/{lessonId}/material', 'diunggah lewat XHR agar ada progres'],
  ['/api/v1/learn/lessons/{lessonId}/material', 'dibuka lewat href, bukan fetch'],
  ['/api/v1/admin/errors/{errorId}/resolve', 'dipanggil lewat template literal'],
  ['/api/v1/admin/errors/{errorId}/reopen', 'dipanggil lewat template literal'],
  [
    '/api/v1/telemetry/client-errors',
    'dipanggil lewat template literal dari app/lib/report-error.ts dan instrumentation.ts',
  ],
  [
    '/api/v1/admin/reports',
    'katalog laporan sengaja ditulis di web agar keterangan tiap laporan lebih jelas; lihat app/master/reports/report-exporter.tsx',
  ],
]);

/**
 * Endpoint yang memang belum tersambung, dan sengaja dibiarkan begitu sampai
 * ada keputusan.
 *
 * Dipisahkan dari daftar di atas karena alasannya berbeda jenis: yang di atas
 * tidak akan pernah dipanggil kode web, sedangkan yang di sini adalah celah
 * yang diakui. Menaruhnya di satu daftar akan membuat celah tampak seperti
 * keputusan desain, dan setahun lagi tidak ada yang bisa membedakannya.
 *
 * Kosong bukan berarti tidak berguna: satu-satunya penghuninya, PATCH masa
 * berlaku akses, dihapus dari API setelah diputuskan bahwa akses kursus terbit
 * bersifat permanen. Daftar ini menunggu celah berikutnya.
 */
const BELUM_DIPUTUSKAN = new Map([]);

async function sumberWeb() {
  const isi = [];
  async function telusuri(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const anak = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
      if (entry.isDirectory()) await telusuri(anak);
      else if (/\.tsx?$/.test(entry.name)) isi.push(await readFile(anak, 'utf8'));
    }
  }
  await telusuri(web);
  return isi.join('\n');
}

const blob = await sumberWeb();

/**
 * Sebuah endpoint dihitung terpanggil hanya bila path-nya muncul sebagai
 * literal utuh di antara tanda kutip — persis bentuk yang dipakai klien:
 * `client.GET('/api/v1/...')`.
 *
 * Sebelumnya pemeriksaan ini memakai `blob.includes(path)` tanpa kutip, dan itu
 * membuatnya buta terhadap path yang menjadi awalan path lain:
 * `/admin/enrollments/{enrollmentId}` dianggap terpanggil semata-mata karena
 * `/admin/enrollments/{enrollmentId}/remove` ada di kode. Tiga endpoint lolos
 * karena celah itu, satu di antaranya memang tidak pernah tersambung —
 * tepat jenis cacat yang seharusnya ditangkap penjaga ini.
 *
 * Panggilan lewat template literal tidak akan cocok dengan aturan ini. Itu
 * disengaja: bentuk begitu tidak dapat diperiksa dengan andal, jadi ia harus
 * didaftarkan beserta alasannya alih-alih lolos diam-diam.
 */
export function dipanggilDi(sumber, path) {
  return sumber.includes(`'${path}'`) || sumber.includes(`"${path}"`);
}

test('setiap endpoint API punya pemanggil di web, atau alasan tertulis mengapa tidak', () => {
  const yatim = Object.keys(spec.paths).filter(
    (path) =>
      !dipanggilDi(blob, path) &&
      !DILUAR_JANGKAUAN_WEB.has(path) &&
      !BELUM_DIPUTUSKAN.has(path),
  );
  assert.deepEqual(
    yatim,
    [],
    `Endpoint tanpa pemanggil di web:\n  ${yatim.join('\n  ')}\n` +
      'Sambungkan ke antarmuka, atau daftarkan di DILUAR_JANGKAUAN_WEB beserta alasannya.',
  );
});

test('celah yang diakui tetap terlihat, dan hilang begitu tersambung', () => {
  // Daftar ini tidak boleh menjadi tempat sampah. Begitu sebuah endpoint
  // benar-benar dipanggil, barisnya wajib dicabut — kalau dibiarkan, penjaga
  // ini berhenti mengawasi endpoint tersebut tanpa ada yang menyadarinya.
  for (const [path, alasan] of BELUM_DIPUTUSKAN) {
    assert.ok(spec.paths[path], `${path} sudah tidak ada di API; cabut barisnya.`);
    assert.ok(alasan.length > 60, `${path} perlu alasan yang menjelaskan, bukan sekadar label.`);
    assert.equal(
      dipanggilDi(blob, path),
      false,
      `${path} ternyata sudah dipanggil dari web; pindahkan keluar dari BELUM_DIPUTUSKAN.`,
    );
  }
});

test('path yang menjadi awalan path lain tidak dianggap terpanggil', () => {
  // Kontrol atas celah yang baru ditutup. Tanpa test ini, seseorang dapat
  // mengembalikan pencocokan longgar dan seluruh berkas tetap hijau.
  const sumber = `client.POST('/api/v1/admin/enrollments/{enrollmentId}/remove', {})`;
  assert.equal(dipanggilDi(sumber, '/api/v1/admin/enrollments/{enrollmentId}/remove'), true);
  assert.equal(dipanggilDi(sumber, '/api/v1/admin/enrollments/{enrollmentId}'), false);
});

test('daftar pengecualian tidak menyimpan baris yang sudah tidak relevan', () => {
  // Pengecualian yang endpoint-nya sudah dihapus dari API, atau yang ternyata
  // sudah tersambung, akan menumpuk diam-diam dan melemahkan penjaga ini.
  const adaDiSpec = Object.keys(spec.paths);
  const usang = [...DILUAR_JANGKAUAN_WEB.keys()].filter((path) => !adaDiSpec.includes(path));
  assert.deepEqual(usang, [], `Pengecualian menunjuk endpoint yang tidak ada lagi:\n  ${usang.join('\n  ')}`);

  const sudahTersambung = [...DILUAR_JANGKAUAN_WEB.keys()].filter((path) => dipanggilDi(blob, path));
  assert.deepEqual(
    sudahTersambung,
    [],
    `Sudah dipanggil dari web, jadi pengecualiannya perlu dihapus:\n  ${sudahTersambung.join('\n  ')}`,
  );
});

test('pembukaan pelajaran benar-benar dicatat', async () => {
  // Regresi yang mahal: endpointnya ada dan teruji, tetapi selama berbulan-bulan
  // tidak ada yang memanggilnya. Akibatnya histori tidak pernah dapat
  // menampilkan "Pelajaran dibuka", metrik pembukaan pada dasbor Master
  // selamanya nol, dan "Lanjutkan belajar" tidak dapat mengingat sampai mana
  // seseorang membaca.
  const tracker = await readFile(new URL('learn/[courseId]/[lessonId]/lesson-open-tracker.tsx', web), 'utf8');
  const halaman = await readFile(new URL('learn/[courseId]/[lessonId]/page.tsx', web), 'utf8');
  assert.match(tracker, /POST\('\/api\/v1\/learn\/lessons\/\{lessonId\}\/open'/);
  assert.match(halaman, /<LessonOpenTracker lessonId=\{lessonId\} \/>/);
});

/**
 * Parameter query yang diterima API tetapi tidak pernah dikirim antarmuka.
 *
 * Lapisan kedua dari cacat yang sama. Penjaga di atas hanya melihat apakah
 * sebuah endpoint punya pemanggil; ia tidak melihat apakah pemanggil itu
 * memakai seluruh kemampuannya. Sebuah endpoint dapat terpanggil setiap hari
 * dan tetap menyembunyikan setengah kegunaannya di balik parameter yang tidak
 * pernah diisi siapa pun.
 *
 * Persis itu yang terjadi pada `types` di `/api/v1/search`: pencariannya
 * dipakai terus-menerus, sanggup menyempit ke satu jenis, dan header
 * kelompoknya bahkan sudah menyebutkan "12 kecocokan" — sementara tujuh
 * sisanya tidak dapat dicapai lewat jalan mana pun.
 */
const PARAMETER_DILUAR_JANGKAUAN = new Map([]);

/**
 * Sebuah parameter dihitung terkirim bila namanya muncul sebagai kunci objek,
 * bentuk yang dipakai klien: `params: { query: { limit: 5 } }`.
 *
 * Sengaja longgar. Nama sependek `q` akan cocok di banyak tempat yang tidak
 * ada hubungannya, dan itu dapat membuat parameter yang mati terbaca sebagai
 * hidup. Mengetatkannya menuntut penguraian TypeScript sungguhan, dan penjaga
 * yang salah menuduh akan lebih cepat dimatikan orang daripada diperbaiki.
 * Yang penting ia menangkap parameter yang namanya tidak muncul sama sekali —
 * dan itulah bentuk kelalaian yang sebenarnya terjadi.
 */
export function dikirimDi(sumber, nama) {
  return (
    new RegExp(`\\b${nama}\\s*:`).test(sumber) ||
    sumber.includes(`'${nama}'`) ||
    sumber.includes(`"${nama}"`)
  );
}

function parameterQuery() {
  const daftar = [];
  for (const [path, operasi] of Object.entries(spec.paths)) {
    for (const [metode, op] of Object.entries(operasi)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(metode)) continue;
      for (const parameter of op.parameters ?? []) {
        if (parameter.in === 'query') {
          daftar.push({ path, metode: metode.toUpperCase(), nama: parameter.name });
        }
      }
    }
  }
  return daftar;
}

test('setiap parameter query punya pengirim di web, atau alasan tertulis mengapa tidak', () => {
  const mati = parameterQuery()
    .filter(({ path, nama }) => {
      if (DILUAR_JANGKAUAN_WEB.has(path) || BELUM_DIPUTUSKAN.has(path)) return false;
      if (PARAMETER_DILUAR_JANGKAUAN.has(`${path} ${nama}`)) return false;
      return !dikirimDi(blob, nama);
    })
    .map(({ metode, path, nama }) => `${metode} ${path} — ${nama}`);

  assert.deepEqual(
    mati,
    [],
    `Parameter yang diterima API tetapi tidak pernah dikirim web:\n  ${mati.join('\n  ')}\n` +
      'Sambungkan ke antarmuka, atau daftarkan di PARAMETER_DILUAR_JANGKAUAN beserta alasannya.',
  );
});

test('pencarian dapat menyempit ke satu jenis, bukan sekadar mengaku punya lebih banyak', () => {
  // Kontrol atas celah yang baru ditutup. Menyebut jumlah kecocokan tanpa
  // menyediakan jalan ke sana lebih buruk daripada tidak menyebutkannya.
  const berkas = new URL('components/global-search.tsx', web);
  return readFile(berkas, 'utf8').then((isi) => {
    assert.match(isi, /types:\s*\[/, 'pencarian tidak pernah mengirim penyempitan jenis');
    assert.match(isi, /Lihat semua/, 'tidak ada jalan menuju hasil selebihnya');
  });
});

test('lambang merek dirujuk lewat impor, bukan alamat polos', async () => {
  // Alamat statis seperti `/icon.png` dilayani dengan `immutable` selama
  // setahun. Lambang yang sudah diganti tetap tampil versi lama di browser
  // yang pernah membukanya, dan tidak ada cara memberitahunya. Impor membuat
  // alamatnya membawa sidik jari isi berkas, sehingga penggantian berikutnya
  // langsung terlihat.
  const berkas = await readFile(new URL('components/brand-mark.tsx', web), 'utf8');
  assert.match(berkas, /^import \w+ from '\.\.\/icon\.png';/m, 'lambang tidak diimpor');
  assert.doesNotMatch(berkas, /src="\/icon\.png"/, 'lambang masih memakai alamat polos');
});
