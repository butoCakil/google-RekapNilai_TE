// Notifikasi.js - Baca & tandai notifikasi siswa
// (Fungsi KIRIM notifikasi - kirimNotifikasiKeSiswa / kirimNotifikasiKeKelas -
//  sudah ada di TugasGuru.js sejak Fase 2, tidak diduplikasi di sini.)

function getNotifikasiSiswa(nis, limit) {
  const rekap = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID);
  const data  = rekap.getSheetByName('Notifikasi').getDataRange().getValues();

  const hasil = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === 'siswa' && String(data[i][2]) === String(nis)) {
      hasil.push({
        id: data[i][0], tipe: data[i][3], pesan: data[i][4],
        tugasId: data[i][5], dibaca: data[i][6], waktu: data[i][7]
      });
    }
  }
  hasil.sort(function (a, b) { return new Date(b.waktu) - new Date(a.waktu); });
  return limit ? hasil.slice(0, limit) : hasil;
}

function getJumlahNotifikasiBelumDibaca(nis) {
  return getNotifikasiSiswa(nis).filter(function (n) { return n.dibaca !== true; }).length;
}

function tandaiNotifikasiDibaca(notifikasiId) {
  const rekap = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID);
  const sheet = rekap.getSheetByName('Notifikasi');
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === notifikasiId) {
      sheet.getRange(i + 1, 7).setValue(true); // kolom 7 (1-indexed) = Dibaca
      return { sukses: true };
    }
  }
  return { sukses: false, pesan: 'Notifikasi tidak ditemukan' };
}