import { gradeAttempt, isPassed, type QuestionKey } from './quiz-grading';

const soalTunggal: QuestionKey = {
  id: 'q1',
  type: 'SINGLE_CHOICE',
  points: 1,
  correctOptionIds: ['a'],
};

const soalGanda: QuestionKey = {
  id: 'q2',
  type: 'MULTIPLE_CHOICE',
  points: 3,
  correctOptionIds: ['x', 'y'],
};

describe('Penilaian kuis', () => {
  it('memberi poin penuh untuk jawaban tunggal yang benar', () => {
    const hasil = gradeAttempt([soalTunggal], new Map([['q1', ['a']]]));

    expect(hasil.earnedPoints).toBe(1);
    expect(hasil.totalPoints).toBe(1);
    expect(hasil.scorePercent).toBe(100);
    expect(hasil.results[0]!.isCorrect).toBe(true);
  });

  it('tidak memberi poin untuk jawaban tunggal yang salah', () => {
    const hasil = gradeAttempt([soalTunggal], new Map([['q1', ['b']]]));

    expect(hasil.earnedPoints).toBe(0);
    expect(hasil.scorePercent).toBe(0);
  });

  it('menuntut seluruh pilihan benar pada soal berjawaban ganda', () => {
    const kurang = gradeAttempt([soalGanda], new Map([['q2', ['x']]]));
    const berlebih = gradeAttempt([soalGanda], new Map([['q2', ['x', 'y', 'z']]]));
    const tepat = gradeAttempt([soalGanda], new Map([['q2', ['y', 'x']]]));

    expect(kurang.results[0]!.isCorrect).toBe(false);
    expect(berlebih.results[0]!.isCorrect).toBe(false);
    // Urutan pilihan tidak menentukan benar salahnya.
    expect(tepat.results[0]!.isCorrect).toBe(true);
    expect(tepat.earnedPoints).toBe(3);
  });

  it('menimbang nilai menurut bobot tiap soal, bukan jumlah soal', () => {
    const hasil = gradeAttempt(
      [soalTunggal, soalGanda],
      new Map([
        ['q1', ['a']],
        ['q2', ['x']],
      ]),
    );

    // Satu dari dua soal benar, tetapi bobotnya 1 dari 4.
    expect(hasil.earnedPoints).toBe(1);
    expect(hasil.totalPoints).toBe(4);
    expect(hasil.scorePercent).toBe(25);
  });

  it('menganggap soal tanpa jawaban sebagai salah', () => {
    const hasil = gradeAttempt([soalTunggal, soalGanda], new Map([['q1', ['a']]]));

    expect(hasil.results[1]!.isCorrect).toBe(false);
    expect(hasil.scorePercent).toBe(25);
  });

  it('membulatkan nilai ke dua desimal', () => {
    const soal = Array.from({ length: 3 }, (_, index) => ({
      id: `s${index}`,
      type: 'SINGLE_CHOICE' as const,
      points: 1,
      correctOptionIds: ['benar'],
    }));

    const hasil = gradeAttempt(soal, new Map([['s0', ['benar']]]));

    expect(hasil.scorePercent).toBe(33.33);
  });

  it('menilai kuis tanpa soal sebagai nol alih-alih membagi dengan nol', () => {
    expect(gradeAttempt([], new Map()).scorePercent).toBe(0);
  });

  it('meluluskan nilai yang tepat menyentuh ambang', () => {
    expect(isPassed(70, 70)).toBe(true);
    expect(isPassed(69.99, 70)).toBe(false);
  });
});
