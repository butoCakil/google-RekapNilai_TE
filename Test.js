// Test.js - Fungsi bantu uji manual (jalankan dari editor Apps Script).
// Tidak dipanggil oleh web app.

// Cek kesehatan + tampilkan ringkasan isi data.
function tesRingkas() {
  const hc = healthCheck();
  Logger.log(hc.laporan);
  Logger.log('--- Daftar tugas guru (' + (getCurrentUser() || 'tak dikenal') + ') ---');
  Logger.log(JSON.stringify(getDaftarTugasGuru(), null, 2));
}

// Buat tugas contoh untuk kelas pertama yang ada siswanya, lalu hapus lagi.
function tesSiklusTugas() {
  const kelas = CONFIG.KELAS.find(function (k) { return getDataSiswaByKelas(k).length > 0; });
  if (!kelas) { Logger.log('Tidak ada kelas berisi siswa. Cek sheet Siswa.'); return; }

  const buat = buatTugas({
    judul: '[UJI] Rangkaian Seri-Paralel',
    deskripsi: 'Tugas uji coba - aman dihapus.',
    kelas: kelas,
    deadline: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 16),
    jenisPenilaian: 'huruf'
  });
  Logger.log('buatTugas: ' + JSON.stringify(buat));
  if (!buat.sukses) return;

  Logger.log('getRekapTugas: ' + JSON.stringify(getRekapTugas(buat.id)).slice(0, 800));
  Logger.log('getPemantauan: ' + JSON.stringify(getPemantauan(kelas)).slice(0, 800));

  const hapus = hapusTugas(buat.id);
  Logger.log('hapusTugas: ' + JSON.stringify(hapus));
}

// Uji dashboard siswa: butuh satu NIS valid + password sudah diset di Config.
function tesDashboardSiswa() {
  const contohNis = (function () {
    for (var k = 0; k < CONFIG.KELAS.length; k++) {
      var s = getDataSiswaByKelas(CONFIG.KELAS[k]);
      if (s.length) return s[0].nis;
    }
    return null;
  })();
  if (!contohNis) { Logger.log('Tidak ada siswa.'); return; }

  const login = loginSiswaTugas(contohNis, getPasswordSiswa());
  Logger.log('login (' + contohNis + '): ' + JSON.stringify(login));
  if (!login.sukses) return;

  Logger.log('getDashboardSiswa: ' + JSON.stringify(getDashboardSiswa(login.token)).slice(0, 1200));
  Logger.log('getLinimasaSiswa: ' + JSON.stringify(getLinimasaSiswa(login.token)).slice(0, 800));
}
