import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('title tab membedakan workspace Master dan Pelajar', async () => {
  const [rootLayout, masterLayout] = await Promise.all([
    read('../app/layout.tsx'),
    read('../app/master/layout.tsx'),
  ]);
  assert.match(rootLayout, /Pelajar · Academy AIPreneur/);
  assert.match(masterLayout, /Master · Academy AIPreneur/);
});

test('pemutar video mengizinkan fullscreen tanpa menawarkan unduhan', async () => {
  const source = await read('../app/learn/[courseId]/[lessonId]/video-player.tsx');
  assert.match(source, /allowFullScreen/);
  assert.match(source, /fullscreen/);
  assert.match(source, /controlsList="nodownload noremoteplayback"/);
  assert.doesNotMatch(source, /nofullscreen/);
  assert.match(source, /className="courseVideoControls"/);
  assert.match(source, /requestFullscreen/);
  assert.doesNotMatch(source, /videoViewerWatermark/);
  assert.doesNotMatch(source, /session\.watermark\.text/);
  assert.match(source, /Mundur 10 detik/);
  assert.match(source, /Maju 10 detik/);
  assert.match(source, /Pengaturan video/);
  assert.match(source, /Kecepatan/);
  assert.match(source, /Kualitas/);
  assert.match(source, /MANIFEST_PARSED/);
  assert.match(source, /courseVideoSettingsPanel[^]*?<select/);
  assert.match(source, /courseVideoSkip/);
  const css = await read('../app/styles.css');
  assert.match(css, /\.courseVideoControlRow\{[^}]*justify-content:flex-end/);
  assert.match(css, /\.courseVideoSettingsPanel\{[^}]*right:-38px/);
});

test('tombol layar penuh juga mengembalikan video ke ukuran semula', async () => {
  const source = await read('../app/learn/[courseId]/[lessonId]/video-player.tsx');

  // Menekan tombolnya sekali lagi harus keluar, bukan meminta layar penuh
  // untuk kedua kalinya — permintaan yang tidak melakukan apa-apa karena
  // elemennya memang sudah di sana.
  assert.match(source, /document\.exitFullscreen/);
  assert.match(source, /document\.fullscreenElement/);

  // Labelnya ikut berubah. "Layar penuh" saat sudah layar penuh menyesatkan
  // pembaca layar, dan itu satu-satunya keterangan yang dipunyai tombol ini.
  assert.match(source, /Keluar dari layar penuh/);
  assert.match(source, /fullscreenchange/);
});

test('pintasan papan tik pemutar mengikuti kebiasaan YouTube', async () => {
  const source = await read('../app/learn/[courseId]/[lessonId]/video-player.tsx');

  // Panah atas dan bawah mengatur volume; sebelumnya keduanya hanya menggulir
  // halaman di belakang pemutar.
  assert.match(source, /ArrowUp/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /geserVolume/);

  // Panah kiri/kanan 5 detik, J/L 10 detik — pembagian yang sama seperti
  // YouTube, bukan dua pasang tombol yang melakukan hal identik.
  assert.match(source, /case 'arrowleft':\s*skip\(-5\)/);
  assert.match(source, /case 'l':\s*skip\(10\)/);

  // Angka melompat ke persepuluh durasi, Home/End ke ujung.
  assert.match(source, /\/\^\[0-9\]\$\//);
  assert.match(source, /case 'home'/);
  assert.match(source, /case 'end'/);

  // Kecepatan naik-turun lewat < dan >, memakai daftar yang sama dengan menu.
  assert.match(source, /const SPEEDS/);
  assert.match(source, /case '>'/);
  assert.match(source, /case '<'/);

  // Tombol yang menggulir halaman ditahan, jika tidak menekan spasi untuk jeda
  // ikut melompatkan halaman pelajaran.
  assert.match(source, /GULIR/);
  assert.match(source, /preventDefault/);

  // Slider volume dan posisi memakai panah yang sama. Tanpa penjaga ini satu
  // tekanan berbuah dua perubahan: slider bergeser sendiri, pintasan menyusul.
  assert.match(source, /INPUT|SELECT/);

  // Ctrl+F dan Cmd+L milik browser, bukan milik pemutar.
  assert.match(source, /event\.ctrlKey \|\| event\.metaKey \|\| event\.altKey/);
});

test('halaman kelola kursus menyediakan menu aksi dan pratinjau langsung', async () => {
  const [listPage, detailPage, editor] = await Promise.all([
    read('../app/master/courses/page.tsx'),
    read('../app/master/courses/[courseId]/page.tsx'),
    read('../app/master/courses/[courseId]/course-editor.tsx'),
  ]);
  assert.match(listPage, /<ActionMenu/);
  assert.match(detailPage, /Pratinjau sebagai pelajar/);
  assert.match(editor, /Aksi materi/);
  assert.match(editor, /Pratinjau materi/);
});

test('menu aksi daftar kursus dapat menghapus kursus, dengan aturan yang sama seperti editor', async () => {
  const [listPage, hapus, editor] = await Promise.all([
    read('../app/master/courses/page.tsx'),
    read('../app/master/courses/hapus-kursus.tsx'),
    read('../app/master/courses/[courseId]/course-editor.tsx'),
  ]);

  assert.match(listPage, /from '\.\/hapus-kursus'/);
  assert.match(listPage, /<TombolHapusKursus course=\{course\} \/>/);

  // Konfirmasi, permintaan hapus, dan tawaran hapus paksa saat server menolak
  // dengan 409 tinggal di satu berkas. Daftar dan editor memanggil yang sama,
  // supaya peringatan yang dibaca Master tidak berbeda tergantung dari mana ia
  // menekan tombolnya.
  assert.match(hapus, /notifier\.confirm/);
  assert.match(hapus, /DELETE\('\/api\/v1\/admin\/courses\/\{courseId\}'/);
  assert.match(hapus, /status === 409/);
  assert.match(hapus, /query: force \? \{ force: true \} : \{\}/);
  assert.match(hapus, /className="btnTiny btnDanger"/);

  assert.match(editor, /konfirmasiHapusKursus/);
  assert.doesNotMatch(editor, /jalankanHapus/);
  assert.doesNotMatch(editor, /DELETE\('\/api\/v1\/admin\/courses\/\{courseId\}'/);
});

test('sortir kursus memakai dropdown dan label kartu mobile tetap terbaca', async () => {
  const [listPage, css] = await Promise.all([
    read('../app/master/courses/page.tsx'),
    read('../app/styles.css'),
  ]);

  assert.match(listPage, /<section className="card sortCard"[^>]*>[\s\S]*<form className="sortBar" action="\/master\/courses">/);
  assert.match(listPage, /<select name="sort" defaultValue=\{keadaan\.sort\}>/);
  assert.match(listPage, /<select name="order" defaultValue=\{keadaan\.order\}>/);
  assert.match(listPage, /<button className="btn" type="submit">Terapkan<\/button>/);
  assert.doesNotMatch(listPage, /className="num cellPosition" data-label="Urutan"/);
  assert.match(listPage, /className="toolbar courseStatusBar"/);
  assert.match(css, /\.sortCard\{[^}]*padding:14px/);
  assert.match(css, /\.sortField\{[^}]*white-space:nowrap/);
  assert.match(css, /\.sortField select\{[^}]*background:var\(--raised\)/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*table\.data td::before\s*\{[^}]*white-space:\s*nowrap/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.cellPosition::before\s*\{\s*content:\s*none/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.masterShell \.tableWrap::after\s*\{\s*display:\s*none/);
  assert.match(css, /@media\(max-width:680px\)[\s\S]*\.courseStatusBar\{[^}]*flex-wrap:nowrap[^}]*overflow-x:auto/);
  assert.match(css, /@media\(max-width:680px\)[\s\S]*\.sortBar\{[^}]*flex-direction:column[^}]*overflow:visible/);
  assert.match(css, /@media\(max-width:680px\)[\s\S]*\.sortField[^}]*width:100%/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.courseTableTitle\s*\{[^}]*min-width:\s*0[^}]*flex:\s*1/);
  assert.match(css, /\.cellPosition\{[^}]*overflow-wrap:normal[^}]*white-space:nowrap[^}]*word-break:keep-all/);
});

test('penyusun kursus memberi pratinjau seret dan menggeser kartu dengan halus', async () => {
  const [source, css] = await Promise.all([
    read('../app/master/courses/course-order.tsx'),
    read('../app/styles.css'),
  ]);
  assert.match(source, /classList\.add\('orderDragGhost'\)/);
  assert.match(source, /element\.animate\(/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /Math\.hypot\(/);
  assert.match(source, /tujuanSeretRef/);
  assert.match(source, /pindahKe\(asal, tujuan\)/);
  assert.doesNotMatch(source, /pindahKe\(seret, tujuan\)/);
  assert.match(css, /\.orderDragGhost\{[^}]*position:fixed[^}]*pointer-events:none/);
  assert.match(css, /\.orderCardTarget\{/);
  assert.match(css, /\.orderCardItem\{[^}]*will-change:transform/);
});

test('halaman pemeliharaan memakai logo aplikasi yang dilayani gateway sendiri', async () => {
  const [source, dockerfile, nginx] = await Promise.all([
    read('../../../deploy/nginx/pemeliharaan/__pemeliharaan.html'),
    read('../../../deploy/nginx/Dockerfile.coolify'),
    read('../../../deploy/nginx/coolify.conf.template'),
  ]);
  assert.match(source, /<img src="\/__brand\.png"/);
  assert.doesNotMatch(source, />AI</);
  assert.match(dockerfile, /COPY apps\/web\/app\/icon\.png \/usr\/share\/nginx\/pemeliharaan\/__brand\.png/);
  assert.match(nginx, /location = \/__brand\.png/);
});

test('materi video baru berbawaan ditandai manual, bukan ambang tontonan', async () => {
  // Bawaan 'VIDEO_PERCENTAGE' membuat setiap pelajaran video baru menuntut 90%
  // tontonan tanpa Master pernah memintanya, dan tombol "Tandai selesai" pelajar
  // mati sampai ambang itu terpenuhi.
  const editor = await read('../app/master/courses/[courseId]/course-editor.tsx');
  assert.match(editor, /setCompletionRule\(nextType === 'VIDEO' \? 'MANUAL' : 'OPENED'\)/);
  assert.doesNotMatch(editor, /nextType === 'VIDEO' \? 'VIDEO_PERCENTAGE'/);
  // Aturannya tidak dicabut dari sistem; ia tetap dapat dipilih per pelajaran.
  assert.match(editor, /\{ value: 'VIDEO_PERCENTAGE', label: 'Persentase video' \}/);
});

test('pelajaran video yang sudah ada ikut dipindahkan ke penandaan manual', async () => {
  const migrasi = await read('../../api/prisma/migrations/20260807020000_video_lessons_manual_completion/migration.sql');
  assert.match(migrasi, /UPDATE "lessons"/);
  assert.match(migrasi, /SET "completion_rule" = 'MANUAL'/);
  assert.match(migrasi, /"content_type" = 'VIDEO'/);
  assert.match(migrasi, /"completion_rule" = 'VIDEO_PERCENTAGE'/);
  // Ambang lama dibiarkan tersimpan: di bawah MANUAL ia tidak dibaca, dan
  // membuangnya berarti menghapus angka yang dulu dipilih Master.
  assert.doesNotMatch(migrasi, /completion_config"?\s*=/);
});

test('tombol selesai hanya terkunci oleh aturan yang memang punya ambang', async () => {
  // Di bawah MANUAL, `videoPercentageTarget` bernilai null sehingga tombolnya
  // tidak pernah mati — itulah yang membuat penandaan manual benar-benar manual.
  const tombol = await read('../app/learn/[courseId]/[lessonId]/complete-button.tsx');
  assert.match(tombol, /const belumCukup = videoPercentageTarget !== null && ditonton < videoPercentageTarget/);
});
