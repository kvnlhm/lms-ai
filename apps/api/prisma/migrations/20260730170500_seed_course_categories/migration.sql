INSERT INTO "course_categories" ("id", "slug", "name", "created_at")
VALUES
  ('10000000-0000-4000-8000-000000000001', 'ai-untuk-pemilik-bisnis', 'AI untuk Pemilik Bisnis', NOW()),
  ('10000000-0000-4000-8000-000000000002', 'ai-untuk-marketing', 'AI untuk Marketing', NOW()),
  ('10000000-0000-4000-8000-000000000003', 'dasar-coding', 'Dasar Coding', NOW()),
  ('10000000-0000-4000-8000-000000000004', 'fundamental-dan-penerapan-ai', 'Fundamental dan Penerapan AI', NOW()),
  ('10000000-0000-4000-8000-000000000005', 'karier-dan-kesiapan-kerja-ai', 'Karier dan Kesiapan Kerja AI', NOW())
ON CONFLICT ("slug") DO NOTHING;
