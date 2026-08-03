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
  ['/api/v1/admin/errors/{errorId}/resolve', 'dipanggil lewat template literal'],
  ['/api/v1/admin/errors/{errorId}/reopen', 'dipanggil lewat template literal'],
  // Belum ada antarmukanya, dan itu memang diketahui.
  ['/api/v1/admin/users/{userId}/reset-mfa', 'belum ada antarmukanya'],
  ['/api/v1/auth/logout-all', 'belum ada antarmukanya'],
  ['/api/v1/me/announcements/unread-count', 'belum ada antarmukanya'],
]);

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

test('setiap endpoint API punya pemanggil di web, atau alasan tertulis mengapa tidak', () => {
  const yatim = Object.keys(spec.paths).filter(
    (path) => !blob.includes(path) && !DILUAR_JANGKAUAN_WEB.has(path),
  );
  assert.deepEqual(
    yatim,
    [],
    `Endpoint tanpa pemanggil di web:\n  ${yatim.join('\n  ')}\n` +
      'Sambungkan ke antarmuka, atau daftarkan di DILUAR_JANGKAUAN_WEB beserta alasannya.',
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
