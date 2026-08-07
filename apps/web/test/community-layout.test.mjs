import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');
const shell = await readFile(new URL('../app/components/app-shell.tsx', import.meta.url), 'utf8');
const home = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
const channel = await readFile(new URL('../app/community/community-feed.tsx', import.meta.url), 'utf8');
const channelManager = await readFile(new URL('../app/master/community/channel-manager.tsx', import.meta.url), 'utf8');
const learnerSidebar = await readFile(new URL('../app/components/learner-channel-sidebar.tsx', import.meta.url), 'utf8');
const channelPage = await readFile(new URL('../app/community/[slug]/[subchannelSlug]/page.tsx', import.meta.url), 'utf8');
const checklistDetail = await readFile(new URL('../app/community/checklist-detail.tsx', import.meta.url), 'utf8').catch(() => '');
const checklistDetailPage = await readFile(new URL('../app/community/[slug]/[subchannelSlug]/[postId]/page.tsx', import.meta.url), 'utf8').catch(() => '');
const checklistEdit = await readFile(new URL('../app/community/checklist-editor.tsx', import.meta.url), 'utf8').catch(() => '');
const checklistEditPage = await readFile(new URL('../app/community/[slug]/[subchannelSlug]/[postId]/edit/page.tsx', import.meta.url), 'utf8').catch(() => '');
const masterShortcuts = await readFile(new URL('../app/components/master-community-shortcuts.tsx', import.meta.url), 'utf8');
const composer = await readFile(new URL('../app/community/post-composer.tsx', import.meta.url), 'utf8');
const attachments = await readFile(new URL('../app/community/post-attachments.tsx', import.meta.url), 'utf8');
const poll = await readFile(new URL('../app/community/post-poll.tsx', import.meta.url), 'utf8');

test('shell Pelajar menyediakan sidebar desktop dan memindahkannya ke drawer pada mobile', () => {
  assert.match(css, /\.learnerShellBody\{[^}]*grid-template-columns:220px minmax\(0,1fr\)/);
  assert.match(css, /\.learnerChannelSidebar\{[^}]*position:sticky/);
  assert.match(shell, /LearnerChannelSidebar placement="drawer"/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]*\.learnerShellBody>\.learnerChannelSidebarDesktop\{display:none\}/);
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
  assert.match(channelManager, /isReadOnly: firstSub\.isReadOnly/);
  assert.match(channelManager, /Master dan Pelajar/);
  assert.match(channelManager, /Hanya Master/);
});

test('Channel wajib lahir bersama sub-channel dan daftar Master dapat dibuka-tutup', () => {
  assert.match(channelManager, /subchannelName: firstSub\.name\.trim\(\)/);
  assert.match(channelManager, /name\.trim\(\)\.length < 2 \|\| firstSub\.name\.trim\(\)\.length < 2/);
  assert.match(channelManager, /aria-expanded=\{open\}/);
  assert.match(channelManager, /expanded\.has\(group\.id\)/);
  assert.match(channelManager, /open \? <div className="channelAccordionPanel"/);
});

test('form Channel dibuka dari tombol tambah dan penambahan sub-channel berada di menu Aksi', () => {
  assert.match(channelManager, /<Modal title="Tambah channel"/);
  assert.match(channelManager, />Tambah channel<\/button>/);
  assert.match(channelManager, /<ActionMenu>[\s\S]*?>Tambah sub-channel<\/button>/);
  assert.doesNotMatch(channelManager, /channelSubHead[\s\S]{0,300}<button[^>]*>Tambah sub-channel<\/button>/);
});

test('sidebar Pelajar hanya memakai pintasan pilihan Master dan mendaftar sub-channel secara datar', () => {
  assert.match(learnerSidebar, /GET\('\/api\/v1\/community\/sidebar-channels'/);
  // Nama Channel adalah label kelompok, bukan tombol yang menyembunyikan
  // isinya: seluruh sub-channel harus langsung terlihat tanpa dibuka dulu.
  assert.match(learnerSidebar, /<span className="channelGroup">\{channel\.name\}<\/span>/);
  assert.doesNotMatch(learnerSidebar, /aria-expanded/);
  assert.match(learnerSidebar, /channel\.subchannels\.map\(\(sub\) => \{[\s\S]{0,120}<Link/);
  assert.match(channelManager, /showInSidebar/);
  assert.match(channelManager, /Sembunyikan dari sidebar/);
});

test('baris sidebar Pelajar berisi satu baris tanpa keterangan tambahan', () => {
  // Keterangan di bawah tiap baris adalah yang membuat sidebar lama terasa
  // padat; ia tidak boleh kembali lewat `description` sub-channel.
  assert.doesNotMatch(learnerSidebar, /<small>/);
  assert.doesNotMatch(learnerSidebar, /sub\.description/);
  assert.match(css, /\.channelLink\{flex:none;display:flex;align-items:center/);
  // Sidebar adalah flex column setinggi layar; tanpa `flex:none` label kelompok
  // mengerut sampai tinggi 0 begitu daftarnya melebihi layar.
  assert.match(css, /\.channelGroup\{flex:none;/);
  assert.doesNotMatch(css, /\.channelLink\.active\{box-shadow:inset 3px 0 0/);
});

test('ikon sidebar Pelajar memakai SVG sistem ikon, bukan glif teks', () => {
  // Glif `#` dan `▤` diambil dari font yang berbeda per sistem, jadi tinggi dan
  // tebalnya tidak pernah sejajar dengan ikon Monitoring di barisan yang sama.
  assert.match(learnerSidebar, /CHAT: MessageCircle/);
  assert.match(learnerSidebar, /POSTS: FileText/);
  assert.match(learnerSidebar, /ANNOUNCEMENTS: Megaphone/);
  assert.match(learnerSidebar, /CHECKLIST: ClipboardList/);
  assert.doesNotMatch(learnerSidebar, /COMMUNITY_CHANNEL_TYPES\[sub\.type\]\.icon/);
  // SVG membawa width/height inline, jadi ukuran drawer ponsel harus ditimpa.
  assert.match(css, /\.learnerChannelSidebarDrawer \.channelIcon svg\{width:22px;height:22px\}/);
});

test('sidebar Pelajar hanya berisi monitoring harian dan channel pilihan Master', () => {
  assert.match(learnerSidebar, /label: 'Monitoring harian'/);
  for (const label of ['Kursus', 'Tanya jawab', 'Event', 'Pengumuman', 'Feed komunitas', 'Notifikasi', 'Profil']) {
    assert.doesNotMatch(learnerSidebar, new RegExp(`label: '${label}'`));
  }
  assert.match(home, /id="monitoring-harian"/);
});

test('sidebar Master menampilkan pintasan channel dan indikator pesan baru di bawah Katalog Pelajar', () => {
  assert.match(shell, /Katalog Pelajar[\s\S]*MasterCommunityShortcuts userId=\{user\.id\}/);
  assert.match(masterShortcuts, /GET\('\/api\/v1\/community\/sidebar-channels'/);
  assert.match(masterShortcuts, /setInterval\([\s\S]*INTERVAL_SEGARKAN/);
  assert.match(masterShortcuts, /document\.visibilityState === 'visible'/);
  assert.match(masterShortcuts, /master-community-seen:\$\{userId\}/);
  assert.match(masterShortcuts, /aria-label=\{`\$\{totalUnread\} pesan komunitas baru`\}/);
  assert.match(masterShortcuts, /href=\{`\/community\/\$\{group\.slug\}\/\$\{sub\.slug\}`\}/);
  assert.match(css, /\.masterCommunityShortcuts\{display:grid/);
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

test('judul dan lampiran postingan tampil di feed maupun chat, dan editor mengirim semuanya', () => {
  assert.match(channel, /post\.title \? <h2 className="postTitle">\{post\.title\}<\/h2>/);
  assert.match(channel, /<PostAttachments attachments=\{post\.attachments \?\? \[\]\} \/>/);
  assert.match(channel, /className="chatPostTitle"/);
  assert.match(channel, /className="chatPostAttachments"/);
  assert.match(channel, /attachmentIds/);
  assert.match(channel, /title:.*body:/s);
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

test('sub-channel checklist memakai halaman progres terstruktur seperti referensi', () => {
  assert.match(channelPage, /subchannel\.type === 'CHECKLIST' \? ' communityChecklistLayout'/);
  assert.match(channel, /className="checklistProgressCard"/);
  assert.match(channel, /Selesai \{selesai\} dari \{posts\.length\} topik/);
  assert.match(channel, /aria-valuenow=\{persentase\}/);
  assert.match(channel, /className="checklistSection" open/);
  assert.match(channel, /className="checklistTopicNumber"/);
  assert.match(css, /\.checklistProgressBar>span\{[^}]*transition:width/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]*\.checklistHero\{[^}]*grid-template-columns:1fr/);
});

test('Master menyunting topik checklist melalui halaman editor khusus', () => {
  assert.doesNotMatch(channel, /className="checklistTopicEditor"/);
  assert.match(channel, /href=\{`\/community\/\$\{selected\.groupSlug\}\/\$\{selected\.slug\}\/\$\{post\.id\}\/edit`\}/);
  assert.match(checklistEditPage, /ChecklistEditor/);
  assert.match(checklistEdit, /Simpan perubahan/);
  assert.match(css, /\.checklistComposer textarea\{[^}]*background:var\(--surface-2\)[^}]*color:var\(--text\)/);
  assert.match(channel, /className="btn checklistAddToggle"/);
  assert.match(channel, /aria-expanded=\{composerTerbuka\}/);
});

test('isi checklist dapat ditulis multiline seperti postingan', () => {
  assert.match(channel, /<textarea id="checklist-new-topic"/);
  assert.match(checklistEdit, /<textarea/);
  assert.match(channel, /className="checklistComposerCount">\{body\.length\}\/5000/);
  assert.match(checklistDetail, /className="checklistArticleBody"/);
  assert.match(css, /\.checklistArticleBody\{[^}]*white-space:pre-wrap/);
  assert.match(css, /\.checklistComposer textarea\{[^}]*resize:vertical/);
});

test('editor checklist menerima satu foto, video, atau PDF dan halaman bacaan menampilkannya', () => {
  assert.match(checklistEdit, /accept="image\/jpeg,image\/png,image\/webp,video\/mp4,video\/webm,application\/pdf"/);
  assert.match(checklistEdit, /uploadChecklistAttachment/);
  assert.match(checklistDetail, /item\.attachment\.mimeType\.startsWith\('image\/'\)/);
  assert.match(checklistDetail, /item\.attachment\.mimeType\.startsWith\('video\/'\)/);
  assert.match(checklistDetail, /application\/pdf/);
  assert.doesNotMatch(checklistDetail, /comment|balasan/i);
});

test('setiap checklist memiliki judul yang menuju halaman kontennya', () => {
  assert.match(channel, /title: string \| null/);
  assert.match(channel, /id="checklist-new-title"/);
  assert.match(channel, /className="checklistTopicLink"/);
  assert.match(checklistDetail, /className="checklistArticleBody"/);
  assert.match(css, /\.checklistArticleBody\{[^}]*white-space:pre-wrap/);
});

test('judul checklist membuka halaman postingan dan selesai sebelum lanjut', () => {
  assert.match(channel, /href=\{`\/community\/\$\{selected\.groupSlug\}\/\$\{selected\.slug\}\/\$\{post\.id\}`\}/);
  assert.match(checklistDetailPage, /ChecklistDetail/);
  assert.match(checklistDetail, /className="checklistArticle"/);
  assert.match(checklistDetail, /Saya sudah membaca konten ini/);
  assert.match(checklistDetail, /nextPostId/);
  assert.match(checklistDetail, /Lanjut ke checklist berikutnya/);
  assert.match(css, /\.checklistArticleBody\{[^}]*white-space:pre-wrap/);
});

test('checklist tampil sebagai satu kartu di feed, bukan satu kartu per langkah', () => {
  // Lima langkah Welcome Checklist dulu mengalir ke feed sebagai lima tulisan
  // lepas, masing-masing lengkap dengan tombol suka dan kolom "Balas post ini…".
  assert.match(channel, /const entriFeed = useMemo/);
  assert.match(channel, /post\.channel\.type !== 'CHECKLIST'/);
  assert.match(channel, /entriFeed\.map/);
  assert.doesNotMatch(channel, /posts\.map\(\(post\) => \(\s*<article className="communityPost card"/);
  // Kartunya berdiri di posisi langkah terbarunya supaya feed tetap kronologis.
  assert.match(channel, /\[\.\.\.kartuPost, \.\.\.kartuChecklist\]\.sort/);
});

test('kartu checklist di feed tidak menerima reaksi maupun balasan', () => {
  const kartu = channel.slice(channel.indexOf('function ChecklistFeedCard'), channel.indexOf('function ChecklistPage'));
  assert.doesNotMatch(kartu, /reactionCount|reactedByMe|commentComposer|Balas post ini/);
  assert.match(kartu, /Tidak menerima balasan/);
  assert.match(kartu, /Mulai checklist/);
  assert.match(kartu, /Lanjutkan checklist/);
  assert.match(css, /\.checklistFeedClosed\{[^}]*color:var\(--muted\)/);
});

test('progres kartu checklist datang dari server, bukan dari tulisan yang termuat', () => {
  // Feed dipenggal per halaman; menghitung dari `posts` akan menyebut "2 dari 2"
  // pada checklist yang sebenarnya berisi lima langkah.
  assert.match(channel, /checklistCompletedCount: number/);
  assert.match(channel, /const total = channel\.postCount/);
  assert.match(channel, /Math\.min\(channel\.checklistCompletedCount, total\)/);
  // Bilah progresnya dipakai bersama halaman checklist, bukan disalin.
  assert.match(channel, /className="checklistProgressBar"/);
});

test('composer mengunggah lampiran lebih dulu lalu menyebut id-nya saat menerbitkan', () => {
  // Menerbitkan dulu lalu mengunggah berarti pembaca melihat tulisan tanpa
  // gambarnya selama unggahan berjalan, dan tulisan itu tinggal selamanya bila
  // unggahannya gagal.
  assert.match(composer, /uploadDraftAttachment\(file, setProgres\)/);
  assert.match(composer, /attachmentIds: lampiran\.map\(\(item\) => item\.id\)/);
  assert.match(channel, /\.\.\.\(attachmentIds\.length \? \{ attachmentIds \} : \{\}\)/);
});

test('composer hanya mengosongkan isinya ketika server benar-benar menerima', () => {
  // Kalau dikosongkan tanpa syarat, satu galat jaringan menghapus tulisan dan
  // seluruh lampiran yang sudah diunggah.
  assert.match(composer, /const berhasil = await onPublish\(/);
  assert.match(composer, /if \(!berhasil\) return;/);
  assert.match(channel, /return true;/);
  assert.match(channel, /return false;/);
});

test('lampiran postingan dibaca lewat endpoint, bukan jalur berkas', () => {
  // Kunci objek tidak pernah sampai ke klien; berkasnya disajikan API lewat
  // X-Accel-Redirect sesudah kewenangannya diperiksa.
  assert.match(attachments, /\/api\/v1\/community\/attachments\/\$\{id\}/);
  assert.doesNotMatch(attachments, /objectKey/);
  assert.match(channel, /<PostAttachments attachments=\{post\.attachments \?\? \[\]\} \/>/);
});

test('satu media mengisi lebar kartu dan dipangkas, bukan disusutkan', () => {
  // Cacat yang pernah terjadi dua kali di permukaan yang sama, keduanya
  // dilaporkan lewat tangkapan layar:
  //
  //  1. `object-fit:contain` menyusutkan gambar sampai muat lalu mengisi sisa
  //     kotaknya dengan ruang kosong — bilah abu-abu lebar mengapit potret.
  //  2. Perbaikan pertamanya menghapus bilah itu dengan membiarkan gambar
  //     menentukan ukurannya sendiri, tetapi potret jadi lajur sempit di kartu
  //     yang lebar.
  //
  // Keduanya ditutup oleh aturan yang sama: isi lebar penuh, lalu pangkas yang
  // kelebihan. `cover` tidak pernah menyisakan ruang kosong; `contain` selalu
  // bisa.
  assert.match(css, /\.postMediaSingle img\{display:block;width:100%;height:auto;max-height:min\(125cqw,760px\);object-fit:cover\}/);
  assert.doesNotMatch(css, /\.postMediaSingle img\{[^}]*object-fit:contain/);

  // Batasnya wajib relatif terhadap lebar kartu. Angka piksel mati memangkas
  // dengan kadar yang berbeda-beda tergantung lebar layar, dan pada kartu sempit
  // ia berhenti membatasi sama sekali.
  assert.match(css, /\.postMediaSingle\{container-type:inline-size\}/);

  // Video justru tidak boleh dipangkas: memotong gambar diam masih menyisakan
  // pokoknya, memotong video memotong wajah orang yang sedang berbicara.
  assert.match(css, /\.postMediaSingle video\{[^}]*object-fit:contain[^}]*\}/);

  // Dua media atau lebih: deret mendatar setinggi sama, lebar mengikuti rasio
  // masing-masing.
  assert.match(css, /\.postMediaRow\{[^}]*overflow-x:auto/);
  assert.match(css, /\.postMediaRow img,\.postMediaRow video\{display:block;height:100%;width:auto/);
});

test('gambar dan video berada dalam satu deret, urut sesuai position', () => {
  // Memisahkan gambar dari video membuat urutan yang dipilih penulisnya hilang
  // begitu ia mencampur jenis.
  assert.match(attachments, /\.sort\(\(a, b\) => a\.position - b\.position\)/);
  assert.match(attachments, /media\.length === 1 \? 'postMedia postMediaSingle' : 'postMedia postMediaRow'/);
});

test('batas lampiran di composer sejalan dengan batas server', () => {
  // Dua angka di dua tempat. Kalau melenceng, penulisnya baru tahu setelah
  // berkasnya selesai terunggah dan ditolak server.
  assert.match(composer, /const MAKS_LAMPIRAN = 5;/);
  assert.match(composer, /const MAKS_BYTE = 26_214_400;/);
});

test('hasil polling terlihat sebelum orangnya memilih', () => {
  // Menyembunyikan hasil sampai seseorang ikut memilih memaksa orang menekan
  // pilihan hanya untuk dapat melihatnya — dan suara yang lahir dari rasa
  // penasaran bukan pendapat.
  assert.match(poll, /nilai\.totalVotes > 0 \? Math\.round/);
  assert.doesNotMatch(poll, /myOptionId \? [\s\S]{0,40}persen/);
});

test('menekan pilihan yang sama tidak mengirim ulang suara', () => {
  assert.match(poll, /if \(pending \|\| nilai\.myOptionId === optionId\) return;/);
  assert.match(poll, /POST\('\/api\/v1\/community\/posts\/\{postId\}\/poll\/vote'/);
});

test('composer menolak menerbitkan polling berpilihan kurang dari dua', () => {
  // API menolaknya 422. Kalau tombolnya tetap aktif, penulisnya baru tahu
  // sesudah menekan Terbitkan dan kehilangan konteksnya.
  assert.match(composer, /const pollingSiap = polling === null \|\|/);
  assert.match(composer, /!pollingSiap/);
  assert.match(composer, /const POLLING_MIN = 2;/);
});
