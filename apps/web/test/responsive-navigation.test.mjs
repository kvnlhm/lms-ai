import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');

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
