// Rekap.js - Rekap tugas untuk layar (matriks) + unduhan Spreadsheet rapi.

// ================================================
// REKAP LAYAR: matriks siswa x tugas per kelas
// ================================================
function getRekapKelas(kelas) {
  const guru = getUserInfo();
  if (!guru) return null;

  const tugas = getSemuaTugas()
    .filter(function (t) { return String(t.GuruPembuat) === String(guru.nip) && t.Kelas === kelas; })
    .sort(function (a, b) { return new Date(a.Deadline) - new Date(b.Deadline); });
  const sub = getSemuaSubmission();
  const siswa = getDataSiswaByKelas(kelas);

  const baris = siswa.map(function (s) {
    const sel = tugas.map(function (t) {
      const n = normalisasiSubmission(sub.find(function (x) {
        return x.TugasID === t.ID && String(x.NIS) === String(s.nis);
      }));
      return {
        tugasId: t.ID,
        status: n ? n.status : 'Belum Upload',
        nilaiAngka: n ? n.nilaiAngka : null,
        nilaiHuruf: n ? n.nilaiHuruf : null
      };
    });
    const nilai = sel.filter(function (c) { return c.nilaiAngka !== null; }).map(function (c) { return c.nilaiAngka; });
    return {
      nis: String(s.nis), nama: s.nama, sel: sel,
      rata: nilai.length ? Math.round((nilai.reduce(function (a, b) { return a + b; }, 0) / nilai.length) * 100) / 100 : null
    };
  });

  return {
    kelas: kelas,
    tugas: tugas.map(function (t) {
      return { id: t.ID, judul: t.Judul, deadline: toIso(t.Deadline), jenisPenilaian: t.JenisPenilaian };
    }),
    siswa: baris
  };
}

// ================================================
// UNDUHAN: buat Spreadsheet baru yang rapi, kembalikan URL
// payload: { mode: 'tugas' | 'kelas' | 'semua', tugasId, kelas }
// ================================================
function buatRekapSpreadsheet(payload) {
  try {
    const guru = getUserInfo();
    if (!guru) return { sukses: false, pesan: 'Akses ditolak' };

    const stamp = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmm');
    let judulFile = 'Rekap Tugas';
    const blok = []; // { judul, header:[], rows:[[]] }

    if (payload.mode === 'tugas') {
      const rk = getRekapTugas(payload.tugasId);
      if (!rk.tugas) return { sukses: false, pesan: 'Tugas tidak ditemukan' };
      judulFile = 'Rekap - ' + rk.tugas.judul + ' (' + rk.tugas.kelas + ') - ' + stamp;
      blok.push(_blokRekapTugas(rk));
    } else if (payload.mode === 'kelas') {
      judulFile = 'Rekap Kelas ' + payload.kelas + ' - ' + stamp;
      blok.push(_blokRekapKelas(getRekapKelas(payload.kelas)));
    } else {
      judulFile = 'Rekap Semua Kelas - ' + stamp;
      CONFIG.KELAS.forEach(function (k) {
        const rk = getRekapKelas(k);
        if (rk && rk.tugas.length) blok.push(_blokRekapKelas(rk));
      });
      if (!blok.length) return { sukses: false, pesan: 'Belum ada tugas untuk direkap' };
    }

    const ssBaru = SpreadsheetApp.create(judulFile);
    const folder = _getOrBuatFolder('Rekap Unduhan', getFolderRootTugas());
    DriveApp.getFileById(ssBaru.getId()).moveTo(folder);

    blok.forEach(function (b, i) {
      const namaSheet = _namaSheetAman(b.judul, i);
      const sheet = i === 0 ? ssBaru.getSheets()[0].setName(namaSheet)
                            : ssBaru.insertSheet(namaSheet);
      _tulisBlok(sheet, b);
    });

    const file = DriveApp.getFileById(ssBaru.getId());
    _setSharingAnyone(file);
    return {
      sukses: true,
      url: ssBaru.getUrl(),
      urlUnduhXlsx: 'https://docs.google.com/spreadsheets/d/' + ssBaru.getId() + '/export?format=xlsx',
      nama: judulFile
    };
  } catch (e) {
    Logger.log('buatRekapSpreadsheet error: ' + e.stack);
    return { sukses: false, pesan: e.message };
  }
}

function _namaSheetAman(judul, i) {
  var s = String(judul).replace(/[\[\]:\\\/?*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 85);
  return (s || 'Rekap') + ' ' + (i + 1);
}

function _blokRekapTugas(rk) {
  const header = ['NIS', 'Nama', 'Status', 'Waktu Upload', 'Nilai Angka', 'Nilai Huruf', 'Catatan', 'Dinilai Oleh'];
  const rows = rk.siswa.map(function (r) {
    const s = r.submission;
    return [
      r.nis, r.nama, r.status,
      s && s.waktuUpload ? fmtTanggalId(s.waktuUpload) : '',
      s && s.nilaiAngka !== null ? s.nilaiAngka : '',
      s ? (s.nilaiHuruf || '') : '',
      s ? s.catatan : '',
      s ? s.dinilaiOleh : ''
    ];
  });
  return { judul: rk.tugas.judul + ' - ' + rk.tugas.kelas, header: header, rows: rows,
           meta: 'Kelas ' + rk.tugas.kelas + ' | Deadline ' + fmtTanggalId(rk.tugas.deadline) };
}

function _blokRekapKelas(rk) {
  const header = ['NIS', 'Nama'].concat(rk.tugas.map(function (t) { return t.judul; })).concat(['Rata-rata']);
  const rows = rk.siswa.map(function (r) {
    return [r.nis, r.nama].concat(r.sel.map(function (c) {
      if (c.nilaiAngka !== null) return c.nilaiHuruf + ' (' + c.nilaiAngka + ')';
      return c.status === 'Belum Upload' ? '-' : c.status;
    })).concat([r.rata === null ? '' : r.rata]);
  });
  return { judul: 'Kelas ' + rk.kelas, header: header, rows: rows, meta: rk.tugas.length + ' tugas' };
}

function _tulisBlok(sheet, b) {
  sheet.getRange(1, 1).setValue(b.judul).setFontWeight('bold').setFontSize(13);
  if (b.meta) sheet.getRange(2, 1).setValue(b.meta).setFontColor('#666666');
  const r0 = 4;
  sheet.getRange(r0, 1, 1, b.header.length).setValues([b.header])
    .setFontWeight('bold').setBackground('#4f46e5').setFontColor('#ffffff');
  if (b.rows.length) sheet.getRange(r0 + 1, 1, b.rows.length, b.header.length).setValues(b.rows);
  sheet.setFrozenRows(r0);
  sheet.setFrozenColumns(2);
  sheet.getRange(r0, 1, b.rows.length + 1, b.header.length)
    .setBorder(true, true, true, true, true, true, '#e5e7eb', SpreadsheetApp.BorderStyle.SOLID);
  for (let c = 1; c <= b.header.length; c++) sheet.autoResizeColumn(c);
}
