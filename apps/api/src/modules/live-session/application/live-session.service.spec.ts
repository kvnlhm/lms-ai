import { isAllowedMeetingUrl } from './live-session.service';

describe('isAllowedMeetingUrl', () => {
  it('accepts the meeting providers Master is likely to use', () => {
    expect(isAllowedMeetingUrl('https://zoom.us/j/1234567890')).toBe(true);
    expect(isAllowedMeetingUrl('https://us02web.zoom.us/j/1234567890?pwd=abc')).toBe(true);
    expect(isAllowedMeetingUrl('https://meet.google.com/abc-defg-hij')).toBe(true);
    expect(isAllowedMeetingUrl('https://teams.microsoft.com/l/meetup-join/x')).toBe(true);
    expect(isAllowedMeetingUrl('  https://meet.jit.si/AIPreneur  ')).toBe(true);
  });

  it('rejects plain http because the link would travel in the clear', () => {
    expect(isAllowedMeetingUrl('http://zoom.us/j/1234567890')).toBe(false);
  });

  it('rejects hosts that merely contain an allowed name', () => {
    // Kolom ini disiarkan ke seluruh peserta kursus, jadi host palsu harus
    // ditolak alih-alih sekadar dicocokkan sebagian.
    expect(isAllowedMeetingUrl('https://zoom.us.phishing.test/j/1')).toBe(false);
    expect(isAllowedMeetingUrl('https://notzoom.us/j/1')).toBe(false);
    expect(isAllowedMeetingUrl('https://meet.google.com.evil.test/x')).toBe(false);
  });

  it('rejects providers outside the allow list', () => {
    expect(isAllowedMeetingUrl('https://example.com/meeting')).toBe(false);
    expect(isAllowedMeetingUrl('https://discord.gg/abc')).toBe(false);
  });

  it('rejects anything that is not a usable URL', () => {
    expect(isAllowedMeetingUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedMeetingUrl('bukan tautan')).toBe(false);
    expect(isAllowedMeetingUrl('')).toBe(false);
  });
});
