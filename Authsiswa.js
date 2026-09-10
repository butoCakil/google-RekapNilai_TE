// AuthSiswa.js - Autentikasi Siswa (NIS + password bersama)
//
// Catatan: pola ini mengikuti gaya portal Siswa yang sudah ada (NIS dibawa lewat
// parameter URL, tanpa session server sungguhan) - konsisten dengan yang sudah
// berjalan, bukan pengaman tingkat tinggi. Password hanya dicek sekali saat login.

function loginSiswaTugas(nis, password) {
  try {
    const siswa = getSiswaByNis(nis); // reuse dari Master.js
    if (!siswa) return { sukses: false, pesan: 'NIS tidak ditemukan' };

    const passwordBenar = getPasswordSiswa(); // dari KonversiNilai.js
    if (passwordBenar === null) {
      return { sukses: false, pesan: 'Password siswa belum diatur di sheet Config' };
    }
    if (String(password) !== String(passwordBenar)) {
      return { sukses: false, pesan: 'Password salah' };
    }

    // Token sesi sederhana (6 jam) - supaya NIS tidak mentah-mentah di URL
    const token = Utilities.getUuid();
    CacheService.getScriptCache().put('sesi_' + token, String(nis), 21600);

    return { sukses: true, siswa: siswa, token: token };

  } catch (e) {
    Logger.log('loginSiswaTugas error: ' + e.message);
    return { sukses: false, pesan: e.message };
  }
}

function getNisDariToken(token) {
  const nis = CacheService.getScriptCache().get('sesi_' + token);
  return nis || null;
}

// Batalkan token sesi -> tautan lama (?page=tugas&token=...) tidak bisa dipakai lagi.
function logoutSiswaTugas(token) {
  try {
    if (token) CacheService.getScriptCache().remove('sesi_' + token);
  } catch (e) {}
  return true;
}