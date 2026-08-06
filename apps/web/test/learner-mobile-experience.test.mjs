import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');
const shell = await readFile(new URL('../app/components/app-shell.tsx', import.meta.url), 'utf8');
const mobileNav = await readFile(new URL('../app/components/learner-mobile-nav.tsx', import.meta.url), 'utf8');
const drawer = await readFile(new URL('../app/components/mobile-navigation.tsx', import.meta.url), 'utf8');
const home = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
const lesson = await readFile(new URL('../app/learn/[courseId]/[lessonId]/page.tsx', import.meta.url), 'utf8');
const announcementsPage = await readFile(new URL('../app/announcements/page.tsx', import.meta.url), 'utf8');
const announcementsFeed = await readFile(new URL('../app/announcements/announcement-feed.tsx', import.meta.url), 'utf8');

test('navigasi Pelajar tidak mengulang tautan Beranda', () => {
  assert.match(shell, /LearnerMobileNav unread=\{notifikasiBelumDibaca\}/);
  assert.doesNotMatch(shell, /href: '\/', label: 'Beranda'/);
  assert.doesNotMatch(mobileNav, /href: '\/', label: 'Beranda'/);
  assert.match(mobileNav, /href: '\/notifications'/);
  assert.match(mobileNav, /href: '\/community'/);
  assert.match(mobileNav, /<span>Cari<\/span>/);
  assert.match(css, /\.learnerBottomNav\{position:fixed[^}]*grid-template-columns:repeat\(3,1fr\)/);
});

test('seluruh tujuan Pelajar tetap dapat dijangkau dan pintasan lengkap berada di drawer burger', () => {
  assert.match(shell, /className="learnerMobileTabs"/);
  assert.match(shell, /LEARNER_NAV\.map/);
  assert.match(shell, /LearnerChannelSidebar placement="drawer"/);
  assert.match(css, /\.learnerMobileTabs\{position:sticky[^}]*overflow-x:auto/);
  assert.match(css, /\.topbar>\.mobileNavigation\{display:block;order:0\}/);
  assert.match(css, /\.learnerShellBody>\.learnerChannelSidebarDesktop\{display:none\}/);
  assert.match(css, /\.mobileDrawerBody \.learnerChannelSidebarDrawer\{position:static[^}]*flex-direction:column/);
  assert.match(css, /\.learnerMobileDrawer\{width:100vw/);
  assert.match(css, /\.learnerChannelSidebarDrawer \.channelLink\.active strong\{font-weight:800\}/);
  assert.match(drawer, /createPortal\(/);
  assert.match(drawer, /document\.body/);
  assert.match(shell, /variant="learner"/);
});

test('lebar setengah desktop memakai satu navigasi channel melalui drawer', () => {
  assert.match(css, /@media\(min-width:761px\) and \(max-width:1120px\)[\s\S]*\.learnerShellBody>\.learnerChannelSidebarDesktop\{display:none\}/);
  assert.match(css, /@media\(min-width:761px\) and \(max-width:1120px\)[\s\S]*\.learnerMobileDrawer\{width:min\(360px,92vw\)/);
  assert.match(css, /@media\(min-width:761px\) and \(max-width:1120px\)[\s\S]*\.learnerChannelSidebarDrawer\{position:static/);
});

test('lebar setengah desktop mempertahankan menu utama sebagai baris yang dapat digeser', () => {
  assert.match(css, /@media\(min-width:761px\) and \(max-width:1120px\)[\s\S]*\.topbar>\.mainNav\{display:flex[^}]*overflow-x:auto/);
  assert.match(css, /@media\(min-width:761px\) and \(max-width:1120px\)[\s\S]*\.topbar>\.mainNav \.navLink\{flex:0 0 auto/);
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

test('pengumuman Pelajar memakai kartu responsif dengan status baca yang jelas', () => {
  assert.match(announcementsPage, /learnerAnnouncementPage/);
  assert.match(announcementsFeed, /announcementCardUnread/);
  assert.match(announcementsFeed, /announcementReadButton/);
  assert.match(announcementsFeed, /Tandai sudah dibaca/);
  assert.match(css, /\.announcementCard\{display:grid/);
  assert.match(css, /\.announcementCardUnread\{border-color:/);
});
