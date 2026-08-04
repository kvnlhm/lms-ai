/**
 * Menjaga agar setiap endpoint yang mengembalikan body mendokumentasikan
 * bentuknya.
 *
 * Endpoint tanpa dekorator respons tidak muncul di OpenAPI, sehingga klien
 * yang di-generate tidak punya tipe untuknya — dan pemanggilnya terpaksa
 * menulis `as unknown as`. Cast itu bukan sekadar tidak rapi: ia mematikan
 * pemeriksaan tipe justru pada batas tempat kontrak paling mudah bergeser
 * tanpa ketahuan.
 *
 * Endpoint yang memang tidak berbody didaftarkan tegas di bawah, supaya
 * menambahkannya menjadi keputusan sadar dan bukan kelalaian.
 */
import { readdir, readFile } from 'node:fs/promises';

const AKAR = new URL('../src/', import.meta.url);

/** Endpoint tanpa body, beserta alasannya. */
const TANPA_BODY = new Map([
  ['GET live', 'probe orkestrator, bentuknya bukan kontrak publik'],
  ['GET ready', 'probe orkestrator'],
  ['PUT admin/videos/:videoAssetId/content', 'unggahan streaming, bukan JSON'],
  ['GET playback-sessions/:playbackSessionId/content', 'diteruskan reverse proxy lewat X-Accel-Redirect'],
]);

async function berkasController(dir) {
  const hasil = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const anak = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
    if (entry.isDirectory()) hasil.push(...(await berkasController(anak)));
    else if (entry.name.endsWith('.controller.ts')) hasil.push(anak);
  }
  return hasil;
}

const DEKORATOR_RESPONS = ['@ApiEnvelope(', '@ApiEnvelopeList(', '@ApiEnvelopeArray('];
const temuan = [];

for (const berkas of await berkasController(AKAR)) {
  const baris = (await readFile(berkas, 'utf8')).split('\n');
  for (let i = 0; i < baris.length; i += 1) {
    const rute = /^\s*@(Get|Post|Put|Patch|Delete)\((?:'([^']*)')?/.exec(baris[i]);
    if (!rute) continue;

    // Kumpulkan seluruh dekorator sampai tanda tangan methodnya.
    //
    // Batasnya adalah deklarasi method, bukan "baris pertama yang bukan @":
    // dekorator seperti `@ApiHeader({ ... })` membentang beberapa baris dengan
    // isi yang tidak diawali @, dan berhenti di sana membuat penjaga ini
    // melewatkan `@ApiEnvelope` yang berada sesudahnya — positif palsu.
    const blok = [baris[i]];
    let j = i + 1;
    while (j < baris.length && !/^ {2}(?:async )?[a-zA-Z_]\w*\s*\(/.test(baris[j])) {
      blok.push(baris[j]);
      j += 1;
    }
    const dekorator = blok.join('\n');
    const tandaTangan = baris.slice(j, j + 8).join('\n');

    if (DEKORATOR_RESPONS.some((d) => dekorator.includes(d))) continue;
    // 204 memang tidak berbody menurut definisinya sendiri.
    if (dekorator.includes('@HttpCode(204)')) continue;
    // Respons yang ditulis langsung ke stream tidak melewati interceptor envelope.
    if (tandaTangan.includes('@Res(') || tandaTangan.includes('StreamableFile')) continue;
    // Method yang menyatakan dirinya tidak mengembalikan apa pun memang tidak
    // punya bentuk untuk didokumentasikan.
    if (/:\s*Promise<void>/.test(tandaTangan)) continue;

    const kunci = `${rute[1].toUpperCase()} ${rute[2] ?? ''}`.trim();
    if (TANPA_BODY.has(kunci)) continue;
    temuan.push(`${kunci}  (${berkas.pathname.split('/src/')[1]}:${i + 1})`);
  }
}

if (temuan.length > 0) {
  console.error('Endpoint yang mengembalikan body tanpa mendokumentasikan bentuknya:\n');
  for (const t of temuan) console.error(`  ${t}`);
  console.error(
    '\nTambahkan @ApiEnvelope / @ApiEnvelopeList / @ApiEnvelopeArray, atau daftarkan di\n' +
      'TANPA_BODY pada scripts/check-response-contract.mjs beserta alasannya.',
  );
  process.exit(1);
}

console.log('Seluruh endpoint berbody sudah mendokumentasikan bentuk responsnya.');
