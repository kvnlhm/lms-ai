import {
  bunnyPlaylistUrl,
  parseBunnyVideoId,
  parseYoutubeVideoId,
  playbackWatermarkText,
} from './video.service';

describe('parseYoutubeVideoId', () => {
  it('accepts the link shapes people actually paste', () => {
    const expected = 'dQw4w9WgXcQ';
    expect(parseYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(expected);
    expect(parseYoutubeVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(expected);
    expect(parseYoutubeVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(expected);
    expect(parseYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe(expected);
    expect(parseYoutubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(expected);
    expect(parseYoutubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(expected);
    expect(parseYoutubeVideoId('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe(expected);
  });

  it('keeps the video id when the link carries extra parameters', () => {
    expect(parseYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL1')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(parseYoutubeVideoId('  https://youtu.be/dQw4w9WgXcQ?si=abc  ')).toBe('dQw4w9WgXcQ');
  });

  it('rejects links that are not YouTube videos', () => {
    expect(parseYoutubeVideoId('https://vimeo.com/123456789')).toBeNull();
    expect(parseYoutubeVideoId('https://www.youtube.com/')).toBeNull();
    expect(parseYoutubeVideoId('https://www.youtube.com/@channel')).toBeNull();
    expect(parseYoutubeVideoId('https://www.youtube.com/watch?list=PL1')).toBeNull();
    expect(parseYoutubeVideoId('bukan tautan sama sekali')).toBeNull();
    expect(parseYoutubeVideoId('')).toBeNull();
  });

  it('rejects ids that are the wrong length or contain illegal characters', () => {
    expect(parseYoutubeVideoId('https://youtu.be/tooshort')).toBeNull();
    expect(parseYoutubeVideoId('https://youtu.be/waaaaaaaytoolong')).toBeNull();
    expect(parseYoutubeVideoId('https://youtu.be/abcdefghij!')).toBeNull();
  });

  it('rejects non-http schemes so a link can never become script execution', () => {
    expect(parseYoutubeVideoId('javascript:alert(1)')).toBeNull();
    expect(parseYoutubeVideoId('data:text/html,<script>alert(1)</script>')).toBeNull();
    // Host yang sekadar mengandung "youtube.com" bukan milik YouTube.
    expect(parseYoutubeVideoId('https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ')).toBeNull();
  });
});

describe('playbackWatermarkText', () => {
  it('identifies the viewer and session without exposing the complete email local-part', () => {
    expect(
      playbackWatermarkText(
        'Pelajar Testing',
        'pelajar.testing@example.com',
        '91ba1234-1111-2222-3333-444444444444',
      ),
    ).toBe('Pelajar Testing · pe****@example.com · 91BA1234');
  });

  it('handles short and malformed email values without throwing', () => {
    expect(playbackWatermarkText('Akun', 'a@example.com', 'abcd1234')).toBe(
      'Akun · a*@example.com · ABCD1234',
    );
    expect(playbackWatermarkText('Akun', 'lokal', 'abcd1234')).toBe('Akun · lo*** · ABCD1234');
  });
});

describe('parseBunnyVideoId', () => {
  const guid = 'b4dcc06c-ea97-4547-aa95-c17b7c998297';

  it('accepts the shapes people actually paste from the Bunny dashboard', () => {
    expect(parseBunnyVideoId(guid)).toBe(guid);
    expect(parseBunnyVideoId(`  ${guid.toUpperCase()}  `)).toBe(guid);
    expect(parseBunnyVideoId(`https://iframe.mediadelivery.net/play/719347/${guid}`)).toBe(guid);
    expect(parseBunnyVideoId(`https://vz-8419cb1c-81c.b-cdn.net/${guid}/playlist.m3u8`)).toBe(guid);
  });

  it('rejects anything that carries no GUID at all', () => {
    expect(parseBunnyVideoId('')).toBeNull();
    expect(parseBunnyVideoId('bukan guid')).toBeNull();
    expect(parseBunnyVideoId('b4dcc06c-ea97-4547-aa95')).toBeNull();
    expect(parseBunnyVideoId('zzzzzzzz-ea97-4547-aa95-c17b7c998297')).toBeNull();
  });
});

describe('bunnyPlaylistUrl', () => {
  const videoId = 'b4dcc06c-ea97-4547-aa95-c17b7c998297';
  const dir = `/${videoId}/`;
  const expiresAt = new Date('2026-08-03T12:00:00.000Z');

  it('returns nothing when no CDN hostname is configured', () => {
    expect(bunnyPlaylistUrl({}, videoId, expiresAt)).toBeNull();
    expect(bunnyPlaylistUrl({ tokenAuthKey: 'rahasia' }, videoId, expiresAt)).toBeNull();
  });

  it('falls back to an unsigned URL when no signing key is set', () => {
    expect(bunnyPlaylistUrl({ cdnHostname: 'vz-abc.b-cdn.net' }, videoId, expiresAt)).toBe(
      `https://vz-abc.b-cdn.net${dir}playlist.m3u8`,
    );
  });

  it('signs the whole directory, with the token embedded in the path', () => {
    const url = bunnyPlaylistUrl(
      { cdnHostname: 'vz-abc.b-cdn.net', tokenAuthKey: 'kunci-rahasia' },
      videoId,
      expiresAt,
    );
    // Nilai tetapnya dihitung terpisah dengan HMAC-SHA256 + base64url di luar
    // kode ini. Tanda tangan yang diam-diam berubah bentuk akan ditolak Bunny,
    // dan gejalanya hanya "video tidak dapat diputar".
    expect(url).toBe(
      'https://vz-abc.b-cdn.net/bcdn_token=HS256-gzNt3Rlf5Msg11rRhlKSTq0BeWH9AHkOyPjMsDycxq8' +
        `&expires=1785758400${dir}playlist.m3u8`,
    );
  });

  it('keeps the token in the path so relative playlist entries inherit it', () => {
    // Inilah alasan token tidak ditaruh di query string: pemutar me-resolve
    // `720p/video.m3u8` relatif terhadap playlist, dan query induk tidak ikut.
    // Sebagai segmen path, tokennya terbawa dengan sendirinya.
    const url = bunnyPlaylistUrl(
      { cdnHostname: 'vz-abc.b-cdn.net', tokenAuthKey: 'kunci-rahasia' },
      videoId,
      expiresAt,
    );
    expect(new URL(url ?? '').search).toBe('');
    const turunan = new URL('720p/video.m3u8', url ?? '').toString();
    expect(turunan).toContain('bcdn_token=HS256-');
    expect(turunan).toContain(`${dir}720p/video.m3u8`);
  });

  it('gives a different signature once the session expires later', () => {
    const config = { cdnHostname: 'vz-abc.b-cdn.net', tokenAuthKey: 'kunci-rahasia' };
    const kemudian = new Date(expiresAt.getTime() + 60_000);
    expect(bunnyPlaylistUrl(config, videoId, kemudian)).not.toBe(
      bunnyPlaylistUrl(config, videoId, expiresAt),
    );
  });

  it('scopes the signature to one video', () => {
    const config = { cdnHostname: 'vz-abc.b-cdn.net', tokenAuthKey: 'kunci-rahasia' };
    const lain = bunnyPlaylistUrl(config, '00000000-0000-4000-8000-000000000000', expiresAt);
    expect(lain).not.toContain('gzNt3Rlf5Msg11rRhlKSTq0BeWH9AHkOyPjMsDycxq8');
  });
});
