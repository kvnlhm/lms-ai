'use client';

import { useEffect, useState } from 'react';
import type { Schemas } from '@lms/api-client';
import { useNotifier } from '../../../components/notifier';
import { ApiError, browserClient, ensureSuccess, unwrap } from '../../../lib/browser-api';
import { ChevronDown, ChevronUp, Trash } from '../../../components/icons';

type AdminQuiz = Schemas['AdminQuizDto'];

const QUESTION_TYPES = [
  { value: 'SINGLE_CHOICE', label: 'Pilihan tunggal' },
  { value: 'MULTIPLE_CHOICE', label: 'Pilihan ganda' },
] as const;

type QuestionType = (typeof QUESTION_TYPES)[number]['value'];

interface OptionDraft {
  key: string;
  text: string;
  isCorrect: boolean;
}

interface QuestionDraft {
  key: string;
  /** Ada hanya untuk soal yang sudah tersimpan; itulah yang menjaga riwayat. */
  id?: string;
  prompt: string;
  explanation: string;
  type: QuestionType;
  points: number;
  options: OptionDraft[];
}

let penghitungKunci = 0;
function kunciBaru(): string {
  penghitungKunci += 1;
  return `draf-${penghitungKunci}`;
}

function soalKosong(): QuestionDraft {
  return {
    key: kunciBaru(),
    prompt: '',
    explanation: '',
    type: 'SINGLE_CHOICE',
    points: 1,
    options: [
      { key: kunciBaru(), text: '', isCorrect: true },
      { key: kunciBaru(), text: '', isCorrect: false },
    ],
  };
}

/**
 * Penyusun soal kuis untuk satu pelajaran.
 *
 * Seluruh kuis dikirim sekali sebagai satu PUT, bukan per soal. Master menyusun
 * daftar soal sebagai satu kesatuan, dan mengirimnya sepotong-sepotong akan
 * meninggalkan kuis setengah jadi bila jaringan putus di tengah.
 */
export function QuizEditor({
  lessonId,
  lessonTitle,
  onClose,
}: {
  lessonId: string;
  lessonTitle: string;
  onClose: () => void;
}) {
  const notifier = useNotifier();
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  // Hanya kegagalan memuat yang tetap tampil di dalam panel: saat itu tidak ada
  // apa pun lagi untuk dikerjakan di sini, jadi pesannya adalah isi panelnya.
  const [galat, setGalat] = useState<string | null>(null);
  const [adaDiServer, setAdaDiServer] = useState(false);
  const [jumlahPercobaan, setJumlahPercobaan] = useState(0);

  const [passingScore, setPassingScore] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState('');
  const [showFeedback, setShowFeedback] = useState(true);
  const [questions, setQuestions] = useState<QuestionDraft[]>([soalKosong()]);

  useEffect(() => {
    let dibatalkan = false;

    async function muat() {
      try {
        const quiz = unwrap<AdminQuiz>(
          await browserClient().GET('/api/v1/admin/lessons/{lessonId}/quiz', {
            params: { path: { lessonId } },
          }),
        );
        if (dibatalkan) return;

        setAdaDiServer(true);
        setJumlahPercobaan(quiz.attemptCount);
        setPassingScore(quiz.passingScore);
        setMaxAttempts(quiz.maxAttempts === null ? '' : String(quiz.maxAttempts));
        setShowFeedback(quiz.showFeedback);
        setQuestions(
          quiz.questions.map((question) => ({
            key: kunciBaru(),
            id: question.id,
            prompt: question.prompt,
            explanation: question.explanation ?? '',
            type: question.type as QuestionType,
            points: question.points,
            options: question.options.map((option) => ({
              key: kunciBaru(),
              text: option.text,
              isCorrect: option.isCorrect,
            })),
          })),
        );
      } catch (caught) {
        // Belum ada kuis adalah keadaan wajar untuk pelajaran yang baru dibuat,
        // jadi formulir kosong tetap ditampilkan alih-alih pesan galat.
        if (!(caught instanceof ApiError && caught.isNotFound)) {
          if (!dibatalkan) setGalat('Kuis tidak dapat dimuat. Coba tutup dan buka lagi.');
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

  function ubahSoal(key: string, ubah: (soal: QuestionDraft) => QuestionDraft) {
    setQuestions((daftar) => daftar.map((soal) => (soal.key === key ? ubah(soal) : soal)));
  }

  function geserSoal(index: number, arah: -1 | 1) {
    setQuestions((daftar) => {
      const target = index + arah;
      if (target < 0 || target >= daftar.length) return daftar;
      const salinan = [...daftar];
      [salinan[index], salinan[target]] = [salinan[target]!, salinan[index]!];
      return salinan;
    });
  }

  /**
   * Menandai jawaban benar.
   *
   * Pada pilihan tunggal penandaan bersifat eksklusif, seperti radio button:
   * memilih yang baru otomatis melepas yang lama. Tanpa itu Master dapat
   * menyimpan dua jawaban benar pada soal pilihan tunggal, dan server akan
   * menolaknya dengan pesan yang baru terlihat setelah menekan simpan.
   */
  function tandaiBenar(soalKey: string, opsiKey: string, nilai: boolean) {
    ubahSoal(soalKey, (soal) => ({
      ...soal,
      options: soal.options.map((opsi) => {
        if (opsi.key === opsiKey) return { ...opsi, isCorrect: nilai };
        if (soal.type === 'SINGLE_CHOICE' && nilai) return { ...opsi, isCorrect: false };
        return opsi;
      }),
    }));
  }

  function gantiJenis(soalKey: string, jenis: QuestionType) {
    ubahSoal(soalKey, (soal) => {
      if (jenis !== 'SINGLE_CHOICE') return { ...soal, type: jenis };
      // Turun ke pilihan tunggal: sisakan satu jawaban benar yang pertama.
      let sudah = false;
      return {
        ...soal,
        type: jenis,
        options: soal.options.map((opsi) => {
          if (!opsi.isCorrect) return opsi;
          if (sudah) return { ...opsi, isCorrect: false };
          sudah = true;
          return opsi;
        }),
      };
    });
  }

  function periksaLokal(): string[] {
    const masalah: string[] = [];
    questions.forEach((soal, index) => {
      const nomor = index + 1;
      if (soal.prompt.trim().length < 3) masalah.push(`Soal ${nomor} belum memiliki pertanyaan.`);
      if (soal.options.some((opsi) => opsi.text.trim().length === 0)) {
        masalah.push(`Soal ${nomor} memiliki pilihan jawaban yang masih kosong.`);
      }
      const benar = soal.options.filter((opsi) => opsi.isCorrect).length;
      if (soal.type === 'SINGLE_CHOICE' && benar !== 1) {
        masalah.push(`Soal ${nomor} harus memiliki tepat satu jawaban benar.`);
      }
      if (soal.type === 'MULTIPLE_CHOICE' && benar < 1) {
        masalah.push(`Soal ${nomor} harus memiliki minimal satu jawaban benar.`);
      }
    });
    return masalah;
  }

  async function simpan() {
    if (sibuk) return;
    const masalah = periksaLokal();
    if (masalah.length > 0) {
      void notifier.error('Kuis belum dapat disimpan', { reasons: masalah });
      return;
    }

    setSibuk(true);

    try {
      const quiz = unwrap<AdminQuiz>(
        await browserClient().PUT('/api/v1/admin/lessons/{lessonId}/quiz', {
          params: { path: { lessonId } },
          body: {
            passingScore,
            maxAttempts: maxAttempts.trim() === '' ? undefined : Number(maxAttempts),
            showFeedback,
            questions: questions.map((soal) => ({
              id: soal.id,
              prompt: soal.prompt.trim(),
              explanation: soal.explanation.trim() || undefined,
              type: soal.type,
              points: soal.points,
              options: soal.options.map((opsi) => ({
                text: opsi.text.trim(),
                isCorrect: opsi.isCorrect,
              })),
            })),
          },
        }),
      );

      setAdaDiServer(true);
      setJumlahPercobaan(quiz.attemptCount);
      // Id soal yang baru dibuat dibawa kembali, supaya menyimpan untuk kedua
      // kalinya memperbarui soal yang sama alih-alih membuat duplikatnya.
      setQuestions((daftar) =>
        daftar.map((soal, index) => ({ ...soal, id: quiz.questions[index]?.id ?? soal.id })),
      );
      notifier.success(
        `Tersimpan: ${quiz.questions.length} soal, total ${quiz.totalPoints} poin.`,
      );
    } catch (caught) {
      if (caught instanceof ApiError) {
        void notifier.error('Kuis belum tersimpan', {
          text: caught.message,
          reasons: Object.values(caught.fields ?? {}).flat(),
        });
      } else {
        void notifier.error('Tidak dapat menghubungi server', {
          text: 'Kuis belum tersimpan. Periksa koneksimu lalu coba lagi.',
        });
      }
    } finally {
      setSibuk(false);
    }
  }

  async function hapus() {
    if (sibuk) return;
    setSibuk(true);
    try {
      ensureSuccess(
        await browserClient().DELETE('/api/v1/admin/lessons/{lessonId}/quiz', {
          params: { path: { lessonId } },
        }),
      );
      onClose();
    } catch (caught) {
      void notifier.error('Kuis gagal dihapus', {
        text: caught instanceof ApiError ? caught.message : undefined,
      });
    } finally {
      setSibuk(false);
    }
  }

  if (memuat) {
    return (
      <div className="quizEditor">
        <p className="quizEmpty">Memuat kuis…</p>
      </div>
    );
  }

  return (
    <section className="quizEditor" aria-label={`Soal kuis untuk ${lessonTitle}`}>
      {galat ? (
        <p className="notice noticeError" role="alert">
          {galat}
        </p>
      ) : null}

      <div className="lessonEditHead">
        <div>
          <strong>Soal kuis</strong>
          <p>
            Pelajar dinyatakan selesai pada pelajaran ini hanya setelah nilainya mencapai ambang
            lulus.
          </p>
        </div>
      </div>

      {jumlahPercobaan > 0 ? (
        <p className="notice noticeInfo" role="status">
          Kuis ini sudah dikerjakan {jumlahPercobaan} kali. Soal yang pernah dijawab tidak dapat
          dihapus, tetapi isinya masih dapat diperbaiki.
        </p>
      ) : null}

      <div className="quizSettings">
        <div className="field">
          <label htmlFor={`quiz-passing-${lessonId}`}>Ambang lulus (%)</label>
          <input
            id={`quiz-passing-${lessonId}`}
            type="number"
            min={0}
            max={100}
            value={passingScore}
            disabled={sibuk}
            onChange={(event) => setPassingScore(Number(event.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor={`quiz-attempts-${lessonId}`}>Batas percobaan</label>
          <input
            id={`quiz-attempts-${lessonId}`}
            type="number"
            min={1}
            max={20}
            placeholder="Tanpa batas"
            value={maxAttempts}
            disabled={sibuk}
            onChange={(event) => setMaxAttempts(event.target.value)}
          />
          <span className="fieldHint">Kosongkan bila pelajar boleh mengulang sebanyak apa pun.</span>
        </div>
        <label className="checkRow">
          <input
            type="checkbox"
            checked={showFeedback}
            disabled={sibuk}
            onChange={(event) => setShowFeedback(event.target.checked)}
          />
          Tampilkan jawaban benar setelah dikirim
        </label>
      </div>

      {questions.map((soal, index) => (
        <article key={soal.key} className="quizQuestion">
          <div className="quizQuestionHead">
            <span className="lessonIndex">{index + 1}</span>
            <span className="inlineActions">
              <button
                type="button"
                className="iconAction"
                disabled={sibuk || index === 0}
                onClick={() => geserSoal(index, -1)}
                aria-label={`Naikkan soal ${index + 1}`}
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                className="iconAction"
                disabled={sibuk || index === questions.length - 1}
                onClick={() => geserSoal(index, 1)}
                aria-label={`Turunkan soal ${index + 1}`}
              >
                <ChevronDown size={16} />
              </button>
              <button
                type="button"
                className="iconAction btnDanger"
                disabled={sibuk || questions.length === 1}
                onClick={() =>
                  setQuestions((daftar) => daftar.filter((lain) => lain.key !== soal.key))
                }
                aria-label={`Hapus soal ${index + 1}`}
              >
                <Trash size={16} />
              </button>
            </span>
          </div>

          <div className="field">
            <label htmlFor={`quiz-prompt-${soal.key}`}>Pertanyaan</label>
            <textarea
              id={`quiz-prompt-${soal.key}`}
              value={soal.prompt}
              maxLength={2000}
              disabled={sibuk}
              onChange={(event) =>
                ubahSoal(soal.key, (lama) => ({ ...lama, prompt: event.target.value }))
              }
            />
          </div>

          <div className="quizQuestionMeta">
            <div className="field">
              <label htmlFor={`quiz-type-${soal.key}`}>Jenis soal</label>
              <select
                id={`quiz-type-${soal.key}`}
                value={soal.type}
                disabled={sibuk}
                onChange={(event) => gantiJenis(soal.key, event.target.value as QuestionType)}
              >
                {QUESTION_TYPES.map((jenis) => (
                  <option key={jenis.value} value={jenis.value}>
                    {jenis.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`quiz-points-${soal.key}`}>Bobot poin</label>
              <input
                id={`quiz-points-${soal.key}`}
                type="number"
                min={1}
                max={100}
                value={soal.points}
                disabled={sibuk}
                onChange={(event) =>
                  ubahSoal(soal.key, (lama) => ({ ...lama, points: Number(event.target.value) }))
                }
              />
            </div>
          </div>

          <ul className="quizOptionList">
            {soal.options.map((opsi, opsiIndex) => (
              <li key={opsi.key} className="quizOption">
                <label className="quizOptionMark">
                  <input
                    type={soal.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                    name={`benar-${soal.key}`}
                    checked={opsi.isCorrect}
                    disabled={sibuk}
                    onChange={(event) => tandaiBenar(soal.key, opsi.key, event.target.checked)}
                  />
                  <span className="srOnly">
                    Tandai pilihan {opsiIndex + 1} sebagai jawaban benar
                  </span>
                </label>
                <input
                  className="quizOptionText"
                  value={opsi.text}
                  maxLength={500}
                  placeholder={`Pilihan ${opsiIndex + 1}`}
                  disabled={sibuk}
                  aria-label={`Teks pilihan ${opsiIndex + 1} soal ${index + 1}`}
                  onChange={(event) =>
                    ubahSoal(soal.key, (lama) => ({
                      ...lama,
                      options: lama.options.map((lain) =>
                        lain.key === opsi.key ? { ...lain, text: event.target.value } : lain,
                      ),
                    }))
                  }
                />
                <button
                  type="button"
                  className="iconAction btnDanger"
                  disabled={sibuk || soal.options.length <= 2}
                  aria-label={`Hapus pilihan ${opsiIndex + 1} soal ${index + 1}`}
                  onClick={() =>
                    ubahSoal(soal.key, (lama) => ({
                      ...lama,
                      options: lama.options.filter((lain) => lain.key !== opsi.key),
                    }))
                  }
                >
                  <Trash size={14} />
                </button>
              </li>
            ))}
          </ul>

          <div className="field">
            <label htmlFor={`quiz-explanation-${soal.key}`}>Penjelasan (opsional)</label>
            <input
              id={`quiz-explanation-${soal.key}`}
              value={soal.explanation}
              maxLength={2000}
              placeholder="Ditampilkan bersama hasil setelah pelajar mengirim jawaban."
              disabled={sibuk}
              onChange={(event) =>
                ubahSoal(soal.key, (lama) => ({ ...lama, explanation: event.target.value }))
              }
            />
          </div>

          <button
            type="button"
            className="btnTiny"
            disabled={sibuk || soal.options.length >= 8}
            onClick={() =>
              ubahSoal(soal.key, (lama) => ({
                ...lama,
                options: [...lama.options, { key: kunciBaru(), text: '', isCorrect: false }],
              }))
            }
          >
            Tambah pilihan
          </button>
        </article>
      ))}

      <div className="quizEditorActions">
        <button
          type="button"
          className="btnSecondary btnSmall"
          disabled={sibuk || questions.length >= 50}
          onClick={() => setQuestions((daftar) => [...daftar, soalKosong()])}
        >
          Tambah soal
        </button>
        {adaDiServer && jumlahPercobaan === 0 ? (
          <button type="button" className="btnGhost btnSmall" disabled={sibuk} onClick={hapus}>
            Hapus kuis
          </button>
        ) : null}
        <span className="quizEditorSpacer" />
        <button type="button" className="btnGhost btnSmall" disabled={sibuk} onClick={onClose}>
          Tutup
        </button>
        <button type="button" className="btn" disabled={sibuk} onClick={simpan}>
          {sibuk ? 'Menyimpan…' : 'Simpan kuis'}
        </button>
      </div>
    </section>
  );
}
