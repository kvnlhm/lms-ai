import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');

test('scrollbar mengikuti token tema pada Firefox dan browser WebKit', () => {
  assert.match(css, /--scroll-thumb:\s*color-mix\(in srgb, var\(--muted\) 55%, transparent\)/);
  assert.match(css, /\*\s*\{[^}]*scrollbar-color:\s*var\(--scroll-thumb\) transparent/);
  assert.match(css, /\*::-webkit-scrollbar-thumb\s*\{[^}]*background:\s*var\(--scroll-thumb\)/);
  assert.match(css, /\*::-webkit-scrollbar-thumb:hover\s*\{[^}]*background:\s*var\(--scroll-thumb-hover\)/);
});

test('scrollbar bertema tetap cukup ramping dan track tidak menjadi bilah putih', () => {
  assert.match(css, /\*::-webkit-scrollbar\s*\{[^}]*width:\s*10px[^}]*height:\s*10px/);
  assert.match(css, /\*::-webkit-scrollbar-track\s*\{[^}]*background:\s*transparent/);
});
