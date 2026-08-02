-- Harga normal paket akses, untuk ditampilkan tercoret di samping harga jual.
--
-- Nullable dan tanpa nilai bawaan: paket yang memang tidak sedang diskon
-- tampil dengan satu harga saja, dan baris yang sudah ada tidak perlu
-- ditebak nilainya.
ALTER TABLE "access_tiers" ADD COLUMN "original_price_idr" INTEGER;
