'use client';

import type { Schemas } from '@lms/api-client';
import { useState, type FormEvent } from 'react';
import { Modal } from '../../components/modal';
import { useNotifier } from '../../components/notifier';
import { ApiError, browserClient, unwrap } from '../../lib/browser-api';

type Tier = Schemas['AccessTierDto'];
type Course = Schemas['AdminCourseListItemDto'];

interface TierDraft {
  name: string;
  slug: string;
  description: string;
  promoCode: string;
  priceIdr: string;
  originalPriceIdr: string;
  duration: string;
  position: string;
  isActive: boolean;
  courseIds: string[];
}

const emptyDraft: TierDraft = {
  name: '',
  slug: '',
  description: '',
  promoCode: '',
  priceIdr: '',
  originalPriceIdr: '',
  duration: '6',
  position: '0',
  isActive: true,
  courseIds: [],
};

export function AccessTierManager({
  initialTiers,
  courses,
}: {
  initialTiers: Tier[];
  courses: Course[];
}) {
  const [tiers, setTiers] = useState(initialTiers);
  const [draft, setDraft] = useState<TierDraft>(emptyDraft);
  const [editing, setEditing] = useState<Tier | null>(null);
  const [editingDraft, setEditingDraft] = useState<TierDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const notifier = useNotifier();
  const [createOpen, setCreateOpen] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const tier = unwrap<Tier>(
await browserClient().POST('/api/v1/admin/access-tiers', {
          body: payload(draft),
        }),
  );
      setTiers((current) => [...current, tier].sort((a, b) => a.position - b.position));
      setDraft(emptyDraft);
      notifier.success('Paket berhasil dibuat dan siap ditampilkan.');
      setCreateOpen(false);
    } catch (error) {
      void notifier.error('Paket belum dapat disimpan', {
        text: error instanceof ApiError ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing || !editingDraft) return;
    setBusy(true);
    try {
      const tier = unwrap<Tier>(
await browserClient().PATCH('/api/v1/admin/access-tiers/{tierId}', {
          params: { path: { tierId: editing.id } },
          body: payload(editingDraft),
        }),
  );
      setTiers((current) =>
        current.map((item) => (item.id === tier.id ? tier : item)).sort((a, b) => a.position - b.position),
      );
      setEditing(null);
      setEditingDraft(null);
      notifier.success('Perubahan paket berhasil disimpan.');
    } catch (error) {
      void notifier.error('Perubahan belum dapat disimpan', {
        text: error instanceof ApiError ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tierAdminLayout">
      <section className="card tierAdminForm">
        <h2>Buat paket baru</h2>
        <p className="pageSub">Gunakan lifetime bila akses tidak memiliki tanggal berakhir.</p>
        <button className="btn tierCreateButton" onClick={() => setCreateOpen(true)} disabled={busy} type="button">
          Buat paket
        </button>
      </section>

      {createOpen ? (
        <Modal
          title="Buat paket baru"
          description="Gunakan lifetime bila akses tidak memiliki tanggal berakhir."
          busy={busy}
          onClose={() => setCreateOpen(false)}
        >
          <TierFields draft={draft} courses={courses} onChange={setDraft} />
          <div className="lessonEditActions">
            <button className="btn btnGhost" onClick={() => setCreateOpen(false)} disabled={busy} type="button">
              Batal
            </button>
            <button className="btn" onClick={() => void create()} disabled={busy} type="button">
              {busy ? 'Menyimpan…' : 'Buat paket'}
            </button>
          </div>
        </Modal>
      ) : null}

      <section className="tierAdminList">
        <div className="sectionHead">
          <h2>Paket tersedia</h2>
          <span className="pill">{tiers.length} paket</span>
        </div>
        {tiers.length === 0 ? <div className="card empty">Belum ada paket akses.</div> : null}
        {tiers.map((tier) => (
          <article className="card tierAdminCard" key={tier.id}>
            <div>
              <span className={tier.isActive ? 'status active' : 'status'}>{tier.isActive ? 'Aktif' : 'Nonaktif'}</span>
              <h3>{tier.name}</h3>
              <p className="pageSub">
                {formatRupiah(tier.priceIdr)} · {tier.isLifetime ? 'Lifetime' : `${tier.durationMonths} bulan`}
              </p>
              <p>{tier.description || 'Tanpa deskripsi.'}</p>
              <p className="cellSub">{tier.courses.map((course) => course.title).join(' · ')}</p>
            </div>
            <button className="btn btnGhost" onClick={() => {
              setEditing(tier);
              setEditingDraft({
                name: tier.name,
                slug: tier.slug,
                description: tier.description ?? '',
                promoCode: tier.promoCode ?? '',
                priceIdr: String(tier.priceIdr),
                originalPriceIdr: tier.originalPriceIdr === null ? '' : String(tier.originalPriceIdr),
                duration: tier.isLifetime ? 'lifetime' : String(tier.durationMonths),
                position: String(tier.position),
                isActive: tier.isActive,
                courseIds: tier.courses.map((course) => course.id),
              });
            }}>Ubah</button>
          </article>
        ))}
      </section>

      {editing && editingDraft ? (
        <div className="modalBackdrop" role="presentation" onMouseDown={() => { setEditing(null); setEditingDraft(null); }}>
          <form className="modalCard tierEditModal" onSubmit={saveEdit} onMouseDown={(e) => e.stopPropagation()}>
            <div className="sectionHead">
              <div><span className="eyebrow">Edit paket</span><h2>{editing.name}</h2></div>
              <button className="btnTiny" type="button" onClick={() => { setEditing(null); setEditingDraft(null); }}>Tutup</button>
            </div>
            <TierFields
              draft={editingDraft}
              courses={courses}
              onChange={setEditingDraft}
            />
            <button className="btn btnBlock" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan perubahan'}</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function TierFields({
  draft,
  courses,
  onChange,
}: {
  draft: TierDraft;
  courses: Course[];
  onChange?: (draft: TierDraft) => void;
}) {
  const [courseQuery, setCourseQuery] = useState('');
  const update = (patch: Partial<TierDraft>) => onChange?.({ ...draft, ...patch });
  const visibleCourses = courses.filter((course) =>
    course.title.toLocaleLowerCase().includes(courseQuery.trim().toLocaleLowerCase()),
  );
  const toggleVisibleCourses = (checked: boolean) => {
    const visibleIds = new Set(visibleCourses.map((course) => course.id));
    update({
      courseIds: checked
        ? Array.from(new Set([...draft.courseIds, ...visibleIds]))
        : draft.courseIds.filter((id) => !visibleIds.has(id)),
    });
  };
  return (
    <div className="tierFieldGrid">
      <label className="field"><span>Nama paket</span><input required minLength={3} value={draft.name} onChange={(e) => update({ name: e.target.value, slug: draft.slug || slugify(e.target.value) })} /></label>
      <label className="field"><span>Slug</span><input required value={draft.slug} onChange={(e) => update({ slug: slugify(e.target.value) })} /></label>
      <label className="field"><span>Harga (Rupiah)</span><input required type="number" min={0} value={draft.priceIdr} onChange={(e) => update({ priceIdr: e.target.value })} /></label>
      <label className="field">
        <span>Harga normal (opsional)</span>
        <input
          type="number"
          min={0}
          placeholder="Kosongkan bila tidak sedang diskon"
          value={draft.originalPriceIdr}
          onChange={(e) => update({ originalPriceIdr: e.target.value })}
        />
        <span className="fieldHint">Ditampilkan tercoret di samping harga jual. Harus lebih tinggi dari harga jual.</span>
      </label>
      <div className="field">
        <span>Masa akses (bulan)</span>
        <input
          type="number"
          min={1}
          max={1200}
          disabled={draft.duration === 'lifetime'}
          value={draft.duration === 'lifetime' ? '' : draft.duration}
          placeholder={draft.duration === 'lifetime' ? 'Tanpa batas' : 'Contoh: 6 atau 12'}
          onChange={(e) => update({ duration: e.target.value })}
        />
        <label className="checkRow">
          <input
            type="checkbox"
            checked={draft.duration === 'lifetime'}
            onChange={(e) => update({ duration: e.target.checked ? 'lifetime' : '12' })}
          />
          <span>Lifetime</span>
        </label>
      </div>
      <label className="field"><span>Urutan</span><input type="number" min={0} value={draft.position} onChange={(e) => update({ position: e.target.value })} /></label>
      <label className="field tierDescription"><span>Deskripsi</span><textarea rows={3} value={draft.description} onChange={(e) => update({ description: e.target.value })} /></label>
      <label className="field"><span>Kode promo paket</span><input value={draft.promoCode} placeholder="Contoh: AIPRENEUR2026" maxLength={80} onChange={(e) => update({ promoCode: e.target.value.toUpperCase() })} /><span className="fieldHint">Kode ini dapat dimasukkan calon pembeli saat mendaftar.</span></label>
      <fieldset className="tierCourses">
        <legend>Kursus dalam paket</legend>
        <div className="tierCourseTools">
          <label className="tierCourseSearch">
            <span className="srOnly">Cari kursus dalam paket</span>
            <input
              value={courseQuery}
              placeholder="Cari kursus dalam paket…"
              onChange={(event) => setCourseQuery(event.currentTarget.value)}
            />
          </label>
          <button className="btnTiny" type="button" onClick={() => toggleVisibleCourses(true)}>Pilih semua</button>
          <button className="btnTiny" type="button" onClick={() => toggleVisibleCourses(false)}>Kosongkan</button>
        </div>
        <small className="tierCourseCount">{draft.courseIds.length} dipilih dari {courses.length} kursus</small>
        <div className="tierCourseList">
        {visibleCourses.map((course) => (
          <label className="checkRow tierCourseRow" key={course.id}>
            <input
              type="checkbox"
              value={course.id}
              checked={draft.courseIds.includes(course.id)}
              onChange={(e) =>
                update({
                  courseIds: e.target.checked
                    ? [...draft.courseIds, course.id]
                    : draft.courseIds.filter((id) => id !== course.id),
                })
              }
            />
            <span>{course.title} <small>({statusLabel(course.status)})</small></span>
          </label>
        ))}
        {!visibleCourses.length ? <small className="muted">Kursus tidak ditemukan.</small> : null}
        </div>
      </fieldset>
      <label className="checkRow"><input type="checkbox" checked={draft.isActive} onChange={(e) => update({ isActive: e.target.checked })} /><span>Tampilkan paket pada halaman pendaftaran</span></label>
    </div>
  );
}

function payload(draft: TierDraft) {
  return {
    name: draft.name,
    slug: draft.slug,
    description: draft.description || undefined,
    promoCode: draft.promoCode.trim() || null,
    priceIdr: Number(draft.priceIdr),
    originalPriceIdr: draft.originalPriceIdr.trim() === '' ? null : Number(draft.originalPriceIdr),
    durationMonths: draft.duration === 'lifetime' ? null : Number(draft.duration),
    position: Number(draft.position),
    isActive: draft.isActive,
    courseIds: draft.courseIds,
  };
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}

function statusLabel(status: string): string {
  return status === 'PUBLISHED' ? 'Terbit' : status === 'DRAFT' ? 'Draf' : 'Arsip';
}
