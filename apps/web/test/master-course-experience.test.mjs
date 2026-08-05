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
