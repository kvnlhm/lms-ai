/**
 * Penangkap galat sisi server Next.js.
 *
 * `global-error.tsx` hanya menangkap yang terjadi di browser. Kegagalan saat
 * Server Component dirender — API tidak terjangkau, data tidak sesuai bentuk —
 * tidak pernah sampai ke sana, dan sebelumnya hanya berakhir di log container
 * web yang praktis tidak pernah dibaca.
 */
export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
): Promise<void> {
  // Alamat internal, bukan yang dipakai browser: ini berjalan di dalam jaringan
  // Docker, tempat nama service yang berlaku.
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return;

  const described =
    error instanceof Error
      ? { type: error.name || 'Error', message: error.message || 'Tanpa pesan', stack: error.stack }
      : { type: 'UnknownError', message: String(error), stack: undefined };

  try {
    await fetch(`${apiUrl}/api/v1/telemetry/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: described.type.slice(0, 200),
        message: described.message.slice(0, 500),
        ...(described.stack ? { stack: described.stack.slice(0, 4_000) } : {}),
        ...(request.path
          ? { path: `${request.method ?? 'GET'} ${request.path.split('?')[0]}`.slice(0, 300) }
          : {}),
      }),
    });
  } catch {
    // Pelaporan galat tidak boleh menjadi sumber galat baru.
  }
}
