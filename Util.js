// Util.js - Helper umum + lapisan akses data (baca sheet jadi objek)
//
// Semua modul lain sebaiknya lewat helper di sini supaya perubahan kolom sheet
// cukup diubah di satu tempat.

const STATUS_SUBMISSION = {
  MENUNGGU: 'Menunggu Penilaian',
  DINILAI : 'Dinilai',
  REVISI  : 'Revisi'
};

const STATUS_TUGAS = {
  AKTIF  : 'Aktif',
  ARSIP  : 'Arsip'
};

function buatId(prefix) {
  const waktu = new Date().getTime();
  const acak = Math.floor(Math.random() * 1000);
  return prefix + '-' + waktu + '-' + acak;
}

function toIso(v) {
  if (!v) return null;
  try { return new Date(v).toISOString(); } catch (e) { return null; }
}

function fmtTanggalId(v) {
  if (!v) return '-';
  return Utilities.formatDate(new Date(v), 'Asia/Jakarta', "d MMM yyyy, HH:mm");
}

function amanParseJson(str, fallback) {
  if (str === undefined || str === null || str === '') return fallback;
  if (typeof str === 'object') return str;
  try { return JSON.parse(str); } catch (e) { return fallback; }
}

// ------------------------------------------------
// Akses sheet
// ------------------------------------------------
function _ssRekap()  { return SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID); }
function _ssMaster() { return SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID); }

// Baca sheet -> array objek {header: nilai}, plus properti __row (nomor baris sheet 1-indexed)
function bacaSheet(ss, nama) {
  const sheet = ss.getSheetByName(nama);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const header = data[0];
  const hasil = [];
  for (let i = 1; i < data.length; i++) {
    const obj = { __row: i + 1 };
    for (let c = 0; c < header.length; c++) obj[header[c]] = data[i][c];
    hasil.push(obj);
  }
  return hasil;
}

// Tulis satu baris objek ke sheet (append). Mengembalikan nomor baris baru.
function appendObjek(ss, nama, obj) {
  const sheet = ss.getSheetByName(nama);
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = header.map(function (h) { return obj[h] === undefined ? '' : obj[h]; });
  sheet.appendRow(row);
  return sheet.getLastRow();
}

// Update sebagian kolom pada baris tertentu (nomorBaris 1-indexed dari sheet)
function updateBarisObjek(ss, nama, nomorBaris, obj) {
  const sheet = ss.getSheetByName(nama);
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Object.keys(obj).forEach(function (k) {
    const idx = header.indexOf(k);
    if (idx >= 0) sheet.getRange(nomorBaris, idx + 1).setValue(obj[k]);
  });
}

// ------------------------------------------------
// Query siap pakai
// ------------------------------------------------
function getSemuaTugas()      { return bacaSheet(_ssRekap(), CONFIG.SHEET.TUGAS); }
function getSemuaSubmission()  { return bacaSheet(_ssRekap(), CONFIG.SHEET.SUBMISSION); }
function getSemuaNotifikasi()  { return bacaSheet(_ssRekap(), CONFIG.SHEET.NOTIFIKASI); }

function getTugasById(id) {
  const list = getSemuaTugas();
  for (let i = 0; i < list.length; i++) if (list[i].ID === id) return list[i];
  return null;
}

function getSubmission(tugasId, nis) {
  const list = getSemuaSubmission();
  for (let i = 0; i < list.length; i++) {
    if (list[i].TugasID === tugasId && String(list[i].NIS) === String(nis)) return list[i];
  }
  return null;
}

// Normalisasi objek submission mentah -> bentuk yang dikirim ke klien
function normalisasiSubmission(s) {
  if (!s) return null;
  const lampiran = amanParseJson(s.LampiranJSON, null);
  return {
    id          : s.ID,
    tugasId     : s.TugasID,
    nis         : String(s.NIS),
    nama        : s.Nama,
    kelas       : s.Kelas,
    fileUrl     : s.FileURL,
    fileDriveId : s.FileDriveID,
    lampiran    : lampiran && lampiran.length ? lampiran
                  : (s.FileDriveID ? [{ id: s.FileDriveID, url: s.FileURL, nama: '(berkas)', mime: '' }] : []),
    waktuUpload : toIso(s.WaktuUpload),
    status      : s.Status || 'Menunggu Penilaian',
    nilaiAngka  : s.NilaiAngka === '' || s.NilaiAngka === null ? null : Number(s.NilaiAngka),
    nilaiHuruf  : s.NilaiHuruf || null,
    catatan     : s.Catatan || '',
    waktuDinilai: toIso(s.WaktuDinilai),
    dinilaiOleh : s.DinilaiOleh || '',
    diuploadOleh: s.DiuploadOleh || 'siswa'
  };
}
