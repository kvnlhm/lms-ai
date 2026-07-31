'use client';

import { browserApiUrl } from './browser-api';

/**
 * Galat yang sudah dilaporkan pada sesi tab ini.
 *
 * Komponen React yang gagal render kerap gagal berulang kali dalam hitungan
 * detik. Tanpa penjaga ini, satu bug menghasilkan puluhan permintaan dan
 * langsung menabrak pembatas laju di API — sehingga laporan pertama yang justru
 * paling berguna ikut tertolak.
 */
const reported = new Set<string>();
const MAX_TRACKED = 50;

export interface ClientErrorReport {
  type: string;
  message: string;
  stack?: string;
  path?: string;
}

export function describeError(error: unknown): { type: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      type: error.name || 'Error',
      message: error.message || 'Tanpa pesan',
      stack: error.stack,
    };
  }
  return { type: 'UnknownError', message: String(error).slice(0, 500) };
}

/**
 * Mengirim laporan galat browser ke API.
 *
 * Tidak pernah melempar dan tidak pernah ditunggu: halaman sudah rusak, dan
 * kegagalan melaporkannya tidak boleh menambah masalah baru di atasnya.
 */
export function reportClientError(error: unknown, path?: string): void {
  try {
    const described = describeError(error);
    const signature = `${described.type}|${described.message}`;
    if (reported.has(signature)) return;
    if (reported.size >= MAX_TRACKED) reported.clear();
    reported.add(signature);

    // Query sengaja dibuang: sering memuat token undangan atau pemulihan
    // password, dan tabel galat bukan tempat yang pantas untuk itu.
    const resolvedPath =
      path ?? (typeof window === 'undefined' ? undefined : window.location.pathname);

    const body: ClientErrorReport = {
      type: described.type.slice(0, 200),
      message: described.message.slice(0, 500),
      ...(described.stack ? { stack: described.stack.slice(0, 4_000) } : {}),
      ...(resolvedPath ? { path: resolvedPath.slice(0, 300) } : {}),
    };

    void fetch(`${browserApiUrl()}/api/v1/telemetry/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // Supaya laporan tetap terkirim ketika galatnya memicu perpindahan halaman.
      keepalive: true,
    }).catch(() => {
      // Diam: tidak ada tindakan berguna bila pelaporan galat ikut gagal.
    });
  } catch {
    // Sama: pelaporan tidak boleh menjadi sumber galat baru.
  }
}
