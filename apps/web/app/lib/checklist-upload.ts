'use client';

import { ApiError } from '@lms/api-client';
import { browserApiUrl, readCsrfToken } from './browser-api';

export function uploadChecklistAttachment(postId: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', new URL(`/api/v1/community/checklist/${postId}/attachment`, `${browserApiUrl().replace(/\/$/, '')}/`).toString());
    request.withCredentials = true;
    request.setRequestHeader('Content-Type', file.type);
    request.setRequestHeader('X-File-Name', file.name.replace(/[^\x20-\x7E]/g, '_'));
    const csrf = readCsrfToken();
    if (csrf) request.setRequestHeader('X-CSRF-Token', csrf);
    request.upload.addEventListener('progress', (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) return resolve();
      let message = 'Lampiran gagal diunggah.';
      try { message = JSON.parse(request.responseText)?.error?.message ?? message; } catch { /* respons non-JSON */ }
      reject(new ApiError('VALIDATION_ERROR', request.status, message));
    });
    request.addEventListener('error', () => reject(new ApiError('INTERNAL_ERROR', 0, 'Tidak dapat menghubungi server.')));
    request.send(file);
  });
}
