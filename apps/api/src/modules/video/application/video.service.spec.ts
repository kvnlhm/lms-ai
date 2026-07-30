import { parseYoutubeVideoId } from './video.service';

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
