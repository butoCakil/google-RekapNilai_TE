# RekapNilai TE — Portal Tugas & Nilai (Google Apps Script)

Web app untuk **upload & penilaian tugas siswa** SMK Negeri Bansari, Jurusan Teknik
Elektronika. Penyimpanan berkas di **Google Drive**, database di **Google
Spreadsheet**. Tampilan bergaya *LMS journey* (peta perjalanan, XP, level, badge)
agar menarik untuk siswa.

---

## Fitur

### Guru (`?page=guru` — login pakai akun Google yang terdaftar di sheet `Guru`)
- **Ringkasan**: jumlah kumpulan, yang perlu dinilai, aktivitas terbaru, rekap per kelas.
- **Tugas**: buat / edit / arsip / hapus tugas per kelas, narasi tugas, link materi, jenis penilaian (angka / huruf).
- **Rekap & Koreksi**: daftar siswa per tugas, **pratinjau berkas** (gambar, PDF, Word, video, teks), panel koreksi dengan input **angka atau huruf** (dua-duanya otomatis dikonversi), catatan/komentar.
- **Upload atas nama siswa**: guru bisa mengunggahkan berkas untuk siswa tertentu.
- **Pemantauan** per kelas: belum mengumpulkan, belum diperiksa, paling rajin, paling perlu perhatian, nilai tertinggi/terendah, tabel semua siswa (XP/level/tepat waktu).
- **Unduh**: rekap per tugas / per kelas / semua kelas sebagai Google Spreadsheet rapi (bisa diekspor `.xlsx`).
- **Nilai Rapor** (`?page=dashboard`): modul lama input nilai per-mapel, sudah diselaraskan tampilannya.

### Siswa (`?page=loginTugas` → NIS 4 digit + password bersama)
- **Peta Perjalanan**: kartu tugas sebagai node roadmap; status jelas (belum / menunggu / revisi / dinilai), nilai muncul huruf **dan** angka.
- **Hero XP**: level, progress XP, streak, badge/lencana, rata-rata nilai.
- **Detail tugas**: narasi + berkas dari guru (dengan pratinjau), area upload (multi-berkas, drag & drop, mendukung video via upload langsung ke Drive), pratinjau kumpulan sendiri, status + nilai + catatan guru.
- **Linimasa Nilai**: nilai di tiap titik tugas + ringkasan (rata-rata, tertinggi, terendah).
- **Aktivitas / Notifikasi**: konfirmasi guru, nilai, catatan, status — dengan lonceng jumlah belum dibaca.
- **Nilai Rapor** (`?page=siswa&nis=…`): rekap nilai per-mapel.

---

## Struktur file

| File | Peran |
|---|---|
| `Kode.js` | `CONFIG`, router `doGet`, `include()` |
| `Util.js` | Lapisan akses sheet berbasis nama kolom, `normalisasiSubmission`, konstanta status |
| `Auth.js` / `Authsiswa.js` | Autentikasi guru (email Google) & siswa (NIS + password, token cache 6 jam) |
| `Master.js` / `Guru.js` / `Konversinilai.js` | Data siswa, mapel, kelas, konversi nilai huruf⇄angka |
| `Tugasguru.js` | Kelola tugas, rekap, koreksi, pemantauan |
| `Tugassiswa.js` | Dashboard journey, detail tugas, linimasa (semua pakai token) |
| `DriveUpload.js` | Mint OAuth token untuk *resumable upload* klien, verifikasi & catat submission, sharing berkas |
| `Upload.js` | Jalur cadangan upload base64 (berkas kecil) |
| `Preview.js` | Info pratinjau berkas |
| `Gamifikasi.js` | XP, level, streak, badge (dipakai siswa & pemantauan) |
| `Rekap.js` | Matriks rekap layar + generator Spreadsheet unduhan |
| `Notifikasi.js` | Kirim / baca / tandai notifikasi, feed aktivitas |
| `Setup.js` | Provisioning + migrasi kolom + `healthCheck()` |
| `Test.js` | Fungsi uji manual |
| `AppCSS.html` / `AppJS.html` | Design system + helper klien (di-`include`) |
| `Index.html` `LoginSiswaTugas.html` `SiswaApp.html` `GuruApp.html` `Dashboard.html` `Siswa.html` | Halaman |

---

## Setup (sekali)

1. `clasp push` seluruh file ke project Apps Script.
2. Di editor Apps Script jalankan **`setupFiturTugas`** — membuat/menambal sheet
   `Config`, `Tugas`, `Submission`, `Notifikasi` (aman diulang; hanya menambah
   kolom yang belum ada).
3. Buka sheet **`Config`** di spreadsheet Master, ganti nilai `PASSWORD_SISWA`
   dari `GANTI_PASSWORD_INI` ke password asli.
4. Pastikan sheet **`Guru`** berisi kolom `NIP`, `Nama`, `Email` (email = akun
   Google guru), dan sheet **`Siswa`** berisi `No`, `NIS`, `Nama`, `Kelas`.
5. Jalankan **`healthCheck`** — perbaiki semua item di bagian `MASALAH`.
6. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone with Google Account**
   - Setujui permintaan izin (Spreadsheet, Drive).
7. Bagikan URL `/exec`. Guru buka apa adanya; siswa diarahkan ke login NIS.

> Setiap kali menambah/mengubah kolom sheet, jalankan `setupFiturTugas` lalu `healthCheck` lagi.

---

## Skema sheet

**Tugas**: `ID · Judul · Deskripsi · Kelas · Deadline · GuruPembuat · LampiranMateriURL · JenisPenilaian · TglDibuat · Status`

**Submission**: `ID · TugasID · NIS · Nama · Kelas · FileURL · FileDriveID · WaktuUpload · Status · NilaiAngka · NilaiHuruf · Catatan · WaktuDinilai · DinilaiOleh · LampiranJSON · DiuploadOleh`

**Notifikasi**: `ID · TargetType · TargetID · Tipe · Pesan · TugasID · Dibaca · Waktu`

**Config** (key–value): `PASSWORD_SISWA`, `KELAS` (multi-baris), `KONVERSI_NILAI` (`A|86-100`), `GAMIFIKASI_BADGE` (`id|nama|minTugas`).

---

## Cara kerja upload berkas

- Berkas (termasuk **video**) diunggah **langsung dari browser ke Google Drive**
  memakai *resumable upload*. Server hanya meminjamkan OAuth token akun deployer
  lewat `mintUploadTugasSiswa` / `mintUploadTugasGuru` **setelah** memverifikasi
  sesi & kelas. Ini menembus batas ~50 MB request Apps Script.
- Saat finalisasi, tiap `fileId` diverifikasi benar-benar berada di folder tugas
  dan baru dibuat sebelum dicatat di sheet `Submission`.
- Berkas kecil (< 30 MB): kalau upload langsung gagal (mis. CORS diblokir
  jaringan sekolah), otomatis jatuh ke jalur base64 via `google.script.run`.
- Semua berkas dibuat *Anyone with link → Viewer* supaya pratinjau bisa tampil di
  browser siswa (yang tidak login Google Drive). Tautan tidak bisa ditebak.
- Semua berkas tersimpan di Drive **akun deployer**, folder
  `RekapNilai_TE - Tugas Siswa / <ID tugas> - <judul>`.

---

## Catatan keamanan (alat internal sekolah)

- Token Drive yang dipinjamkan ke browser berlaku ~1 jam, hanya scope milik
  script, dan hanya diberikan untuk sesi siswa yang valid + tugas yang memang
  untuk kelasnya. Risiko sisa diterima untuk konteks internal.
- Login siswa memakai **satu password bersama** — bukan pengaman tingkat tinggi,
  sesuai permintaan.
- `?page=siswa&nis=…` (rekap rapor) tidak mengecek kepemilikan NIS — sama seperti
  versi sebelumnya. Pertimbangkan menambah pengecekan bila perlu.

---

## Batas yang diketahui

- Upload langsung ke Drive butuh `fetch` lintas-origin dari sandbox Apps Script;
  di sebagian jaringan yang memblokir `googleapis.com` hanya jalur base64 (berkas
  kecil) yang jalan.
- Pratinjau Word/Excel memakai viewer Google Drive (perlu koneksi ke Drive).
- Belum ada paginasi; untuk ratusan submission per tugas, pemuatan sheet bisa lambat.
