import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manager = await readFile(new URL('../app/master/users/user-manager.tsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');

test('form tambah pengguna membedakan isian dari ringkasan role dan area aksi', () => {
  assert.match(manager, /className="userCreateRole"[^>]*aria-label="Role pengguna baru: Pelajar"/);
  assert.doesNotMatch(manager, /<input id="newUserRole"/);
  assert.match(css, /\.userCreateRole\s*\{[^}]*background:\s*var\(--raised\)/);
  assert.match(css, /\.userCreateActions\s*\{[^}]*border-top:\s*1px solid var\(--line-soft\)/);
});

test('form tambah pengguna tetap rapi dalam satu kolom pada layar kecil', () => {
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.userCreateGrid\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.userCreateActions\s*\{[^}]*flex-direction:\s*column-reverse/);
});
