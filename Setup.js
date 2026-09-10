// Setup.js - Utilitas provisioning satu kali untuk fitur Upload & Penilaian Tugas
//
// CARA PAKAI:
// 1. Tempel file ini ke project Apps Script (folder yang sama dengan Kode.js dkk)
// 2. clasp push
// 3. Di editor Apps Script (script.google.com), pilih fungsi "setupFiturTugas" di dropdown
//    lalu klik Run. Cek log eksekusi untuk konfirmasi.
// 4. Buka sheet Config di Master_TE, ganti nilai 'GANTI_PASSWORD_INI' dengan password asli.
// 5. Boleh dijalankan ulang kapan saja - sheet yang sudah ada tidak akan ditimpa.

function setupFiturTugas() {
  const hasil = [];
  hasil.push(setupSheetConfig());
  hasil.push(setupSheetTugas());
  hasil.push(setupSheetSubmission());
  hasil.push(setupSheetNotifikasi());
  Logger.log(hasil.join('\n'));
  return hasil;
}

function setupSheetConfig() {
  const master = SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID);
  let sheet = master.getSheetByName(CONFIG.SHEET.CONFIG);
  const baru = !sheet;

  if (baru) {
    sheet = master.insertSheet(CONFIG.SHEET.CONFIG);
    sheet.appendRow(['Key', 'Value', 'Keterangan']);

    sheet.appendRow([
      'PASSWORD_SISWA',
      'GANTI_PASSWORD_INI',
      'Password bersama untuk login semua siswa - WAJIB diganti manual di sini sebelum dipakai'
    ]);

    CONFIG.KELAS.forEach(function (k) {
      sheet.appendRow(['KELAS', k, 'Daftar kelas aktif - hapus baris ini kalau kelas tidak aktif lagi, tambah baris baru kalau ada kelas baru']);
    });

    const konversi = [
      ['A', 86, 100],
      ['A-', 81, 85],
      ['B+', 76, 80],
      ['B', 71, 75],
      ['B-', 66, 70],
      ['C+', 61, 65],
      ['C', 56, 60],
      ['C-', 51, 55],
      ['D', 0, 50]
    ];
    konversi.forEach(function (row) {
      sheet.appendRow(['KONVERSI_NILAI', row[0] + '|' + row[1] + '-' + row[2], 'Skala konversi nilai huruf (versi kampus)']);
    });

    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, 3);
  }

  return baru
    ? 'Sheet Config: dibuat baru dan diisi data awal.'
    : 'Sheet Config: sudah ada, tidak diubah (cek manual isinya masih sesuai atau perlu ditambah).';
}

function setupSheetTugas() {
  return buatSheetJikaBelumAda(
    CONFIG.REKAP_SPREADSHEET_ID,
    'Tugas',
    ['ID', 'Judul', 'Deskripsi', 'Kelas', 'Deadline', 'GuruPembuat', 'LampiranMateriURL', 'JenisPenilaian', 'TglDibuat']
  );
}

function setupSheetSubmission() {
  return buatSheetJikaBelumAda(
    CONFIG.REKAP_SPREADSHEET_ID,
    'Submission',
    ['ID', 'TugasID', 'NIS', 'Nama', 'Kelas', 'FileURL', 'FileDriveID', 'WaktuUpload', 'Status', 'NilaiAngka', 'NilaiHuruf', 'Catatan', 'WaktuDinilai', 'DinilaiOleh']
  );
}

function setupSheetNotifikasi() {
  return buatSheetJikaBelumAda(
    CONFIG.REKAP_SPREADSHEET_ID,
    'Notifikasi',
    ['ID', 'TargetType', 'TargetID', 'Tipe', 'Pesan', 'TugasID', 'Dibaca', 'Waktu']
  );
}

function buatSheetJikaBelumAda(spreadsheetId, namaSheet, headers) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  let sheet = ss.getSheetByName(namaSheet);

  if (sheet) {
    return 'Sheet ' + namaSheet + ': sudah ada, tidak diubah.';
  }

  sheet = ss.insertSheet(namaSheet);
  sheet.appendRow(headers);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
  return 'Sheet ' + namaSheet + ': dibuat baru dengan header.';
}