import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../app/login/page.tsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');

test('header login mobile menempatkan brand sebelum tombol tema', () => {
  assert.match(page, /className="authCardHead"[\s\S]*className="brand"[\s\S]*<ThemeToggle \/>/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.authCardHead \.brand\s*\{[^}]*order:\s*0/);
  assert.match(css, /\.authCardHead\s*\{[^}]*justify-content:\s*space-between/);
});
