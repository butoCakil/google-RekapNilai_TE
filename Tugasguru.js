// Tugasguru.js - Logic sisi guru: kelola tugas, rekap, koreksi, pemantauan.

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
    appendObjek(_ssRekap(), CONFIG.SHEET.TUGAS, {
      ID: id,
      Judul: payload.judul,
      Deskripsi: payload.deskripsi || '',
      Kelas: payload.kelas,
      Deadline: new Date(payload.deadline),
      GuruPembuat: guru.nip,
      LampiranMateriURL: payload.lampiranUrl || '',
      JenisPenilaian: payload.jenisPenilaian === 'huruf' ? 'huruf' : 'angka',
      TglDibuat: new Date(),
      Status: STATUS_TUGAS.AKTIF
    });

    kirimNotifikasiKeKelas(payload.kelas, 'tugas_baru', 'Tugas baru: ' + payload.judul, id);
    return { sukses: true, pesan: 'Tugas berhasil dibuat', id: id };
  } catch (e) {
    Logger.log('buatTugas error: ' + e.stack);
    return { sukses: false, pesan: e.message };
  }
}

function editTugas(payload) {
  try {
    const guru = getUserInfo();
    if (!guru) return { sukses: false, pesan: 'Akses ditolak' };
    const tugas = getTugasById(payload.id);
    if (!tugas) return { sukses: false, pesan: 'Tugas tidak ditemukan' };
    if (String(tugas.GuruPembuat) !== String(guru.nip)) {
      return { sukses: false, pesan: 'Anda bukan pembuat tugas ini' };
    }
    updateBarisObjek(_ssRekap(), CONFIG.SHEET.TUGAS, tugas.__row, {
      Judul: payload.judul,
      Deskripsi: payload.deskripsi || '',
      Kelas: payload.kelas,
      Deadline: new Date(payload.deadline),
      LampiranMateriURL: payload.lampiranUrl || '',
      JenisPenilaian: payload.jenisPenilaian === 'huruf' ? 'huruf' : 'angka'
    });
    return { sukses: true, pesan: 'Tugas berhasil diperbarui' };
  } catch (e) {
    Logger.log('editTugas error: ' + e.stack);
    return { sukses: false, pesan: e.message };
  }
}

function setStatusTugas(tugasId, status) {
  const guru = getUserInfo();
  if (!guru) return { sukses: false, pesan: 'Akses ditolak' };
  const tugas = getTugasById(tugasId);
  if (!tugas) return { sukses: false, pesan: 'Tugas tidak ditemukan' };
  if (String(tugas.GuruPembuat) !== String(guru.nip)) {
    return { sukses: false, pesan: 'Anda bukan pembuat tugas ini' };
  }
  updateBarisObjek(_ssRekap(), CONFIG.SHEET.TUGAS, tugas.__row,
    { Status: status === STATUS_TUGAS.ARSIP ? STATUS_TUGAS.ARSIP : STATUS_TUGAS.AKTIF });
  return { sukses: true, pesan: 'Status tugas diperbarui' };
}

function hapusTugas(tugasId) {
  try {
    const guru = getUserInfo();
    if (!guru) return { sukses: false, pesan: 'Akses ditolak' };
    const tugas = getTugasById(tugasId);
    if (!tugas) return { sukses: false, pesan: 'Tugas tidak ditemukan' };
    if (String(tugas.GuruPembuat) !== String(guru.nip)) {
      return { sukses: false, pesan: 'Anda bukan pembuat tugas ini' };
    }
    // Hapus baris submission terkait (data sheet saja; berkas Drive dibiarkan agar aman)
    const subSheet = _ssRekap().getSheetByName(CONFIG.SHEET.SUBMISSION);
    const subData = subSheet.getDataRange().getValues();
    for (let i = subData.length - 1; i >= 1; i--) {
      if (subData[i][1] === tugasId) subSheet.deleteRow(i + 1);
    }
    _ssRekap().getSheetByName(CONFIG.SHEET.TUGAS).deleteRow(tugas.__row);
    return { sukses: true, pesan: 'Tugas dihapus' };
  } catch (e) {
    Logger.log('hapusTugas error: ' + e.stack);
    return { sukses: false, pesan: e.message };
  }
}

// ================================================
// DAFTAR & RINGKASAN
// ================================================
function getDaftarTugasGuru() {
  const guru = getUserInfo();
  if (!guru) return [];
  const sub = getSemuaSubmission();

  return getSemuaTugas()
    .filter(function (t) { return String(t.GuruPembuat) === String(guru.nip); })
    .map(function (t) {
      const subTugas = sub.filter(function (s) { return s.TugasID === t.ID; });
      const totalSiswa = getDataSiswaByKelas(t.Kelas).length;
      const belumDinilai = subTugas.filter(function (s) {
        return (s.Status || STATUS_SUBMISSION.MENUNGGU) === STATUS_SUBMISSION.MENUNGGU;
      }).length;
      return {
        id: t.ID,
        judul: t.Judul,
        deskripsi: t.Deskripsi,
        kelas: t.Kelas,
        deadline: toIso(t.Deadline),
        tglDibuat: toIso(t.TglDibuat),
        jenisPenilaian: t.JenisPenilaian,
        lampiranUrl: t.LampiranMateriURL,
        status: t.Status || STATUS_TUGAS.AKTIF,
        totalSiswa: totalSiswa,
        totalSubmit: subTugas.length,
        belumSubmit: Math.max(0, totalSiswa - subTugas.length),
        belumDinilai: belumDinilai,
        sudahDinilai: subTugas.filter(function (s) { return s.Status === STATUS_SUBMISSION.DINILAI; }).length
      };
    })
    .sort(function (a, b) { return new Date(b.tglDibuat) - new Date(a.tglDibuat); });
}

function getRingkasanGuru() {
  const guru = getUserInfo();
  if (!guru) return null;
  const daftar = getDaftarTugasGuru();
  const perluDinilai = daftar.reduce(function (a, t) { return a + t.belumDinilai; }, 0);
  const totalSubmit = daftar.reduce(function (a, t) { return a + t.totalSubmit; }, 0);

  // aktivitas terbaru: submission 10 terakhir
  const sub = getSemuaSubmission()
    .filter(function (s) {
      return daftar.some(function (t) { return t.id === s.TugasID; });
    })
    .sort(function (a, b) { return new Date(b.WaktuUpload) - new Date(a.WaktuUpload); })
    .slice(0, 10)
    .map(function (s) {
      const t = getTugasById(s.TugasID);
      return {
        nama: s.Nama, kelas: s.Kelas,
        tugas: t ? t.Judul : s.TugasID,
        tugasId: s.TugasID,
        waktu: toIso(s.WaktuUpload),
        status: s.Status
      };
    });

  return {
    guru: guru,
    totalTugas: daftar.length,
    tugasAktif: daftar.filter(function (t) { return t.status === STATUS_TUGAS.AKTIF; }).length,
    totalSubmit: totalSubmit,
    perluDinilai: perluDinilai,
    perKelas: CONFIG.KELAS.map(function (k) {
      const tk = daftar.filter(function (t) { return t.kelas === k; });
      return {
        kelas: k,
        tugas: tk.length,
        submit: tk.reduce(function (a, t) { return a + t.totalSubmit; }, 0),
        belumDinilai: tk.reduce(function (a, t) { return a + t.belumDinilai; }, 0)
      };
    }).filter(function (x) { return x.tugas > 0; }),
    aktivitas: sub
  };
}

// ================================================
// REKAP PER TUGAS
// ================================================
function getRekapTugas(tugasId) {
  const guru = getUserInfo();
  if (!guru) return { tugas: null, siswa: [] };
  const t = getTugasById(tugasId);
  if (!t) return { tugas: null, siswa: [] };

  const siswaKelas = getDataSiswaByKelas(t.Kelas);
  const sub = getSemuaSubmission();

  const rows = siswaKelas.map(function (s) {
    const raw = sub.find(function (x) {
      return x.TugasID === tugasId && String(x.NIS) === String(s.nis);
    });
    const n = normalisasiSubmission(raw);
    return {
      nis: String(s.nis),
      nama: s.nama,
      submission: n,
      status: n ? n.status : 'Belum Upload'
    };
  });

  return {
    tugas: {
      id: t.ID, judul: t.Judul, deskripsi: t.Deskripsi, kelas: t.Kelas,
      deadline: toIso(t.Deadline), jenisPenilaian: t.JenisPenilaian,
      lampiranUrl: t.LampiranMateriURL, status: t.Status || STATUS_TUGAS.AKTIF
    },
    konversi: getKonversiNilai(),
    siswa: rows,
    statistik: {
      total: rows.length,
      terkumpul: rows.filter(function (r) { return r.submission; }).length,
      dinilai: rows.filter(function (r) { return r.status === STATUS_SUBMISSION.DINILAI; }).length,
      revisi: rows.filter(function (r) { return r.status === STATUS_SUBMISSION.REVISI; }).length
    }
  };
}

function getDetailSubmission(submissionId) {
  const raw = getSemuaSubmission().find(function (s) { return s.ID === submissionId; });
  return normalisasiSubmission(raw);
}

// ================================================
// KOREKSI / PENILAIAN
// ================================================
function simpanKoreksi(payload) {
  try {
    const guru = getUserInfo();
    if (!guru) return { sukses: false, pesan: 'Akses ditolak' };

    if ([STATUS_SUBMISSION.DINILAI, STATUS_SUBMISSION.REVISI].indexOf(payload.status) === -1) {
      return { sukses: false, pesan: 'Status harus Dinilai atau Revisi' };
    }

    let nilaiAngka = '', nilaiHuruf = '';
    if (payload.status === STATUS_SUBMISSION.DINILAI) {
      if (payload.nilai === undefined || payload.nilai === null || payload.nilai === '') {
        return { sukses: false, pesan: 'Nilai wajib diisi bila status Dinilai' };
      }
      if (payload.tipeInput === 'huruf') {
        nilaiHuruf = String(payload.nilai).toUpperCase().trim();
        nilaiAngka = hurufKeAngka(nilaiHuruf);
        if (nilaiAngka === null) return { sukses: false, pesan: 'Nilai huruf "' + nilaiHuruf + '" tidak dikenal' };
      } else {
        nilaiAngka = parseFloat(payload.nilai);
        if (isNaN(nilaiAngka)) return { sukses: false, pesan: 'Nilai angka tidak valid' };
        nilaiHuruf = angkaKeHuruf(nilaiAngka);
      }
    }

    const raw = getSemuaSubmission().find(function (s) { return s.ID === payload.submissionId; });
    if (!raw) return { sukses: false, pesan: 'Submission tidak ditemukan' };

    updateBarisObjek(_ssRekap(), CONFIG.SHEET.SUBMISSION, raw.__row, {
      Status: payload.status,
      NilaiAngka: nilaiAngka,
      NilaiHuruf: nilaiHuruf,
      Catatan: payload.catatan || '',
      WaktuDinilai: new Date(),
      DinilaiOleh: guru.nama
    });

    const t = getTugasById(raw.TugasID);
    const judul = t ? t.Judul : 'tugas';
    if (payload.status === STATUS_SUBMISSION.DINILAI) {
      kirimNotifikasiKeSiswa(raw.NIS, 'penilaian',
        'Nilai "' + judul + '": ' + nilaiHuruf + ' (' + nilaiAngka + ')' +
        (payload.catatan ? ' — ada catatan' : ''), raw.TugasID);
    } else {
      kirimNotifikasiKeSiswa(raw.NIS, 'revisi',
        'Tugas "' + judul + '" perlu direvisi' + (payload.catatan ? ': ' + payload.catatan : ''), raw.TugasID);
    }

    return { sukses: true, pesan: 'Koreksi disimpan', submission: normalisasiSubmission(getSemuaSubmission().find(function (s) { return s.ID === payload.submissionId; })) };
  } catch (e) {
    Logger.log('simpanKoreksi error: ' + e.stack);
    return { sukses: false, pesan: e.message };
  }
}

// Simpan banyak nilai sekaligus (mode koreksi cepat di tabel rekap)
function simpanKoreksiBanyak(daftar) {
  const hasil = (daftar || []).map(function (p) { return { id: p.submissionId, res: simpanKoreksi(p) }; });
  return { sukses: hasil.every(function (h) { return h.res.sukses; }), detail: hasil };
}

// ================================================
// PEMANTAUAN
// ================================================
function getPemantauan(kelas) {
  const guru = getUserInfo();
  if (!guru) return null;

  const tugasKelas = getSemuaTugas().filter(function (t) {
    return String(t.GuruPembuat) === String(guru.nip) && t.Kelas === kelas;
  });
  const sub = getSemuaSubmission();
  const siswaKelas = getDataSiswaByKelas(kelas);

  const rekapSiswa = siswaKelas.map(function (s) {
    const items = tugasKelas.map(function (t) {
      const raw = sub.find(function (x) { return x.TugasID === t.ID && String(x.NIS) === String(s.nis); });
      return { tugas: { deadline: toIso(t.Deadline) }, submission: normalisasiSubmission(raw) };
    });
    const g = hitungGamifikasi(items);
    return {
      nis: String(s.nis), nama: s.nama,
      totalTugas: tugasKelas.length,
      terkumpul: g.terkumpul,
      belumSubmit: g.belumUpload,
      dinilai: g.dinilai,
      belumDinilai: items.filter(function (it) {
        return it.submission && it.submission.status === STATUS_SUBMISSION.MENUNGGU;
      }).length,
      rasioTepatWaktu: g.rasioTepatWaktu,
      rataNilai: g.rataNilai,
      xp: g.xp, level: g.level, streak: g.streak
    };
  });

  const byNilai = rekapSiswa.filter(function (s) { return s.rataNilai !== null; });
  const skorRajin = function (s) { return s.terkumpul * 2 + s.rasioTepatWaktu / 10 + s.streak; };

  return {
    kelas: kelas,
    totalTugas: tugasKelas.length,
    siswa: rekapSiswa.sort(function (a, b) { return b.xp - a.xp; }),
    belumSubmit: rekapSiswa.filter(function (s) { return s.belumSubmit > 0; })
      .sort(function (a, b) { return b.belumSubmit - a.belumSubmit; }),
    perluDinilai: rekapSiswa.filter(function (s) { return s.belumDinilai > 0; })
      .sort(function (a, b) { return b.belumDinilai - a.belumDinilai; }),
    palingRajin: rekapSiswa.slice().sort(function (a, b) { return skorRajin(b) - skorRajin(a); }).slice(0, 5),
    palingMalas: rekapSiswa.slice().sort(function (a, b) { return skorRajin(a) - skorRajin(b); }).slice(0, 5),
    nilaiTertinggi: byNilai.slice().sort(function (a, b) { return b.rataNilai - a.rataNilai; }).slice(0, 5),
    nilaiTerendah: byNilai.slice().sort(function (a, b) { return a.rataNilai - b.rataNilai; }).slice(0, 5)
  };
}
