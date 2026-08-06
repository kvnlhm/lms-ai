import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const modalSource = await readFile(
  new URL('../app/components/modal.tsx', import.meta.url),
  'utf8',
);

test('modal tidak mengulang autofocus ketika isi form berubah', () => {
  assert.match(modalSource, /const onCloseTerkini = useRef\(onClose\)/);
  assert.match(modalSource, /const busyTerkini = useRef\(busy\)/);
  assert.match(modalSource, /onCloseTerkini\.current\(\)/);
  assert.doesNotMatch(modalSource, /\}, \[busy, onClose\]\);/);
});
