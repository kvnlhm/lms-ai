import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import type { AppConfig } from '../../../config/configuration';
import { AppError } from '../../../shared/errors/app-error';

/** Identitas yang sudah terbukti milik pemegang token. */
export interface IdentitasGoogle {
  /** Penanda akun Google yang tidak berubah walau emailnya diganti. */
  sub: string;
  email: string;
  name?: string;
}

/**
 * Memeriksa ID token dari tombol "Masuk dengan Google".
 *
 * Yang dipakai ID token, bukan alur redirect authorization code: browser
 * memperoleh tokennya langsung dari Google, dan yang perlu dilakukan server
 * hanyalah membuktikan token itu memang terbitan Google dan memang untuk
 * aplikasi ini. Tidak ada `state`, tidak ada callback, tidak ada client secret
 * yang harus disimpan.
 *
 * Tanda tangan, `iss`, dan `exp` diperiksa `google-auth-library`; `aud`
 * diperiksa dengan menyerahkan client id kita sebagai `audience` — tanpa itu
 * token yang diterbitkan untuk aplikasi lain ikut diterima.
 */
@Injectable()
export class GoogleIdentityService {
  private readonly logger = new Logger(GoogleIdentityService.name);
  private readonly clientId: string;
  private readonly klien: Pick<OAuth2Client, 'verifyIdToken'>;

  constructor(config: ConfigService<{ app: AppConfig }, true>) {
    this.clientId = config.get('app', { infer: true }).auth.googleClientId;
    this.klien = new OAuth2Client(this.clientId);
  }

  /** Apakah masuk dengan Google dikonfigurasi sama sekali. */
  aktif(): boolean {
    return this.clientId !== '';
  }

  /**
   * Membuktikan token, lalu mengembalikan identitas di dalamnya.
   *
   * Selalu melempar 401 yang sama tanpa merinci sebabnya: pemegang token yang
   * ditolak tidak perlu tahu apakah yang salah tanda tangannya, audience-nya,
   * atau status verifikasi emailnya.
   */
  async periksa(idToken: string): Promise<IdentitasGoogle> {
    // Client id kosong berarti fitur ini belum dikonfigurasi. Menerima token
    // apa pun dalam keadaan itu berarti menerima token aplikasi mana pun.
    if (!this.aktif()) {
      this.logger.warn('Masuk dengan Google dipanggil tetapi GOOGLE_OAUTH_CLIENT_ID kosong.');
      throw AppError.invalidCredentials();
    }

    let klaim;
    try {
      const tiket = await this.klien.verifyIdToken({ idToken, audience: this.clientId });
      klaim = tiket.getPayload();
    } catch {
      throw AppError.invalidCredentials();
    }

    // `email_verified` harus diperiksa sendiri; pustakanya tidak melakukannya.
    // Inilah satu-satunya yang menahan pengambilalihan akun lewat email yang
    // sama, karena penautan memang dilakukan berdasarkan email.
    if (!klaim?.sub || !klaim.email || klaim.email_verified !== true) {
      throw AppError.invalidCredentials();
    }

    return { sub: klaim.sub, email: klaim.email.trim().toLowerCase(), name: klaim.name };
  }
}
