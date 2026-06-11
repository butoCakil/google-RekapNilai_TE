// Kode.gs - Router utama Web App

// ================================================
// KONFIGURASI UTAMA
// ================================================

const CONFIG = {
  MASTER_SPREADSHEET_ID: '1WN6ehDWsFHj3eYUJ3FbDVxbRSURbGpmoVksFwkHeCFA',
  REKAP_SPREADSHEET_ID:  '157LNNLUgZ6ZRxZS6EHaMvD4TuuOorwLo8KGZsrTQmzE',
  
  SHEET: {
    SISWA       : 'Siswa',
    GURU        : 'Guru',
    CONFIG      : 'Config',
    MASTER_MAPEL: 'Master_Mapel',
    NILAI: {
      PRE  : 'Nilai_PRE',
      PMM  : 'Nilai_PMM',
      PISAV: 'Nilai_PISAV',
      PISS : 'Nilai_PISS',
      PSRT : 'Nilai_PSRT',
      P4E  : 'Nilai_P4E',
    }
  },

  KELAS: [
    'XI TE 1', 'XI TE 2', 'XI TE 3', 'XI TE 4',
    'XII TE 1','XII TE 2','XII TE 3','XII TE 4'
  ],

  MAPEL: [
    { kode: 'P4E',   nama: 'Perakitan, Perawatan, Perbaikan Peralatan Elektronika' },
    { kode: 'PRE',   nama: 'Perencanaan Rangkaian Elektronika' },
    { kode: 'PMM',   nama: 'Pemrograman Mikroprosesor dan Mikrokontroler' },
    { kode: 'PISAV', nama: 'Penerapan Instalasi Sistem Audio Video' },
    { kode: 'PISS',  nama: 'Penerapan Instalasi Sound System' },
    { kode: 'PSRT',  nama: 'Penerapan Sistem Radio dan TV' },
  ]
};

function doGet(e) {
  const page = e.parameter.page || 'index';
  const user = getCurrentUser();

  if (page === 'siswa') {
    const nis = e.parameter.nis || '';
    const template = HtmlService.createTemplateFromFile('Siswa');
    template.nis = nis;
    return template.evaluate()
      .setTitle('Portal Nilai Siswa - TE')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  if (page === 'dashboard') {
    if (!user) return redirectTo('index');
    return HtmlService.createTemplateFromFile('Dashboard')
      .evaluate()
      .setTitle('Dashboard Guru - RekapNilai TE')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // Default: halaman index / login
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('RekapNilai TE - Login')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function redirectTo(page) {
  const url = ScriptApp.getService().getUrl() + '?page=' + page;
  return HtmlService.createHtmlOutput(
    '<script>window.location.href="' + url + '";</script>'
  );
}

function getCurrentUser() {
  try {
    const email = Session.getActiveUser().getEmail();
    return email || null;
  } catch(e) {
    return null;
  }
}

function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

// Sertakan file HTML lain sebagai include
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function debugCariNIS() {
  const master = SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID);
  const sheet  = master.getSheetByName(CONFIG.SHEET.SISWA);
  const data   = sheet.getDataRange().getValues();
  
  Logger.log('Total baris: ' + data.length);
  Logger.log('Header: ' + JSON.stringify(data[0]));
  Logger.log('Baris 2: ' + JSON.stringify(data[1]));
  Logger.log('Tipe NIS: ' + typeof data[1][1]);
  Logger.log('Nilai NIS: ' + data[1][1]);
  Logger.log('Cocok "3306": ' + (String(data[1][1]) === '3306'));
}

function debugNilaiSiswa() {
  const hasil = getNilaiByNis('3306');
  Logger.log('Hasil getNilaiByNis: ' + JSON.stringify(hasil));
  
  const siswa = getSiswaByNis('3306');
  Logger.log('Hasil getSiswaByNis: ' + JSON.stringify(siswa));
}