/**
 * Penanda bahwa halaman ini dibuka sebagai pratinjau kursus yang belum terbit.
 *
 * Pratinjau sengaja memakai jalur pelajar yang sama persis — itulah gunanya —
 * sehingga tanpa penanda, draf dan kursus yang sudah tayang tampak identik.
 * Kekeliruan yang mahal bukan "mengira terbit padahal draf", melainkan
 * sebaliknya: menganggap sesuatu sudah dilihat pelajar padahal belum.
 */
export function PreviewBanner() {
  return (
    <p className="notice previewBanner" role="status">
      <span>
        <strong>Pratinjau.</strong> Kursus ini belum terbit. Hanya penyusun kursus yang dapat
        membukanya; pelajar belum melihat apa pun di sini.
      </span>
    </p>
  );
}
