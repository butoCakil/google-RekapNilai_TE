// Upload.js - Jalur upload file KECIL lewat base64 (fallback).
// Untuk file besar/video, klien memakai resumable upload (lihat DriveUpload.js).
// Batas praktis jalur ini: ~30-40MB setelah base64 (limit request Apps Script ~50MB).

const BATAS_BASE64_MB = 35;

// payload: { token, tugasId, files: [{ base64, nama, mime }] }  (siswa)
function uploadTugasKecil(payload) {
  const nis = getNisDariToken(payload.token);
  if (!nis) return { sukses: false, pesan: 'Sesi kedaluwarsa, login ulang' };
  const siswa = getSiswaByNis(nis);
  const tugas = getTugasById(payload.tugasId);
  if (!siswa || !tugas) return { sukses: false, pesan: 'Data tidak valid' };
  if (tugas.Kelas !== siswa.kelas) return { sukses: false, pesan: 'Tugas bukan untuk kelas Anda' };
  return _uploadBase64(tugas, siswa, payload.files, 'siswa');
}

// payload: { tugasId, nis, files: [{ base64, nama, mime }] }  (guru atas nama siswa)
function uploadTugasKecilOlehGuru(payload) {
  const guru = getUserInfo();
  if (!guru) return { sukses: false, pesan: 'Akses ditolak' };
  const siswa = getSiswaByNis(payload.nis);
  const tugas = getTugasById(payload.tugasId);
  if (!siswa || !tugas) return { sukses: false, pesan: 'Data tidak valid' };
  if (siswa.kelas !== tugas.Kelas) return { sukses: false, pesan: 'Siswa tidak di kelas tugas ini' };
  return _uploadBase64(tugas, siswa, payload.files, 'guru:' + guru.nama);
}

function _uploadBase64(tugas, siswa, files, diuploadOleh) {
  try {
    if (!files || !files.length) return { sukses: false, pesan: 'Tidak ada berkas' };

    const folder = getFolderTugas(tugas.ID, tugas.Judul);
    const izinFile = _jenisFileArr(tugas.JenisFile);
    const dibuat = [];
    files.forEach(function (f) {
      if (!f.base64 || !f.nama) throw new Error('Berkas tidak lengkap');
      if (!fileTipeCocok(f.nama, f.mime, izinFile)) {
        throw new Error('Berkas "' + f.nama + '" tidak sesuai. Yang diizinkan: ' + labelIzinFile(izinFile));
      }
      const bytes = Utilities.base64Decode(f.base64);
      if (bytes.length > BATAS_BASE64_MB * 1024 * 1024) {
        throw new Error('Berkas "' + f.nama + '" terlalu besar untuk jalur ini (maks ' +
          BATAS_BASE64_MB + 'MB). Gunakan upload biasa.');
      }
      const blob = Utilities.newBlob(bytes, f.mime || 'application/octet-stream',
        String(siswa.nis) + '_' + siswa.nama + '_' + f.nama);
      const file = folder.createFile(blob);
      dibuat.push({ id: file.getId(), nama: file.getName(), mime: file.getMimeType(), size: file.getSize() });
    });

    return _catatSubmission(tugas, siswa, dibuat, diuploadOleh);
  } catch (e) {
    Logger.log('_uploadBase64 error: ' + e.stack);
    return { sukses: false, pesan: e.message };
  }
}
