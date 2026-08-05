import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');
const shell = await readFile(new URL('../app/components/app-shell.tsx', import.meta.url), 'utf8');
const mobileNav = await readFile(new URL('../app/components/learner-mobile-nav.tsx', import.meta.url), 'utf8');

test('Pelajar memiliki navigasi bawah mobile dengan empat tujuan utama', () => {
  assert.match(shell, /LearnerMobileNav unread=\{notifikasiBelumDibaca\}/);
  assert.match(mobileNav, /href: '\/notifications'/);
  assert.match(mobileNav, /href: '\/community'/);
  assert.match(mobileNav, /<span>Cari<\/span>/);
  assert.match(css, /\.learnerBottomNav\{position:fixed[^}]*grid-template-columns:repeat\(4,1fr\)/);
});

test('seluruh tujuan Pelajar tetap dapat dijangkau melalui tab horizontal mobile', () => {
  assert.match(shell, /className="learnerMobileTabs"/);
  assert.match(shell, /LEARNER_NAV\.map/);
  assert.match(css, /\.learnerMobileTabs\{position:sticky[^}]*overflow-x:auto/);
  assert.match(css, /\.learnerChannelSidebar\{top:123px/);
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
