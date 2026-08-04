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

test('halaman pemeliharaan memakai logo tanpa teks AI', async () => {
  const source = await read('../../../deploy/nginx/pemeliharaan/__pemeliharaan.html');
  assert.match(source, /<svg/);
  assert.doesNotMatch(source, />AI</);
});
