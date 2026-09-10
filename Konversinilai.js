// KonversiNilai.js - Baca tabel konversi nilai huruf<->angka dan daftar kelas dari sheet Config
//
// Catatan desain: kalau guru input NILAI HURUF, angka yang disimpan diambil dari
// TITIK TENGAH rentang huruf tersebut (misal B+ = 76-80 -> disimpan 78).
// Kalau maunya beda (misal pakai batas atas/bawah), tinggal ganti rumus di hurufKeAngka().

function getKonversiNilai() {
  const master = SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID);
  const sheet  = master.getSheetByName(CONFIG.SHEET.CONFIG);
  const data   = sheet.getDataRange().getValues();

  const tabel = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'KONVERSI_NILAI') {
      // format Value di sheet: "A|86-100"
      const parts = String(data[i][1]).split('|');
      const huruf = parts[0];
      const range = parts[1].split('-');
      tabel.push({
        huruf: huruf,
        min: parseFloat(range[0]),
        max: parseFloat(range[1])
      });
    }
  }
  tabel.sort(function (a, b) { return b.min - a.min; }); // tertinggi ke terendah
  return tabel;
}

function angkaKeHuruf(angka) {
  const n = parseFloat(angka);
  const tabel = getKonversiNilai();
  for (let i = 0; i < tabel.length; i++) {
    if (n >= tabel[i].min && n <= tabel[i].max) return tabel[i].huruf;
  }
  if (!tabel.length) return '';
  return n > tabel[0].max ? tabel[0].huruf : tabel[tabel.length - 1].huruf;
}

function hurufKeAngka(huruf) {
  const tabel = getKonversiNilai();
  const found = tabel.find(function (t) { return t.huruf === String(huruf).toUpperCase(); });
  if (!found) return null;
  return Math.round((found.min + found.max) / 2);
}

function getKelasAktif() {
  const master = SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID);
  const sheet  = master.getSheetByName(CONFIG.SHEET.CONFIG);
  const data   = sheet.getDataRange().getValues();

  const kelas = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'KELAS') kelas.push(data[i][1]);
  }
  return kelas;
}

function getPasswordSiswa() {
  const master = SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID);
  const sheet  = master.getSheetByName(CONFIG.SHEET.CONFIG);
  const data   = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'PASSWORD_SISWA') return data[i][1];
  }
  return null;
}