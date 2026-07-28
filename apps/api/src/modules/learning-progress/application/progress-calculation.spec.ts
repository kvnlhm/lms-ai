import { calculateProgress } from './progress-calculation';

describe('calculateProgress', () => {
  it('menghitung persentase dua desimal', () => {
    expect(calculateProgress({ requiredTotal: 3, requiredCompleted: 1 })).toEqual({
      percent: 33.33,
      isCourseComplete: false,
    });
  });

  it('membatasi completion agar materi opsional tidak membuat progres melebihi 100%', () => {
    expect(calculateProgress({ requiredTotal: 2, requiredCompleted: 4 })).toEqual({
      percent: 100,
      isCourseComplete: true,
    });
  });

  it('tidak menyelesaikan kursus tanpa pelajaran wajib', () => {
    expect(calculateProgress({ requiredTotal: 0, requiredCompleted: 0 })).toEqual({
      percent: 0,
      isCourseComplete: false,
    });
  });

  it('menormalkan input negatif', () => {
    expect(calculateProgress({ requiredTotal: -1, requiredCompleted: -3 })).toEqual({
      percent: 0,
      isCourseComplete: false,
    });
  });
});
