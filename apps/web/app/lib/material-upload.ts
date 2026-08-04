'use client';

import { ApiError } from '@lms/api-client';
import { browserApiUrl, readCsrfToken } from './browser-api';

/**
 * Mengunggah berkas materi pelajaran.
 *
 * Memakai XHR, bukan `fetch`, karena hanya XHR yang melaporkan kemajuan
 * unggahan — dan PDF berpuluh megabyte tanpa indikator terasa seperti aplikasi
 * yang menggantung.
 *
 * Nama berkas dikirim lewat header tersendiri, bukan sebagai bagian body:
 * bodynya adalah PDF mentah yang dialirkan langsung ke disk, tanpa dibungkus
 * multipart yang harus ditampung dulu di memori server.
 */
export function uploadMaterial(
  lessonId: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    throw new ApiError('VALIDATION_ERROR', 422, `"${file.name}" bukan berkas .pdf.`);
  }
  if (file.size < 1) {
    throw new ApiError('VALIDATION_ERROR', 422, `"${file.name}" kosong.`);
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const url = new URL(
      `/api/v1/admin/lessons/${lessonId}/material`,
      `${browserApiUrl().replace(/\/$/, '')}/`,
    ).toString();
    request.open('PUT', url);
    request.withCredentials = true;
    request.setRequestHeader('Content-Type', 'application/pdf');
    // Hanya ASCII yang aman di header; nama berkas non-latin diganti server.
    request.setRequestHeader('X-File-Name', file.name.replace(/[^\x20-\x7E]/g, '_'));
    const csrf = readCsrfToken();
    if (csrf) request.setRequestHeader('X-CSRF-Token', csrf);

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }
      let pesan = 'Materi gagal diunggah.';
      try {
        const isi = JSON.parse(request.responseText) as { error?: { message?: string } };
        if (isi.error?.message) pesan = isi.error.message;
      } catch {
        // Balasan yang bukan JSON tidak menambah keterangan apa pun.
      }
      reject(new ApiError('VALIDATION_ERROR', request.status, pesan));
    });
    request.addEventListener('error', () =>
      reject(new ApiError('INTERNAL_ERROR', 0, 'Tidak dapat menghubungi server.')),
    );
    request.send(file);
  });
}
