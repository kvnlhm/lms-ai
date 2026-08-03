import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');
const shell = await readFile(new URL('../app/components/app-shell.tsx', import.meta.url), 'utf8');
const home = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');

test('beranda komunitas menyediakan tiga area desktop dan dua tahap responsif', () => {
  assert.match(css, /\.communityLayout\{[^}]*grid-template-columns:240px minmax\(0,1fr\) 310px/);
  assert.match(css, /@media\(max-width:1180px\)\{\.communityLayout\{grid-template-columns:210px minmax\(0,1fr\)/);
  assert.match(css, /@media\(max-width:760px\)\{\.communityLayout\{display:flex;flex-direction:column/);
  assert.match(css, /\.communityChannels\{position:static;width:100%;display:flex;flex-direction:row;overflow-x:auto/);
});

test('navigasi komunitas tersedia bagi pelajar dan pengelolaan hanya muncul di workspace Master', () => {
  assert.match(shell, /href: '\/community'/);
  assert.match(shell, /href: '\/master\/community'/);
  assert.match(shell, /permission: 'discussions\.moderate'/);
});

test('beranda merangkai channel, feed, sesi langsung, dan pengumuman', () => {
  assert.match(home, /CommunityFeed/);
  assert.match(home, /CommunityRail/);
  assert.match(home, /\/api\/v1\/community\/channels/);
  assert.match(home, /\/api\/v1\/me\/announcements/);
  assert.match(home, /\/api\/v1\/learn\/courses\/\{courseId\}\/live-sessions/);
});
