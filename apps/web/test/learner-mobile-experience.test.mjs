import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');
const shell = await readFile(new URL('../app/components/app-shell.tsx', import.meta.url), 'utf8');
const mobileNav = await readFile(new URL('../app/components/learner-mobile-nav.tsx', import.meta.url), 'utf8');
const home = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
const lesson = await readFile(new URL('../app/learn/[courseId]/[lessonId]/page.tsx', import.meta.url), 'utf8');

test('Pelajar memiliki navigasi bawah mobile dengan empat tujuan utama', () => {
  assert.match(shell, /LearnerMobileNav unread=\{notifikasiBelumDibaca\}/);
  assert.match(mobileNav, /href: '\/notifications'/);
  assert.match(mobileNav, /href: '\/community'/);
  assert.match(mobileNav, /<span>Cari<\/span>/);
  assert.match(css, /\.learnerBottomNav\{position:fixed[^}]*grid-template-columns:repeat\(4,1fr\)/);
});

test('seluruh tujuan Pelajar tetap dapat dijangkau dan pintasan lengkap berada di drawer burger', () => {
  assert.match(shell, /className="learnerMobileTabs"/);
  assert.match(shell, /LEARNER_NAV\.map/);
  assert.match(shell, /LearnerChannelSidebar placement="drawer"/);
  assert.match(css, /\.learnerMobileTabs\{position:sticky[^}]*overflow-x:auto/);
  assert.match(css, /\.topbar>\.mobileNavigation\{display:block;order:0\}/);
  assert.match(css, /\.learnerShellBody>\.learnerChannelSidebarDesktop\{display:none\}/);
  assert.match(css, /\.mobileDrawerBody \.learnerChannelSidebarDrawer\{position:static[^}]*flex-direction:column/);
});

test('pencarian mobile dapat ditutup dan memakai id aksesibilitas yang unik', () => {
  assert.match(mobileNav, /role="dialog" aria-modal="true"/);
  assert.match(mobileNav, /event\.key === 'Escape'/);
  assert.match(mobileNav, /idPrefix="learnerMobileSearch"/);
});

test('konten tidak tertutup safe area navigasi bawah', () => {
  assert.match(css, /\.learnerShellBody\{padding-bottom:calc\(70px \+ env\(safe-area-inset-bottom\)\)\}/);
  assert.match(css, /height:calc\(70px \+ env\(safe-area-inset-bottom\)\)/);
});

test('Histori dan bookmark tidak ditampilkan pada pengalaman Pelajar', () => {
  assert.doesNotMatch(shell, /href: '\/history'|href: '\/bookmarks'/);
  assert.doesNotMatch(home, /Aktivitas terbaru|Riwayat belajar|learning-history/);
  assert.doesNotMatch(lesson, /BookmarkButton|bookmark-button/);
});
