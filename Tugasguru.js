// TugasGuru.js - Logic sisi guru untuk fitur Upload & Penilaian Tugas

const STATUS_SUBMISSION = {
  MENUNGGU: 'Menunggu Penilaian',
  DINILAI : 'Dinilai',
  REVISI  : 'Revisi'
};

// ================================================
// KELOLA TUGAS
// ================================================

function buatTugas(payload) {
  try {
    const guru = getUserInfo();
    if (!guru) return { sukses: false, pesan: 'Akses ditolak' };

    if (!payload.judul || !payload.kelas || !payload.deadline) {
      return { sukses: false, pesan: 'Judul, kelas, dan deadline wajib diisi' };
    }

    const id = buatId('TGS');
    const rekap = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID);
    const sheet = rekap.getSheetByName('Tugas');

    sheet.appendRow([
      id,
      payload.judul,
      payload.deskripsi || '',
      payload.kelas,
      payload.deadline,
      guru.nip,
      payload.lampiranUrl || '',
      payload.jenisPenilaian || 'angka', // 'angka' atau 'huruf'
      new Date()
    ]);

    kirimNotifikasiKeKelas(payload.kelas, 'tugas_baru', 'Tugas baru: ' + payload.judul, id);

    return { sukses: true, pesan: 'Tugas berhasil dibuat', id: id };

  } catch (e) {
    Logger.log('buatTugas error: ' + e.message);
    return { sukses: false, pesan: e.message };
  }
}

function editTugas(payload) {
  try {
    const guru = getUserInfo();
    if (!guru) return { sukses: false, pesan: 'Akses ditolak' };

    const rekap = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID);
    const sheet = rekap.getSheetByName('Tugas');
    const data  = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === payload.id) {
        if (String(data[i][5]) !== String(guru.nip)) {
          return { sukses: false, pesan: 'Anda bukan pembuat tugas ini' };
        }
        // Kolom 2-5 (1-indexed): Judul, Deskripsi, Kelas, Deadline
        sheet.getRange(i + 1, 2, 1, 4).setValues([[
          payload.judul, payload.deskripsi || '', payload.kelas, payload.deadline
        ]]);
        // Kolom 7 (1-indexed): LampiranMateriURL. Kolom 6 (GuruPembuat) sengaja tidak disentuh.
        sheet.getRange(i + 1, 7).setValue(payload.lampiranUrl || '');

        return { sukses: true, pesan: 'Tugas berhasil diperbarui' };
      }
    }
    return { sukses: false, pesan: 'Tugas tidak ditemukan' };

  } catch (e) {
    Logger.log('editTugas error: ' + e.message);
    return { sukses: false, pesan: e.message };
  }
}

function hapusTugas(tugasId) {
  try {
    const guru = getUserInfo();
    if (!guru) return { sukses: false, pesan: 'Akses ditolak' };

    const rekap = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID);
    const sheet = rekap.getSheetByName('Tugas');
    const data  = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === tugasId) {
        if (String(data[i][5]) !== String(guru.nip)) {
          return { sukses: false, pesan: 'Anda bukan pembuat tugas ini' };
        }
        sheet.deleteRow(i + 1);
        return { sukses: true, pesan: 'Tugas berhasil dihapus' };
      }
    }
    return { sukses: false, pesan: 'Tugas tidak ditemukan' };

  } catch (e) {
    Logger.log('hapusTugas error: ' + e.message);
    return { sukses: false, pesan: e.message };
  }
}

function getDaftarTugasGuru() {
  const guru = getUserInfo();
  if (!guru) return [];

  const rekap = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID);
  const dataTugas = rekap.getSheetByName('Tugas').getDataRange().getValues();
  const dataSub   = rekap.getSheetByName('Submission').getDataRange().getValues();

  const daftar = [];
  for (let i = 1; i < dataTugas.length; i++) {
    if (String(dataTugas[i][5]) !== String(guru.nip)) continue;

    const id = dataTugas[i][0];
    const kelas = dataTugas[i][3];

    let totalSubmit = 0, belumDinilai = 0;
    for (let j = 1; j < dataSub.length; j++) {
      if (dataSub[j][1] === id) {
        totalSubmit++;
        if (dataSub[j][8] === STATUS_SUBMISSION.MENUNGGU) belumDinilai++;
      }
    }
    const totalSiswaKelas = getDataSiswaByKelas(kelas).length;

    daftar.push({
      id: id,
      judul: dataTugas[i][1],
      kelas: kelas,
      deadline: dataTugas[i][4],
      jenisPenilaian: dataTugas[i][7],
      totalSiswa: totalSiswaKelas,
      totalSubmit: totalSubmit,
      belumSubmit: totalSiswaKelas - totalSubmit,
      belumDinilai: belumDinilai
    });
  }
  return daftar;
}

// ================================================
// REKAP & DETAIL SUBMISSION
// ================================================

function getRekapTugas(tugasId) {
  const rekap = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID);
  const dataTugas = rekap.getSheetByName('Tugas').getDataRange().getValues();

  let tugas = null;
  for (let i = 1; i < dataTugas.length; i++) {
    if (dataTugas[i][0] === tugasId) {
      tugas = {
        id: dataTugas[i][0], judul: dataTugas[i][1], deskripsi: dataTugas[i][2],
        kelas: dataTugas[i][3], deadline: dataTugas[i][4], jenisPenilaian: dataTugas[i][7]
      };
      break;
    }
  }
  if (!tugas) return { tugas: null, siswa: [] };

  const siswaKelas = getDataSiswaByKelas(tugas.kelas);
  const dataSub = rekap.getSheetByName('Submission').getDataRange().getValues();

  const hasil = siswaKelas.map(function (s) {
    for (let j = 1; j < dataSub.length; j++) {
      if (dataSub[j][1] === tugasId && String(dataSub[j][2]) === String(s.nis)) {
        return {
          submissionId: dataSub[j][0], nis: s.nis, nama: s.nama,
          fileUrl: dataSub[j][5], waktuUpload: dataSub[j][7], status: dataSub[j][8],
          nilaiAngka: dataSub[j][9], nilaiHuruf: dataSub[j][10], catatan: dataSub[j][11]
        };
      }
    }
    return { submissionId: null, nis: s.nis, nama: s.nama, status: 'Belum Upload' };
  });

  return { tugas: tugas, siswa: hasil };
}

function getDetailSubmission(submissionId) {
  const rekap = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID);
  const dataSub = rekap.getSheetByName('Submission').getDataRange().getValues();

  for (let i = 1; i < dataSub.length; i++) {
    if (dataSub[i][0] === submissionId) {
      return {
        id: dataSub[i][0], tugasId: dataSub[i][1], nis: dataSub[i][2], nama: dataSub[i][3],
        kelas: dataSub[i][4], fileUrl: dataSub[i][5], waktuUpload: dataSub[i][7],
        status: dataSub[i][8], nilaiAngka: dataSub[i][9], nilaiHuruf: dataSub[i][10],
        catatan: dataSub[i][11]
      };
    }
  }
  return null;
}

// ================================================
// KOREKSI / PENILAIAN
// ================================================

function simpanKoreksi(payload) {
  try {
    const guru = getUserInfo();
    if (!guru) return { sukses: false, pesan: 'Akses ditolak' };

    if (payload.status !== STATUS_SUBMISSION.DINILAI && payload.status !== STATUS_SUBMISSION.REVISI) {
      return { sukses: false, pesan: 'Status harus Dinilai atau Revisi' };
    }

    let nilaiAngka = '', nilaiHuruf = '';
    if (payload.status === STATUS_SUBMISSION.DINILAI) {
      if (payload.nilai === undefined || payload.nilai === '') {
        return { sukses: false, pesan: 'Nilai wajib diisi kalau status Dinilai' };
      }
      if (payload.tipeInput === 'huruf') {
        nilaiHuruf = String(payload.nilai).toUpperCase();
        nilaiAngka = hurufKeAngka(nilaiHuruf);
      } else {
        nilaiAngka = parseFloat(payload.nilai);
        nilaiHuruf = angkaKeHuruf(nilaiAngka);
      }
    }

    const rekap = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID);
    const sheet = rekap.getSheetByName('Submission');
    const data  = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === payload.submissionId) {
        // Kolom 9-14 (1-indexed): Status, NilaiAngka, NilaiHuruf, Catatan, WaktuDinilai, DinilaiOleh
        sheet.getRange(i + 1, 9, 1, 6).setValues([[
          payload.status, nilaiAngka, nilaiHuruf, payload.catatan || '', new Date(), guru.email
        ]]);

        const tugasId = data[i][1];
        const nis = data[i][2];
        const pesan = payload.status === STATUS_SUBMISSION.DINILAI
          ? 'Tugas sudah dinilai: ' + nilaiHuruf + ' (' + nilaiAngka + ')'
          : 'Tugas Anda perlu direvisi';
        kirimNotifikasiKeSiswa(nis, 'penilaian', pesan, tugasId);

        return { sukses: true, pesan: 'Koreksi berhasil disimpan' };
      }
    }
    return { sukses: false, pesan: 'Submission tidak ditemukan' };

  } catch (e) {
    Logger.log('simpanKoreksi error: ' + e.message);
    return { sukses: false, pesan: e.message };
  }
}

// ================================================
// NOTIFIKASI (dipakai di sini, nanti dipakai juga oleh sisi siswa)
// ================================================

function kirimNotifikasiKeKelas(kelas, tipe, pesan, tugasId) {
  const siswaKelas = getDataSiswaByKelas(kelas);
  siswaKelas.forEach(function (s) {
    kirimNotifikasiKeSiswa(s.nis, tipe, pesan, tugasId);
  });
}

function kirimNotifikasiKeSiswa(nis, tipe, pesan, tugasId) {
  const rekap = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID);
  const sheet = rekap.getSheetByName('Notifikasi');
  sheet.appendRow([
    buatId('NTF'), 'siswa', nis, tipe, pesan, tugasId, false, new Date()
  ]);
}

// ================================================
// PEMANTAUAN
// ================================================
//
// Catatan definisi (sesuaikan kalau maksud Anda beda):
// - "Paling rajin" / "paling malas" = rasio submit TEPAT WAKTU (sebelum deadline)
//   dari semua tugas yang guru ini buat untuk kelas tsb
// - "Nilai tertinggi/terendah" = rata-rata NilaiAngka dari submission yang sudah Dinilai

function getPemantauan(kelas) {
  const guru = getUserInfo();
  if (!guru) return null;

  const rekap = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID);
  const dataTugas = rekap.getSheetByName('Tugas').getDataRange().getValues();
  const dataSub   = rekap.getSheetByName('Submission').getDataRange().getValues();

  const tugasKelas = [];
  for (let i = 1; i < dataTugas.length; i++) {
    if (String(dataTugas[i][5]) === String(guru.nip) && dataTugas[i][3] === kelas) {
      tugasKelas.push({ id: dataTugas[i][0], deadline: new Date(dataTugas[i][4]) });
    }
  }

  const siswaKelas = getDataSiswaByKelas(kelas);
  const rekapSiswa = siswaKelas.map(function (s) {
    const totalTugas = tugasKelas.length;
    let submitTepatWaktu = 0, submitTotal = 0, totalNilai = 0, jumlahNilai = 0;

    tugasKelas.forEach(function (t) {
      for (let j = 1; j < dataSub.length; j++) {
        if (dataSub[j][1] === t.id && String(dataSub[j][2]) === String(s.nis)) {
          submitTotal++;
          const waktuUpload = new Date(dataSub[j][7]);
          if (waktuUpload <= t.deadline) submitTepatWaktu++;
          if (dataSub[j][8] === STATUS_SUBMISSION.DINILAI && dataSub[j][9] !== '') {
            totalNilai += parseFloat(dataSub[j][9]);
            jumlahNilai++;
          }
          break;
        }
      }
    });

    return {
      nis: s.nis, nama: s.nama,
      totalTugas: totalTugas, submitTotal: submitTotal,
      belumSubmit: totalTugas - submitTotal,
      rasioTepatWaktu: totalTugas > 0 ? submitTepatWaktu / totalTugas : 0,
      rataRataNilai: jumlahNilai > 0 ? Math.round((totalNilai / jumlahNilai) * 100) / 100 : null
    };
  });

  const belumSubmit = rekapSiswa.filter(function (s) { return s.belumSubmit > 0; })
    .sort(function (a, b) { return b.belumSubmit - a.belumSubmit; });

  const berdasarkanRajin = rekapSiswa.slice()
    .sort(function (a, b) { return b.rasioTepatWaktu - a.rasioTepatWaktu; });

  const punyaNilai = rekapSiswa.filter(function (s) { return s.rataRataNilai !== null; })
    .sort(function (a, b) { return b.rataRataNilai - a.rataRataNilai; });

  return {
    kelas: kelas,
    belumSubmit: belumSubmit,
    palingRajin: berdasarkanRajin.slice(0, 5),
    palingMalas: berdasarkanRajin.slice(-5).reverse(),
    nilaiTertinggi: punyaNilai.slice(0, 5),
    nilaiTerendah: punyaNilai.slice(-5).reverse()
  };
}