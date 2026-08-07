-- Materi video diselesaikan dengan ditandai manual, bukan dengan ambang tontonan.
--
-- Aturan `VIDEO_PERCENTAGE` tersimpan sejak lama tetapi baru benar-benar
-- ditegakkan belakangan. Sejak saat itu 95 pelajaran video menuntut 90% tontonan
-- sebelum dapat diselesaikan, dan tombol "Tandai selesai" mati sampai ambang itu
-- terpenuhi. Pemiliknya memutuskan penyelesaian materi video cukup ditandai
-- sendiri oleh pelajar.
--
-- `completion_config` sengaja tidak dikosongkan. Di bawah aturan MANUAL ia tidak
-- dibaca sama sekali (`ambangPelajaran` mengembalikan null untuk aturan yang
-- tidak memakainya), sedangkan membuangnya berarti menghapus angka yang dulu
-- dipilih Master — dan angka itulah yang akan dipakai lagi kalau suatu saat
-- sebuah pelajaran dikembalikan ke `VIDEO_PERCENTAGE`.
--
-- Aturan `VIDEO_PERCENTAGE` sendiri tidak dihapus dari sistem; ia tetap dapat
-- dipilih per pelajaran di editor kursus.
UPDATE "lessons"
SET "completion_rule" = 'MANUAL'
WHERE "content_type" = 'VIDEO'
  AND "completion_rule" = 'VIDEO_PERCENTAGE';
