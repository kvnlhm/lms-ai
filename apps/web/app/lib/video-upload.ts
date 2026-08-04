import { ApiError, browserApiUrl, browserClient, readCsrfToken, unwrap } from './browser-api';

/**
 * Unggahan video dipakai di dua tempat — penyusun kursus dan perpustakaan
 * media — jadi jalurnya tinggal satu di sini.
 *
 * Memakai XMLHttpRequest, bukan fetch, semata karena hanya XHR yang melaporkan
 * kemajuan unggahan. Untuk berkas 1 GB, bilah kemajuan adalah pembeda antara
 * "sedang berjalan" dan "mungkin menggantung".
 */
export function uploadFile(
  uploadUrl: string,
  method: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const absoluteUrl = new URL(uploadUrl, `${browserApiUrl().replace(/\/$/, '')}/`).toString();
    request.open(method, absoluteUrl);
    request.withCredentials = true;
    request.setRequestHeader('Content-Type', 'video/mp4');
    const csrf = readCsrfToken();
    if (csrf) request.setRequestHeader('X-CSRF-Token', csrf);

    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable || event.total < 1) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(xhrApiError(request));
    });
    request.addEventListener('error', () => {
      reject(new ApiError('NETWORK_ERROR', 0, 'Koneksi terputus saat mengunggah video.'));
    });
    request.addEventListener('abort', () => {
      reject(new ApiError('NETWORK_ERROR', 0, 'Upload video dibatalkan.'));
    });
    request.send(file);
  });
}

function xhrApiError(request: XMLHttpRequest): ApiError {
  try {
    const payload = JSON.parse(request.responseText) as {
      error?: {
        code?: string;
        message?: string;
        fields?: Record<string, string[]>;
        requestId?: string;
      };
    };
    const body = payload.error;
    if (body) {
      return new ApiError(
        (body.code ?? 'INTERNAL_ERROR') as ConstructorParameters<typeof ApiError>[0],
        request.status,
        body.message ?? 'Upload video gagal.',
        body.fields,
        body.requestId,
      );
    }
  } catch {
    // Respons non-JSON ditangani dengan pesan generik di bawah.
  }
  return new ApiError('INTERNAL_ERROR', request.status, 'Server menolak upload video.');
}

export function uploadErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Upload gagal. Periksa koneksi dan coba lagi.';
  }
  const details = error.fields ? Object.values(error.fields).flat().filter(Boolean) : [];
  return details.length > 0 ? details.join(' ') : error.message;
}

/** Nama berkas tanpa ekstensi, dipakai sebagai judul awal di perpustakaan. */
export function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').slice(0, 200) || fileName.slice(0, 200);
}

/**
 * Mengunggah satu berkas ke perpustakaan dan mengembalikan id asetnya.
 *
 * Validasi ekstensi dan ukuran dilakukan di sini supaya pemanggil tidak
 * mengirim berkas yang sudah pasti ditolak server setelah menunggu lama.
 */
export async function uploadToLibrary(
  file: File,
  title: string,
  onProgress: (percent: number) => void,
): Promise<string> {
  if (!file.name.toLowerCase().endsWith('.mp4')) {
    throw new ApiError('VALIDATION_ERROR', 422, `"${file.name}" bukan berkas .mp4.`);
  }
  if (file.size < 1) {
    throw new ApiError('VALIDATION_ERROR', 422, `"${file.name}" kosong.`);
  }

  // Sebagian browser/OS memberi `file.type` kosong atau `application/octet-stream`
  // untuk MP4. Ekstensi dinormalisasi di sini; server tetap memeriksa signature
  // ISO-BMFF `ftyp` sebelum menandai video tersedia.
  const intent = unwrap(
    await browserClient().POST('/api/v1/admin/videos/upload-intents', {
      body: { title, fileName: file.name, mimeType: 'video/mp4', sizeBytes: file.size },
    }),
  );

  await uploadFile(intent.uploadUrl, intent.method, file, onProgress);
  return intent.videoAssetId;
}

/** Memasang aset perpustakaan pada sebuah pelajaran. */
export async function attachToLesson(lessonId: string, videoAssetId: string): Promise<void> {
  unwrap(
    await browserClient().PUT('/api/v1/admin/lessons/{lessonId}/video', {
      params: { path: { lessonId } },
      body: { videoAssetId },
    }),
  );
}
