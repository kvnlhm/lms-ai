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

test('sortir kursus memakai dropdown dan label kartu mobile tetap terbaca', async () => {
  const [listPage, css] = await Promise.all([
    read('../app/master/courses/page.tsx'),
    read('../app/styles.css'),
  ]);

  assert.match(listPage, /<form className="sortBar" action="\/master\/courses">/);
  assert.match(listPage, /<select name="sort" defaultValue=\{keadaan\.sort\}>/);
  assert.match(listPage, /<select name="order" defaultValue=\{keadaan\.order\}>/);
  assert.match(listPage, />Terapkan<\/button>/);
  assert.match(listPage, /className="toolbar courseStatusBar"/);
  assert.match(css, /\.sortBar\{[^}]*overflow-x:auto/);
  assert.match(css, /\.sortField\{[^}]*white-space:nowrap/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*table\.data td::before\s*\{[^}]*white-space:\s*nowrap/);
  assert.match(css, /@media\(max-width:680px\)[\s\S]*\.courseStatusBar\{[^}]*flex-wrap:nowrap[^}]*overflow-x:auto/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.courseTableTitle\s*\{[^}]*min-width:\s*0[^}]*flex:\s*1/);
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
