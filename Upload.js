// Upload.js - Terima file dari siswa, simpan ke Drive, catat/perbarui Submission
//
// Catatan penting: karena executeAs = USER_DEPLOYING, semua penulisan Drive/Sheet
// di sini pakai izin akun Anda - jadi selalu berhasil apa pun status login siswa.
// Semua file tugas akan masuk ke folder milik Anda (root Drive Anda).
//
// Peringatan praktis: untuk file besar (terutama video), base64 encoding di browser
// bisa lambat/berat, dan Apps Script Web App punya batas ukuran request (~50MB).
// Kalau nanti banyak siswa upload video besar, mungkin perlu strategi lain
// (kompresi di sisi klien, atau upload langsung ke Drive lewat picker) - belum
// ditangani di versi ini, cukup untuk gambar/PDF/Word/Text dulu.

function uploadTugas(payload) {
  try {
    const siswa = getSiswaByNis(payload.nis);
    if (!siswa) return { sukses: false, pesan: 'NIS tidak valid' };

    const rekap = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID);
    const dataTugas = rekap.getSheetByName('Tugas').getDataRange().getValues();

    let tugasValid = false, judulTugas = '';
    for (let i = 1; i < dataTugas.length; i++) {
      if (dataTugas[i][0] === payload.tugasId) {
        if (dataTugas[i][3] !== siswa.kelas) {
          return { sukses: false, pesan: 'Tugas ini bukan untuk kelas Anda' };
        }
        tugasValid = true;
        judulTugas = dataTugas[i][1];
        break;
      }
    }
    if (!tugasValid) return { sukses: false, pesan: 'Tugas tidak ditemukan' };

    if (!payload.fileBase64 || !payload.fileName) {
      return { sukses: false, pesan: 'File wajib diunggah' };
    }

    const folder = getFolderTugas(payload.tugasId, judulTugas);
    const blob = Utilities.newBlob(
      Utilities.base64Decode(payload.fileBase64),
      payload.mimeType || 'application/octet-stream',
      payload.nis + '_' + siswa.nama + '_' + payload.fileName
    );
    const file = folder.createFile(blob);

    const sheet = rekap.getSheetByName('Submission');
    const data  = sheet.getDataRange().getValues();

    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === payload.tugasId && String(data[i][2]) === String(payload.nis)) {
        rowIndex = i + 1;
        break;
      }
    }

    // Upload baru ATAU upload ulang (misal setelah diminta revisi) -> reset kolom nilai
    const rowData = [
      rowIndex > 0 ? data[rowIndex - 1][0] : buatId('SUB'),
      payload.tugasId, payload.nis, siswa.nama, siswa.kelas,
      file.getUrl(), file.getId(), new Date(), STATUS_SUBMISSION.MENUNGGU,
      '', '', '', '', ''
    ];

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    kirimNotifikasiKeSiswa(payload.nis, 'submission', 'Tugas berhasil diupload: ' + judulTugas, payload.tugasId);

    return { sukses: true, pesan: 'Tugas berhasil diupload', fileUrl: file.getUrl() };

  } catch (e) {
    Logger.log('uploadTugas error: ' + e.message);
    return { sukses: false, pesan: e.message };
  }
}

function getFolderTugas(tugasId, judulTugas) {
  const root = getOrBuatFolder('RekapNilai_TE - Tugas Siswa', DriveApp.getRootFolder());
  const namaFolderTugas = tugasId + ' - ' + judulTugas;
  return getOrBuatFolder(namaFolderTugas, root);
}

function getOrBuatFolder(nama, parent) {
  const existing = parent.getFoldersByName(nama);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(nama);
}