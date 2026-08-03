import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');
const shell = await readFile(new URL('../app/components/app-shell.tsx', import.meta.url), 'utf8');
const home = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
const channel = await readFile(new URL('../app/community/community-feed.tsx', import.meta.url), 'utf8');
const channelManager = await readFile(new URL('../app/master/community/channel-manager.tsx', import.meta.url), 'utf8');

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

test('beranda pelajar terpisah dari komunitas dan menampilkan ringkasan belajar', () => {
  assert.doesNotMatch(home, /CommunityFeed/);
  assert.match(home, /learnerInsights/);
  assert.match(home, /\/api\/v1\/me\/enrollments/);
  assert.match(home, /\/api\/v1\/me\/continue-learning/);
  assert.match(home, /href="\/community"/);
});

test('channel tampil sebagai chat responsif dengan identitas pengguna dari session', () => {
  assert.match(channel, /currentUserId=\{user\.id\}|currentUserId/);
  assert.match(channel, /post\.author\.id === currentUserId/);
  assert.match(channel, /setInterval\(refresh, 5_000\)/);
  assert.match(channel, /document\.visibilityState === 'hidden'/);
  assert.match(channel, /event\.key === 'Enter' && !event\.shiftKey/);
  assert.match(css, /\.chatMessage\.mine\{[^}]*align-self:flex-end/);
  assert.match(css, /\.channelChat\{[^}]*grid-template-rows:auto minmax\(0,1fr\) auto/);
});

test('Master dapat mengedit identitas, urutan, dan akses menulis channel', () => {
  assert.match(channelManager, /PATCH\('\/api\/v1\/admin\/community\/channels\/\{id\}'/);
  assert.match(channelManager, /name: draft\.name\.trim\(\)/);
  assert.match(channelManager, /slug: draft\.slug\.trim\(\)\.toLowerCase\(\)/);
  assert.match(channelManager, /description: draft\.description\.trim\(\)/);
  assert.match(channelManager, /position: draft\.position/);
  assert.match(channelManager, /isReadOnly: draft\.isReadOnly/);
  assert.match(channelManager, /Master dan Pelajar/);
  assert.match(channelManager, /Hanya Master/);
});
