// Setup.js - Provisioning + migrasi + health check untuk fitur Upload & Penilaian Tugas
//
// CARA PAKAI:
// 1. clasp push
// 2. Di editor Apps Script, jalankan fungsi "setupFiturTugas" satu kali.
// 3. Buka sheet Config di Master_TE, ganti 'GANTI_PASSWORD_INI' dengan password asli.
// 4. Jalankan "healthCheck" kapan saja untuk memeriksa semua sheet/kolom sudah benar.
// 5. Aman dijalankan ulang - sheet yang sudah ada tidak ditimpa, hanya kolom baru
//    yang ditambahkan lewat migrasi.

// ------------------------------------------------
// Skema kolom (dipakai migrasi + health check)
// ------------------------------------------------
const SKEMA_SHEET = {
  Tugas: {
    id: CONFIG.REKAP_SPREADSHEET_ID,
    kolom: ['ID', 'Judul', 'Deskripsi', 'Kelas', 'Deadline', 'GuruPembuat',
            'LampiranMateriURL', 'JenisPenilaian', 'TglDibuat', 'Status',
            'Kategori', 'JenisFile']
  },
  Submission: {
    id: CONFIG.REKAP_SPREADSHEET_ID,
    kolom: ['ID', 'TugasID', 'NIS', 'Nama', 'Kelas', 'FileURL', 'FileDriveID',
            'WaktuUpload', 'Status', 'NilaiAngka', 'NilaiHuruf', 'Catatan',
            'WaktuDinilai', 'DinilaiOleh', 'LampiranJSON', 'DiuploadOleh']
  },
  Notifikasi: {
    id: CONFIG.REKAP_SPREADSHEET_ID,
    kolom: ['ID', 'TargetType', 'TargetID', 'Tipe', 'Pesan', 'TugasID', 'Dibaca', 'Waktu']
  }
};

function setupFiturTugas() {
  const hasil = [];
  hasil.push(setupSheetConfig());
  Object.keys(SKEMA_SHEET).forEach(function (nama) {
    hasil.push(migrasiSheet(nama, SKEMA_SHEET[nama]));
  });
  const laporan = hasil.join('\n');
  Logger.log(laporan);
  return laporan;
}

function setupSheetConfig() {
  const master = SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID);
  let sheet = master.getSheetByName(CONFIG.SHEET.CONFIG);
  const catatan = [];

  if (!sheet) {
    sheet = master.insertSheet(CONFIG.SHEET.CONFIG);
    sheet.appendRow(['Key', 'Value', 'Keterangan']);
    sheet.appendRow(['PASSWORD_SISWA', 'GANTI_PASSWORD_INI',
      'Password bersama untuk login semua siswa - WAJIB diganti manual sebelum dipakai']);

    CONFIG.KELAS.forEach(function (k) {
      sheet.appendRow(['KELAS', k, 'Daftar kelas aktif']);
    });

    [['A', 86, 100], ['A-', 81, 85], ['B+', 76, 80], ['B', 71, 75], ['B-', 66, 70],
     ['C+', 61, 65], ['C', 56, 60], ['C-', 51, 55], ['D', 0, 50]
    ].forEach(function (row) {
      sheet.appendRow(['KONVERSI_NILAI', row[0] + '|' + row[1] + '-' + row[2], 'Skala konversi nilai huruf']);
    });
    sheet.setFrozenRows(1);
    catatan.push('Sheet Config: dibuat baru + data awal.');
  } else {
    catatan.push('Sheet Config: sudah ada.');
  }

  // Sejak versi ini, daftar lencana ada di kode (Gamifikasi.js), bukan di Config.
  return catatan.join(' ');
}

// Buat sheet kalau belum ada, atau tambahkan kolom yang hilang di ujung header
function migrasiSheet(nama, skema) {
  const ss = SpreadsheetApp.openById(skema.id);
  let sheet = ss.getSheetByName(nama);

  if (!sheet) {
    sheet = ss.insertSheet(nama);
    sheet.appendRow(skema.kolom);
    sheet.setFrozenRows(1);
    return 'Sheet ' + nama + ': dibuat baru (' + skema.kolom.length + ' kolom).';
  }

  const headerSekarang = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  const hilang = skema.kolom.filter(function (k) { return headerSekarang.indexOf(k) === -1; });
  if (!hilang.length) return 'Sheet ' + nama + ': OK, kolom lengkap.';

  sheet.getRange(1, headerSekarang.length + 1, 1, hilang.length).setValues([hilang]);
  return 'Sheet ' + nama + ': +kolom [' + hilang.join(', ') + '].';
}

// ------------------------------------------------
// HEALTH CHECK
// ------------------------------------------------
function healthCheck() {
  const masalah = [];
  const info = [];

  // Spreadsheet bisa dibuka?
  let master, rekap;
  try { master = SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID); info.push('Master OK'); }
  catch (e) { masalah.push('Master TIDAK bisa dibuka: ' + e.message); }
  try { rekap = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID); info.push('Rekap OK'); }
  catch (e) { masalah.push('Rekap TIDAK bisa dibuka: ' + e.message); }

  // Sheet inti master
  if (master) {
    ['Siswa', 'Guru', 'Config'].forEach(function (n) {
      if (!master.getSheetByName(n)) masalah.push('Master: sheet "' + n + '" hilang');
    });
    const cfg = master.getSheetByName('Config');
    if (cfg) {
      const pw = getPasswordSiswa();
      if (!pw || pw === 'GANTI_PASSWORD_INI') masalah.push('Config: PASSWORD_SISWA belum diganti');
      if (getKonversiNilai().length === 0) masalah.push('Config: KONVERSI_NILAI kosong');
      if (getKelasAktif().length === 0) info.push('Config: KELAS kosong (pakai CONFIG.KELAS bawaan)');
    }
  }

  // Sheet + kolom fitur tugas
  Object.keys(SKEMA_SHEET).forEach(function (nama) {
    const skema = SKEMA_SHEET[nama];
    const sheet = SpreadsheetApp.openById(skema.id).getSheetByName(nama);
    if (!sheet) { masalah.push('Sheet "' + nama + '" belum dibuat (jalankan setupFiturTugas)'); return; }
    const header = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
    const hilang = skema.kolom.filter(function (k) { return header.indexOf(k) === -1; });
    if (hilang.length) masalah.push('Sheet "' + nama + '" kurang kolom: ' + hilang.join(', '));
    else info.push('Sheet "' + nama + '" OK (' + (sheet.getLastRow() - 1) + ' baris)');
  });

  // Drive
  try {
    const f = getFolderRootTugas();
    info.push('Folder Drive root: "' + f.getName() + '"');
  } catch (e) { masalah.push('Drive tidak bisa diakses: ' + e.message); }

  // OAuth token (dipakai upload resumable)
  try {
    const tok = ScriptApp.getOAuthToken();
    info.push('OAuth token: ' + (tok ? 'tersedia (' + tok.length + ' char)' : 'KOSONG'));
  } catch (e) { masalah.push('ScriptApp.getOAuthToken gagal: ' + e.message); }

  const laporan = '=== HEALTH CHECK ===\n' +
    (masalah.length ? 'MASALAH:\n- ' + masalah.join('\n- ') : 'Tidak ada masalah.') +
    '\n\nINFO:\n- ' + info.join('\n- ');
  Logger.log(laporan);
  return { ok: masalah.length === 0, masalah: masalah, info: info, laporan: laporan };
}
