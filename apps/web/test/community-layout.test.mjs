import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');
const shell = await readFile(new URL('../app/components/app-shell.tsx', import.meta.url), 'utf8');
const home = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
const channel = await readFile(new URL('../app/community/community-feed.tsx', import.meta.url), 'utf8');
const channelManager = await readFile(new URL('../app/master/community/channel-manager.tsx', import.meta.url), 'utf8');

test('shell Pelajar menyediakan sidebar channel desktop dan navigasi horizontal mobile', () => {
  assert.match(css, /\.learnerShellBody\{[^}]*grid-template-columns:220px minmax\(0,1fr\)/);
  assert.match(css, /\.learnerChannelSidebar\{[^}]*position:sticky/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]*\.learnerChannelSidebar\{position:sticky[^}]*flex-direction:row/);
  assert.match(css, /\.communityLayout\{grid-template-columns:minmax\(0,1fr\) 310px/);
});

test('header drawer mobile tidak menyusut dan menutupi menu Beranda', () => {
  assert.match(css, /\.mobileDrawerHead\s*\{[^}]*flex:\s*0 0 auto/);
  assert.match(css, /\.mobileDrawerBody\s*\{[^}]*flex:\s*1 1 auto[^}]*overflow-y:\s*auto/);
});

test('navigasi komunitas tersedia bagi pelajar dan pengelolaan hanya muncul di workspace Master', () => {
  assert.match(shell, /href: '\/community'/);
  assert.match(shell, /href: '\/master\/community'/);
  assert.match(shell, /permission: 'discussions\.moderate'/);
});

test('beranda pelajar menggabungkan ringkasan belajar, feed, event, dan pengumuman', () => {
  assert.match(home, /CommunityFeed/);
  assert.match(home, /CommunityRail/);
  assert.match(home, /learnerInsights/);
  assert.match(home, /\/api\/v1\/me\/enrollments/);
  assert.match(home, /\/api\/v1\/me\/continue-learning/);
  assert.match(home, /href="\/community"/);
});

test('channel tersedia persisten di shell Pelajar dan composer tidak memakai select native', () => {
  assert.match(shell, /LearnerChannelSidebar/);
  assert.match(channel, /composerChannelPicker/);
  assert.doesNotMatch(channel, /<select value=\{channelId\}/);
  assert.match(css, /\.continueContent>\.progress\{margin-bottom:18px\}/);
  assert.match(css, /\.sectionTitleRow>a,\.railTitle>a\{color:var\(--text\)\}/);
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
