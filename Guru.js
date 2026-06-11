// Guru.gs - Logic input dan rekap nilai

function getDataKelas() {
  return CONFIG.KELAS;
}

function getDataSiswaByKelas(kelas) {
  const master = SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID);
  const sheet  = master.getSheetByName(CONFIG.SHEET.SISWA);
  const data   = sheet.getDataRange().getValues();

  const siswa = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][3] === kelas) { // kolom ke-4 = Kelas
      siswa.push({
        no   : data[i][0],
        nis  : data[i][1],
        nama : data[i][2],
        kelas: data[i][3]
      });
    }
  }
  return siswa;
}

function getMapelGuru(nip) {
  const rekap     = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID);
  const sheet     = rekap.getSheetByName(CONFIG.SHEET.MASTER_MAPEL);
  const data      = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]) === String(nip)) { // kolom ke-3 = NIP Guru
      return {
        kode          : data[i][0],
        nama          : data[i][1],
        bobotHarian   : data[i][3],
        bobotPraktik  : data[i][4],
        bobotProject  : data[i][5]
      };
    }
  }
  return null;
}

function getNilaiSiswa(kodeMapel, kelas) {
  const namaSheet = 'Nilai_' + kodeMapel;
  const rekap     = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID);
  const sheet     = rekap.getSheetByName(namaSheet);
  if (!sheet) return [];

  const data   = sheet.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === kelas) { // kolom ke-3 = Kelas
      result.push({
        nis         : data[i][0],
        nama        : data[i][1],
        kelas       : data[i][2],
        harian      : data[i][3],
        praktik     : data[i][4],
        project     : data[i][5],
        nilaiAkhir  : data[i][6],
        tglInput    : data[i][7],
        inputOleh   : data[i][8]
      });
    }
  }
  return result;
}

function simpanNilai(payload) {
  try {
    const guru = getUserInfo();
    if (!guru) return { sukses: false, pesan: 'Akses ditolak' };

    const mapel     = getMapelGuru(guru.nip);
    if (!mapel) return { sukses: false, pesan: 'Mapel tidak ditemukan' };

    const namaSheet = 'Nilai_' + mapel.kode;
    const rekap     = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID);
    const sheet     = rekap.getSheetByName(namaSheet);
    if (!sheet) return { sukses: false, pesan: 'Sheet tidak ditemukan' };

    const harian   = parseFloat(payload.harian)  || 0;
    const praktik  = parseFloat(payload.praktik) || 0;
    const project  = parseFloat(payload.project) || 0;

    // Hitung nilai akhir berdasarkan bobot
    const nilaiAkhir = (
      (harian  * mapel.bobotHarian  / 100) +
      (praktik * mapel.bobotPraktik / 100) +
      (project * mapel.bobotProject / 100)
    ).toFixed(2);

    const tglInput = new Date().toLocaleString('id-ID');

    // Cek apakah NIS sudah ada di sheet (update) atau belum (insert)
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(payload.nis)) {
        rowIndex = i + 1; // +1 karena index sheet mulai dari 1
        break;
      }
    }

    const rowData = [
      payload.nis,
      payload.nama,
      payload.kelas,
      harian,
      praktik,
      project,
      nilaiAkhir,
      tglInput,
      guru.email
    ];

    if (rowIndex > 0) {
      // Update baris existing
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      // Insert baris baru
      sheet.appendRow(rowData);
    }

    return { sukses: true, pesan: 'Nilai berhasil disimpan', nilaiAkhir };

  } catch(e) {
    Logger.log('simpanNilai error: ' + e.message);
    return { sukses: false, pesan: e.message };
  }
}

function updateBobot(bobotHarian, bobotPraktik, bobotProject) {
  try {
    const guru = getUserInfo();
    if (!guru) return { sukses: false, pesan: 'Akses ditolak' };

    // Validasi total bobot = 100
    const total = parseFloat(bobotHarian) + parseFloat(bobotPraktik) + parseFloat(bobotProject);
    if (total !== 100) return { sukses: false, pesan: 'Total bobot harus 100' };

    const rekap = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID);
    const sheet = rekap.getSheetByName(CONFIG.SHEET.MASTER_MAPEL);
    const data  = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][2]) === String(guru.nip)) {
        sheet.getRange(i + 1, 4, 1, 3).setValues([[
          parseFloat(bobotHarian),
          parseFloat(bobotPraktik),
          parseFloat(bobotProject)
        ]]);
        return { sukses: true, pesan: 'Bobot berhasil diperbarui' };
      }
    }

    return { sukses: false, pesan: 'Data mapel tidak ditemukan' };

  } catch(e) {
    Logger.log('updateBobot error: ' + e.message);
    return { sukses: false, pesan: e.message };
  }
}