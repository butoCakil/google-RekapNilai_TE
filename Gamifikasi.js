// Gamifikasi.js - Perhitungan XP, level, streak, badge.
// Fungsi murni: input daftar tugas + submission siswa, output angka gamifikasi.
// Dipakai oleh Tugassiswa.js (dashboard) dan Tugasguru.js (pemantauan).

function _statusDinilai(s) { return s && s.status === STATUS_SUBMISSION.DINILAI; }
function _statusTerkumpul(s) { return s && s.status && s.status !== 'Belum Upload'; }

// items: [{ tugas: {deadline,...}, submission: normalisasiSubmission() | null }]
function hitungGamifikasi(items) {
  let xp = 0;
  let terkumpul = 0, dinilai = 0, tepatWaktu = 0, revisi = 0;
  const nilaiAngka = [];

  items.forEach(function (it) {
    const s = it.submission;
    if (!_statusTerkumpul(s)) return;
    terkumpul++;
    xp += CONFIG.XP.UPLOAD;

    if (s.waktuUpload && it.tugas.deadline &&
        new Date(s.waktuUpload) <= new Date(it.tugas.deadline)) {
      tepatWaktu++;
      xp += CONFIG.XP.TEPAT_WAKTU;
    }
    if (s.status === STATUS_SUBMISSION.REVISI) revisi++;
    if (_statusDinilai(s)) {
      dinilai++;
      xp += CONFIG.XP.DINILAI;
      if (s.nilaiAngka !== null && !isNaN(s.nilaiAngka)) {
        xp += Math.round(s.nilaiAngka * CONFIG.XP.PER_POIN_NILAI);
        nilaiAngka.push(s.nilaiAngka);
      }
    }
  });

  const rataNilai = nilaiAngka.length
    ? Math.round((nilaiAngka.reduce(function (a, b) { return a + b; }, 0) / nilaiAngka.length) * 100) / 100
    : null;

  const perLevel = CONFIG.XP.PER_LEVEL;
  const level = Math.floor(xp / perLevel) + 1;
  const xpDiLevel = xp - (level - 1) * perLevel;

  return {
    xp: xp,
    level: level,
    xpDiLevel: xpDiLevel,
    xpUntukNaik: perLevel,
    progresLevel: Math.round((xpDiLevel / perLevel) * 100),
    totalTugas: items.length,
    terkumpul: terkumpul,
    belumUpload: items.length - terkumpul,
    dinilai: dinilai,
    revisi: revisi,
    tepatWaktu: tepatWaktu,
    rasioTepatWaktu: items.length ? Math.round((tepatWaktu / items.length) * 100) : 0,
    rataNilai: rataNilai,
    streak: hitungStreak(items),
    badge: hitungBadge(terkumpul, rataNilai)
  };
}

// Streak = jumlah tugas berturut-turut (dari terlama ke terbaru berdasar deadline)
// yang dikumpulkan tepat waktu, dihitung mundur dari tugas berdeadline terakhir yang sudah lewat.
function hitungStreak(items) {
  const lewat = items
    .filter(function (it) { return it.tugas.deadline && new Date(it.tugas.deadline) <= new Date(); })
    .sort(function (a, b) { return new Date(b.tugas.deadline) - new Date(a.tugas.deadline); });

  let streak = 0;
  for (let i = 0; i < lewat.length; i++) {
    const s = lewat[i].submission;
    if (s && s.waktuUpload && new Date(s.waktuUpload) <= new Date(lewat[i].tugas.deadline)) streak++;
    else break;
  }
  return streak;
}

function getDaftarBadge() {
  const data = bacaSheet(_ssMaster(), CONFIG.SHEET.CONFIG);
  const badge = [];
  data.forEach(function (r) {
    if (r.Key !== 'GAMIFIKASI_BADGE') return;
    const p = String(r.Value).split('|');
    badge.push({ id: p[0], nama: p[1], minTerkumpul: parseInt(p[2], 10) || 0 });
  });
  if (!badge.length) {
    return [
      { id: 'starter', nama: 'Upload Pertama', minTerkumpul: 1 },
      { id: 'rajin',   nama: 'Rajin',          minTerkumpul: 5 },
      { id: 'tekun',   nama: 'Tekun',          minTerkumpul: 10 }
    ];
  }
  return badge;
}

function hitungBadge(terkumpul, rataNilai) {
  const semua = getDaftarBadge();
  return semua.map(function (b) {
    let dapat = terkumpul >= b.minTerkumpul;
    if (b.id === 'juara') dapat = rataNilai !== null && rataNilai >= 90;
    return { id: b.id, nama: b.nama, dapat: dapat, syarat: b.minTerkumpul };
  });
}
