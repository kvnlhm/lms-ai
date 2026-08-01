'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { ApiError, browserClient, unwrap } from '../../../lib/browser-api';
import { ArrowRight, Check } from '../../../components/icons';

type LearnerQuiz = Schemas['LearnerQuizDto'];
type AttemptResult = Schemas['QuizAttemptResultDto'];

interface Props {
  courseId: string;
  lessonId: string;
  nextLessonId: string | null;
}

/**
 * Pengerjaan kuis oleh pelajar.
 *
 * Penilaian sepenuhnya milik server: komponen ini tidak pernah menerima kunci
 * jawaban sebelum jawaban dikirim, jadi tidak ada yang dapat dibaca dari
 * peramban untuk menebak nilainya lebih dulu.
 */
export function QuizRunner({ courseId, lessonId, nextLessonId }: Props) {
  const router = useRouter();
  const [quiz, setQuiz] = useState<LearnerQuiz | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [alasan, setAlasan] = useState<string[]>([]);
  const [sibuk, setSibuk] = useState(false);
  const [pilihan, setPilihan] = useState<Record<string, string[]>>({});
  const [hasil, setHasil] = useState<AttemptResult | null>(null);
  /**
   * Ulasan milik percobaan yang barusan dikirim, bukan milik jawaban yang
   * sedang disusun. Begitu pelajar mengubah satu pilihan, tanda benar-salah di
   * layar tidak lagi menggambarkan apa yang akan dikirim, jadi tandanya
   * dilepas — kalau tidak, jawaban baru akan tampak sudah dinilai.
   */
  const [tampilkanUlasan, setTampilkanUlasan] = useState(false);

  useEffect(() => {
    let dibatalkan = false;

    async function muat() {
      try {
        const data = unwrap<LearnerQuiz>(
          await browserClient().GET('/api/v1/learn/lessons/{lessonId}/quiz', {
            params: { path: { lessonId } },
          }),
        );
        if (!dibatalkan) setQuiz(data);
      } catch (caught) {
        if (dibatalkan) return;
        if (caught instanceof ApiError && caught.isNotFound) {
          setGalat('Soal kuis untuk materi ini belum disiapkan.');
        } else {
          setGalat('Kuis tidak dapat dimuat. Muat ulang halaman untuk mencoba lagi.');
        }
      } finally {
        if (!dibatalkan) setMemuat(false);
      }
    }

    void muat();
    return () => {
      dibatalkan = true;
    };
  }, [lessonId]);

  function tandai(questionId: string, optionId: string, tunggal: boolean, aktif: boolean) {
    setTampilkanUlasan(false);
    setPilihan((sekarang) => {
      const terpilih = sekarang[questionId] ?? [];
      if (tunggal) return { ...sekarang, [questionId]: [optionId] };
      return {
        ...sekarang,
        [questionId]: aktif
          ? [...terpilih, optionId]
          : terpilih.filter((id) => id !== optionId),
      };
    });
  }

  async function kirim() {
    if (!quiz || sibuk) return;
    setSibuk(true);
    setGalat(null);
    setAlasan([]);

    try {
      const jawaban = quiz.questions.map((soal) => ({
        questionId: soal.id,
        selectedOptionIds: pilihan[soal.id] ?? [],
      }));

      const data = unwrap<AttemptResult>(
        await browserClient().POST('/api/v1/learn/lessons/{lessonId}/quiz/attempts', {
          params: { path: { lessonId } },
          body: { answers: jawaban },
        }),
      );

      setHasil(data);
      setTampilkanUlasan(true);
      // Daftar pelajaran di samping dan persentase progres ikut berubah begitu
      // kuis lulus, jadi halamannya dimuat ulang alih-alih ditebak di klien.
      if (data.passed) router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.isUnauthenticated) {
          router.replace(`/login?next=/learn/${courseId}/${lessonId}`);
          return;
        }
        setGalat(caught.message);
        setAlasan(Object.values(caught.fields ?? {}).flat());
      } else {
        setGalat('Tidak dapat menghubungi server. Jawaban belum terkirim.');
      }
    } finally {
      setSibuk(false);
    }
  }

  if (memuat) return <p className="stageNote">Memuat kuis…</p>;

  if (!quiz) {
    return (
      <p className="notice noticeError" role="alert">
        {galat ?? 'Kuis tidak tersedia.'}
      </p>
    );
  }

  const sudahLulus = hasil?.passed ?? quiz.passed;
  const sisaPercobaan = hasil ? hasil.attemptsLeft : quiz.attemptsLeft;
  const habis = sisaPercobaan === 0 && !sudahLulus;
  const belumLengkap = quiz.questions.some((soal) => (pilihan[soal.id] ?? []).length === 0);

  return (
    <div className="quizRunner">
      <div className="quizRunnerHead">
        <div>
          <strong>Kuis</strong>
          <p>
            {quiz.questions.length} soal · total {quiz.totalPoints} poin · lulus di{' '}
            {quiz.passingScore}%
          </p>
        </div>
        <span className="pill">
          {sisaPercobaan === null
            ? 'Percobaan tidak dibatasi'
            : `Sisa percobaan: ${sisaPercobaan}`}
        </span>
      </div>

      {galat ? (
        <div className="notice noticeError" role="alert">
          <div>
            {galat}
            {alasan.length > 0 ? (
              <ul className="reasonList">
                {alasan.map((baris) => (
                  <li key={baris}>{baris}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {hasil ? (
        <div
          className={hasil.passed ? 'quizScore quizScoreGood' : 'quizScore quizScoreBad'}
          role="status"
        >
          <strong>
            {hasil.scorePercent}% · {hasil.earnedPoints} dari {hasil.totalPoints} poin
          </strong>
          <p>
            {hasil.passed
              ? 'Selamat, kamu lulus. Materi ini sudah ditandai selesai.'
              : hasil.attemptsLeft === 0
                ? 'Belum lulus, dan jatah percobaan sudah habis. Hubungi pengelola bila perlu kesempatan tambahan.'
                : `Belum mencapai ${hasil.passingScore}%. Perbaiki jawabanmu lalu coba lagi.`}
          </p>
        </div>
      ) : sudahLulus ? (
        <div className="quizScore quizScoreGood" role="status">
          <strong>Kuis ini sudah kamu lulusi.</strong>
          {quiz.bestScorePercent !== null ? <p>Nilai terbaik {quiz.bestScorePercent}%.</p> : null}
        </div>
      ) : null}

      {sudahLulus ? null : (
        <ol className="quizQuestionList">
          {quiz.questions.map((soal, index) => {
            const tunggal = soal.type === 'SINGLE_CHOICE';
            const ulasan = tampilkanUlasan
              ? (hasil?.review?.find((item) => item.questionId === soal.id) ?? null)
              : null;
            const terpilih = pilihan[soal.id] ?? [];

            return (
              <li key={soal.id} className="quizQuestionCard">
                <p className="quizPrompt">
                  <span className="lessonIndex">{index + 1}</span>
                  {soal.prompt}
                </p>
                <p className="quizHint">
                  {tunggal ? 'Pilih satu jawaban.' : 'Pilih semua jawaban yang benar.'} · {soal.points}{' '}
                  poin
                </p>
                <ul className="quizChoiceList">
                  {soal.options.map((opsi) => {
                    const benar = ulasan?.correctOptionIds.includes(opsi.id) ?? false;
                    const dipilih = terpilih.includes(opsi.id);
                    return (
                      <li key={opsi.id}>
                        <label
                          className={
                            ulasan && benar
                              ? 'quizChoice quizChoiceCorrect'
                              : ulasan && dipilih
                                ? 'quizChoice quizChoiceWrong'
                                : 'quizChoice'
                          }
                        >
                          <input
                            type={tunggal ? 'radio' : 'checkbox'}
                            name={`soal-${soal.id}`}
                            checked={dipilih}
                            disabled={sibuk || habis}
                            onChange={(event) =>
                              tandai(soal.id, opsi.id, tunggal, event.target.checked)
                            }
                          />
                          <span>{opsi.text}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {ulasan ? (
                  <p className={ulasan.isCorrect ? 'quizVerdictGood' : 'quizVerdictBad'}>
                    {ulasan.isCorrect ? 'Benar.' : 'Belum benar.'}
                    {ulasan.explanation ? ` ${ulasan.explanation}` : ''}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      <div className="quizRunnerActions">
        {sudahLulus ? (
          <>
            <span className="pill pillGood">
              <Check size={13} strokeWidth={3} /> Materi selesai
            </span>
            {nextLessonId ? (
              <button
                type="button"
                className="btn"
                onClick={() => router.push(`/learn/${courseId}/${nextLessonId}`)}
              >
                Pelajaran berikutnya <ArrowRight size={16} />
              </button>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={kirim}
            disabled={sibuk || habis || belumLengkap}
          >
            {sibuk ? 'Menilai…' : hasil ? 'Kirim ulang jawaban' : 'Kirim jawaban'}
          </button>
        )}
      </div>

      {!sudahLulus && belumLengkap && !habis ? (
        <p className="quizHint" role="status">
          Jawab seluruh soal sebelum mengirim.
        </p>
      ) : null}
    </div>
  );
}
