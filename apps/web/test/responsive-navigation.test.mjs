import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');
const shell = await readFile(new URL('../app/components/app-shell.tsx', import.meta.url), 'utf8');
const icons = await readFile(new URL('../app/components/icons.tsx', import.meta.url), 'utf8');

test('navbar pelajar beralih ke drawer pada viewport setengah desktop', () => {
  const breakpoint = css.indexOf('@media (min-width: 601px) and (max-width: 1120px)');
  const nextMedia = css.indexOf('@media', breakpoint + 1);
  const compactRule = css.slice(breakpoint, nextMedia);

  assert.notEqual(breakpoint, -1, 'breakpoint compact 601–1120px harus tersedia');
  assert.match(compactRule, /\.topbar > \.mobileNavigation \{ display: block;/);
  assert.match(compactRule, /\.topbar > \.mainNav \{ display: none;/);
});

test('label navbar tidak dipecah menjadi beberapa baris', () => {
  const navLabelRule = css.match(/\.mainNav \.navLink \{([\s\S]*?)\n\}/);

  assert.ok(navLabelRule, 'aturan label navbar harus tersedia');
  assert.match(navLabelRule[1], /white-space: nowrap;/);
  assert.match(navLabelRule[1], /overflow-wrap: normal;/);
});

test('sidebar Master ringkas hanya menampilkan ikon tanpa label yang terjepit', () => {
  const breakpoint = css.indexOf('@media (max-width: 980px)');
  const nextMedia = css.indexOf('@media', breakpoint + 1);
  const compactRule = css.slice(breakpoint, nextMedia);

  assert.notEqual(breakpoint, -1, 'breakpoint sidebar Master ringkas harus tersedia');
  assert.match(compactRule, /\.workspaceSwitch > span:nth-child\(2\)\s*\{\s*display:\s*none;/);
  assert.match(compactRule, /\.masterSidebar\s*\{[^}]*overflow:\s*hidden;/);
  assert.match(compactRule, /\.sideProfile\s*\{[^}]*flex-direction:\s*column;[^}]*flex-wrap:\s*nowrap;/);
  assert.match(compactRule, /\.sideProfileLink\s*\{[^}]*flex:\s*none;/);
});

test('Dashboard Master mobile menampilkan logo dan ranking tidak melebarkan viewport', () => {
  assert.match(shell, /className="mobileBrand"[\s\S]{0,120}<BrandMark size=\{28\}/);
  assert.match(css, /\.analyticsRankMain\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.analyticsRankTitle strong\s*\{[^}]*flex:\s*1;[^}]*min-width:\s*0;/);
  assert.match(css, /@media \(max-width: 340px\)[\s\S]*\.mobileBrand > span:last-child\s*\{\s*display:\s*none;/);
  assert.doesNotMatch(css, /@media \(max-width: 340px\)[\s\S]*\.mobileBrand\s*\{\s*display:\s*none;/);
});

test('menu Master memakai ikon yang sesuai dengan fungsi setiap halaman', () => {
  const mappings = [
    ['Paket akses', 'Package'], ['Transaksi', 'CreditCard'], ['Forum', 'MessageCircle'],
    ['Channel komunitas', 'Hash'], ['Insight', 'BarChart'], ['Kelola event', 'Calendar'],
    ['Pengumuman', 'Megaphone'], ['Perpustakaan video', 'Video'], ['Laporan', 'FileText'],
    ['Galat', 'AlertTriangle'], ['Audit log', 'ClipboardList'],
  ];
  for (const [label, icon] of mappings) {
    assert.match(shell, new RegExp(`label: '${label}',[\\s\\S]{0,80}icon: ${icon}`));
    assert.match(icons, new RegExp(`export const ${icon}`));
  }
  assert.match(shell, /href="\/notifications"[\s\S]{0,100}<Bell size=\{18\}/);
});
