// Gamifikasi.js - Perhitungan XP, level, streak, lencana.
// Fungsi murni: input daftar item {tugas, submission}, output angka gamifikasi.
// Dipakai Tugassiswa.js (dashboard) & Tugasguru.js (pemantauan).

function _statusTerkumpul(s) { return s && s.status && s.status !== 'Belum Upload'; }

// items: [{ tugas: {deadline, tglDibuat, ...}, submission: normalisasiSubmission() | null }]
function hitungGamifikasi(items) {
  let xp = 0;
  let terkumpul = 0, dinilai = 0, tepatWaktu = 0, revisi = 0, kilat = 0, adaVideo = false, nilai100 = false;
  const nilaiAngka = [];

  items.forEach(function (it) {
    const s = it.submission;
    if (!_statusTerkumpul(s)) return;
    terkumpul++;
    xp += CONFIG.XP.UPLOAD;

    const wu = s.waktuUpload ? new Date(s.waktuUpload) : null;
    if (wu && it.tugas.deadline && wu <= new Date(it.tugas.deadline)) { tepatWaktu++; xp += CONFIG.XP.TEPAT_WAKTU; }
    if (wu && it.tugas.tglDibuat && (wu - new Date(it.tugas.tglDibuat)) <= 24 * 3600 * 1000) kilat++;
    if (s.status === STATUS_SUBMISSION.REVISI) revisi++;
    (s.lampiran || []).forEach(function (l) { if (/^video\//i.test(l.mime || '')) adaVideo = true; });

    if (s.status === STATUS_SUBMISSION.DINILAI) {
      dinilai++;
      xp += CONFIG.XP.DINILAI;
      if (s.nilaiAngka !== null && !isNaN(s.nilaiAngka)) {
        xp += Math.round(s.nilaiAngka * CONFIG.XP.PER_POIN_NILAI);
        nilaiAngka.push(s.nilaiAngka);
        if (s.nilaiAngka >= 100) nilai100 = true;
      }
    }
  });

  const rataNilai = nilaiAngka.length
    ? Math.round((nilaiAngka.reduce(function (a, b) { return a + b; }, 0) / nilaiAngka.length) * 100) / 100
    : null;

  const perLevel = CONFIG.XP.PER_LEVEL;
  const level = Math.floor(xp / perLevel) + 1;
  const xpDiLevel = xp - (level - 1) * perLevel;
  const streak = hitungStreak(items);

  const stats = {
    totalTugas: items.length, terkumpul: terkumpul, belumUpload: items.length - terkumpul,
    dinilai: dinilai, revisi: revisi, tepatWaktu: tepatWaktu, kilat: kilat,
    streak: streak, rataNilai: rataNilai, adaVideo: adaVideo, nilai100: nilai100, xp: xp
  };

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
    streak: streak,
    badge: hitungBadge(stats)
  };
}

// Streak = jumlah tugas berdeadline (yang sudah lewat) berturut-turut, dari terbaru
// ke belakang, yang dikumpulkan tepat waktu.
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

// ------------------------------------------------
// LENCANA - daftar di kode, banyak kategori supaya tiap siswa punya peluang.
// Tiap lencana: id, nama, ikon, syarat (teks), tingkat (1-4 untuk warna), cek(stats)
// ------------------------------------------------
function daftarLencana() {
  return [
    { id: 'mulai',    nama: 'Langkah Pertama', ikon: '🌱', tingkat: 1, syarat: 'Kumpulkan 1 tugas',
      cek: function (s) { return s.terkumpul >= 1; } },
    { id: 'rajin',    nama: 'Rajin',           ikon: '🔥', tingkat: 2, syarat: 'Kumpulkan 5 tugas',
      cek: function (s) { return s.terkumpul >= 5; } },
    { id: 'tekun',    nama: 'Tekun',           ikon: '📚', tingkat: 3, syarat: 'Kumpulkan 10 tugas',
      cek: function (s) { return s.terkumpul >= 10; } },
    { id: 'maraton',  nama: 'Pelari Maraton',  ikon: '🏃', tingkat: 4, syarat: 'Kumpulkan 20 tugas',
      cek: function (s) { return s.terkumpul >= 20; } },

    { id: 'tuntas',   nama: 'Tuntas',          ikon: '✅', tingkat: 3, syarat: 'Tidak ada tugas tertinggal (min. 3 tugas)',
      cek: function (s) { return s.totalTugas >= 3 && s.belumUpload === 0; } },
    { id: 'tepatwaktu', nama: 'Tepat Waktu',   ikon: '⏰', tingkat: 2, syarat: '3 tugas dikumpulkan sebelum deadline',
      cek: function (s) { return s.tepatWaktu >= 3; } },
    { id: 'disiplin', nama: 'Disiplin',        ikon: '🎯', tingkat: 4, syarat: 'Semua tugas dikumpulkan tepat waktu (min. 5)',
      cek: function (s) { return s.terkumpul >= 5 && s.tepatWaktu === s.terkumpul; } },
    { id: 'kilat',    nama: 'Si Kilat',        ikon: '⚡', tingkat: 3, syarat: '3 tugas dikumpulkan < 24 jam setelah dibuat',
      cek: function (s) { return s.kilat >= 3; } },

    { id: 'konsisten', nama: 'Konsisten',      ikon: '🔗', tingkat: 2, syarat: 'Streak 3 tugas berturut-turut',
      cek: function (s) { return s.streak >= 3; } },
    { id: 'takterhentikan', nama: 'Tak Terhentikan', ikon: '🚀', tingkat: 4, syarat: 'Streak 7 tugas berturut-turut',
      cek: function (s) { return s.streak >= 7; } },

    { id: 'bintang',  nama: 'Bintang',         ikon: '⭐', tingkat: 3, syarat: 'Rata-rata nilai ≥ 85',
      cek: function (s) { return s.rataNilai !== null && s.rataNilai >= 85; } },
    { id: 'juara',    nama: 'Juara Kelas',     ikon: '🏆', tingkat: 4, syarat: 'Rata-rata nilai ≥ 90',
      cek: function (s) { return s.rataNilai !== null && s.rataNilai >= 90; } },
    { id: 'sempurna', nama: 'Nilai Sempurna',  ikon: '💯', tingkat: 4, syarat: 'Pernah dapat nilai 100',
      cek: function (s) { return s.nilai100; } },
    { id: 'naik',     nama: 'Terus Berkembang', ikon: '📈', tingkat: 2, syarat: 'Punya nilai & rata-rata ≥ 70',
      cek: function (s) { return s.rataNilai !== null && s.rataNilai >= 70; } },

    { id: 'pejuang',  nama: 'Pejuang Revisi',  ikon: '🛡️', tingkat: 2, syarat: 'Menyelesaikan tugas revisi',
      cek: function (s) { return s.revisi >= 1 && s.dinilai >= 1; } },
    { id: 'kreator',  nama: 'Kreator',         ikon: '🎬', tingkat: 3, syarat: 'Mengunggah video tugas',
      cek: function (s) { return s.adaVideo; } },
    { id: 'kolektor', nama: 'Kolektor XP',     ikon: '💎', tingkat: 4, syarat: 'Kumpulkan 300 XP',
      cek: function (s) { return s.xp >= 300; } }
  ];
}

function hitungBadge(stats) {
  return daftarLencana().map(function (b) {
    return { id: b.id, nama: b.nama, ikon: b.ikon, tingkat: b.tingkat, syarat: b.syarat, dapat: !!b.cek(stats) };
  });
}
