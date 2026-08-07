'use client';

import { ApiError } from '@lms/api-client';
import { browserApiUrl, readCsrfToken } from './browser-api';

export type LampiranTerunggah = {
  id: string; originalName: string; mimeType: string; sizeBytes: string; position: number; createdAt: string;
};

/**
 * Mengunggah satu berkas sebagai badan permintaan mentah.
 *
 * `XMLHttpRequest`, bukan `fetch`: hanya XHR yang melaporkan kemajuan unggahan,
 * dan tanpa itu berkas 10 MB tampak seperti antarmuka yang menggantung.
 */
function kirim<T>(path: string, file: File, onProgress: (percent: number) => void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', new URL(path, `${browserApiUrl().replace(/\/$/, '')}/`).toString());
    request.withCredentials = true;
    request.setRequestHeader('Content-Type', file.type);
    request.setRequestHeader('X-File-Name', file.name.replace(/[^\x20-\x7E]/g, '_'));
    const csrf = readCsrfToken();
    if (csrf) request.setRequestHeader('X-CSRF-Token', csrf);
    request.upload.addEventListener('progress', (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        try { return resolve(JSON.parse(request.responseText)?.data as T); } catch { return resolve(undefined); }
      }
      let message = 'Lampiran gagal diunggah.';
      try { message = JSON.parse(request.responseText)?.error?.message ?? message; } catch { /* respons non-JSON */ }
      reject(new ApiError('VALIDATION_ERROR', request.status, message));
    });
    request.addEventListener('error', () => reject(new ApiError('INTERNAL_ERROR', 0, 'Tidak dapat menghubungi server.')));
    request.send(file);
  });
}

export async function uploadChecklistAttachment(postId: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  await kirim(`/api/v1/community/checklist/${postId}/attachment`, file, onProgress);
}

/**
 * Mengunggah lampiran composer, sebelum postingannya ada.
 *
 * Id yang dikembalikan disebut pada `attachmentIds` saat menerbitkan. Sampai
 * saat itu berkasnya hanya dapat dibaca pengunggahnya, dan akan disapu server
 * bila composer ditutup begitu saja.
 */
export async function uploadDraftAttachment(file: File, onProgress: (percent: number) => void): Promise<LampiranTerunggah> {
  const hasil = await kirim<LampiranTerunggah>('/api/v1/community/attachments', file, onProgress);
  if (!hasil) throw new ApiError('INTERNAL_ERROR', 0, 'Server tidak mengembalikan lampiran.');
  return hasil;
}
