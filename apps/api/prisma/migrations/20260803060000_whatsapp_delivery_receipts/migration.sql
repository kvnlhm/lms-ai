-- Tanda terima pengantaran WhatsApp.
--
-- Sebelum ini `whatsapp_delivery_status` ditulis `SENT` hanya karena Graph API
-- membalas 2xx. Balasan itu berarti "Meta menerima permintaannya", bukan "pesan
-- sampai": Meta dapat menggagalkan pengantaran sesudahnya dan satu-satunya
-- pemberitahuannya adalah webhook status pesan. Akibatnya order yang WA-nya
-- tidak pernah sampai tetap tercatat sudah dikirimi.
--
-- `DELIVERED` ditambahkan di akhir daftar enum. Nilai enum PostgreSQL tidak
-- dapat disisipkan di tengah tanpa menulis ulang tipenya, dan urutannya tidak
-- dipakai untuk mengurutkan apa pun di kode.
ALTER TYPE "DeliveryStatus" ADD VALUE 'DELIVERED';

-- `wamid` dari balasan Meta. Unik karena satu pesan hanya milik satu order,
-- dan webhook mencari ordernya lewat kolom ini.
ALTER TABLE "registration_orders" ADD COLUMN "whatsapp_message_id" TEXT;

CREATE UNIQUE INDEX "registration_orders_whatsapp_message_id_key"
  ON "registration_orders"("whatsapp_message_id");
