// Master.gs - CRUD data master (siswa via NIS, info mapel)

function getSiswaByNis(nis) {
  try {
    const master = SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID);
    const sheet  = master.getSheetByName(CONFIG.SHEET.SISWA);
    const data   = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(nis)) { // kolom ke-2 = NIS
        return {
          no   : data[i][0],
          nis  : data[i][1],
          nama : data[i][2],
          kelas: data[i][3]
        };
      }
    }
    return null; // NIS tidak ditemukan

  } catch(e) {
    Logger.log('getSiswaByNis error: ' + e.message);
    return null;
  }
}

function getNilaiByNis(nis) {
  try {
    const rekap  = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID);
    const mapel  = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID)
                    .getSheetByName(CONFIG.SHEET.MASTER_MAPEL)
                    .getDataRange().getValues();

    const hasil = [];

    // Loop semua sheet nilai
    Object.entries(CONFIG.SHEET.NILAI).forEach(([kode, namaSheet]) => {
      const sheet = rekap.getSheetByName(namaSheet);
      if (!sheet) return;

      const data = sheet.getDataRange().getValues();

      // Cari baris bobot dari Master_Mapel
      let bobot = { harian: 40, praktik: 40, project: 20 }; // default
      for (let m = 1; m < mapel.length; m++) {
        if (mapel[m][0] === kode) {
          bobot = {
            harian  : mapel[m][3],
            praktik : mapel[m][4],
            project : mapel[m][5]
          };
          break;
        }
      }

      // Cari nilai siswa di sheet ini
      let found = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(nis)) {
          hasil.push({
            kode       : kode,
            mapel      : data[i][1] ? getNamaMapel(kode) : kode,
            status     : 'sudah',
            harian     : data[i][3],
            praktik    : data[i][4],
            project    : data[i][5],
            nilaiAkhir : data[i][6],
            tglInput   : data[i][7],
            bobot      : bobot
          });
          found = true;
          break;
        }
      }

      // Kalau belum ada nilai
      if (!found) {
        hasil.push({
          kode      : kode,
          mapel     : getNamaMapel(kode),
          status    : 'belum',
          harian    : '-',
          praktik   : '-',
          project   : '-',
          nilaiAkhir: '-',
          tglInput  : '-',
          bobot     : bobot
        });
      }
    });

    return hasil;

  } catch(e) {
    Logger.log('getNilaiByNis error: ' + e.message);
    return [];
  }
}

function getNamaMapel(kode) {
  const found = CONFIG.MAPEL.find(m => m.kode === kode);
  return found ? found.nama : kode;
}

function getAllMapel() {
  return CONFIG.MAPEL;
}

function getAllKelas() {
  return CONFIG.KELAS;
}