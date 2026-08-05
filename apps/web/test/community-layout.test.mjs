import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');
const shell = await readFile(new URL('../app/components/app-shell.tsx', import.meta.url), 'utf8');
const home = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
const channel = await readFile(new URL('../app/community/community-feed.tsx', import.meta.url), 'utf8');
const channelManager = await readFile(new URL('../app/master/community/channel-manager.tsx', import.meta.url), 'utf8');
const channelPage = await readFile(new URL('../app/community/[slug]/[subchannelSlug]/page.tsx', import.meta.url), 'utf8');

test('shell Pelajar menyediakan sidebar channel desktop dan navigasi horizontal mobile', () => {
  assert.match(css, /\.learnerShellBody\{[^}]*grid-template-columns:220px minmax\(0,1fr\)/);
  assert.match(css, /\.learnerChannelSidebar\{[^}]*position:sticky/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]*\.learnerChannelSidebar\{position:sticky[^}]*flex-direction:row/);
  assert.match(css, /\.communityLayout\{grid-template-columns:minmax\(0,1fr\) 310px/);
});

test('header drawer mobile tidak menyusut dan menutupi menu Beranda', () => {
  assert.match(css, /\.mobileDrawerHead\s*\{[^}]*flex:\s*0 0 auto/);
  assert.match(css, /\.mobileDrawerBody\s*\{[^}]*flex:\s*1 1 auto[^}]*overflow-y:\s*auto/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]*\.learnerChannelSidebar\{[^}]*z-index:10/);
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

test('Master dapat membuat sub-channel dan mengatur akses menulis ruang chat', () => {
  assert.match(channelManager, /POST\('\/api\/v1\/admin\/community\/channels\/\{id\}\/subchannels'/);
  assert.match(channelManager, /name: draft\.name\.trim\(\)/);
  assert.match(channelManager, /description: draft\.description\.trim\(\)/);
  assert.match(channelManager, /isReadOnly: draft\.isReadOnly/);
  assert.match(channelManager, /Master dan Pelajar/);
  assert.match(channelManager, /Hanya Master/);
});

test('sunting dan hapus pesan bersandar pada kewenangan dari server, bukan tebakan browser', () => {
  // Kalau tombolnya digantungkan pada perbandingan ID di browser, Master tidak
  // akan pernah melihat tombol hapus pada tulisan orang lain — dan siapa pun
  // dapat memunculkan tombolnya kembali lewat devtools.
  assert.match(channel, /canEdit=\{post\.canEdit\} canDelete=\{post\.canDelete\}/);
  assert.match(channel, /canEdit=\{item\.canEdit\} canDelete=\{item\.canDelete\}/);
  assert.match(channel, /canEdit=\{comment\.canEdit\} canDelete=\{comment\.canDelete\}/);
  assert.match(channel, /PATCH\('\/api\/v1\/community\/posts\/\{postId\}'/);
  assert.match(channel, /DELETE\('\/api\/v1\/community\/posts\/\{postId\}'/);
  assert.match(channel, /PATCH\('\/api\/v1\/community\/comments\/\{commentId\}'/);
  assert.match(channel, /DELETE\('\/api\/v1\/community\/comments\/\{commentId\}'/);
  // Menghapus tulisan orang lain harus menyebut bahwa tindakannya tercatat.
  assert.match(channel, /tercatat di audit log/);
  assert.match(css, /\.editedMark\{/);
});

test('isi yang lebih lama punya jalan menuju ke sana, dan penyegaran tidak membuangnya', () => {
  // Tanpa penggabungan, penyegaran lima detik akan menghapus pesan lama yang
  // baru saja ditarik pengguna — tombolnya ada, tetapi hasilnya lenyap.
  assert.match(channel, /function gabungKronologis/);
  assert.match(channel, /function segarkanKronologis/);
  assert.match(channel, /segarkanKronologis\(current, items, meta\.total\)/);
  assert.match(channel, /Muat pesan lama/);
  assert.match(channel, /Lihat \$\{sisa\} balasan sebelumnya/);
  assert.match(channel, /\/api\/v1\/community\/posts\/\{postId\}\/comments'/);
  // Totalnya harus datang dari server sejak render pertama, bukan ditebak.
  assert.match(channelPage, /unwrapList<CommunityPost>/);
  assert.match(channelPage, /initialTotal=\{posts\.meta\.total\}/);
  assert.match(css, /\.chatMuatLama\{/);
});

test('sematan punya tombolnya, dan tetap terlihat saat percakapan digulung', () => {
  assert.match(channel, /PATCH\('\/api\/v1\/community\/posts\/\{postId\}\/pin'/);
  assert.match(channel, /canPin: post\.canPin, isPinned: post\.isPinned/);
  assert.match(channel, /Lepas sematan/);
  // Diambil terpisah: sematan yang hanya ikut halaman percakapan akan tergulung
  // hilang bersama pesannya, dan menyematkan jadi tidak ada gunanya.
  assert.match(channel, /\/api\/v1\/community\/channels\/\{channelSlug\}\/\{subchannelSlug\}\/pinned/);
  assert.match(css, /\.chatPinned\{[^}]*position:sticky/);
  // Bilahnya melekat di dalam linimasa, jadi grid tiga baris channel tidak berubah.
  assert.match(css, /\.channelChat\{[^}]*grid-template-rows:auto minmax\(0,1fr\) auto/);
});

test('arsip channel dan sub-channel punya jalan pulang dan konfirmasi', () => {
  // Dulu satu tekan langsung menyembunyikan seluruh isi channel, tanpa
  // konfirmasi dan tanpa cara mengembalikannya.
  assert.match(channelManager, /notifier\.confirm\(`Hapus channel \$\{group\.name\}\?`/);
  assert.match(channelManager, /POST\('\/api\/v1\/admin\/community\/channels\/\{id\}\/restore'/);
  assert.match(channelManager, /Pulihkan/);
  // Channel yang diarsipkan tetap ada di daftar, sebab kalau ia dibuang dari
  // state, tombol pulihnya ikut hilang sampai halaman dimuat ulang.
  assert.match(channelManager, /archivedAt: new Date\(\)\.toISOString\(\)/);
  assert.match(channelManager, /channels\.filter\(\(item\) => item\.archivedAt\)/);
  assert.match(css, /\.channelArchive\{/);
});

test('aksi channel diringkas dalam satu menu dan penghapusan tetap dapat dipulihkan', () => {
  assert.equal((channelManager.match(/<ActionMenu>/g) ?? []).length, 3);
  assert.doesNotMatch(channelManager, /label=\{`Aksi \$\{item\.name\}`\}/);
  assert.match(channelManager, />Buka channel<\/a>/);
  assert.match(channelManager, />Tambah sub-channel<\/button>/);
  assert.match(channelManager, /className="btnDanger"[\s\S]*?Hapus channel<\/button>/);
  assert.match(channelManager, /confirmLabel: 'Hapus channel'/);
  assert.match(channelManager, /dapat dipulihkan/);
});

test('ruang chat dapat membalas, bukan hanya menampilkan balasan', () => {
  // Balasan sudah lama dirender di ruang chat, tetapi kolom tulisnya hanya ada
  // di mode feed — jadi tak seorang pun dapat membuatnya dari sana.
  assert.match(channel, /className="chatBalasToggle"/);
  assert.match(channel, /className="chatReplyComposer"/);
  assert.match(channel, /aksi\.kirimBalasan\(post\.id\)/);
  assert.match(channel, /aria-expanded=\{balasKe === post\.id\}/);
  // Enter mengirim, Escape menutup tanpa membuang yang sudah diketik.
  assert.match(channel, /event\.key === 'Escape'\) setBalasKe\(null\)/);
  assert.match(css, /\.chatReplyComposer\{/);
});
