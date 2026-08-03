-- Tanda terima pengantaran email, sepasang dengan yang sudah ada untuk WhatsApp.
--
-- `email_delivery_status` ditulis `SENT` hanya karena Resend membalas 2xx —
-- yang berarti "Resend menerima suratnya untuk diantar", bukan "surat sampai".
-- Pada 3 Agustus 2026 email aktivasi sebuah order berstatus `SENT` sementara
-- Gmail menaruhnya di Spam; tidak ada apa pun di basis data yang membedakan itu
-- dari surat yang mendarat di Kotak Masuk.
--
-- Id dari balasan Resend disimpan supaya webhook statusnya punya pegangan untuk
-- mencocokkan peristiwa dengan ordernya.
ALTER TABLE "registration_orders" ADD COLUMN "email_message_id" TEXT;

CREATE UNIQUE INDEX "registration_orders_email_message_id_key"
  ON "registration_orders"("email_message_id");
