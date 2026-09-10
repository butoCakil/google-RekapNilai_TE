// Notifikasi.js - Kirim, baca, tandai notifikasi + feed aktivitas.

// ------------------------------------------------
// KIRIM
// ------------------------------------------------
function kirimNotifikasi(targetType, targetId, tipe, pesan, tugasId) {
  appendObjek(_ssRekap(), CONFIG.SHEET.NOTIFIKASI, {
    ID: buatId('NTF'),
    TargetType: targetType,
    TargetID: String(targetId),
    Tipe: tipe,
    Pesan: pesan,
    TugasID: tugasId || '',
    Dibaca: false,
    Waktu: new Date()
  });
}

function kirimNotifikasiKeSiswa(nis, tipe, pesan, tugasId) {
  kirimNotifikasi('siswa', nis, tipe, pesan, tugasId);
}

function kirimNotifikasiKeGuru(nip, tipe, pesan, tugasId) {
  kirimNotifikasi('guru', nip, tipe, pesan, tugasId);
}

function kirimNotifikasiKeKelas(kelas, tipe, pesan, tugasId) {
  const siswa = getDataSiswaByKelas(kelas);
  if (!siswa.length) return;
  const sheet = _ssRekap().getSheetByName(CONFIG.SHEET.NOTIFIKASI);
  const now = new Date();
  const rows = siswa.map(function (s, i) {
    return [buatId('NTF') + '-' + i, 'siswa', String(s.nis), tipe, pesan, tugasId || '', false, now];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
}

// ------------------------------------------------
// BACA (SISWA)
// ------------------------------------------------
function getNotifikasiSiswa(nis, limit) {
  const hasil = getSemuaNotifikasi()
    .filter(function (n) { return n.TargetType === 'siswa' && String(n.TargetID) === String(nis); })
    .map(function (n) {
      return {
        id: n.ID, tipe: n.Tipe, pesan: n.Pesan, tugasId: n.TugasID,
        dibaca: n.Dibaca === true || n.Dibaca === 'TRUE',
        waktu: toIso(n.Waktu)
      };
    })
    .sort(function (a, b) { return new Date(b.waktu) - new Date(a.waktu); });
  return limit ? hasil.slice(0, limit) : hasil;
}

function getJumlahNotifikasiBelumDibaca(nis) {
  return getNotifikasiSiswa(nis).filter(function (n) { return !n.dibaca; }).length;
}

function tandaiNotifikasiDibaca(notifikasiId) {
  const sheet = _ssRekap().getSheetByName(CONFIG.SHEET.NOTIFIKASI);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === notifikasiId) {
      sheet.getRange(i + 1, data[0].indexOf('Dibaca') + 1).setValue(true);
      return { sukses: true };
    }
  }
  return { sukses: false, pesan: 'Notifikasi tidak ditemukan' };
}

function tandaiSemuaNotifikasiDibaca(nis) {
  const sheet = _ssRekap().getSheetByName(CONFIG.SHEET.NOTIFIKASI);
  const data = sheet.getDataRange().getValues();
  const colDibaca = data[0].indexOf('Dibaca') + 1;
  let n = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === 'siswa' && String(data[i][2]) === String(nis) && data[i][6] !== true) {
      sheet.getRange(i + 1, colDibaca).setValue(true);
      n++;
    }
  }
  return { sukses: true, jumlah: n };
}

// ------------------------------------------------
// FEED AKTIVITAS (gabungan notifikasi, urut terbaru, dgn label ramah)
// ------------------------------------------------
function getAktivitasSiswa(nis, limit) {
  const IKON = {
    tugas_baru: '📌', submission: '📤', penilaian: '✅', revisi: '🔁',
    catatan: '💬', pengingat: '⏰'
  };
  return getNotifikasiSiswa(nis, limit || 30).map(function (n) {
    return {
      id: n.id,
      ikon: IKON[n.tipe] || '•',
      tipe: n.tipe,
      pesan: n.pesan,
      tugasId: n.tugasId,
      waktu: n.waktu,
      waktuLabel: n.waktu ? _relatif(n.waktu) : '',
      dibaca: n.dibaca
    };
  });
}

function _relatif(iso) {
  const d = new Date(iso);
  const detik = Math.floor((new Date() - d) / 1000);
  if (detik < 60) return 'baru saja';
  if (detik < 3600) return Math.floor(detik / 60) + ' menit lalu';
  if (detik < 86400) return Math.floor(detik / 3600) + ' jam lalu';
  if (detik < 604800) return Math.floor(detik / 86400) + ' hari lalu';
  return fmtTanggalId(iso);
}
