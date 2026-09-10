// Kode.gs - Router utama Web App

// ================================================
// KONFIGURASI UTAMA
// ================================================

const CONFIG = {
  MASTER_SPREADSHEET_ID: '1WN6ehDWsFHj3eYUJ3FbDVxbRSURbGpmoVksFwkHeCFA',
  REKAP_SPREADSHEET_ID:  '157LNNLUgZ6ZRxZS6EHaMvD4TuuOorwLo8KGZsrTQmzE',

  SHEET: {
    SISWA       : 'Siswa',
    GURU        : 'Guru',
    CONFIG      : 'Config',
    MASTER_MAPEL: 'Master_Mapel',
    TUGAS       : 'Tugas',
    SUBMISSION  : 'Submission',
    NOTIFIKASI  : 'Notifikasi',
    NILAI: {
      PRE  : 'Nilai_PRE',
      PMM  : 'Nilai_PMM',
      PISAV: 'Nilai_PISAV',
      PISS : 'Nilai_PISS',
      PSRT : 'Nilai_PSRT',
      P4E  : 'Nilai_P4E',
    }
  },

  KELAS: [
    'XI TE 1', 'XI TE 2', 'XI TE 3', 'XI TE 4',
    'XII TE 1','XII TE 2','XII TE 3','XII TE 4'
  ],

  MAPEL: [
    { kode: 'P4E',   nama: 'Perakitan, Perawatan, Perbaikan Peralatan Elektronika' },
    { kode: 'PRE',   nama: 'Perencanaan Rangkaian Elektronika' },
    { kode: 'PMM',   nama: 'Pemrograman Mikroprosesor dan Mikrokontroler' },
    { kode: 'PISAV', nama: 'Penerapan Instalasi Sistem Audio Video' },
    { kode: 'PISS',  nama: 'Penerapan Instalasi Sound System' },
    { kode: 'PSRT',  nama: 'Penerapan Sistem Radio dan TV' },
  ],

  // Nama folder Drive akar untuk semua file tugas siswa (milik akun deployer / guru)
  FOLDER_ROOT_TUGAS: 'RekapNilai_TE - Tugas Siswa',

  // Aturan gamifikasi - dipakai Gamifikasi.js
  XP: {
    UPLOAD        : 10,   // XP saat berhasil upload
    TEPAT_WAKTU   : 15,   // bonus kalau upload sebelum deadline
    DINILAI       : 5,    // XP saat tugas dinilai
    PER_POIN_NILAI: 1,    // XP tambahan = nilaiAngka * faktor ini
    PER_LEVEL     : 150,  // XP yang dibutuhkan untuk naik 1 level
  }
};

// ================================================
// ROUTER
// ================================================

function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) || 'index';

  switch (page) {

    // ---------- APLIKASI TUGAS: GURU ----------
    case 'guru': {
      const guru = getUserInfo();
      if (!guru) return renderTolakGuru();
      const t = HtmlService.createTemplateFromFile('GuruApp');
      t.scriptUrl = getScriptUrl();
      t.guruJson  = JSON.stringify(guru);
      return t.evaluate()
        .setTitle('Dashboard Guru - Tugas TE')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    // ---------- APLIKASI TUGAS: SISWA (SPA) ----------
    case 'tugas':
    case 'dashboardTugas':
    case 'detailTugas':
    case 'notifikasiTugas': {
      const token = (e.parameter.token || '').trim();
      const nis = getNisDariToken(token);
      if (!nis) return redirectTo('loginTugas');
      const siswa = getSiswaByNis(nis);
      if (!siswa) return redirectTo('loginTugas');

      const t = HtmlService.createTemplateFromFile('SiswaApp');
      t.scriptUrl = getScriptUrl();
      t.token     = token;
      t.siswaJson = JSON.stringify(siswa);
      // Rute lama -> arahkan ke view SPA yang sesuai
      const viewAwal = page === 'detailTugas'
          ? ('detail/' + (e.parameter.id || ''))
        : page === 'notifikasiTugas'
          ? 'notifikasi'
          : 'journey';
      t.viewAwal = viewAwal;
      return t.evaluate()
        .setTitle('Portal Tugas - ' + siswa.nama)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    case 'loginTugas': {
      const t = HtmlService.createTemplateFromFile('LoginSiswaTugas');
      t.scriptUrl = getScriptUrl();
      return t.evaluate()
        .setTitle('Login Tugas Siswa - TE')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }

    case 'keluar': {
      if (e.parameter.token) logoutSiswaTugas(e.parameter.token);
      const t = HtmlService.createTemplateFromFile('Keluar');
      t.scriptUrl = getScriptUrl();
      return t.evaluate()
        .setTitle('Keluar - RekapNilai TE')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }

    // ---------- LEGACY: REKAP NILAI ----------
    case 'dashboard': {
      if (!getCurrentUser()) return redirectTo('index');
      return HtmlService.createTemplateFromFile('Dashboard')
        .evaluate()
        .setTitle('Dashboard Guru - RekapNilai TE')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }

    case 'siswa': {
      const t = HtmlService.createTemplateFromFile('Siswa');
      t.nis = e.parameter.nis || '';
      return t.evaluate()
        .setTitle('Portal Nilai Siswa - TE')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }

    default:
      return HtmlService.createTemplateFromFile('Index')
        .evaluate()
        .setTitle('RekapNilai TE - Portal')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
}

function renderTolakGuru() {
  const url = getScriptUrl();
  return HtmlService.createHtmlOutput(
    '<div style="font-family:system-ui,sans-serif;max-width:420px;margin:60px auto;padding:32px;' +
    'border:1px solid #e5e7eb;border-radius:16px;text-align:center">' +
    '<div style="font-size:40px">&#128274;</div>' +
    '<h2 style="margin:12px 0 6px">Akses ditolak</h2>' +
    '<p style="color:#6b7280;font-size:14px">Akun Google Anda belum terdaftar sebagai guru di sheet ' +
    '<b>Guru</b>. Pastikan Anda membuka tautan ini dengan akun yang benar.</p>' +
    '<a href="' + url + '" style="display:inline-block;margin-top:14px;padding:10px 18px;background:#4f46e5;' +
    'color:#fff;border-radius:10px;text-decoration:none;font-size:14px">Kembali</a></div>'
  ).addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function redirectTo(page) {
  const url = getScriptUrl() + '?page=' + page;
  return HtmlService.createHtmlOutput(
    '<script>top.location.href="' + url + '";</script>' +
    '<noscript><a href="' + url + '">Lanjut</a></noscript>'
  );
}

function getCurrentUser() {
  try {
    const email = Session.getActiveUser().getEmail();
    return email || null;
  } catch (e) {
    return null;
  }
}

function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

// Sertakan file HTML lain sebagai include (dipakai di template: <?!= include('AppCSS') ?>)
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
