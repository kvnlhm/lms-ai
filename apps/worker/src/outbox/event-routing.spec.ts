import { destinationsFor, retryDelayMs } from './event-routing';

describe('Perutean event outbox', () => {
  it('mengirim event pembelajaran ke analytics', () => {
    expect(destinationsFor('learning.lesson_opened')).toEqual(['analytics']);
    expect(destinationsFor('learning.lesson_completed')).toEqual(['analytics']);
  });

  it('mengirim penyelesaian kursus ke analytics dan notifications', () => {
    expect(destinationsFor('learning.course_completed')).toEqual(['analytics', 'notifications']);
  });

  it('mengembalikan daftar kosong untuk event yang belum dipetakan', () => {
    expect(destinationsFor('community.discussion_created')).toEqual([]);
  });
});

describe('Backoff percobaan ulang', () => {
  it('berlipat ganda pada setiap percobaan', () => {
    expect(retryDelayMs(1)).toBe(2_000);
    expect(retryDelayMs(2)).toBe(4_000);
    expect(retryDelayMs(3)).toBe(8_000);
  });

  it('berhenti bertambah pada lima menit', () => {
    expect(retryDelayMs(20)).toBe(300_000);
  });

  it('memperlakukan percobaan nol seperti percobaan pertama', () => {
    expect(retryDelayMs(0)).toBe(2_000);
  });
});
