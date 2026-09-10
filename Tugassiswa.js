// Tugassiswa.js - Logic sisi siswa: dashboard journey, detail tugas, linimasa nilai.
// Semua fungsi publik memakai token sesi (bukan NIS mentah) untuk keamanan.

function _siswaDariToken(token) {
  const nis = getNisDariToken(token);
  if (!nis) return null;
  return getSiswaByNis(nis);
}

// Bangun daftar item {tugas, submission} untuk kelas siswa
function _itemTugasSiswa(siswa) {
  const sub = getSemuaSubmission();
  return getSemuaTugas()
    .filter(function (t) {
      return t.Kelas === siswa.kelas && (t.Status || STATUS_TUGAS.AKTIF) !== STATUS_TUGAS.ARSIP;
    })
    .map(function (t) {
      const raw = sub.find(function (x) {
        return x.TugasID === t.ID && String(x.NIS) === String(siswa.nis);
      });
      return {
        tugas: {
          id: t.ID, judul: t.Judul, deskripsi: t.Deskripsi, kelas: t.Kelas,
          deadline: toIso(t.Deadline), tglDibuat: toIso(t.TglDibuat),
          jenisPenilaian: t.JenisPenilaian, lampiranUrl: t.LampiranMateriURL
        },
        submission: normalisasiSubmission(raw)
      };
    });
}

function _statusRoadmap(it) {
  const s = it.submission;
  if (!s) {
    const telat = it.tugas.deadline && new Date(it.tugas.deadline) < new Date();
    return telat ? 'terlambat' : 'belum';
  }
  if (s.status === STATUS_SUBMISSION.DINILAI) return 'dinilai';
  if (s.status === STATUS_SUBMISSION.REVISI) return 'revisi';
  return 'menunggu';
}

function _kartuTugas(it) {
  const s = it.submission;
  return {
    tugasId: it.tugas.id,
    judul: it.tugas.judul,
    deskripsi: it.tugas.deskripsi,
    deadline: it.tugas.deadline,
    tglDibuat: it.tugas.tglDibuat,
    jenisPenilaian: it.tugas.jenisPenilaian,
    adaLampiranMateri: !!it.tugas.lampiranUrl,
    statusRoadmap: _statusRoadmap(it),
    sudahUpload: !!s,
    status: s ? s.status : 'Belum Upload',
    nilaiAngka: s ? s.nilaiAngka : null,
    nilaiHuruf: s ? s.nilaiHuruf : null,
    catatan: s ? s.catatan : '',
    waktuUpload: s ? s.waktuUpload : null,
    jumlahLampiran: s ? s.lampiran.length : 0
  };
}

// ================================================
// DASHBOARD JOURNEY
// ================================================
function getDashboardSiswa(token) {
  const siswa = _siswaDariToken(token);
  if (!siswa) return { ok: false, pesan: 'Sesi kedaluwarsa' };

  const items = _itemTugasSiswa(siswa);
  const g = hitungGamifikasi(items);

  // roadmap = urut kronologis (dibuat), untuk peta perjalanan
  const roadmap = items.slice()
    .sort(function (a, b) { return new Date(a.tugas.tglDibuat) - new Date(b.tugas.tglDibuat); })
    .map(_kartuTugas);

  // "harus dikerjakan" = belum upload / revisi, deadline terdekat dulu
  const perluDikerjakan = items
    .filter(function (it) { return _statusRoadmap(it) === 'belum' || _statusRoadmap(it) === 'terlambat' || _statusRoadmap(it) === 'revisi'; })
    .sort(function (a, b) { return new Date(a.tugas.deadline) - new Date(b.tugas.deadline); })
    .map(_kartuTugas);

  return {
    ok: true,
    siswa: siswa,
    gamifikasi: g,
    roadmap: roadmap,
    perluDikerjakan: perluDikerjakan,
    notifikasiBelum: getJumlahNotifikasiBelumDibaca(siswa.nis),
    aktivitasTerbaru: getAktivitasSiswa(siswa.nis, 5)
  };
}

// ================================================
// DETAIL TUGAS
// ================================================
function getDetailTugasSiswa(token, tugasId) {
  const siswa = _siswaDariToken(token);
  if (!siswa) return { ok: false, pesan: 'Sesi kedaluwarsa' };

  const t = getTugasById(tugasId);
  if (!t || t.Kelas !== siswa.kelas) return { ok: false, pesan: 'Tugas tidak ditemukan' };

  const raw = getSubmission(tugasId, siswa.nis);
  const s = normalisasiSubmission(raw);

  let lampiranMateri = null;
  if (t.LampiranMateriURL) {
    const m = String(t.LampiranMateriURL).match(/[-\w]{25,}/);
    lampiranMateri = { url: t.LampiranMateriURL, fileId: m ? m[0] : null };
  }

  return {
    ok: true,
    siswa: siswa,
    tugas: {
      id: t.ID, judul: t.Judul, deskripsi: t.Deskripsi, kelas: t.Kelas,
      deadline: toIso(t.Deadline), tglDibuat: toIso(t.TglDibuat),
      jenisPenilaian: t.JenisPenilaian, lampiranMateri: lampiranMateri,
      lewatDeadline: t.Deadline && new Date(t.Deadline) < new Date()
    },
    submission: s,
    statusRoadmap: _statusRoadmap({ tugas: { deadline: toIso(t.Deadline) }, submission: s })
  };
}

// ================================================
// LINIMASA / REKAP NILAI SISWA
// ================================================
function getLinimasaSiswa(token) {
  const siswa = _siswaDariToken(token);
  if (!siswa) return { ok: false, pesan: 'Sesi kedaluwarsa' };

  const items = _itemTugasSiswa(siswa);
  const g = hitungGamifikasi(items);

  const titik = items.slice()
    .sort(function (a, b) { return new Date(a.tugas.deadline) - new Date(b.tugas.deadline); })
    .map(function (it) {
      const s = it.submission;
      return {
        tugasId: it.tugas.id,
        judul: it.tugas.judul,
        deadline: it.tugas.deadline,
        status: _statusRoadmap(it),
        dinilai: !!(s && s.status === STATUS_SUBMISSION.DINILAI),
        nilaiAngka: s ? s.nilaiAngka : null,
        nilaiHuruf: s ? s.nilaiHuruf : null,
        catatan: s ? s.catatan : ''
      };
    });

  const dinilai = titik.filter(function (t) { return t.dinilai && t.nilaiAngka !== null; });
  return {
    ok: true,
    siswa: siswa,
    gamifikasi: g,
    titik: titik,
    ringkas: {
      rataNilai: g.rataNilai,
      nilaiHurufRata: g.rataNilai !== null ? angkaKeHuruf(g.rataNilai) : null,
      tertinggi: dinilai.length ? Math.max.apply(null, dinilai.map(function (t) { return t.nilaiAngka; })) : null,
      terendah: dinilai.length ? Math.min.apply(null, dinilai.map(function (t) { return t.nilaiAngka; })) : null,
      jumlahDinilai: dinilai.length
    }
  };
}

// ================================================
// NOTIFIKASI (proxy aman lewat token)
// ================================================
function getNotifikasiSiswaToken(token) {
  const siswa = _siswaDariToken(token);
  if (!siswa) return { ok: false, pesan: 'Sesi kedaluwarsa' };
  return { ok: true, aktivitas: getAktivitasSiswa(siswa.nis, 50) };
}

function tandaiSemuaDibacaToken(token) {
  const siswa = _siswaDariToken(token);
  if (!siswa) return { ok: false };
  return tandaiSemuaNotifikasiDibaca(siswa.nis);
}

// ================================================
// NILAI RAPOR (modul lama) - dibungkus token untuk dipakai di dalam SPA siswa
// ================================================
function getNilaiRaporSiswaToken(token) {
  const siswa = _siswaDariToken(token);
  if (!siswa) return { ok: false, pesan: 'Sesi kedaluwarsa' };
  return { ok: true, siswa: siswa, nilai: getNilaiByNis(siswa.nis) };
}
